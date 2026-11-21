// Гонка: все в комнате угадывают одного героя, кто быстрее — тот выше.
// Комната Activity = экземпляр Activity в голосовом канале (instanceId), на сайте — комната по коду.
import { kv } from "./kv";
import { HERO_BY_ID, Mode, RACE_POINTS, answerOf, randomHero } from "./game";
import { GameError, Progress, applyGuess, viewPuzzle } from "./daily";
import { addPoints, statRace } from "./scores";
import { publicUsers } from "./users";

const TTL = 60 * 60 * 12;
const ONLINE_MS = 20_000;
const COUNTDOWN_MS = 4_000;
const DURATION: Record<Mode, number> = { c: 180_000, p: 120_000 };

type Meta = { created: number; lid: string | null; n: number };
type Standing = { uid: string; attempts: number; done: "win" | "fail" | null; ms: number | null; place: number | null; pts: number };
type Round = {
  n: number; mode: Mode; hero: number; startsAt: number; endsAt: number; status: "live" | "done";
  standings?: Standing[]; by: string;
};
type RP = Progress & { at?: number };

export const validRoom = (rid: string) => /^[iw][A-Za-z0-9_-]{4,90}$/.test(rid);
const K = (rid: string) => ({
  meta: `room:${rid}:meta`, pl: `room:${rid}:pl`, round: `room:${rid}:round`,
  prog: (n: number) => `room:${rid}:p:${n}`, fin: (n: number) => `room:${rid}:fin:${n}`,
});

export async function joinRoom(rid: string, uid: string, lid: string | null) {
  if (!validRoom(rid)) throw new GameError("Неверная комната");
  const k = K(rid);
  await kv.set(k.meta, { created: Date.now(), lid, n: 0 } satisfies Meta, { nx: true, ex: TTL });
  await kv.hset(k.pl, uid, { seen: Date.now() });
  await kv.expire(k.pl, TTL);
  return roomState(rid, uid);
}

export async function startRound(rid: string, uid: string, mode: Mode) {
  const k = K(rid);
  const [meta, cur] = await Promise.all([kv.get<Meta>(k.meta), kv.get<Round>(k.round)]);
  if (!meta) throw new GameError("Комната не найдена, зайди заново");
  if (cur && cur.status === "live" && Date.now() < cur.endsAt) throw new GameError("Раунд уже идёт");
  if (cur && cur.status === "live") await finalize(rid, cur, meta);
  const n = meta.n + 1;
  const now = Date.now();
  const round: Round = { n, mode, hero: randomHero(cur?.hero).id, startsAt: now + COUNTDOWN_MS,
    endsAt: now + COUNTDOWN_MS + DURATION[mode], status: "live", by: uid };
  await kv.set(k.meta, { ...meta, n }, { ex: TTL });
  await kv.set(k.round, round, { ex: TTL });
  return roomState(rid, uid);
}

export async function raceGuess(rid: string, uid: string, heroId: number) {
  const k = K(rid);
  const round = await kv.get<Round>(k.round);
  const now = Date.now();
  if (!round || round.status !== "live") throw new GameError("Раунд не идёт");
  if (now < round.startsAt) throw new GameError("Ещё не началось!");
  if (now > round.endsAt) throw new GameError("Время вышло");
  const pr = (await kv.hget<RP>(k.prog(round.n), uid)) ?? { ids: [] };
  if (pr.done) return roomState(rid, uid);
  const next: RP = applyGuess(round.mode, HERO_BY_ID.get(round.hero)!, pr, heroId);
  if (next.done) next.at = now;
  await kv.hset(k.prog(round.n), uid, next);
  await kv.expire(k.prog(round.n), TTL);
  return roomState(rid, uid);
}

export async function endRound(rid: string, uid: string) {
  const k = K(rid);
  const [meta, round] = await Promise.all([kv.get<Meta>(k.meta), kv.get<Round>(k.round)]);
  if (meta && round && round.status === "live") {
    if (round.by !== uid && Date.now() < round.endsAt) throw new GameError("Закончить раунд может тот, кто его начал");
    await finalize(rid, { ...round, endsAt: Math.min(round.endsAt, Date.now()) }, meta);
  }
  return roomState(rid, uid);
}

function buildStandings(round: Round, prog: Record<string, RP>, award: boolean): Standing[] {
  const rows: Standing[] = Object.entries(prog).map(([uid, p]) => ({
    uid, attempts: p.ids.length, done: p.done ?? null, ms: p.at ? p.at - round.startsAt : null, place: null, pts: 0,
  }));
  const winners = rows.filter((r) => r.done === "win").sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
  winners.forEach((r, i) => { r.place = i + 1; if (award) r.pts = RACE_POINTS[i] ?? 1; });
  const rest = rows.filter((r) => r.done !== "win").sort((a, b) => b.attempts - a.attempts);
  return [...winners, ...rest];
}

async function finalize(rid: string, round: Round, meta: Meta) {
  const k = K(rid);
  if (!(await kv.set(k.fin(round.n), 1, { nx: true, ex: TTL }))) return;
  const prog = await kv.hgetall<RP>(k.prog(round.n));
  const standings = buildStandings(round, prog, true);
  // очки начисляем, только если в раунде было хотя бы 2 игрока — чтобы нельзя было фармить в одиночку
  const multi = standings.length >= 2;
  if (!multi) standings.forEach((s) => (s.pts = 0));
  await Promise.all(standings.map(async (s) => {
    if (s.pts) await addPoints(s.uid, s.pts, "r");
    if (multi) await statRace(s.uid, s.place);
  }));
  await kv.set(k.round, { ...round, status: "done", standings } satisfies Round, { ex: TTL });
}

export async function roomState(rid: string, uid: string) {
  if (!validRoom(rid)) throw new GameError("Неверная комната");
  const k = K(rid);
  const [meta, round0, players] = await Promise.all([kv.get<Meta>(k.meta), kv.get<Round>(k.round), kv.hgetall<{ seen: number }>(k.pl)]);
  if (!meta) throw new GameError("Комната не найдена, зайди заново");
  const now = Date.now();
  // отмечаем присутствие (не чаще раза в 8 секунд, чтобы экономить запросы)
  if (!players[uid] || now - players[uid].seen > 8000) {
    players[uid] = { seen: now };
    await kv.hset(k.pl, uid, players[uid]);
  }
  let round = round0;
  let prog: Record<string, RP> = {};
  if (round) {
    prog = round.status === "live" ? await kv.hgetall<RP>(k.prog(round.n)) : {};
    if (round.status === "live") {
      const online = Object.entries(players).filter(([, p]) => now - p.seen < ONLINE_MS).map(([u]) => u);
      const allDone = online.length > 0 && online.every((u) => prog[u]?.done);
      if (now > round.endsAt || (allDone && now > round.startsAt)) {
        await finalize(rid, round, meta);
        round = (await kv.get<Round>(k.round)) ?? round;
      }
    }
  }
  const uids = [...Object.keys(players), ...(round?.standings?.map((s) => s.uid) ?? [])];
  const users = await publicUsers(uids);
  const started = !!round && now >= round.startsAt;
  let me = null;
  if (round && started) {
    const myProg = round.status === "live" ? prog[uid] : null;
    const view = viewPuzzle(round.mode, HERO_BY_ID.get(round.hero)!, myProg ?? { ids: [] });
    me = round.status === "done" ? null : { ...view, answer: null };
  }
  const standings = round
    ? (round.status === "done" ? round.standings ?? [] : buildStandings(round, prog, false))
    : [];
  return {
    rid, now, lid: meta.lid,
    players: Object.entries(players).map(([u, p]) => ({ ...users[u], online: now - p.seen < ONLINE_MS }))
      .sort((a, b) => Number(b.online) - Number(a.online)),
    round: round && {
      n: round.n, mode: round.mode, status: round.status, startsAt: round.startsAt, endsAt: round.endsAt, by: round.by,
      me, standings: standings.map((s) => ({ ...s, user: users[s.uid] })),
      answer: round.status === "done" ? answerOf(HERO_BY_ID.get(round.hero)!) : null,
    },
  };
}

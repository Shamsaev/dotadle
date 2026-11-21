import { kv } from "./kv";
import {
  COLUMNS, FIRST_BONUS, HERO_BY_ID, Hero, Mode, PORTRAIT_TRIES, answerOf, classicPoints, compare, heroLite,
  heroOfDay, portraitPoints, randomHero, secondsToNextDay, today, validDay,
} from "./game";
import { portraitView } from "./portrait";
import { addPoints, statClassic, statPortrait } from "./scores";
import { bumpStreak, getStreak } from "./streak";
import { COLORS, avatarOf, notifyUserLeagues, siteUrl } from "./notify";
import { getProfile } from "./users";

export class GameError extends Error {}
const TTL = 60 * 60 * 24 * 45;

export type Progress = { ids: number[]; done?: "win" | "fail"; t?: number };
export type DayResult = { attempts: number; points: number; first: boolean; solved: boolean; t: number };

// Общая логика одной загадки (дневная, архивная, бесконечная)
export function viewPuzzle(mode: Mode, target: Hero, pr: Progress) {
  const done = !!pr.done;
  const base = {
    mode, attempts: pr.ids.length, solved: pr.done === "win", failed: pr.done === "fail",
    answer: done ? answerOf(target) : null,
  };
  if (mode === "c") {
    return { ...base, columns: COLUMNS, rows: pr.ids.map((id) => compare(HERO_BY_ID.get(id)!, target)) };
  }
  const wrong = pr.ids.filter((id) => id !== target.id);
  return {
    ...base, tries: PORTRAIT_TRIES, guesses: pr.ids.map((id) => ({ ...heroLite(HERO_BY_ID.get(id)!), ok: id === target.id })),
    ...portraitView(target, wrong.length, done),
  };
}

export function applyGuess(mode: Mode, target: Hero, pr: Progress, heroId: number): Progress {
  if (!HERO_BY_ID.has(heroId)) throw new GameError("Нет такого героя");
  if (pr.done) return pr;
  if (pr.ids.includes(heroId)) throw new GameError("Этого героя ты уже пробовал");
  const ids = [...pr.ids, heroId];
  if (heroId === target.id) return { ids, done: "win", t: Date.now() };
  if (mode === "p" && ids.length >= PORTRAIT_TRIES) return { ids, done: "fail", t: Date.now() };
  return { ids };
}

// ---------- Ежедневные ----------
const pk = (mode: Mode, day: string, uid: string) => `g:${mode}:${day}:${uid}`;

export async function dailyState(uid: string, mode: Mode) {
  const day = today();
  const target = heroOfDay(mode, day);
  const [pr, res] = await Promise.all([
    kv.get<Progress>(pk(mode, day, uid)),
    kv.hget<DayResult>(`r:${mode}:${day}`, uid),
  ]);
  const streak = await getStreak(uid);
  return { day, nextIn: secondsToNextDay(), points: res?.points ?? null, first: res?.first ?? false, streak: streak.current,
    ...viewPuzzle(mode, target, pr ?? { ids: [] }) };
}

export async function dailyGuess(uid: string, mode: Mode, heroId: number) {
  const day = today();
  const target = heroOfDay(mode, day);
  const key = pk(mode, day, uid);
  const pr = (await kv.get<Progress>(key)) ?? { ids: [] };
  if (pr.done) return dailyState(uid, mode);
  const next = applyGuess(mode, target, pr, heroId);
  await kv.set(key, next, { ex: TTL });
  if (pr.ids.length === 0) await kv.sadd(`tried:${mode}:${day}`, uid);
  if (next.done) {
    const n = next.ids.length;
    let points = 0, first = false;
    if (next.done === "win") {
      if (mode === "c") {
        first = await kv.set(`first:c:${day}`, uid, { nx: true, ex: TTL });
        points = classicPoints(n) + (first ? FIRST_BONUS : 0);
      } else points = portraitPoints(n);
    }
    await kv.hset(`r:${mode}:${day}`, uid, { attempts: n, points, first, solved: next.done === "win", t: Date.now() } satisfies DayResult);
    await kv.expire(`r:${mode}:${day}`, TTL);
    await addPoints(uid, points, mode, day);
    if (mode === "c") await statClassic(uid, n, first, day);
    else await statPortrait(uid, n, next.done === "win");
    const streak = next.done === "win" ? (await bumpStreak(uid, day)).n : (await getStreak(uid)).current;
    await announce(uid, mode, target, next, points, first, streak);
  }
  return dailyState(uid, mode);
}

const EM = { ok: "🟩", part: "🟨", no: "🟥" } as const;
function grid(mode: Mode, target: Hero, ids: number[]) {
  if (mode === "p") return ids.map((id) => (id === target.id ? "🟩" : "🟥")).join("");
  const rows = ids.map((id) => compare(HERO_BY_ID.get(id)!, target).slice(1).map((c) => EM[c.s]).join(""));
  return (rows.length > 8 ? [...rows.slice(0, 3), "⋯", ...rows.slice(-4)] : rows).join("\n");
}
const word = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "попытку" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "попытки" : "попыток");

// Сообщение в Discord-каналы лиг игрока (ответ не раскрываем)
async function announce(uid: string, mode: Mode, target: Hero, pr: Progress, points: number, first: boolean, streak: number) {
  try {
    const p = await getProfile(uid);
    const n = pr.ids.length;
    const label = mode === "c" ? "🧩 Классика" : "🖼️ Портрет";
    const head = pr.done === "win"
      ? `угадал(а) героя дня за **${n}** ${word(n)} · **+${points}**${first ? " · 🥇 первым!" : ""}${streak >= 2 ? ` · 🔥 ${streak}` : ""}`
      : "не угадал(а) героя дня ❌";
    await notifyUserLeagues(uid, {
      author: { name: `${p.nick || p.name} — ${label}`, icon_url: avatarOf(p) },
      description: `${head}\n\n${grid(mode, target, pr.ids)}`,
      color: pr.done === "win" ? COLORS.win : COLORS.fail, url: siteUrl(),
    });
  } catch (e) { console.error("[dotadle] announce failed", e); }
}

export async function dayResults(mode: Mode, day: string) {
  return kv.hgetall<DayResult>(`r:${mode}:${day}`);
}

// ---------- Архив прошлых дней (без очков) ----------
export async function archiveState(uid: string, mode: Mode, day: string) {
  if (!validDay(day)) throw new GameError("Этот день недоступен");
  const pr = (await kv.get<Progress>(`ga:${mode}:${day}:${uid}`)) ?? { ids: [] };
  return { day, ...viewPuzzle(mode, heroOfDay(mode, day), pr) };
}
export async function archiveGuess(uid: string, mode: Mode, day: string, heroId: number) {
  if (!validDay(day)) throw new GameError("Этот день недоступен");
  const key = `ga:${mode}:${day}:${uid}`;
  const pr = (await kv.get<Progress>(key)) ?? { ids: [] };
  await kv.set(key, applyGuess(mode, heroOfDay(mode, day), pr, heroId), { ex: TTL });
  return archiveState(uid, mode, day);
}

// ---------- Бесконечный режим (без очков) ----------
type Endless = Progress & { hero: number; streak: number; total: number };
export async function endlessState(uid: string, mode: Mode) {
  const key = `endless:${mode}:${uid}`;
  let e = await kv.get<Endless>(key);
  if (!e) { e = { hero: randomHero().id, ids: [], streak: 0, total: 0 }; await kv.set(key, e); }
  return { streak: e.streak, total: e.total, ...viewPuzzle(mode, HERO_BY_ID.get(e.hero)!, e) };
}
export async function endlessGuess(uid: string, mode: Mode, heroId: number) {
  const key = `endless:${mode}:${uid}`;
  const e = (await kv.get<Endless>(key)) ?? { hero: randomHero().id, ids: [], streak: 0, total: 0 };
  const next = applyGuess(mode, HERO_BY_ID.get(e.hero)!, e, heroId);
  const upd: Endless = { ...e, ...next };
  if (next.done && !e.done) { upd.total = e.total + 1; upd.streak = next.done === "win" ? e.streak + 1 : 0; }
  await kv.set(key, upd);
  return endlessState(uid, mode);
}
export async function endlessNext(uid: string, mode: Mode) {
  const key = `endless:${mode}:${uid}`;
  const e = await kv.get<Endless>(key);
  if (e && !e.done) return endlessState(uid, mode); // нельзя пропустить нерешённую
  await kv.set(key, { hero: randomHero(e?.hero).id, ids: [], streak: e?.streak ?? 0, total: e?.total ?? 0 });
  return endlessState(uid, mode);
}
export async function endlessGiveUp(uid: string, mode: Mode) {
  const key = `endless:${mode}:${uid}`;
  const e = await kv.get<Endless>(key);
  if (e && !e.done) await kv.set(key, { ...e, done: "fail", streak: 0, total: e.total + 1 });
  return endlessState(uid, mode);
}

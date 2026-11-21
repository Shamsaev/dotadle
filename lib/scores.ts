import { kv } from "./kv";
import { season, shiftDay, today } from "./game";
import { leagueTournaments, tournamentActive, userLeagues } from "./leagues";

export type Kind = "c" | "p" | "r";

// Начисление очков: глобальный рейтинг + все лиги игрока + активные турниры этих лиг
export async function addPoints(uid: string, pts: number, kind: Kind, day = today()) {
  if (pts <= 0) return;
  const s = season(day);
  const lids = await userLeagues(uid);
  const ops: Promise<unknown>[] = [
    kv.zincrby("lb:global:all", pts, uid),
    kv.zincrby(`lb:global:s:${s}`, pts, uid),
  ];
  for (const lid of lids) {
    ops.push(kv.zincrby(`lb:${lid}:all`, pts, uid), kv.zincrby(`lb:${lid}:s:${s}`, pts, uid));
  }
  await Promise.all(ops);
  const tours = (await Promise.all(lids.map(leagueTournaments))).flat();
  await Promise.all(tours.filter((t) => tournamentActive(t, day) && t.modes.includes(kind))
    .map((t) => kv.zincrby(`lb:t:${t.id}`, pts, uid)));
}

// Статистика игрока
export async function statClassic(uid: string, attempts: number, first: boolean, day: string) {
  const k = `stats:${uid}`;
  const last = await kv.hget<string>(k, "last_day");
  const streak = last === shiftDay(day, -1) ? Number((await kv.hget<number>(k, "streak")) ?? 0) + 1 : last === day ? Number((await kv.hget<number>(k, "streak")) ?? 1) : 1;
  const best = Number((await kv.hget<number>(k, "best_streak")) ?? 0);
  await Promise.all([
    kv.hincrby(k, "c_wins", 1),
    kv.hincrby(k, "c_attempts", attempts),
    kv.hincrby(k, `cd${Math.min(attempts, 11)}`, 1),
    first ? kv.hincrby(k, "c_first", 1) : null,
    kv.hset(k, "last_day", day),
    kv.hset(k, "streak", streak),
    streak > best ? kv.hset(k, "best_streak", streak) : null,
  ]);
}
export async function statPortrait(uid: string, attempts: number, solved: boolean) {
  const k = `stats:${uid}`;
  await Promise.all([
    kv.hincrby(k, "p_played", 1),
    solved ? kv.hincrby(k, "p_wins", 1) : null,
    solved ? kv.hincrby(k, "p_attempts", attempts) : null,
    solved ? kv.hincrby(k, `pd${attempts}`, 1) : kv.hincrby(k, "pd_x", 1),
  ]);
}
export async function statRace(uid: string, place: number | null) {
  const k = `stats:${uid}`;
  await Promise.all([kv.hincrby(k, "r_played", 1), place === 1 ? kv.hincrby(k, "r_wins", 1) : null,
    place && place <= 3 ? kv.hincrby(k, "r_podium", 1) : null]);
}
export const getStats = (uid: string) => kv.hgetall<number | string>(`stats:${uid}`);

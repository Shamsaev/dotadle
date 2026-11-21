// Серия: сколько дней подряд игрок угадывает героя дня (классика или портрет — любой из них засчитывает день)
import { kv } from "./kv";
import { shiftDay, today } from "./game";

export type Streak = { n: number; last: string; best: number };

export const effective = (s: Streak | null, day = today()) =>
  s && (s.last === day || s.last === shiftDay(day, -1)) ? s.n : 0;

export async function bumpStreak(uid: string, day = today()): Promise<Streak> {
  const key = `streak:${uid}`;
  const cur = await kv.get<Streak>(key);
  if (cur?.last === day) return cur; // день уже засчитан
  const n = cur && cur.last === shiftDay(day, -1) ? cur.n + 1 : 1;
  const next = { n, last: day, best: Math.max(n, cur?.best ?? 0) };
  await kv.set(key, next);
  return next;
}

export async function getStreak(uid: string) {
  const s = await kv.get<Streak>(`streak:${uid}`);
  return { current: effective(s), best: s?.best ?? 0 };
}

export async function streaksOf(uids: string[]): Promise<Record<string, number>> {
  if (!uids.length) return {};
  const vals = await kv.mget<Streak>(uids.map((u) => `streak:${u}`));
  return Object.fromEntries(uids.map((u, i) => [u, effective(vals[i])]));
}

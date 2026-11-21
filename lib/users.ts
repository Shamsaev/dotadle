import { kv } from "./kv";
import { HEROES } from "./game";

export type SessionUser = { uid: string; name: string; image?: string | null };
export type Profile = {
  name: string;          // имя от провайдера
  nick?: string;         // своё имя (по желанию)
  image?: string | null; // аватарка Google/Discord
  hero?: string;         // slug героя-аватарки
  color?: string;        // цвет ника (саппортеры)
  theme?: string;        // тема оформления (саппортеры)
};

// Платный доступ. Пока PAYWALL не равен "on", все функции открыты (удобно для теста с друзьями).
export const PAYWALL = process.env.PAYWALL === "on";

export const NICK_COLORS = ["#f5c542", "#ff6b6b", "#4dd0e1", "#9ccc65", "#ba68c8", "#ff9f43", "#f06292", "#e0e0e0"];
export const THEMES = ["dark", "radiant", "dire", "aegis"];

export async function getProfile(uid: string): Promise<Profile> {
  return (await kv.get<Profile>(`user:${uid}`)) ?? { name: "Игрок" };
}

export async function touchUser(u: SessionUser) {
  const p = await kv.get<Profile>(`user:${u.uid}`);
  if (!p) {
    // новичку даём случайного героя-аватарку
    const hero = HEROES[Math.floor(Math.random() * HEROES.length)].slug;
    await kv.set(`user:${u.uid}`, { name: u.name || "Игрок", image: u.image ?? null, hero });
  } else if (p.name !== u.name || p.image !== (u.image ?? null)) {
    await kv.set(`user:${u.uid}`, { ...p, name: u.name || p.name, image: u.image ?? null });
  }
}

export async function updateProfile(uid: string, patch: Partial<Profile>) {
  const p = await getProfile(uid);
  await kv.set(`user:${uid}`, { ...p, ...patch });
}

export async function supporterUntil(uid: string): Promise<number> {
  return (await kv.get<number>(`sup:${uid}`)) ?? 0;
}
export const isSupporter = async (uid: string) => (await supporterUntil(uid)) > Date.now();
export const canSupporterFeatures = async (uid: string) => !PAYWALL || (await isSupporter(uid));

export async function grantSupporter(uid: string, days: number) {
  const cur = Math.max(await supporterUntil(uid), Date.now());
  const until = cur + days * 86400_000;
  await kv.set(`sup:${uid}`, until);
  if (!(await kv.zscore("supporters", uid))) await kv.zincrby("supporters", Date.now(), uid);
  return until;
}

// Публичная карточка игрока для рейтингов и гонки
export type PublicUser = { uid: string; name: string; hero?: string; image?: string | null; color?: string; sup: boolean };

export async function publicUsers(uids: string[]): Promise<Record<string, PublicUser>> {
  const uniq = [...new Set(uids)];
  if (!uniq.length) return {};
  const [profiles, sups] = await Promise.all([
    kv.mget<Profile>(uniq.map((u) => `user:${u}`)),
    kv.mget<number>(uniq.map((u) => `sup:${u}`)),
  ]);
  const now = Date.now();
  const out: Record<string, PublicUser> = {};
  uniq.forEach((uid, i) => {
    const p = profiles[i] ?? { name: "Игрок" };
    const sup = (sups[i] ?? 0) > now;
    out[uid] = { uid, name: p.nick || p.name, hero: p.hero, image: p.image, color: sup || !PAYWALL ? p.color : undefined, sup };
  });
  return out;
}

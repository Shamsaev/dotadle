import { kv } from "./kv";
import { PAYWALL } from "./users";
import { today } from "./game";

// Лига = группа игроков со своим рейтингом.
//  g<guildId> — Discord-сервер (создаётся автоматически из Activity)
//  c<CODE>    — своя лига на сайте, вступление по коду
export type League = {
  id: string; name: string; type: "guild" | "custom"; icon?: string | null;
  created: number; premiumUntil?: number; owner?: string;
};
export type Tournament = {
  id: string; lid: string; name: string; start: string; end: string; modes: ("c" | "p" | "r")[];
  sponsor?: { name: string; url?: string; prize?: string; logo?: string };
  createdBy: string; created: number;
};

export const getLeague = (lid: string) => kv.get<League>(`league:${lid}`);
export const leagueMembers = (lid: string) => kv.smembers(`lm:${lid}`);
export const userLeagues = (uid: string) => kv.smembers(`ul:${uid}`);
export const isAdmin = (lid: string, uid: string) => kv.sismember(`la:${lid}`, uid);
export const isLeaguePremium = (l: League | null) => !!l && (l.premiumUntil ?? 0) > Date.now();
export const canLeaguePlus = (l: League | null) => !PAYWALL || isLeaguePremium(l);

export async function joinLeague(lid: string, uid: string, admin = false) {
  await Promise.all([kv.sadd(`lm:${lid}`, uid), kv.sadd(`ul:${uid}`, lid), admin ? kv.sadd(`la:${lid}`, uid) : null]);
}
export async function leaveLeague(lid: string, uid: string) {
  await Promise.all([kv.srem(`lm:${lid}`, uid), kv.srem(`ul:${uid}`, lid), kv.srem(`la:${lid}`, uid)]);
}

export async function ensureGuildLeague(guildId: string, name: string, icon?: string | null) {
  const lid = `g${guildId}`;
  const cur = await getLeague(lid);
  if (!cur) await kv.set(`league:${lid}`, { id: lid, name, type: "guild", icon: icon ?? null, created: Date.now() } satisfies League);
  else if (cur.name !== name || cur.icon !== (icon ?? null)) await kv.set(`league:${lid}`, { ...cur, name, icon: icon ?? null });
  return lid;
}

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const randomCode = (n = 6) => Array.from({ length: n }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join("");

export async function createCustomLeague(uid: string, name: string) {
  for (let i = 0; i < 5; i++) {
    const lid = `c${randomCode()}`;
    const ok = await kv.set(`league:${lid}`, { id: lid, name, type: "custom", created: Date.now(), owner: uid } satisfies League, { nx: true });
    if (ok) { await joinLeague(lid, uid, true); return lid; }
  }
  throw new Error("Не удалось создать лигу, попробуй ещё раз");
}

export async function extendLeaguePremium(lid: string, days: number) {
  const l = await getLeague(lid);
  if (!l) throw new Error("Лига не найдена");
  const until = Math.max(l.premiumUntil ?? 0, Date.now()) + days * 86400_000;
  await kv.set(`league:${lid}`, { ...l, premiumUntil: until });
  return until;
}

// ---- Турниры ----
export async function createTournament(t: Omit<Tournament, "id" | "created">) {
  const id = `${t.lid}-${Date.now().toString(36)}`;
  const full: Tournament = { ...t, id, created: Date.now() };
  await kv.set(`t:${id}`, full);
  await kv.sadd(`lt:${t.lid}`, id);
  return full;
}
export async function leagueTournaments(lid: string): Promise<Tournament[]> {
  const ids = await kv.smembers(`lt:${lid}`);
  const ts = (await kv.mget<Tournament>(ids.map((i) => `t:${i}`))).filter(Boolean) as Tournament[];
  return ts.sort((a, b) => b.start.localeCompare(a.start));
}
export async function deleteTournament(lid: string, id: string) {
  await Promise.all([kv.del(`t:${id}`), kv.srem(`lt:${lid}`, id)]);
}
export const tournamentActive = (t: Tournament, day = today()) => day >= t.start && day <= t.end;

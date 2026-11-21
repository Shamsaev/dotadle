import { api, issueToken, mode, str } from "@/lib/session";
import { GameError, archiveGuess, archiveState, dailyGuess, dailyState, endlessGiveUp, endlessGuess, endlessNext, endlessState } from "@/lib/daily";
import { getBoard } from "@/lib/boards";
import {
  canLeaguePlus, createCustomLeague, createTournament, deleteTournament, getLeague, isAdmin, isLeaguePremium,
  joinLeague, leagueMembers, leagueTournaments, leaveLeague, tournamentActive, userLeagues,
} from "@/lib/leagues";
import { createCode, listCodes, redeem } from "@/lib/codes";
import { endRound, joinRoom, raceGuess, roomState, startRound } from "@/lib/race";
import { getStats } from "@/lib/scores";
import { kv, usingMemory } from "@/lib/kv";
import { randomCode, extendLeaguePremium } from "@/lib/leagues";
import { NICK_COLORS, PAYWALL, THEMES, canSupporterFeatures, getProfile, grantSupporter, publicUsers, supporterUntil, touchUser, updateProfile } from "@/lib/users";
import { HEROES, LAUNCH_DAY, shiftDay, today } from "@/lib/game";
import { discordAvatar, discordGet, exchangeCode, syncGuilds, DUser } from "@/lib/discord";

export const dynamic = "force-dynamic";

const num = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n)) throw new GameError("Неверное число"); return n; };
const needSupporter = async (uid: string) => {
  if (!(await canSupporterFeatures(uid))) throw new GameError("Это доступно саппортерам ⭐");
};
const dayStr = (v: unknown) => { const d = str(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new GameError("Неверная дата"); return d; };

async function myLeagues(uid: string) {
  const lids = await userLeagues(uid);
  const out = [];
  for (const lid of lids) {
    const l = await getLeague(lid);
    if (!l) continue;
    const [admin, members, tours] = await Promise.all([isAdmin(lid, uid), leagueMembers(lid), leagueTournaments(lid)]);
    out.push({
      id: lid, name: l.name, type: l.type, icon: l.icon ?? null, code: l.type === "custom" ? lid.slice(1) : null,
      members: members.length, admin, premium: isLeaguePremium(l), premiumUntil: l.premiumUntil ?? null, plus: canLeaguePlus(l),
      tournaments: tours.map((t) => ({ ...t, active: tournamentActive(t), finished: t.end < today() })),
    });
  }
  return out.sort((a, b) => Number(b.type === "guild") - Number(a.type === "guild"));
}

type H = Parameters<typeof api>[0];
const GET_ROUTES: Record<string, [H, { public?: boolean }?]> = {
  me: [async (u) => {
    const [p, until, leagues] = await Promise.all([getProfile(u.uid), supporterUntil(u.uid), myLeagues(u.uid)]);
    return {
      user: { uid: u.uid, ...p }, supporter: { active: until > Date.now(), until },
      paywall: PAYWALL, can: { supporter: !PAYWALL || until > Date.now() }, leagues,
      colors: NICK_COLORS, themes: THEMES, launchDay: LAUNCH_DAY, today: today(), memory: usingMemory,
    };
  }],
  daily: [async (u, _b, url) => dailyState(u.uid, mode(url.searchParams.get("mode")))],
  archive: [async (u, _b, url) => { await needSupporter(u.uid); return archiveState(u.uid, mode(url.searchParams.get("mode")), dayStr(url.searchParams.get("day"))); }],
  endless: [async (u, _b, url) => { await needSupporter(u.uid); return endlessState(u.uid, mode(url.searchParams.get("mode"))); }],
  board: [async (u, _b, url) => getBoard(str(url.searchParams.get("scope")) || "global", str(url.searchParams.get("period")) || "today", u.uid)],
  leagues: [async (u) => myLeagues(u.uid)],
  stats: [async (u) => { await needSupporter(u.uid); return getStats(u.uid); }],
  supporters: [async () => {
    const top = await kv.zrevrange("supporters", 0, 199);
    const users = await publicUsers(top.map(([x]) => x));
    return top.map(([x]) => users[x]).filter((x) => x.sup);
  }, { public: true }],
  "race/state": [async (u, _b, url) => roomState(str(url.searchParams.get("rid")), u.uid)],
};

const POST_ROUTES: Record<string, [H, { public?: boolean }?]> = {
  me: [async (u, b) => {
    const patch: Record<string, unknown> = {};
    if (b.nick !== undefined) patch.nick = str(b.nick, 24) || undefined;
    if (b.hero !== undefined) {
      if (!HEROES.some((h) => h.slug === b.hero)) throw new GameError("Нет такого героя");
      patch.hero = b.hero;
      patch.useHero = true;
    }
    if (b.useHero !== undefined) patch.useHero = !!b.useHero;
    if (b.color !== undefined || b.theme !== undefined) await needSupporter(u.uid);
    if (b.color !== undefined) { if (b.color && !NICK_COLORS.includes(String(b.color))) throw new GameError("Неверный цвет"); patch.color = b.color || undefined; }
    if (b.theme !== undefined) { if (!THEMES.includes(String(b.theme))) throw new GameError("Неверная тема"); patch.theme = b.theme; }
    await updateProfile(u.uid, patch);
    return { ok: true };
  }],
  "discord/token": [async (_u, b) => {
    const code = str(b.code, 200);
    if (!code) throw new GameError("Нет кода");
    const { access_token } = await exchangeCode(code);
    const du = await discordGet<DUser>("/users/@me", access_token);
    const user = { uid: `discord:${du.id}`, name: du.global_name || du.username, image: discordAvatar(du) };
    await touchUser(user);
    const lid = await syncGuilds(user.uid, access_token, str(b.guildId, 30) || null);
    return { access_token, token: await issueToken(user), lid };
  }, { public: true }],
  "dev-login": [async (_u, b) => {
    if (process.env.DEV_LOGIN !== "1") throw new GameError("Отключено");
    const name = str(b.name, 24) || "Тестер";
    const user = { uid: `dev:${name.toLowerCase()}`, name, image: null };
    await touchUser(user);
    const guild = str(b.guild, 30);
    if (guild) { const { ensureGuildLeague } = await import("@/lib/leagues"); await ensureGuildLeague(guild, `Сервер ${guild}`); await joinLeague(`g${guild}`, user.uid, name.toLowerCase() === "admin"); }
    return { token: await issueToken(user), lid: guild ? `g${guild}` : null };
  }, { public: true }],
  "daily/guess": [async (u, b) => dailyGuess(u.uid, mode(b.mode), num(b.heroId))],
  "archive/guess": [async (u, b) => { await needSupporter(u.uid); return archiveGuess(u.uid, mode(b.mode), dayStr(b.day), num(b.heroId)); }],
  "endless/guess": [async (u, b) => { await needSupporter(u.uid); return endlessGuess(u.uid, mode(b.mode), num(b.heroId)); }],
  "endless/next": [async (u, b) => { await needSupporter(u.uid); return endlessNext(u.uid, mode(b.mode)); }],
  "endless/giveup": [async (u, b) => { await needSupporter(u.uid); return endlessGiveUp(u.uid, mode(b.mode)); }],
  "league/create": [async (u, b) => {
    const name = str(b.name, 40);
    if (name.length < 2) throw new GameError("Название слишком короткое");
    if ((await userLeagues(u.uid)).filter((l) => l.startsWith("c")).length >= 10) throw new GameError("Слишком много своих лиг");
    return { lid: await createCustomLeague(u.uid, name) };
  }],
  "league/join": [async (u, b) => {
    const code = str(b.code, 12).toUpperCase().replace(/^C/, "");
    const lid = `c${code}`;
    if (!(await getLeague(lid))) throw new GameError("Лига с таким кодом не найдена");
    await joinLeague(lid, u.uid);
    return { lid };
  }],
  "league/leave": [async (u, b) => {
    const lid = str(b.lid, 40);
    if (lid.startsWith("g")) throw new GameError("Из лиги сервера выйти нельзя: она привязана к Discord");
    await leaveLeague(lid, u.uid);
    return { ok: true };
  }],
  "tournament/create": [async (u, b) => {
    const lid = str(b.lid, 40);
    const l = await getLeague(lid);
    if (!l) throw new GameError("Лига не найдена");
    if (!(await isAdmin(lid, u.uid))) throw new GameError("Турниры создают админы лиги");
    if (!canLeaguePlus(l)) throw new GameError("Турниры доступны в Лиге+");
    const name = str(b.name, 60), start = dayStr(b.start), end = dayStr(b.end);
    if (name.length < 2) throw new GameError("Укажи название турнира");
    if (end < start) throw new GameError("Конец раньше начала");
    if (start < shiftDay(today(), -1)) throw new GameError("Турнир не может начинаться в прошлом");
    if (Date.parse(end) - Date.parse(start) > 62 * 86400_000) throw new GameError("Максимум 2 месяца");
    const modes = (Array.isArray(b.modes) ? b.modes : []).filter((m): m is "c" | "p" | "r" => m === "c" || m === "p" || m === "r");
    if (!modes.length) throw new GameError("Выбери хотя бы один режим");
    const sp = (b.sponsor ?? {}) as Record<string, unknown>;
    const sName = str(sp.name, 60);
    const sUrl = str(sp.url, 200);
    if (sUrl && !/^https:\/\/[^\s]+$/.test(sUrl)) throw new GameError("Ссылка спонсора должна начинаться с https://");
    const sponsor = sName ? { name: sName, url: sUrl || undefined, prize: str(sp.prize, 120) || undefined } : undefined;
    return createTournament({ lid, name, start, end, modes, sponsor, createdBy: u.uid });
  }],
  "tournament/delete": [async (u, b) => {
    const lid = str(b.lid, 40);
    if (!(await isAdmin(lid, u.uid))) throw new GameError("Только для админов лиги");
    await deleteTournament(lid, str(b.id, 80));
    return { ok: true };
  }],
  redeem: [async (u, b) => redeem(u.uid, str(b.code, 40), str(b.lid, 40) || undefined)],
  "race/create": [async (u, b) => {
    const lid = str(b.lid, 40) || null;
    return joinRoom(`w${randomCode(6)}`, u.uid, lid);
  }],
  "race/join": [async (u, b) => {
    const rid = str(b.rid, 100);
    let lid = str(b.lid, 40) || null;
    if (lid && !(await userLeagues(u.uid)).includes(lid)) lid = null;
    return joinRoom(rid, u.uid, lid);
  }],
  "race/start": [async (u, b) => startRound(str(b.rid, 100), u.uid, mode(b.mode))],
  "race/guess": [async (u, b) => raceGuess(str(b.rid, 100), u.uid, num(b.heroId))],
  "race/end": [async (u, b) => endRound(str(b.rid, 100), u.uid)],
};

// Админка (для выдачи промокодов после доната). Ключ — переменная ADMIN_SECRET.
async function admin(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) return Response.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (b.action) {
      case "createCode": return Response.json({ code: await createCode(b.type === "league" ? "league" : "supporter", num(b.days ?? 30), num(b.maxUses ?? 1), str(b.note, 100) || undefined, str(b.code, 40) || undefined) });
      case "listCodes": return Response.json(await listCodes());
      case "grantSupporter": return Response.json({ until: await grantSupporter(str(b.uid, 80), num(b.days ?? 30)) });
      case "grantLeague": return Response.json({ until: await extendLeaguePremium(str(b.lid, 40), num(b.days ?? 30)) });
      default: return Response.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}

type Ctx = { params: Promise<{ path: string[] }> };
const notFound = () => Response.json({ error: "not found" }, { status: 404 });

export async function GET(req: Request, ctx: Ctx) {
  const r = GET_ROUTES[(await ctx.params).path.join("/")];
  return r ? api(r[0], r[1])(req) : notFound();
}
export async function POST(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path.join("/");
  if (path === "admin") return admin(req);
  const r = POST_ROUTES[path];
  return r ? api(r[0], r[1])(req) : notFound();
}

import { kv } from "./kv";
import { season, today } from "./game";
import { DayResult, GameError, dayResults } from "./daily";
import { canLeaguePlus, getLeague, leagueMembers, leagueTournaments } from "./leagues";
import { publicUsers } from "./users";


export async function getBoard(scope: string, period: string, viewer: string) {
  const isGlobal = scope === "global";
  const league = isGlobal ? null : await getLeague(scope);
  if (!isGlobal && !league) throw new GameError("Лига не найдена");
  const members = isGlobal ? null : new Set(await leagueMembers(scope));
  if (members && !members.has(viewer)) throw new GameError("Ты не состоишь в этой лиге");

  if (period === "today") {
    const day = today();
    const [c, p] = await Promise.all([dayResults("c", day), dayResults("p", day)]);
    const uids = [...new Set([...Object.keys(c), ...Object.keys(p)])].filter((u) => !members || members.has(u));
    const users = await publicUsers(uids);
    const rows = uids.map((uid) => {
      const rc: DayResult | undefined = c[uid], rp: DayResult | undefined = p[uid];
      return { user: users[uid], c: rc ?? null, p: rp ?? null, points: (rc?.points ?? 0) + (rp?.points ?? 0) };
    }).sort((a, b) => b.points - a.points || (a.c?.attempts ?? 99) - (b.c?.attempts ?? 99));
    return { kind: "today" as const, rows };
  }

  let key: string;
  let tournament = null;
  if (period === "all") key = `lb:${scope}:all`;
  else if (period === "season" || period.startsWith("season:")) {
    const s = period === "season" ? season(today()) : period.slice(7);
    if (!/^\d{4}-\d{2}$/.test(s)) throw new GameError("Неверный сезон");
    if (league && !canLeaguePlus(league)) throw new GameError("Сезоны лиги доступны в Лиге+");
    key = `lb:${scope}:s:${s}`;
  } else if (period.startsWith("t:")) {
    if (!league) throw new GameError("Турниры есть только у лиг");
    const tid = period.slice(2);
    tournament = (await leagueTournaments(scope)).find((t) => t.id === tid) ?? null;
    if (!tournament) throw new GameError("Турнир не найден");
    key = `lb:t:${tid}`;
  } else throw new GameError("Неверный период");

  const top = await kv.zrevrange(key, 0, 49);
  const users = await publicUsers([...top.map(([u]) => u), viewer]);
  const rows = top.map(([uid, points], i) => ({ place: i + 1, user: users[uid], points }));
  const mine = rows.find((r) => r.user.uid === viewer) ? null : { user: users[viewer], points: (await kv.zscore(key, viewer)) ?? 0 };
  return { kind: "points" as const, rows, mine, tournament };
}

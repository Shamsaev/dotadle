// Ночные итоги дня для лиг с вебхуком (вызывается Vercel Cron после полуночи по Москве)
import { kv } from "./kv";
import { heroOfDay, season, shiftDay, today } from "./game";
import { dayResults } from "./daily";
import { getLeague, leagueMembers } from "./leagues";
import { COLORS, getWebhook, postWebhook, setWebhook, siteUrl } from "./notify";
import { publicUsers } from "./users";

const MEDAL = ["🥇", "🥈", "🥉"];

export async function postDailySummaries(day = shiftDay(today(), -1)) {
  if (!(await kv.set(`summary:${day}`, 1, { nx: true, ex: 3 * 86400 }))) return { skipped: "already sent" };
  const lids = await kv.smembers("leagues:wh");
  const [c, p] = await Promise.all([dayResults("c", day), dayResults("p", day)]);
  const sent: string[] = [];
  for (const lid of lids) {
    const [league, hook, members] = await Promise.all([getLeague(lid), getWebhook(lid), leagueMembers(lid)]);
    if (!league || !hook) continue;
    const mem = new Set(members);
    const played = [...new Set([...Object.keys(c), ...Object.keys(p)])].filter((u) => mem.has(u));
    if (!played.length) continue; // никто не играл — не спамим
    const users = await publicUsers([...played, ...members.slice(0, 300)]);
    const rows = played.map((u) => ({ u, c: c[u], p: p[u], pts: (c[u]?.points ?? 0) + (p[u]?.points ?? 0) }))
      .sort((a, b) => b.pts - a.pts);
    const lines = rows.slice(0, 15).map((r, i) => {
      const parts = [r.c ? `🧩 ${r.c.attempts}` : null, r.p ? `🖼️ ${r.p.solved ? r.p.attempts : "✗"}` : null].filter(Boolean).join(" · ");
      return `${MEDAL[i] ?? `${i + 1}.`} **${users[r.u].name}**: ${parts} · +${r.pts}`;
    });
    const streaks = members.map((u) => ({ u, s: users[u]?.streak ?? 0 })).filter((x) => x.s >= 2)
      .sort((a, b) => b.s - a.s).slice(0, 5).map((x) => `🔥 ${x.s}: ${users[x.u].name}`);
    const season5 = await kv.zrevrange(`lb:${lid}:s:${season(day)}`, 0, 2);
    const sUsers = await publicUsers(season5.map(([u]) => u));
    const desc = [
      `Загаданы были: 🧩 **${heroOfDay("c", day).name}** · 🖼️ **${heroOfDay("p", day).name}**`,
      "",
      rows.length ? lines.join("\n") : "Вчера никто из сервера не играл 😴",
      streaks.length ? `\n**Серии**\n${streaks.join("\n")}` : "",
      season5.length ? `\n**Сезон**\n${season5.map(([u, pts], i) => `${MEDAL[i]} ${sUsers[u].name}: ${pts}`).join("\n")}` : "",
      "\nНовые герои уже загаданы!",
    ].join("\n");
    const r = await postWebhook(hook, [{ title: `🌙 Итоги дня ${day.split("-").reverse().join(".")}`, description: desc, color: COLORS.info, url: siteUrl() }]);
    if (r === "gone") await setWebhook(lid, null);
    else sent.push(lid);
  }
  return { day, sent: sent.length };
}

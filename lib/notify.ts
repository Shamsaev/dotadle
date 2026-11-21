// Сообщения в Discord через вебхуки лиг (админ лиги вставляет ссылку вебхука канала).
import { kv } from "./kv";
import { userLeagues } from "./leagues";
import { Profile } from "./users";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
export const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export const getWebhook = (lid: string) => kv.get<string>(`lwh:${lid}`);
export async function setWebhook(lid: string, url: string | null) {
  if (url) { await kv.set(`lwh:${lid}`, url); await kv.sadd("leagues:wh", lid); }
  else { await kv.del(`lwh:${lid}`); await kv.srem("leagues:wh", lid); }
}

type Embed = { title?: string; description?: string; color?: number; url?: string;
  author?: { name: string; icon_url?: string }; thumbnail?: { url: string }; footer?: { text: string } };

export async function postWebhook(url: string, embeds: Embed[]) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${url}?wait=false`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ username: "Dotadle", avatar_url: SITE ? `${SITE}/heroes/p/invoker.webp` : undefined, embeds, allowed_mentions: { parse: [] } }),
    });
    if (r.status === 404 || r.status === 401) return "gone";
    return r.ok ? "ok" : "fail";
  } catch { return "fail"; } finally { clearTimeout(t); }
}

export function avatarOf(p: Profile | null) {
  if (p?.image && !p.useHero) return p.image;
  return SITE && p?.hero ? `${SITE}/heroes/p/${p.hero}.webp` : undefined;
}

// Разослать сообщение во все лиги игрока, где настроен вебхук
export async function notifyUserLeagues(uid: string, embed: Embed) {
  const lids = await userLeagues(uid);
  await notifyLeagues(lids, embed);
}
export async function notifyLeagues(lids: string[], embed: Embed) {
  const hooks = await kv.mget<string>(lids.map((l) => `lwh:${l}`));
  await Promise.allSettled(hooks.map(async (h, i) => {
    if (!h) return;
    if ((await postWebhook(h, [embed])) === "gone") await setWebhook(lids[i], null); // вебхук удалили в Discord
  }));
}

export const COLORS = { win: 0x2f9e55, fail: 0xb0392c, race: 0xf0b232, info: 0x5865f2 };
export const siteUrl = () => SITE || undefined;

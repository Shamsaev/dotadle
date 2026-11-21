import { ensureGuildLeague, getLeague, joinLeague } from "./leagues";

const API = "https://discord.com/api/v10";
export type DGuild = { id: string; name: string; icon: string | null; owner: boolean; permissions: string };
export type DUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

export const discordAvatar = (u: DUser) =>
  u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null;
export const guildIcon = (g: DGuild) => (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null);

const isGuildAdmin = (g: DGuild) => {
  if (g.owner) return true;
  try { const p = BigInt(g.permissions); return (p & 0x8n) !== 0n || (p & 0x20n) !== 0n; } catch { return false; }
};

export async function exchangeCode(code: string) {
  const r = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_DISCORD_ID!, client_secret: process.env.AUTH_DISCORD_SECRET!,
      grant_type: "authorization_code", code,
    }),
  });
  if (!r.ok) throw new Error(`Discord token exchange failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as { access_token: string };
}

export async function discordGet<T>(path: string, token: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Discord ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

// Добавляем игрока в лиги его серверов. Лига текущего сервера (откуда запущена Activity) создаётся,
// остальные — только если уже существуют.
export async function syncGuilds(uid: string, token: string, currentGuildId?: string | null) {
  let guilds: DGuild[] = [];
  try { guilds = await discordGet<DGuild[]>("/users/@me/guilds", token); } catch { return null; }
  let current: string | null = null;
  for (const g of guilds.slice(0, 200)) {
    const lid = `g${g.id}`;
    if (g.id === currentGuildId) {
      await ensureGuildLeague(g.id, g.name, guildIcon(g));
      await joinLeague(lid, uid, isGuildAdmin(g));
      current = lid;
    } else if (await getLeague(lid)) {
      await joinLeague(lid, uid, isGuildAdmin(g));
    }
  }
  return current;
}

// Промокоды: так выдаётся «Саппортер» после доната (Boosty/DonationAlerts) и «Лига+» для сервера.
import { kv } from "./kv";
import { GameError } from "./daily";
import { extendLeaguePremium, getLeague, joinLeague, leagueMembers, randomCode } from "./leagues";
import { grantSupporter } from "./users";

export type PromoCode = { code: string; type: "supporter" | "league"; days: number; maxUses: number; uses: number; note?: string; created: number };

export async function createCode(type: PromoCode["type"], days: number, maxUses = 1, note?: string, code?: string) {
  const c = (code || `${type === "league" ? "LIGA" : "SUP"}-${randomCode(8)}`).toUpperCase();
  const ok = await kv.set(`code:${c}`, { code: c, type, days, maxUses, uses: 0, note, created: Date.now() } satisfies PromoCode, { nx: true });
  if (!ok) throw new GameError("Такой код уже есть");
  await kv.sadd("codes", c);
  return c;
}

export async function listCodes() {
  const all = await kv.smembers("codes");
  return (await kv.mget<PromoCode>(all.map((c) => `code:${c}`))).filter(Boolean) as PromoCode[];
}

export async function redeem(uid: string, raw: string, lid?: string) {
  const code = raw.trim().toUpperCase();
  const c = await kv.get<PromoCode>(`code:${code}`);
  if (!c) throw new GameError("Код не найден");
  if (c.uses >= c.maxUses) throw new GameError("Код уже использован");
  if (await kv.sismember(`code:${code}:by`, uid)) throw new GameError("Ты уже активировал этот код");
  let result: { type: string; until: number; lid?: string };
  if (c.type === "supporter") {
    result = { type: "supporter", until: await grantSupporter(uid, c.days) };
  } else {
    if (!lid) throw new GameError("Выбери лигу, для которой активируешь Лигу+");
    const l = await getLeague(lid);
    if (!l) throw new GameError("Лига не найдена");
    if (!(await leagueMembers(lid)).includes(uid)) throw new GameError("Ты не состоишь в этой лиге");
    result = { type: "league", lid, until: await extendLeaguePremium(lid, c.days) };
    await joinLeague(lid, uid, true); // активировавший становится админом лиги
  }
  await kv.set(`code:${code}`, { ...c, uses: c.uses + 1 });
  await kv.sadd(`code:${code}:by`, uid);
  return result;
}

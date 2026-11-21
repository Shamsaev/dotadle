// Минимальная обёртка над Redis (Upstash) + хранилище в памяти для локальной разработки.
// Все значения хранятся как JSON-строки.
import { Redis } from "@upstash/redis";

export interface KV {
  get<T>(k: string): Promise<T | null>;
  set(k: string, v: unknown, o?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(k: string): Promise<void>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  incr(k: string): Promise<number>;
  expire(k: string, sec: number): Promise<void>;
  hget<T>(k: string, f: string): Promise<T | null>;
  hset(k: string, f: string, v: unknown): Promise<void>;
  hdel(k: string, f: string): Promise<void>;
  hgetall<T>(k: string): Promise<Record<string, T>>;
  hincrby(k: string, f: string, n: number): Promise<number>;
  zincrby(k: string, n: number, m: string): Promise<void>;
  zrevrange(k: string, start: number, stop: number): Promise<[string, number][]>;
  zscore(k: string, m: string): Promise<number | null>;
  zcard(k: string): Promise<number>;
  sadd(k: string, m: string): Promise<void>;
  srem(k: string, m: string): Promise<void>;
  smembers(k: string): Promise<string[]>;
  sismember(k: string, m: string): Promise<boolean>;
}

const dec = <T,>(v: unknown): T | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
};
const enc = (v: unknown) => JSON.stringify(v);

class UpstashKV implements KV {
  constructor(private r: Redis) {}
  async get<T>(k: string) { return dec<T>(await this.r.get(k)); }
  async set(k: string, v: unknown, o: { ex?: number; nx?: boolean } = {}) {
    const opts: Record<string, unknown> = {};
    if (o.ex) opts.ex = o.ex;
    if (o.nx) opts.nx = true;
    const res = await this.r.set(k, enc(v), opts as never);
    return res === "OK";
  }
  async del(k: string) { await this.r.del(k); }
  async mget<T>(keys: string[]) {
    if (!keys.length) return [];
    const vals = await this.r.mget<unknown[]>(...keys);
    return vals.map((v) => dec<T>(v));
  }
  async incr(k: string) { return this.r.incr(k); }
  async expire(k: string, sec: number) { await this.r.expire(k, sec); }
  async hget<T>(k: string, f: string) { return dec<T>(await this.r.hget(k, f)); }
  async hset(k: string, f: string, v: unknown) { await this.r.hset(k, { [f]: enc(v) }); }
  async hdel(k: string, f: string) { await this.r.hdel(k, f); }
  async hgetall<T>(k: string) {
    const all = (await this.r.hgetall<Record<string, unknown>>(k)) ?? {};
    const out: Record<string, T> = {};
    for (const [f, v] of Object.entries(all)) out[f] = dec<T>(v) as T;
    return out;
  }
  async hincrby(k: string, f: string, n: number) { return this.r.hincrby(k, f, n); }
  async zincrby(k: string, n: number, m: string) { await this.r.zincrby(k, n, m); }
  async zrevrange(k: string, start: number, stop: number) {
    const raw = (await this.r.zrange(k, start, stop, { rev: true, withScores: true })) as (string | number)[];
    const out: [string, number][] = [];
    for (let i = 0; i < raw.length; i += 2) out.push([String(raw[i]), Number(raw[i + 1])]);
    return out;
  }
  async zscore(k: string, m: string) { const s = await this.r.zscore(k, m); return s === null ? null : Number(s); }
  async zcard(k: string) { return this.r.zcard(k); }
  async sadd(k: string, m: string) { await this.r.sadd(k, m); }
  async srem(k: string, m: string) { await this.r.srem(k, m); }
  async smembers(k: string) { return (await this.r.smembers(k)).map(String); }
  async sismember(k: string, m: string) { return (await this.r.sismember(k, m)) === 1; }
}

type Entry = { v: unknown; exp?: number };
class MemoryKV implements KV {
  private m = new Map<string, Entry>();
  private live(k: string) {
    const e = this.m.get(k);
    if (e && e.exp && e.exp < Date.now()) { this.m.delete(k); return undefined; }
    return e;
  }
  private obj<T>(k: string, init: () => T): T {
    const e = this.live(k);
    if (e) return e.v as T;
    const v = init(); this.m.set(k, { v }); return v;
  }
  async get<T>(k: string) { const e = this.live(k); return e ? dec<T>(e.v) : null; }
  async set(k: string, v: unknown, o: { ex?: number; nx?: boolean } = {}) {
    if (o.nx && this.live(k)) return false;
    this.m.set(k, { v: enc(v), exp: o.ex ? Date.now() + o.ex * 1000 : undefined }); return true;
  }
  async del(k: string) { this.m.delete(k); }
  async mget<T>(keys: string[]) { return Promise.all(keys.map((k) => this.get<T>(k))); }
  async incr(k: string) { const n = Number((await this.get<number>(k)) ?? 0) + 1; const e = this.live(k); this.m.set(k, { v: enc(n), exp: e?.exp }); return n; }
  async expire(k: string, sec: number) { const e = this.live(k); if (e) e.exp = Date.now() + sec * 1000; }
  async hget<T>(k: string, f: string) { const h = this.obj(k, () => new Map<string, string>()); const v = h.get(f); return v === undefined ? null : dec<T>(v); }
  async hset(k: string, f: string, v: unknown) { this.obj(k, () => new Map<string, string>()).set(f, enc(v)); }
  async hdel(k: string, f: string) { this.obj(k, () => new Map<string, string>()).delete(f); }
  async hgetall<T>(k: string) { const h = this.obj(k, () => new Map<string, string>()); const o: Record<string, T> = {}; h.forEach((v, f) => (o[f] = dec<T>(v) as T)); return o; }
  async hincrby(k: string, f: string, n: number) { const h = this.obj(k, () => new Map<string, string>()); const v = Number(dec<number>(h.get(f) ?? "0")) + n; h.set(f, enc(v)); return v; }
  async zincrby(k: string, n: number, m: string) { const z = this.obj(k, () => new Map<string, number>()); z.set(m, (z.get(m) ?? 0) + n); }
  async zrevrange(k: string, start: number, stop: number) {
    const z = this.obj(k, () => new Map<string, number>());
    const arr = [...z.entries()].sort((a, b) => b[1] - a[1]);
    return arr.slice(start, stop < 0 ? undefined : stop + 1);
  }
  async zscore(k: string, m: string) { return this.obj(k, () => new Map<string, number>()).get(m) ?? null; }
  async zcard(k: string) { return this.obj(k, () => new Map<string, number>()).size; }
  async sadd(k: string, m: string) { this.obj(k, () => new Set<string>()).add(m); }
  async srem(k: string, m: string) { this.obj(k, () => new Set<string>()).delete(m); }
  async smembers(k: string) { return [...this.obj(k, () => new Set<string>())]; }
  async sismember(k: string, m: string) { return this.obj(k, () => new Set<string>()).has(m); }
}

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const g = globalThis as unknown as { __kv?: KV };
export const kv: KV = (g.__kv ??= url && token
  ? new UpstashKV(new Redis({ url, token, automaticDeserialization: false }))
  : new MemoryKV());
export const usingMemory = !(url && token);

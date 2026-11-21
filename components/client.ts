"use client";
import heroesData from "@/lib/heroes.json";

export type HeroLite = { id: number; slug: string; name: string; aliases: string[]; ru: string[] };
export const HEROES: HeroLite[] = (heroesData as HeroLite[]).map(({ id, slug, name, aliases, ru }) => ({ id, slug, name, aliases, ru }));
export const HERO_BY_SLUG = new Map(HEROES.map((h) => [h.slug, h]));
export const faceUrl = (slug?: string) => (slug ? `/heroes/face/${slug}.webp` : "/heroes/face/wisp.webp");

export type Cell = { v: string | number; s: "ok" | "part" | "no"; img?: string; arrow?: "up" | "down" };
export type Art = { cols: number; rows: number; chars: string; colors: string; gray: boolean };
export type Answer = { id: number; name: string; img: string; full: string };
export type PuzzleView = {
  mode: "c" | "p"; attempts: number; solved: boolean; failed: boolean; answer: Answer | null;
  columns?: string[]; rows?: Cell[][];
  tries?: number; guesses?: { id: number; name: string; img: string; ok: boolean }[]; art?: Art; level?: number; hints?: string[];
};
export type PublicUser = { uid: string; name: string; hero?: string; image?: string | null; color?: string; sup: boolean };
export type League = {
  id: string; name: string; type: "guild" | "custom"; icon: string | null; code: string | null; members: number;
  admin: boolean; premium: boolean; premiumUntil: number | null; plus: boolean; tournaments: Tournament[];
};
export type Tournament = {
  id: string; lid: string; name: string; start: string; end: string; modes: ("c" | "p" | "r")[];
  sponsor?: { name: string; url?: string; prize?: string }; active: boolean; finished: boolean;
};
export type Me = {
  user: { uid: string; name: string; nick?: string; image?: string | null; hero?: string; color?: string; theme?: string };
  supporter: { active: boolean; until: number }; paywall: boolean; can: { supporter: boolean };
  leagues: League[]; colors: string[]; themes: string[]; launchDay: string; today: string; memory: boolean;
};

// ---- Сессия и запросы ----
let bearer: string | null = null;
export let inDiscord = false;
export const setBearer = (t: string | null) => { bearer = t; };
export const setInDiscord = (v: boolean) => { inDiscord = v; };

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`/api/${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = await r.json().catch(() => ({ error: "Нет связи с сервером" }));
  if (!r.ok) throw new ApiError(data.error || "Ошибка", r.status);
  return data as T;
}

// Внутри Discord внешние картинки идут через URL Mapping (см. README)
export function ext(url?: string | null) {
  if (!url) return undefined;
  if (!inDiscord) return url;
  return url.replace("https://cdn.discordapp.com/", "/dcdn/").replace("https://lh3.googleusercontent.com/", "/gcdn/");
}

export function storage(key: string, value?: string | null) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage недоступен */ }
  return null;
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
}

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[\s\-_'’.]/g, "");

export function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
export const tries = (n: number) => `${n} ${plural(n, "попытку", "попытки", "попыток")}`;

export function fmtLeft(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}

const EMOJI = { ok: "🟩", part: "🟨", no: "🟥" } as const;
export function shareText(v: PuzzleView, title: string, points?: number | null) {
  let body: string;
  if (v.mode === "c") body = (v.rows ?? []).map((r) => r.slice(1).map((c) => EMOJI[c.s]).join("")).join("\n");
  else body = (v.guesses ?? []).map((g) => (g.ok ? "🟩" : "🟥")).join("") + (v.failed ? " ❌" : "");
  const res = v.solved ? `угадал за ${tries(v.attempts)}` : "не угадал";
  return `${title}: ${res}${points ? ` (+${points})` : ""}\n${body}\n${process.env.NEXT_PUBLIC_SITE_URL || (typeof location !== "undefined" ? location.origin : "")}`;
}

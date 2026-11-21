import heroesData from "./heroes.json";

export type Hero = {
  id: number; slug: string; name: string; attr: "str" | "agi" | "int" | "all";
  melee: boolean; roles: string[]; legs: number; speed: number; range: number;
  aliases: string[]; ru: string[];
};
export type Cell = { v: string | number; s: "ok" | "part" | "no"; img?: string; arrow?: "up" | "down" };
export type Mode = "c" | "p"; // c = классика (по параметрам), p = портрет из символов

export const HEROES: Hero[] = (heroesData as Hero[]).slice().sort((a, b) => a.id - b.id);
export const HERO_BY_ID = new Map(HEROES.map((h) => [h.id, h]));
export const COLUMNS = ["Герой", "Атрибут", "Атака", "Роли", "Ноги", "Скорость", "Дальность"];
export const face = (h: Hero) => `/heroes/face/${h.slug}.webp`;
export const full = (h: Hero) => `/heroes/full/${h.slug}.webp`;

export const ATTR_RU = { str: "Сила", agi: "Ловкость", int: "Интеллект", all: "Универсал" } as const;
const ROLE_RU: Record<string, string> = {
  Carry: "Керри", Support: "Саппорт", Nuker: "Нюкер", Disabler: "Контроль",
  Initiator: "Инициатор", Durable: "Танк", Escape: "Побег", Pusher: "Пушер",
};

// ---- Очки ----
export const CLASSIC_MAX = 10;   // за 1 попытку, дальше -1 (минимум 1)
export const FIRST_BONUS = 2;    // первому угадавшему классику за день
export const PORTRAIT_TRIES = 6; // попыток в портрете
export const classicPoints = (n: number) => Math.max(1, CLASSIC_MAX + 1 - n);
export const portraitPoints = (n: number) => Math.max(1, PORTRAIT_TRIES + 1 - n); // 6..1
export const RACE_POINTS = [5, 3, 2]; // места в гонке; остальные угадавшие получают 1

// ---- Время: Москва, UTC+3 без перехода на летнее время ----
const OFFSET_MS = 3 * 3600 * 1000;
const DAY_MS = 86400 * 1000;
export const LAUNCH_DAY = process.env.LAUNCH_DAY || "2026-11-01"; // с какого дня доступен архив
export function today(): string { return new Date(Date.now() + OFFSET_MS).toISOString().slice(0, 10); }
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}
export const season = (day: string) => day.slice(0, 7); // YYYY-MM
export function secondsToNextDay(): number {
  const t = Date.now() + OFFSET_MS;
  return Math.ceil((DAY_MS - (t % DAY_MS)) / 1000);
}
export const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= LAUNCH_DAY && d < today();

// ---- Герой дня: детерминированная перетасовка, без повторов, пока не пройдут все ----
function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const perms: Partial<Record<Mode, number[]>> = {};
export function heroOfDay(mode: Mode, day: string): Hero {
  let perm = perms[mode];
  if (!perm) {
    const rnd = mulberry32(seedFrom(`${process.env.GAME_SALT || "change-me"}:${mode}`));
    perm = HEROES.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    perms[mode] = perm;
  }
  const idx = Math.floor(Date.parse(day + "T00:00:00Z") / DAY_MS);
  return HEROES[perm[idx % perm.length]];
}
export function randomHero(exclude?: number): Hero {
  let h: Hero;
  do { h = HEROES[Math.floor(Math.random() * HEROES.length)]; } while (h.id === exclude);
  return h;
}

// ---- Сравнение для классики ----
export function compare(g: Hero, t: Hero): Cell[] {
  const cells: Cell[] = [
    { v: g.name, s: g.id === t.id ? "ok" : "no", img: face(g) },
    { v: ATTR_RU[g.attr], s: g.attr === t.attr ? "ok" : "no" },
    { v: g.melee ? "Ближняя" : "Дальняя", s: g.melee === t.melee ? "ok" : "no" },
  ];
  const gr = new Set(g.roles), tr = new Set(t.roles);
  const same = gr.size === tr.size && [...gr].every((r) => tr.has(r));
  const any = [...gr].some((r) => tr.has(r));
  cells.push({ v: g.roles.map((r) => ROLE_RU[r] || r).join(", "), s: same ? "ok" : any ? "part" : "no" });
  for (const k of ["legs", "speed", "range"] as const) {
    const a = g[k], b = t[k];
    cells.push(a === b ? { v: a, s: "ok" } : { v: a, s: "no", arrow: b > a ? "up" : "down" });
  }
  return cells;
}

export const heroLite = (h: Hero) => ({ id: h.id, name: h.name, img: face(h) });
export const answerOf = (h: Hero) => ({ id: h.id, name: h.name, img: face(h), full: full(h) });

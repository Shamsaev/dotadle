// Портрет из символов: сервер отдаёт только символы и цвета нужного уровня,
// поэтому по ответу нельзя узнать героя раньше времени.
import data from "./portraits.json";
import { ATTR_RU, Hero, PORTRAIT_TRIES } from "./game";

const P = data as { cols: number; rows: number; grids: Record<string, string> };
const RAMP = " .:-=+*#%@";
// Количество колонок на каждом уровне (1 — самый размытый). Последний — после завершения.
export const LEVEL_COLS = [8, 11, 15, 21, 28, 37, 48];

export type Art = { cols: number; rows: number; chars: string; colors: string; gray: boolean };

const cache = new Map<string, Art>();

export function renderArt(heroId: number, level: number): Art {
  const lv = Math.max(1, Math.min(LEVEL_COLS.length, level));
  const key = `${heroId}:${lv}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = P.grids[String(heroId)];
  const C = P.cols, R = P.rows;
  const cols = LEVEL_COLS[lv - 1];
  const rows = Math.round((R * cols) / C);
  const gray = lv <= 2;
  let chars = "", colors = "";
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const x0 = Math.floor((bx * C) / cols), x1 = Math.floor(((bx + 1) * C) / cols);
      const y0 = Math.floor((by * R) / rows), y1 = Math.floor(((by + 1) * R) / rows);
      let r = 0, gg = 0, b = 0, wa = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const o = (y * C + x) * 4;
        const a = parseInt(g[o + 3], 16) * 17;
        r += parseInt(g[o], 16) * 17 * a; gg += parseInt(g[o + 1], 16) * 17 * a; b += parseInt(g[o + 2], 16) * 17 * a;
        wa += a; n++;
      }
      const A = n ? wa / n / 255 : 0;
      if (A < 0.08 || wa === 0) { chars += " "; colors += "000"; continue; }
      r /= wa; gg /= wa; b /= wa;
      const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
      const v = A * (0.1 + 0.9 * lum);
      chars += RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.floor(v * 1.25 * RAMP.length)))];
      // осветляем: рендеры героев тёмные
      const mx = Math.max(r, gg, b, 1);
      const k = Math.min(1.6, 235 / mx);
      const q = (c: number) => Math.min(15, Math.round((c * k) / 17)).toString(16);
      if (gray) { const l = q((r + gg + b) / 3); colors += l + l + l; }
      else colors += q(r) + q(gg) + q(b);
    }
  }
  const art = { cols, rows, chars, colors, gray };
  cache.set(key, art);
  return art;
}

// Подсказки открываются после ошибок
export function portraitHints(h: Hero, wrong: number, done: boolean) {
  const hints: string[] = [];
  if (wrong >= 2 || done) hints.push(`Раса: ${h.race}`);
  if (wrong >= 3 || done) hints.push(`Атрибут: ${ATTR_RU[h.attr]}`);
  if (wrong >= 4 || done) hints.push(`Атака: ${h.melee ? "ближняя" : "дальняя"}`);
  if (wrong >= 5 || done) hints.push(`Первая буква: ${h.name[0]}`);
  return hints;
}

export function portraitView(h: Hero, wrong: number, done: boolean) {
  const level = done ? LEVEL_COLS.length : Math.min(PORTRAIT_TRIES, wrong + 1);
  return { art: renderArt(h.id, level), level, hints: portraitHints(h, wrong, done) };
}

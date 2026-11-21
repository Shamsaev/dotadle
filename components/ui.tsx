"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Art, Cell, HEROES, PublicUser, PuzzleView, copyText, ext, faceUrl, norm, shareText, tries } from "./client";

// ---------- Аватар и имя игрока ----------
// По умолчанию — аватарка Discord/Google; если игрок выбрал героя или аватарки нет — герой
export function Avatar({ u, size = 28 }: { u?: Partial<PublicUser> | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const own = !u?.useHero && u?.image && !broken ? ext(u.image) : undefined;
  return <img className="ava" src={own ?? faceUrl(u?.hero)} alt="" width={size} height={size} style={{ width: size, height: size }}
    referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}
export function UserName({ u }: { u?: Partial<PublicUser> | null }) {
  if (!u) return <span>Игрок</span>;
  return (
    <span className="uname" style={u.color ? { color: u.color } : undefined}>
      {u.name}{u.sup && <span className="badge" title="Саппортер">⭐</span>}
    </span>
  );
}
export function UserChip({ u, size = 26 }: { u?: Partial<PublicUser> | null; size?: number }) {
  return <span className="uchip"><Avatar u={u} size={size} /><UserName u={u} /></span>;
}

// ---------- Поиск героя ----------
export function HeroSearch({ exclude, onPick, disabled, placeholder }: {
  exclude: Set<number>; onPick: (id: number) => void; disabled?: boolean; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const options = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    const scored = HEROES.filter((h) => !exclude.has(h.id)).map((h) => {
      const name = norm(h.name);
      let s = -1;
      if (name.startsWith(n)) s = 0;
      else if (h.ru.some((r) => norm(r).startsWith(n))) s = 1;
      else if (h.aliases.some((a) => norm(a) === n)) s = 1;
      else if (name.includes(n)) s = 2;
      else if (h.ru.some((r) => norm(r).includes(n)) || h.aliases.some((a) => norm(a).startsWith(n))) s = 3;
      return { h, s };
    }).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.h.name.localeCompare(b.h.name));
    return scored.slice(0, 24).map((x) => x.h);
  }, [q, exclude]);

  const pick = (id: number) => { setQ(""); setSel(0); onPick(id); ref.current?.focus(); };
  return (
    <div className="search">
      <input ref={ref} value={q} disabled={disabled} placeholder={placeholder ?? "Введи имя героя (можно по-русски)…"}
        autoComplete="off" autoCorrect="off" spellCheck={false}
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, options.length - 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, 0)); e.preventDefault(); }
          if (e.key === "Enter" && options[sel]) pick(options[sel].id);
          if (e.key === "Escape") setQ("");
        }} />
      {options.length > 0 && (
        <div className="list">
          {options.map((h, i) => (
            <div key={h.id} className={i === sel ? "sel" : ""} onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); pick(h.id); }}>
              <img src={faceUrl(h.slug)} alt="" loading="lazy" />
              <span>{h.name}</span>
              {h.ru[0] && <small>{h.ru[0]}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Классика: таблица подсказок ----------
export function ClassicRows({ columns, rows, animateFirst }: { columns: string[]; rows: Cell[][]; animateFirst: boolean }) {
  if (!rows.length) return null;
  const list = [...rows].reverse();
  return (
    <div className="board">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {list.map((cells, ri) => (
            <tr key={String(cells[0].v)}>
              {cells.map((c, i) => {
                const style = animateFirst && ri === 0 ? { animation: `flip .45s ease ${i * 0.1}s both` } : undefined;
                if (i === 0) return (
                  <td key={i} className={`hero ${c.s}`} style={style} title={String(c.v)}>
                    <img src={c.img} alt="" /><em>{c.v}</em>
                  </td>
                );
                return (
                  <td key={i} className={`${c.s}${c.arrow ? ` arrow ${c.arrow}` : ""}`} style={style}>
                    <span>{typeof c.v === "number" ? <b className="num">{c.v}</b> : c.v}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Портрет из символов ----------
export function AsciiArt({ art }: { art: Art }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cv = ref.current, box = wrap.current;
    if (!cv || !box) return;
    const draw = () => {
      const W = Math.min(box.clientWidth - 16, 380, (window.innerHeight * 0.55) / ((art.rows / art.cols) / 0.6));
      const cw = W / art.cols, ch = cw / 0.6, H = art.rows * ch;
      const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `700 ${Math.floor(ch * 0.92)}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const big = art.cols <= 15;
      for (let y = 0; y < art.rows; y++) for (let x = 0; x < art.cols; x++) {
        const i = y * art.cols + x;
        const c = art.chars[i];
        if (c === " ") continue;
        const col = "#" + art.colors.slice(i * 3, i * 3 + 3);
        if (big) { ctx.globalAlpha = 0.22; ctx.fillStyle = col; ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2); }
        ctx.globalAlpha = 1; ctx.fillStyle = col;
        ctx.fillText(c, x * cw + cw / 2, y * ch + ch / 2);
      }
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(box);
    return () => ro.disconnect();
  }, [art]);
  return <div className="art" ref={wrap}><canvas ref={ref} /></div>;
}

// ---------- Панель загадки (классика или портрет) ----------
export function Puzzle({ view, onGuess, busy, title, points, extra, footer }: {
  view: PuzzleView; onGuess: (id: number) => void; busy?: boolean; title: string; points?: number | null;
  extra?: React.ReactNode; footer?: React.ReactNode;
}) {
  const [anim, setAnim] = useState(false);
  const prev = useRef(view.attempts);
  useEffect(() => { setAnim(view.attempts > prev.current); prev.current = view.attempts; }, [view.attempts]);
  const done = view.solved || view.failed;
  const exclude = useMemo(() => new Set(view.mode === "c"
    ? (view.rows ?? []).map((r) => HEROES.find((h) => h.name === r[0].v)?.id ?? -1)
    : (view.guesses ?? []).map((g) => g.id)), [view]);
  const [copied, setCopied] = useState(false);

  return (
    <div className="puzzle">
      {view.mode === "p" && view.art && (
        <div className="portrait">
          <AsciiArt art={view.art} />
          <div className="pside">
            <div className="tries">{Array.from({ length: view.tries ?? 6 }, (_, i) => {
              const g = view.guesses?.[i];
              return <span key={i} className={g ? (g.ok ? "ok" : "no") : ""} title={g?.name}>{g ? <img src={g.img} alt="" /> : i + 1}</span>;
            })}</div>
            {!!view.hints?.length && <ul className="hints">{view.hints.map((h) => <li key={h}>💡 {h}</li>)}</ul>}
            {!done && <p className="sub">Осталось попыток: {(view.tries ?? 6) - view.attempts}</p>}
          </div>
        </div>
      )}

      {!done && <HeroSearch exclude={exclude} onPick={onGuess} disabled={busy} />}
      {extra}

      {done && view.answer && (
        <div className={`win ${view.failed ? "lose" : ""}`}>
          <img className="full" src={view.answer.full} alt="" />
          <div>
            <h2>{view.solved ? `Это ${view.answer.name}!` : `Это был ${view.answer.name}`}</h2>
            <div>{view.solved ? `Угадано за ${tries(view.attempts)}` : "Не угадано"}</div>
            {points != null && <div className="pts">+{points}</div>}
            <button className="btn" onClick={async () => { setCopied(await copyText(shareText(view, title, points))); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? "Скопировано ✓" : "📤 Поделиться"}
            </button>
          </div>
        </div>
      )}

      {view.mode === "c" && view.columns && <ClassicRows columns={view.columns} rows={view.rows ?? []} animateFirst={anim} />}
      {footer}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, React.ReactNode][] }) {
  return (
    <div className="seg">
      {items.map(([k, label]) => <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{label}</button>)}
    </div>
  );
}

export function Err({ msg, onClose }: { msg: string; onClose: () => void }) {
  if (!msg) return null;
  return <div className="err" onClick={onClose}>{msg}</div>;
}

export function Locked({ what, kind }: { what: string; kind: "supporter" | "league" }) {
  return (
    <div className="locked">
      <div className="lockicon">{kind === "supporter" ? "⭐" : "🏆"}</div>
      <h3>{what}</h3>
      <p>{kind === "supporter"
        ? "Это открывается саппортерам: поддержи проект и активируй код в профиле."
        : "Это функция Лиги+. Админ сервера может активировать её кодом в профиле."}</p>
    </div>
  );
}

export { ext };

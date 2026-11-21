"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleView, api, fmtLeft } from "./client";
import { Err, Puzzle } from "./ui";

type DailyState = PuzzleView & { day: string; nextIn: number; points: number | null; first: boolean };

export default function Daily({ mode }: { mode: "c" | "p" }) {
  const [s, setS] = useState<DailyState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const deadline = useRef(0);

  const load = useCallback(async () => {
    try { const d = await api<DailyState>(`daily?mode=${mode}`); setS(d); deadline.current = Date.now() + d.nextIn * 1000; }
    catch (e) { setErr((e as Error).message); }
  }, [mode]);
  useEffect(() => { setS(null); load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!deadline.current) return;
      const l = (deadline.current - Date.now()) / 1000;
      setLeft(l);
      if (l <= 0) { deadline.current = 0; setTimeout(load, 1500); }
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const guess = async (heroId: number) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { setS(await api<DailyState>("daily/guess", { mode, heroId })); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  if (!s) return <div className="center small"><div className="spinner" /></div>;
  const title = `Dotadle ${mode === "c" ? "🧩" : "🖼️"} ${s.day}`;
  return (
    <section>
      <div className="meta">
        <span>{mode === "c" ? "Угадай героя по параметрам" : "Угадай героя по портрету"}{s.first ? " · 🥇 первый сегодня" : ""}</span>
        <span>Новый через {fmtLeft(left)}</span>
      </div>
      <Err msg={err} onClose={() => setErr("")} />
      <Puzzle view={s} onGuess={guess} busy={busy} title={title} points={s.solved || s.failed ? s.points : null} />
      <p className="sub rules">{mode === "c"
        ? "Очки: 10 за первую попытку, потом на 1 меньше (минимум 1). Первый угадавший за день получает +2."
        : "6 попыток. Очки: 6 за первую, потом на 1 меньше. После 3, 4 и 5 ошибок открываются подсказки."}</p>
    </section>
  );
}

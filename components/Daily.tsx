"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleView, api, fmtLeft } from "./client";
import { Err, Puzzle } from "./ui";

type DailyState = PuzzleView & { day: string; nextIn: number; points: number | null; first: boolean; streak: number };

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
      <p className="lead">{mode === "c" ? "Угадай героя дня по параметрам" : "Угадай героя дня по портрету"}{s.first ? " · 🥇 ты первый сегодня" : ""}{!s.solved && s.streak >= 1 ? ` · 🔥 ${s.streak}` : ""}</p>
      <Err msg={err} onClose={() => setErr("")} />
      <Puzzle view={s} onGuess={guess} busy={busy} title={title} points={s.solved || s.failed ? s.points : null} streak={s.streak} />
      <p className="next">Новый герой через {fmtLeft(left)}</p>
    </section>
  );
}

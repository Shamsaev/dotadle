"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PuzzleView, api } from "./client";
import { Err, Locked, Puzzle, Tabs } from "./ui";
import { useApp } from "./App";

type EndlessState = PuzzleView & { streak: number; total: number };

export default function Practice() {
  const { me } = useApp();
  const [kind, setKind] = useState<"endless" | "archive">("endless");
  const [mode, setMode] = useState<"c" | "p">("c");
  if (!me.can.supporter) return <Locked kind="supporter" what="Бесконечный режим и архив прошлых дней" />;
  return (
    <section>
      <Tabs value={kind} onChange={setKind} items={[["endless", "♾️ Бесконечный"], ["archive", "📅 Архив"]]} />
      <Tabs value={mode} onChange={setMode} items={[["c", "🧩 Классика"], ["p", "🖼️ Портрет"]]} />
      {kind === "endless" ? <Endless key={mode} mode={mode} /> : <Archive key={mode} mode={mode} />}
      <p className="sub rules">В практике очки не начисляются, тут можно просто тренироваться.</p>
    </section>
  );
}

function Endless({ mode }: { mode: "c" | "p" }) {
  const [s, setS] = useState<EndlessState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<EndlessState>(`endless?mode=${mode}`).then(setS).catch((e) => setErr(e.message)); }, [mode]);
  const call = async (path: string, body: Record<string, unknown> = {}) => {
    if (busy) return; setBusy(true); setErr("");
    try { setS(await api<EndlessState>(path, { mode, ...body })); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  if (!s) return <div className="center small"><div className="spinner" /><Err msg={err} onClose={() => setErr("")} /></div>;
  const done = s.solved || s.failed;
  return (
    <>
      <div className="meta"><span>Серия: 🔥 {s.streak}</span><span>Сыграно: {s.total}</span></div>
      <Err msg={err} onClose={() => setErr("")} />
      <Puzzle view={s} onGuess={(heroId) => call("endless/guess", { heroId })} busy={busy} title="Dotadle ♾️"
        footer={<div className="row">
          {done ? <button className="btn big" onClick={() => call("endless/next")}>Следующий герой →</button>
            : <button className="btn ghost small" onClick={() => call("endless/giveup")}>Сдаться</button>}
        </div>} />
    </>
  );
}

function Archive({ mode }: { mode: "c" | "p" }) {
  const { me } = useApp();
  const days = useMemo(() => {
    const out: string[] = [];
    let t = Date.parse(me.today + "T00:00:00Z") - 86400_000;
    const stop = Date.parse(me.launchDay + "T00:00:00Z");
    while (t >= stop && out.length < 365) { out.push(new Date(t).toISOString().slice(0, 10)); t -= 86400_000; }
    return out;
  }, [me.today, me.launchDay]);
  const [day, setDay] = useState(days[0] ?? "");
  const [s, setS] = useState<PuzzleView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { if (day) api<PuzzleView>(`archive?mode=${mode}&day=${day}`).then(setS).catch((e) => setErr(e.message)); }, [day, mode]);
  useEffect(() => { setS(null); load(); }, [load]);
  if (!days.length) return <p className="sub">Архив появится завтра 🙂</p>;
  return (
    <>
      <select className="sel" value={day} onChange={(e) => setDay(e.target.value)}>
        {days.map((d) => <option key={d} value={d}>{d.split("-").reverse().join(".")}</option>)}
      </select>
      <Err msg={err} onClose={() => setErr("")} />
      {s && <Puzzle view={s} busy={busy} title={`Dotadle архив ${day}`} onGuess={async (heroId) => {
        setBusy(true); setErr("");
        try { setS(await api<PuzzleView>("archive/guess", { mode, day, heroId })); } catch (e) { setErr((e as Error).message); }
        setBusy(false);
      }} />}
    </>
  );
}

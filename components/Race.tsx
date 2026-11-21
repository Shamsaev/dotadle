"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Answer, PublicUser, PuzzleView, api, copyText, inDiscord } from "./client";
import { Avatar, Err, Puzzle, Tabs, UserChip, UserName } from "./ui";
import { useApp } from "./App";

type Standing = { uid: string; attempts: number; done: "win" | "fail" | null; ms: number | null; place: number | null; pts: number; user: PublicUser };
type Room = {
  rid: string; now: number; lid: string | null;
  players: (PublicUser & { online: boolean })[];
  round: null | { n: number; mode: "c" | "p"; status: "live" | "done"; startsAt: number; endsAt: number; by: string;
    me: PuzzleView | null; standings: Standing[]; answer: Answer | null };
};
const MEDAL = ["🥇", "🥈", "🥉"];
const secs = (ms: number | null) => (ms == null ? "" : `${(ms / 1000).toFixed(1)} с`);

export default function Race() {
  const { me, roomId, activeLid } = useApp();
  const [rid, setRid] = useState<string | null>(roomId);
  const [room, setRoom] = useState<Room | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"c" | "p">("c");
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const offset = useRef(0);
  const [copied, setCopied] = useState(false);

  const apply = (r: Room) => { offset.current = r.now - Date.now(); setRoom(r); };

  const join = useCallback(async (id: string) => {
    try { apply(await api<Room>("race/join", { rid: id, lid: activeLid })); setRid(id); setErr(""); }
    catch (e) { setErr((e as Error).message); setRid(null); }
  }, [activeLid]);

  useEffect(() => { if (roomId) join(roomId); }, [roomId, join]);

  // опрос состояния: чаще во время раунда, реже в ожидании, пауза при скрытой вкладке
  useEffect(() => {
    if (!rid) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try { apply(await api<Room>(`race/state?rid=${encodeURIComponent(rid)}`)); } catch (e) { setErr((e as Error).message); }
      }
      const live = room?.round?.status === "live";
      timer = setTimeout(tick, live ? 1500 : 4000);
    };
    timer = setTimeout(tick, 1500);
    return () => { stop = true; clearTimeout(timer); };
  }, [rid, room?.round?.status]);

  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 250); return () => clearInterval(t); }, []);

  const act = async (path: string, body: Record<string, unknown>) => {
    if (busy) return; setBusy(true); setErr("");
    try { apply(await api<Room>(path, { rid, ...body })); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  if (!rid) {
    return (
      <section>
        <div className="card">
          <h3>⚡ Гонка</h3>
          <p className="sub">Все в комнате угадывают одного героя на скорость. 1 место: +5, 2 место: +3, 3 место: +2, остальные угадавшие: +1.
            Лучше всего играть в Discord: запусти Activity в голосовом канале, и комната создастся сама.</p>
          <div className="row">
            <button className="btn" onClick={async () => { try { const r = await api<Room>("race/create", { lid: activeLid }); apply(r); setRid(r.rid); } catch (e) { setErr((e as Error).message); } }}>Создать комнату</button>
          </div>
          <div className="row">
            <input placeholder="Код комнаты" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
            <button className="btn ghost" onClick={() => code && join(`w${code}`)}>Войти</button>
          </div>
        </div>
        <Err msg={err} onClose={() => setErr("")} />
      </section>
    );
  }
  if (!room) return <div className="center small"><div className="spinner" /><Err msg={err} onClose={() => setErr("")} /></div>;

  const now = Date.now() + offset.current;
  const r = room.round;
  const live = r?.status === "live";
  const countdown = live && now < r.startsAt ? Math.ceil((r.startsAt - now) / 1000) : 0;
  const timeLeft = live ? Math.max(0, Math.ceil((r.endsAt - now) / 1000)) : 0;
  const webCode = room.rid.startsWith("w") ? room.rid.slice(1) : null;

  return (
    <section className="race">
      <div className="players">
        {room.players.map((p) => (
          <span key={p.uid} className={`pl ${p.online ? "" : "off"}`} title={p.online ? "в игре" : "отошёл"}>
            <Avatar u={p} size={24} /><UserName u={p} />
          </span>
        ))}
      </div>
      {webCode && !inDiscord && (
        <div className="note">Комната <b>{webCode}</b>. Позови друзей:{" "}
          <button className="link" onClick={async () => { setCopied(await copyText(`${location.origin}/?room=${webCode}`)); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? "ссылка скопирована ✓" : "скопировать ссылку"}</button>
        </div>
      )}
      <Err msg={err} onClose={() => setErr("")} />

      {!live && (
        <div className="card">
          <h3>{r ? `Раунд ${r.n} завершён` : "Готовы?"}</h3>
          {r?.answer && (
            <div className="raceans"><img src={r.answer.img} alt="" /><span>Загадан был <b>{r.answer.name}</b></span></div>
          )}
          {r && <Standings list={r.standings} final />}
          <div className="row">
            <Tabs value={mode} onChange={setMode} items={[["c", "🧩 Классика"], ["p", "🖼️ Портрет"]]} />
            <button className="btn big" disabled={busy} onClick={() => act("race/start", { mode })}>{r ? "Ещё раунд" : "Начать раунд"}</button>
          </div>
          <p className="sub">Очки за гонку идут в рейтинг, если в раунде участвовали хотя бы двое.</p>
        </div>
      )}

      {live && countdown > 0 && <div className="countdown">{countdown}</div>}

      {live && countdown === 0 && (
        <>
          <div className="meta">
            <span>Раунд {r.n} · {r.mode === "c" ? "классика" : "портрет"}</span>
            <span className={timeLeft <= 15 ? "hot" : ""}>⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span>
          </div>
          <Standings list={r.standings} />
          {r.me && (r.me.solved || r.me.failed) ? (
            <div className="card center">
              <h3>{r.me.solved ? `✅ Угадано за ${r.me.attempts}!` : "❌ Попытки кончились"}</h3>
              <p className="sub">Ждём остальных…</p>
            </div>
          ) : r.me && <Puzzle view={r.me} onGuess={(heroId) => act("race/guess", { heroId })} busy={busy} title="Dotadle ⚡ гонка" />}
          {r.by === me.user.uid && <button className="btn ghost small" onClick={() => act("race/end", {})}>Закончить раунд</button>}
        </>
      )}
    </section>
  );
}

function Standings({ list, final }: { list: Standing[]; final?: boolean }) {
  if (!list.length) return <p className="sub">{final ? "Никто не сыграл." : "Пока никто не сделал ни одной попытки"}</p>;
  return (
    <div className="standings">
      {list.map((s) => (
        <div key={s.uid} className={s.done === "win" ? "won" : s.done === "fail" ? "lost" : ""}>
          <span className="place">{s.place ? MEDAL[s.place - 1] ?? `${s.place}.` : s.done === "fail" ? "❌" : final ? "—" : "…"}</span>
          <UserChip u={s.user} size={22} />
          <span className="sub">{s.attempts} поп.{s.ms != null ? ` · ${secs(s.ms)}` : ""}</span>
          {final && s.pts > 0 && <b className="plus">+{s.pts}</b>}
        </div>
      ))}
    </div>
  );
}

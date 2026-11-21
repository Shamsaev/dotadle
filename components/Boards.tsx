"use client";
import { useEffect, useMemo, useState } from "react";
import { PublicUser, Tournament, api, ext } from "./client";
import { Err, Locked, Tabs, UserChip } from "./ui";
import { useApp } from "./App";

type TodayRow = { user: PublicUser; c: { attempts: number; points: number; first: boolean; solved: boolean } | null; p: { attempts: number; points: number; solved: boolean } | null; points: number };
type Board =
  | { kind: "today"; rows: TodayRow[] }
  | { kind: "points"; rows: { place: number; user: PublicUser; points: number }[]; mine: { user: PublicUser; points: number } | null; tournament: Tournament | null };

const MEDAL = ["🥇", "🥈", "🥉"];
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const monthName = (s: string) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
const MODE_RU = { c: "классика", p: "портрет", r: "гонка" };
export const fmtDay = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

export default function Boards() {
  const { me, activeLid, setActiveLid } = useApp();
  const [scope, setScope] = useState<string>(activeLid && me.leagues.some((l) => l.id === activeLid) ? activeLid : "global");
  const [period, setPeriod] = useState<"today" | "season" | "all" | "tours">("today");
  const [month, setMonth] = useState(me.today.slice(0, 7));
  const [tid, setTid] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const league = me.leagues.find((l) => l.id === scope) ?? null;

  const months = useMemo(() => {
    const out: string[] = [];
    let y = Number(me.today.slice(0, 4)), m = Number(me.today.slice(5, 7));
    const stop = me.launchDay.slice(0, 7);
    for (let i = 0; i < 24; i++) {
      const s = `${y}-${String(m).padStart(2, "0")}`;
      out.push(s);
      if (s <= stop) break;
      m--; if (!m) { m = 12; y--; }
    }
    return out;
  }, [me.today, me.launchDay]);

  const locked = !!league && !league.plus && (period === "season" || period === "tours");
  const query = period === "tours" ? (tid ? `t:${tid}` : null) : period === "season" ? `season:${month}` : period;

  useEffect(() => {
    setBoard(null); setErr("");
    if (!query || locked) return;
    api<Board>(`board?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(query)}`).then(setBoard).catch((e) => setErr(e.message));
  }, [scope, query, locked]);

  const tours = league?.tournaments ?? [];

  return (
    <section>
      <div className="scopes">
        <button className={scope === "global" ? "on" : ""} onClick={() => { setScope("global"); if (period === "tours") setPeriod("today"); }}>🌍 Все игроки</button>
        {me.leagues.map((l) => (
          <button key={l.id} className={scope === l.id ? "on" : ""} onClick={() => { setScope(l.id); setActiveLid(l.id); setTid(null); }}>
            {l.icon ? <img src={ext(l.icon)} alt="" /> : <span>{l.type === "guild" ? "🛡️" : "👥"}</span>}
            {l.name}{l.premium && <b className="plusbadge">+</b>}
          </button>
        ))}
      </div>

      <Tabs value={period} onChange={(v) => { setPeriod(v); setTid(null); }} items={[
        ["today", "Сегодня"], ["season", "Сезон"], ["all", "Всё время"], ...(league ? [["tours", "Турниры"] as ["tours", string]] : []),
      ]} />

      {period === "season" && !locked && (
        <select className="sel" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>Сезон: {monthName(m)}{m === me.today.slice(0, 7) ? " (текущий)" : ""}</option>)}
        </select>
      )}

      {locked && <Locked kind="league" what={period === "season" ? "Сезоны лиги" : "Турниры лиги"} />}

      {period === "tours" && !locked && !tid && (
        <div className="tours">
          {!tours.length && <p className="sub">Турниров пока нет. {league?.admin ? "Создай турнир в профиле, во вкладке «Лиги»." : "Попроси админа сервера создать турнир."}</p>}
          {tours.map((t) => (
            <button key={t.id} className="tour" onClick={() => setTid(t.id)}>
              <div><b>{t.name}</b> {t.active ? <span className="live">идёт</span> : t.finished ? <span className="sub">завершён</span> : <span className="sub">скоро</span>}</div>
              <div className="sub">{fmtDay(t.start)}–{fmtDay(t.end)} · {t.modes.map((m) => MODE_RU[m]).join(", ")}</div>
              {t.sponsor && <div className="sponsor-mini">🤝 {t.sponsor.name}{t.sponsor.prize ? ` · 🎁 ${t.sponsor.prize}` : ""}</div>}
            </button>
          ))}
        </div>
      )}

      <Err msg={err} onClose={() => setErr("")} />

      {board?.kind === "points" && board.tournament && (
        <div className="tourhead">
          <button className="link" onClick={() => setTid(null)}>← все турниры</button>
          <h3>{board.tournament.name}</h3>
          <div className="sub">{fmtDay(board.tournament.start)}–{fmtDay(board.tournament.end)} · {board.tournament.modes.map((m) => MODE_RU[m]).join(", ")}</div>
          {board.tournament.sponsor && <Sponsor s={board.tournament.sponsor} />}
        </div>
      )}

      {board?.kind === "today" && (
        <div className="rank">
          {!board.rows.length && <p className="empty">Сегодня ещё никто не доиграл</p>}
          {board.rows.map((r, i) => (
            <div key={r.user.uid} className={r.user.uid === me.user.uid ? "me" : ""}>
              <span className="pos">{MEDAL[i] ?? `${i + 1}.`}</span>
              <UserChip u={r.user} />
              <span className="detail">
                {r.c && <span title="Классика">🧩 {r.c.attempts}{r.c.first ? "🥇" : ""}</span>}
                {r.p && <span title="Портрет">🖼️ {r.p.solved ? r.p.attempts : "✗"}</span>}
              </span>
              <b>+{r.points}</b>
            </div>
          ))}
        </div>
      )}
      {board?.kind === "points" && (
        <div className="rank">
          {!board.rows.length && <p className="empty">Пока пусто</p>}
          {board.rows.map((r) => (
            <div key={r.user.uid} className={r.user.uid === me.user.uid ? "me" : ""}>
              <span className="pos">{MEDAL[r.place - 1] ?? `${r.place}.`}</span>
              <UserChip u={r.user} />
              <span className="detail" />
              <b>{r.points}</b>
            </div>
          ))}
          {board.mine && board.mine.points > 0 && (
            <div className="me"><span className="pos">…</span><UserChip u={board.mine.user} /><span className="detail" /><b>{board.mine.points}</b></div>
          )}
        </div>
      )}
    </section>
  );
}

export function Sponsor({ s }: { s: NonNullable<Tournament["sponsor"]> }) {
  const body = (
    <>
      <span className="sp-label">Спонсор турнира</span>
      <b>{s.name}</b>
      {s.prize && <span className="sp-prize">🎁 Приз: {s.prize}</span>}
    </>
  );
  return s.url ? <a className="sponsor" href={s.url} target="_blank" rel="noopener noreferrer sponsored">{body}</a> : <div className="sponsor">{body}</div>;
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { HEROES, League, PublicUser, api, copyText, ext, faceUrl, inDiscord, norm, setBearer, storage } from "./client";
import { Avatar, Err, Locked, Tabs, UserChip } from "./ui";
import { useApp } from "./App";
import { Sponsor, fmtDay } from "./Boards";

const THEME_RU: Record<string, string> = { dark: "Тёмная", radiant: "Свет (Radiant)", dire: "Тьма (Dire)", aegis: "Аегис" };

export default function Profile() {
  const [sec, setSec] = useState<"me" | "leagues" | "support">("me");
  return (
    <section>
      <Tabs value={sec} onChange={setSec} items={[["me", "👤 Профиль"], ["leagues", "🛡️ Лиги"], ["support", "⭐ Поддержка"]]} />
      {sec === "me" && <MeSection />}
      {sec === "leagues" && <Leagues />}
      {sec === "support" && <Support />}
    </section>
  );
}

function MeSection() {
  const { me, reload } = useApp();
  const [q, setQ] = useState("");
  const [nick, setNick] = useState(me.user.nick ?? "");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const list = useMemo(() => { const n = norm(q); return n ? HEROES.filter((h) => norm(h.name).includes(n) || h.ru.some((r) => norm(r).includes(n))) : HEROES; }, [q]);
  const save = async (patch: Record<string, unknown>) => {
    setErr("");
    try { await api("me", patch); await reload(); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <div className="card profile-head">
        <Avatar u={{ hero: me.user.hero, image: me.user.image, useHero: me.user.useHero }} size={72} />
        <div>
          <h3 style={{ color: me.user.color }}>{me.user.nick || me.user.name}{me.supporter.active && " ⭐"}</h3>
          <div className="sub">{me.user.uid.split(":")[0] === "discord" ? "Discord" : me.user.uid.split(":")[0] === "google" ? "Google" : "Аккаунт"} · {me.user.name}</div>
        </div>
        {saved && <span className="okmsg">Сохранено ✓</span>}
      </div>
      <Err msg={err} onClose={() => setErr("")} />
      <div className="card">
        <h4>Имя в рейтинге</h4>
        <div className="row">
          <input value={nick} maxLength={24} placeholder={me.user.name} onChange={(e) => setNick(e.target.value)} />
          <button className="btn" onClick={() => save({ nick })}>Сохранить</button>
        </div>
      </div>
      <div className="card">
        <h4>Аватарка</h4>
        {me.user.image && (
          <div className="avsrc">
            <button className={!me.user.useHero ? "on" : ""} onClick={() => save({ useHero: false })}>
              <Avatar u={{ image: me.user.image }} size={28} /> {me.user.uid.startsWith("google") ? "Из Google" : "Из Discord"}
            </button>
            <button className={me.user.useHero ? "on" : ""} onClick={() => save({ useHero: true })}>
              <Avatar u={{ hero: me.user.hero, useHero: true }} size={28} /> Герой
            </button>
          </div>
        )}
        <p className="sub">Или выбери героя:</p>
        <input placeholder="Найти героя…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="herogrid">
          {list.map((h) => (
            <button key={h.slug} className={me.user.hero === h.slug ? "on" : ""} title={h.name} onClick={() => save({ hero: h.slug })}>
              <img src={faceUrl(h.slug)} alt={h.name} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h4>Цвет ника и тема {!me.can.supporter && <span className="sub">· для саппортеров ⭐</span>}</h4>
        <div className="colors">
          <button className={!me.user.color ? "on" : ""} disabled={!me.can.supporter} onClick={() => save({ color: "" })}>✕</button>
          {me.colors.map((c) => <button key={c} disabled={!me.can.supporter} className={me.user.color === c ? "on" : ""} style={{ background: c }} onClick={() => save({ color: c })} />)}
        </div>
        <div className="themes">
          {me.themes.map((t) => <button key={t} data-th={t} disabled={!me.can.supporter} className={(me.user.theme || "dark") === t ? "on" : ""} onClick={() => save({ theme: t })}>{THEME_RU[t] ?? t}</button>)}
        </div>
      </div>
      <Stats />
      {!inDiscord && (
        <button className="btn ghost small" onClick={async () => {
          storage("devtoken", null); setBearer(null);
          const { signOut } = await import("next-auth/react"); await signOut({ redirect: false }); location.reload();
        }}>Выйти</button>
      )}
    </>
  );
}

function Stats() {
  const { me } = useApp();
  const [s, setS] = useState<Record<string, number | string> | null>(null);
  useEffect(() => { if (me.can.supporter) api<Record<string, number>>("stats").then(setS).catch(() => {}); }, [me.can.supporter]);
  if (!me.can.supporter) return <Locked kind="supporter" what="Личная статистика" />;
  if (!s) return null;
  const n = (k: string) => Number(s[k] ?? 0);
  const dist = Array.from({ length: 11 }, (_, i) => n(`cd${i + 1}`));
  const mx = Math.max(1, ...dist);
  return (
    <div className="card">
      <h4>Статистика</h4>
      <div className="stats">
        <div><b>{n("c_wins")}</b><span>побед в классике</span></div>
        <div><b>{n("c_wins") ? (n("c_attempts") / n("c_wins")).toFixed(1) : "—"}</b><span>попыток в среднем</span></div>
        <div><b>🔥 {n("streak")}</b><span>серия (лучшая {n("best_streak")})</span></div>
        <div><b>{n("c_first")}</b><span>раз первым</span></div>
        <div><b>{n("p_wins")}/{n("p_played")}</b><span>портретов угадано</span></div>
        <div><b>{n("r_wins")}</b><span>побед в гонках из {n("r_played")}</span></div>
      </div>
      <h4>Попыток до победы в классике</h4>
      <div className="dist">
        {dist.map((v, i) => (
          <div key={i}><span>{i === 10 ? "11+" : i + 1}</span><i style={{ width: `${(v / mx) * 100}%` }}>{v || ""}</i></div>
        ))}
      </div>
    </div>
  );
}

function Leagues() {
  const { me, reload } = useApp();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const call = async (path: string, body: Record<string, unknown>) => {
    setErr("");
    try { await api(path, body); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <Err msg={err} onClose={() => setErr("")} />
      {!me.leagues.length && <p className="sub">Ты пока не в лигах. Запусти игру в Discord на своём сервере, и лига сервера появится сама. Или создай свою лигу для друзей.</p>}
      {me.leagues.map((l) => (
        <div key={l.id} className="card league">
          <div className="lhead">
            {l.icon ? <img src={ext(l.icon)} alt="" /> : <span className="licon">{l.type === "guild" ? "🛡️" : "👥"}</span>}
            <div>
              <b>{l.name}</b> {l.premium ? <span className="plusbadge">Лига+</span> : null}
              <div className="sub">{l.type === "guild" ? "Discord-сервер" : "Своя лига"} · игроков: {l.members}{l.admin ? " · ты админ" : ""}
                {l.premium && l.premiumUntil ? ` · Лига+ до ${new Date(l.premiumUntil).toLocaleDateString("ru-RU")}` : ""}</div>
            </div>
          </div>
          {l.code && (
            <div className="row">
              <span className="sub">Код для друзей: <b className="code">{l.code}</b></span>
              <button className="link" onClick={async () => { if (await copyText(l.code!)) { setCopied(l.id); setTimeout(() => setCopied(""), 1500); } }}>{copied === l.id ? "скопировано ✓" : "копировать"}</button>
              <button className="link danger" onClick={() => confirm(`Выйти из лиги «${l.name}»?`) && call("league/leave", { lid: l.id })}>выйти</button>
            </div>
          )}
          {l.admin && <WebhookAdmin league={l} />}
          {l.admin && <TournamentAdmin league={l} />}
        </div>
      ))}
      <div className="card">
        <h4>Своя лига</h4>
        <div className="row">
          <input placeholder="Название, например «Пати по пятницам»" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button className="btn" onClick={() => name && call("league/create", { name }).then(() => setName(""))}>Создать</button>
        </div>
        <div className="row">
          <input placeholder="Код лиги друга" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn ghost" onClick={() => code && call("league/join", { code }).then(() => setCode(""))}>Вступить</button>
        </div>
      </div>
    </>
  );
}

function WebhookAdmin({ league }: { league: League }) {
  const { reload } = useApp();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (u: string) => {
    setErr(""); setBusy(true);
    try { await api("league/webhook", { lid: league.id, url: u }); setUrl(""); setOpen(false); await reload(); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="tadmin">
      {league.webhook ? (
        <div className="row"><span>💬 Результаты приходят в Discord-канал ✅</span>
          <button className="link danger" onClick={() => confirm("Отключить сообщения в канал?") && save("")}>отключить</button></div>
      ) : !open ? (
        <button className="btn ghost small" onClick={() => setOpen(true)}>💬 Присылать результаты в канал</button>
      ) : (
        <div className="form">
          <p className="sub">В Discord: настройки нужного канала → <b>Интеграция</b> → <b>Вебхуки</b> → <b>Новый вебхук</b> → <b>Копировать URL вебхука</b>. Вставь ссылку сюда:</p>
          <input placeholder="https://discord.com/api/webhooks/…" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
          <Err msg={err} onClose={() => setErr("")} />
          <div className="row"><button className="btn" disabled={!url || busy} onClick={() => save(url)}>{busy ? "Проверяю…" : "Подключить"}</button>
            <button className="link" onClick={() => setOpen(false)}>отмена</button></div>
        </div>
      )}
    </div>
  );
}

function TournamentAdmin({ league }: { league: League }) {
  const { reload, me } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", start: me.today, end: me.today, modes: ["c", "p"] as string[], sName: "", sUrl: "", sPrize: "" });
  const [err, setErr] = useState("");
  if (!league.plus) return <p className="sub">🏆 Турниры и сезоны открываются в Лиге+. Активируй код Лиги+ во вкладке «Поддержка».</p>;
  const toggle = (m: string) => setF((x) => ({ ...x, modes: x.modes.includes(m) ? x.modes.filter((y) => y !== m) : [...x.modes, m] }));
  const create = async () => {
    setErr("");
    try {
      await api("tournament/create", { lid: league.id, name: f.name, start: f.start, end: f.end, modes: f.modes,
        sponsor: f.sName ? { name: f.sName, url: f.sUrl, prize: f.sPrize } : undefined });
      setOpen(false); await reload();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="tadmin">
      {league.tournaments.map((t) => (
        <div key={t.id} className="row">
          <span>🏆 <b>{t.name}</b> <span className="sub">{fmtDay(t.start)}–{fmtDay(t.end)}{t.sponsor ? ` · 🤝 ${t.sponsor.name}` : ""}</span></span>
          <button className="link danger" onClick={async () => { if (confirm("Удалить турнир?")) { await api("tournament/delete", { lid: league.id, id: t.id }); await reload(); } }}>удалить</button>
        </div>
      ))}
      {!open ? <button className="btn ghost small" onClick={() => setOpen(true)}>+ Новый турнир</button> : (
        <div className="form">
          <input placeholder="Название турнира" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="row">
            <label>С <input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
            <label>по <input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
          </div>
          <div className="row checks">
            {[["c", "🧩 Классика"], ["p", "🖼️ Портрет"], ["r", "⚡ Гонки"]].map(([k, l]) => (
              <label key={k}><input type="checkbox" checked={f.modes.includes(k)} onChange={() => toggle(k)} /> {l}</label>
            ))}
          </div>
          <h5>Спонсор (необязательно)</h5>
          <input placeholder="Название спонсора" value={f.sName} maxLength={60} onChange={(e) => setF({ ...f, sName: e.target.value })} />
          <input placeholder="Ссылка (https://…)" value={f.sUrl} maxLength={200} onChange={(e) => setF({ ...f, sUrl: e.target.value })} />
          <input placeholder="Приз, например «Arcana на выбор»" value={f.sPrize} maxLength={120} onChange={(e) => setF({ ...f, sPrize: e.target.value })} />
          {f.sName && <Sponsor s={{ name: f.sName, url: f.sUrl || undefined, prize: f.sPrize || undefined }} />}
          <Err msg={err} onClose={() => setErr("")} />
          <div className="row"><button className="btn" onClick={create}>Создать турнир</button><button className="link" onClick={() => setOpen(false)}>отмена</button></div>
        </div>
      )}
    </div>
  );
}

function Support() {
  const { me, reload } = useApp();
  const [code, setCode] = useState("");
  const [lid, setLid] = useState(me.leagues[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [wall, setWall] = useState<PublicUser[]>([]);
  useEffect(() => { api<PublicUser[]>("supporters").then(setWall).catch(() => {}); }, []);
  const donate = process.env.NEXT_PUBLIC_DONATE_URL;
  const isLeagueCode = code.trim().toUpperCase().startsWith("LIGA");
  const redeem = async () => {
    setErr(""); setMsg("");
    try {
      const r = await api<{ type: string; until: number }>("redeem", { code, lid: isLeagueCode ? lid : undefined });
      setMsg(r.type === "supporter" ? `Спасибо! ⭐ Саппортер до ${new Date(r.until).toLocaleDateString("ru-RU")}` : `Лига+ активна до ${new Date(r.until).toLocaleDateString("ru-RU")}`);
      setCode(""); await reload();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <div className="card">
        <h3>⭐ Поддержать проект</h3>
        <p>Игра бесплатная и без рекламы. Если она тебе нравится, можно поддержать разработку и получить плюшки:</p>
        <ul className="perks">
          <li>⭐ значок саппортера и цветной ник в рейтингах</li>
          <li>🎨 темы оформления</li>
          <li>♾️ бесконечный режим и 📅 архив прошлых дней</li>
          <li>📊 личная статистика</li>
          <li>🏛️ имя в «Зале славы»</li>
        </ul>
        <p><b>Лига+</b> для сервера или своей лиги открывает месячные сезоны и турниры со своими спонсорами и призами.</p>
        {donate ? <a className="btn big" href={donate} target="_blank" rel="noopener noreferrer">Поддержать</a>
          : <p className="sub">Ссылка на донат появится, когда автор её добавит.</p>}
        {me.supporter.active && <p className="okmsg">Ты саппортер до {new Date(me.supporter.until).toLocaleDateString("ru-RU")} 💛</p>}
        {!me.paywall && <p className="sub">Сейчас идёт тестовый период: все функции открыты для всех.</p>}
      </div>
      <div className="card">
        <h4>Активировать код</h4>
        <div className="row">
          <input placeholder="SUP-XXXX или LIGA-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn" onClick={redeem} disabled={!code}>Активировать</button>
        </div>
        {isLeagueCode && (
          me.leagues.length ? (
            <select className="sel" value={lid} onChange={(e) => setLid(e.target.value)}>
              {me.leagues.map((l) => <option key={l.id} value={l.id}>Для лиги: {l.name}</option>)}
            </select>
          ) : <p className="sub">Сначала вступи в лигу или создай её.</p>
        )}
        {msg && <p className="okmsg">{msg}</p>}
        <Err msg={err} onClose={() => setErr("")} />
      </div>
      <div className="card">
        <h4>🏛️ Зал славы</h4>
        {!wall.length ? <p className="sub">Здесь будут те, кто поддержал проект.</p> : (
          <div className="wall">{wall.map((u) => <UserChip key={u.uid} u={u} />)}</div>
        )}
      </div>
    </>
  );
}

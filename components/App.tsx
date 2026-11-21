"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, Me, api, inDiscord, setBearer, setInDiscord, storage } from "./client";
import { Avatar, Err, UserName } from "./ui";
import Daily from "./Daily";
import Race from "./Race";
import Boards from "./Boards";
import Practice from "./Practice";
import Profile from "./Profile";

type Ctx = { me: Me; reload: () => Promise<void>; roomId: string | null; activeLid: string | null; setActiveLid: (l: string) => void };
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

type Tab = "classic" | "portrait" | "race" | "top" | "practice" | "profile";
const TABS: [Tab, string, string][] = [
  ["classic", "🧩", "Классика"], ["portrait", "🖼️", "Портрет"], ["race", "⚡", "Гонка"],
  ["top", "🏆", "Рейтинг"], ["practice", "♾️", "Практика"], ["profile", "👤", "Профиль"],
];

export default function App() {
  const [phase, setPhase] = useState<"boot" | "login" | "ready" | "error">("boot");
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("classic");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [activeLid, setActiveLidState] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const m = await api<Me>("me");
    setMe(m);
    document.documentElement.dataset.theme = m.user.theme || "dark";
  }, []);

  const setActiveLid = (l: string) => { setActiveLidState(l); storage("lid", l); };

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      try {
        if (params.has("frame_id")) {
          // ---- Запуск внутри Discord Activity ----
          setInDiscord(true);
          const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!;
          const { DiscordSDK } = await import("@discord/embedded-app-sdk");
          const sdk = new DiscordSDK(clientId);
          await sdk.ready();
          const { code } = await sdk.commands.authorize({
            client_id: clientId, response_type: "code", state: "", prompt: "none", scope: ["identify", "guilds"],
          });
          const res = await api<{ access_token: string; token: string; lid: string | null }>("discord/token", { code, guildId: sdk.guildId });
          await sdk.commands.authenticate({ access_token: res.access_token });
          setBearer(res.token);
          setRoomId(`i${sdk.instanceId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90));
          if (res.lid) setActiveLidState(res.lid);
        } else {
          // ---- Обычный сайт ----
          const dev = storage("devtoken");
          if (dev) setBearer(dev);
          const room = params.get("room");
          if (room) { setRoomId(`w${room}`); setTab("race"); }
          const saved = storage("lid");
          if (saved) setActiveLidState(saved);
        }
        await reload();
        setPhase("ready");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { storage("devtoken", null); setBearer(null); setPhase("login"); }
        else { setErr((e as Error).message || String(e)); setPhase("error"); }
      }
    })();
  }, [reload]);

  if (phase === "boot") return <div className="center"><div className="spinner" /><p className="sub">Загрузка…</p></div>;
  if (phase === "error") return <div className="center"><h2>Не получилось запуститься</h2><p className="sub">{err}</p><button className="btn" onClick={() => location.reload()}>Ещё раз</button></div>;
  if (phase === "login") return <Login />;
  if (!me) return null;

  return (
    <AppCtx.Provider value={{ me, reload, roomId, activeLid, setActiveLid }}>
      <main className="wrap">
        <header className="top">
          <h1>DOTA<span>DLE</span></h1>
          <button className="mechip" onClick={() => setTab("profile")}>
            <Avatar u={{ hero: me.user.hero }} size={30} />
            <UserName u={{ name: me.user.nick || me.user.name, color: me.user.color, sup: me.supporter.active }} />
          </button>
        </header>
        {me.memory && <div className="note">⚠️ База не подключена: данные хранятся в памяти и пропадут при перезапуске.</div>}
        <nav className="tabs">
          {TABS.map(([k, icon, label]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><span>{icon}</span><small>{label}</small></button>
          ))}
        </nav>
        <Err msg={err} onClose={() => setErr("")} />
        {tab === "classic" && <Daily mode="c" />}
        {tab === "portrait" && <Daily mode="p" />}
        {tab === "race" && <Race />}
        {tab === "top" && <Boards />}
        {tab === "practice" && <Practice />}
        {tab === "profile" && <Profile />}
        <footer className="foot">Фанатский проект, не связан с Valve. Dota 2 и герои принадлежат Valve Corporation.</footer>
      </main>
    </AppCtx.Provider>
  );
}

function Login() {
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }>>({});
  const [devName, setDevName] = useState("");
  useEffect(() => { fetch("/api/auth/providers").then((r) => r.json()).then(setProviders).catch(() => {}); }, []);
  const go = async (id: string) => { const { signIn } = await import("next-auth/react"); signIn(id); };
  const devLogin = async () => {
    const r = await api<{ token: string }>("dev-login", { name: devName || "Тестер" });
    storage("devtoken", r.token); location.reload();
  };
  return (
    <main className="wrap">
      <header className="top"><h1>DOTA<span>DLE</span></h1></header>
      <section className="hero-card">
        <h2>Угадай героя Dota 2</h2>
        <p>Каждый день новые загадки: <b>классика</b> по параметрам и <b>портрет из символов</b>, который становится чётче с каждой ошибкой.
          А с друзьями можно устроить <b>гонку</b> прямо в голосовом канале Discord.</p>
        <div className="logins">
          {providers.google && <button className="login google" onClick={() => go("google")}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Войти через Google</button>}
          {providers.discord && <button className="login discord" onClick={() => go("discord")}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>
            Войти через Discord</button>}
          {!providers.google && !providers.discord && <p className="sub">Вход ещё не настроен: добавь ключи Google или Discord (см. README).</p>}
        </div>
        {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && (
          <div className="devlogin">
            <input placeholder="Тестовое имя" value={devName} onChange={(e) => setDevName(e.target.value)} />
            <button className="btn" onClick={devLogin}>Тестовый вход</button>
          </div>
        )}
        <p className="sub">Вход нужен, чтобы сохранять очки в рейтинге.</p>
      </section>
      <footer className="foot">Фанатский проект, не связан с Valve.</footer>
    </main>
  );
}

export { inDiscord };

import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/auth";
import { SessionUser } from "./users";
import { GameError } from "./daily";

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

// Токен для Discord Activity (внутри iframe Discord куки ненадёжны, поэтому используем Bearer)
export async function issueToken(u: SessionUser) {
  return new SignJWT({ name: u.name, image: u.image ?? null })
    .setProtectedHeader({ alg: "HS256" }).setSubject(u.uid).setIssuedAt().setExpirationTime("7d").sign(key());
}

export class Unauthorized extends Error {}

export async function getUser(req: Request): Promise<SessionUser | null> {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) {
    try {
      const { payload } = await jwtVerify(h.slice(7), key());
      if (payload.sub) return { uid: payload.sub, name: String(payload.name ?? "Игрок"), image: (payload.image as string) ?? null };
    } catch { return null; }
  }
  const s = await auth();
  if (s?.user?.id) return { uid: s.user.id, name: s.user.name || "Игрок", image: s.user.image ?? null };
  return null;
}

type Handler = (u: SessionUser, body: Record<string, unknown>, url: URL) => Promise<unknown>;

// Обёртка для API: авторизация, разбор тела, ошибки
export function api(fn: Handler, opts: { public?: boolean } = {}) {
  return async (req: Request) => {
    try {
      const u = await getUser(req);
      if (!u && !opts.public) throw new Unauthorized();
      const body = req.method === "GET" ? {} : ((await req.json().catch(() => ({}))) as Record<string, unknown>);
      const data = await fn(u ?? { uid: "", name: "" }, body, new URL(req.url));
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof Unauthorized) return Response.json({ error: "Нужно войти" }, { status: 401 });
      if (e instanceof GameError) return Response.json({ error: e.message }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Ошибка сервера" }, { status: 500 });
    }
  };
}

export const str = (v: unknown, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const mode = (v: unknown) => {
  if (v === "c" || v === "p") return v;
  throw new GameError("Неверный режим");
};

import { NextRequest } from "next/server";
import { handlers } from "@/auth";

// Discord начал присылать параметр "iss" в ответе после входа (RFC 9207),
// а Auth.js его не ожидает и падает с ошибкой "unexpected iss". Убираем его перед обработкой.
function stripIss(req: NextRequest) {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/callback/discord") || !url.searchParams.has("iss")) return req;
  url.searchParams.delete("iss");
  return new NextRequest(url, req);
}

export const GET = (req: NextRequest) => handlers.GET(stripIss(req));
export const POST = (req: NextRequest) => handlers.POST(stripIss(req));

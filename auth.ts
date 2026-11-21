// Вход на сайте (вне Discord): Google или Discord через Auth.js.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import { syncGuilds } from "./lib/discord";
import { touchUser } from "./lib/users";

const providers = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_DISCORD_ID) providers.push(Discord({ authorization: { params: { scope: "identify guilds" } } }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const uid = `${account.provider}:${account.providerAccountId}`;
        token.uid = uid;
        await touchUser({ uid, name: token.name || "Игрок", image: token.picture ?? null });
        if (account.provider === "discord" && account.access_token) await syncGuilds(uid, account.access_token);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

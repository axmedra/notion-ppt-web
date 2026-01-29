import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

interface TokenRequestParams {
  params: { code?: string };
  provider: {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  };
}

interface UserinfoRequestParams {
  tokens: { access_token?: string };
}

interface NotionProfile {
  bot: {
    owner: {
      user: {
        id: string;
        name: string;
        avatar_url?: string;
      };
    };
  };
}

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "notion",
      name: "Notion",
      type: "oauth",
      authorization: {
        url: "https://api.notion.com/v1/oauth/authorize",
        params: {
          owner: "user",
          response_type: "code",
        },
      },
      token: {
        url: "https://api.notion.com/v1/oauth/token",
        async request({ params, provider }: TokenRequestParams) {
          const response = await fetch("https://api.notion.com/v1/oauth/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(
                `${provider.clientId}:${provider.clientSecret}`
              ).toString("base64")}`,
            },
            body: JSON.stringify({
              grant_type: "authorization_code",
              code: params.code,
              redirect_uri: provider.callbackUrl,
            }),
          });

          const tokens = await response.json();
          return { tokens };
        },
      },
      userinfo: {
        url: "https://api.notion.com/v1/users/me",
        async request({ tokens }: UserinfoRequestParams) {
          const response = await fetch("https://api.notion.com/v1/users/me", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Notion-Version": "2022-06-28",
            },
          });
          return response.json();
        },
      },
      profile(profile: NotionProfile) {
        return {
          id: profile.bot.owner.user.id,
          name: profile.bot.owner.user.name,
          image: profile.bot.owner.user.avatar_url,
        };
      },
      clientId: process.env.NOTION_CLIENT_ID,
      clientSecret: process.env.NOTION_CLIENT_SECRET,
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

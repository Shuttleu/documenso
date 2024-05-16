/// <reference types="../types/next-auth.d.ts" />
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { DateTime } from 'luxon';
import type { AuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';

import { prisma } from '@documenso/prisma';
import { IdentityProvider } from '@documenso/prisma/client';

const adapter = PrismaAdapter(prisma);
const _linkAccount = adapter.linkAccount;
adapter.linkAccount = async (account) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 'not-before-policy': _, refresh_expires_in, ...data } = account;
  return _linkAccount(data);
};

export const NEXT_AUTH_OPTIONS: AuthOptions = {
  adapter: adapter,
  secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  session: {
    strategy: 'jwt',
  },
  providers: [
    KeycloakProvider({
      clientId: process.env.NEXT_PRIVATE_OIDC_CLIENT_ID || '',
      clientSecret: process.env.NEXT_PRIVATE_OIDC_CLIENT_SECRET || '',
      issuer: process.env.NEXT_PRIVATE_OIDC_WELL_KNOWN,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, account }) {
      const merged = {
        ...token,
        ...user,
        emailVerified: user?.emailVerified ? new Date(user.emailVerified).toISOString() : null,
      } satisfies JWT;

      if (!merged.email || typeof merged.emailVerified !== 'string') {
        const userId = Number(merged.id ?? token.sub);

        let retrieved = await prisma.user.findFirst({
          where: {
            id: userId,
          },
        });

        if (!retrieved) {
          return token;
        }

        if (!retrieved.emailVerified) {
          retrieved = await prisma.user.update({
            where: {
              id: userId,
            },
            data: {
              emailVerified: new Date(),
            },
          });
        }

        merged.id = retrieved.id;
        merged.name = retrieved.name;
        merged.email = retrieved.email;
        merged.emailVerified = retrieved.emailVerified?.toISOString() ?? null;
      }

      if (
        merged.id &&
        (!merged.lastSignedIn ||
          DateTime.fromISO(merged.lastSignedIn).plus({ hours: 1 }) <= DateTime.now())
      ) {
        merged.lastSignedIn = new Date().toISOString();

        const user = await prisma.user.update({
          where: {
            id: Number(merged.id),
          },
          data: {
            lastSignedIn: merged.lastSignedIn,
          },
        });

        merged.emailVerified = user.emailVerified?.toISOString() ?? null;
      }

      if ((trigger === 'signIn' || trigger === 'signUp') && account?.provider === 'google') {
        merged.emailVerified = user?.emailVerified
          ? new Date(user.emailVerified).toISOString()
          : new Date().toISOString();

        await prisma.user.update({
          where: {
            id: Number(merged.id),
          },
          data: {
            emailVerified: merged.emailVerified,
            identityProvider: IdentityProvider.GOOGLE,
          },
        });
      }

      return {
        id: merged.id,
        name: merged.name,
        email: merged.email,
        lastSignedIn: merged.lastSignedIn,
        emailVerified: merged.emailVerified,
      } satisfies JWT;
    },

    session({ token, session }) {
      if (token && token.email) {
        return {
          ...session,
          user: {
            id: Number(token.id),
            name: token.name,
            email: token.email,
            emailVerified: token.emailVerified ?? null,
          },
        } satisfies Session;
      }

      return session;
    },

    signIn({ user }) {
      // We do this to stop OAuth providers from creating an account
      // when signups are disabled
      // if (env('NEXT_PUBLIC_DISABLE_SIGNUP') === 'true') {
      //   const userData = await getUserByEmail({ email: user.email! });
      //
      //   return !!userData;
      // }

      return true;
    },
  },
  // Note: `events` are handled in `apps/web/src/pages/api/auth/[...nextauth].ts` to allow access to the request.
};

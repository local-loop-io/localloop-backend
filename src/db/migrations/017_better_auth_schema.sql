-- 017_better_auth_schema.sql
-- Provisions the better-auth (src/auth.ts) core schema: user, session, account,
-- verification. Generated via better-auth's own `getMigrations().compileMigrations()`
-- (better-auth/db/migration, package version 1.6.29) against the exact BetterAuthOptions
-- used in src/auth.ts (database pool, emailAndPassword.enabled: true, no extra plugins),
-- then committed as a hand-written migration to match this project's existing convention
-- (schema_migrations-tracked SQL files) instead of relying on the separate @better-auth/cli
-- tool at deploy time. AUTH_ENABLED was previously wired in code with no schema ever
-- applied — enabling it before this migration would fail on the first sign-up/sign-in
-- call with a missing-relation error.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

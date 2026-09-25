export * from './client';
export * from './errors';
export * from './guard';
export * from './schema';

/**
 * This package is the single boundary to the ORM: everything else imports query operators from here
 * rather than from `drizzle-orm` directly.
 *
 * That is not stylistic. drizzle-orm declares its drivers as optional peer dependencies, so pnpm installs a
 * separate copy per distinct peer set — the moment `postgres` was added here for the hosted driver, this
 * package resolved `drizzle-orm@...+pglite+postgres` while `packages/auth` still resolved
 * `drizzle-orm@...+pglite`. Two copies means two sets of nominally different types, and `eq(users.id, …)`
 * stopped compiling with "separate declarations of a private property". Funnelling the ORM through one
 * package keeps exactly one copy in every consumer's type graph, whatever drivers get added later.
 */
export { and, eq, gt, isNull, sql } from 'drizzle-orm';

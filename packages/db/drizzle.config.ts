import { defineConfig } from 'drizzle-kit';

// Migrations are generated as reviewable SQL files (docs/phase-0/03-database-schema-proposal.md).
// `generate` never connects to a database, so it needs no credentials.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
});

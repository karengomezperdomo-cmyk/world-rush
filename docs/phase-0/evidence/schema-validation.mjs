// =============================================================================
// EVIDENCIA DE FASE 0 — validación del esquema propuesto (NO es código de producto)
// Ejecuta docs/phase-0/schema-proposal.sql en PostgreSQL 18 embebido (PGlite) y
// comprueba restricciones, bloqueo diario, upsert atómico, leaderboard, moderación,
// finalización y rendimiento con ~197k jugadores.
//
// Re-ejecutar SIN ensuciar el proyecto (usa una carpeta temporal; el script busca
// el SQL en "../schema-proposal.sql", así que respeta esta estructura):
//   <tmp>/wr/schema-proposal.sql            (copia de docs/phase-0/schema-proposal.sql)
//   <tmp>/wr/evidence/schema-validation.mjs (copia de este archivo)
//   cd <tmp>/wr/evidence && npm init -y && npm i @electric-sql/pglite && node schema-validation.mjs
// Tarda 1–3 min (carga masiva). Los tiempos de EXPLAIN son orientativos (WASM).
// En las Fases 4 y 11 esto se sustituye por tests reales (Vitest + Postgres
// multi-conexión para probar concurrencia de verdad).
// =============================================================================

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const SQL = readFileSync(new URL('../schema-proposal.sql', import.meta.url), 'utf8');
const db = new PGlite();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function expectErr(fn, code, msg) {
  try { await fn(); fail++; console.log('  FAIL (no error)', msg); }
  catch (e) { const c = e.code || ''; if (!code || c === code) { pass++; console.log('  PASS', msg, `[${c}]`); } else { fail++; console.log('  FAIL wrong code', msg, c, e.message); } }
}

console.log('== 1. DDL loads');
await db.exec(SQL);
ok(true, 'schema-proposal.sql executes without errors');
const tables = (await q(`select count(*)::int n from information_schema.tables where table_schema='public'`))[0].n;
ok(tables === 17, `17 tables created (got ${tables})`);

console.log('== 2. Seed calendar/content');
await db.exec(`
  insert into system_meta (environment) values ('development');
  insert into seasons (id, slug, name, starts_at) values ('00000000-0000-0000-0000-0000000000a1','s1','Season 1', now() - interval '30 days');
  insert into weeks (id, season_id, week_number, starts_at, ends_at)
    values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1',1, now() - interval '3 days', now() + interval '4 days');
  insert into maps (id, slug, catalog_number, name, difficulty) values
    ('00000000-0000-0000-0000-0000000000c1','sunset-canyon',1,'Sunset Canyon',2),
    ('00000000-0000-0000-0000-0000000000c2','palm-beach',2,'Palm Beach',2),
    ('00000000-0000-0000-0000-0000000000c3','pine-forest',3,'Pine Forest',3),
    ('00000000-0000-0000-0000-0000000000c9','other-map',9,'Other',3);
  insert into map_versions (id, map_id, version, level_asset_key, content_hash, ruleset, par_time_ms) values
    ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1',1,'levels/sunset-canyon-v1.bin','\\x00','r1',40000),
    ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c2',1,'levels/palm-beach-v1.bin','\\x00','r1',45000),
    ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c3',1,'levels/pine-forest-v1.bin','\\x00','r1',50000),
    ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000c9',1,'levels/other-v1.bin','\\x00','r1',50000);
  -- OPEN now (day 1), CLOSED (ended a day ago, day 2), LOCKED (opens tomorrow, day 3)
  insert into competitions (id, week_id, map_id, map_version_id, day_of_week, opens_at, closes_at) values
    ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1',1, now() - interval '1 hour', now() + interval '1 hour'),
    ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d2',2, now() - interval '2 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d3',3, now() + interval '1 day', now() + interval '2 days');
`);
const OPEN = '00000000-0000-0000-0000-0000000000e1', CLOSED = '00000000-0000-0000-0000-0000000000e2', LOCKED = '00000000-0000-0000-0000-0000000000e3';

console.log('== 3. Integrity constraints');
await expectErr(() => db.exec(`insert into competitions (week_id, map_id, map_version_id, day_of_week, opens_at, closes_at)
  values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000d1',4, now(), now() + interval '1 day')`),
  '23503', 'composite FK rejects a map_version that belongs to another map');
await expectErr(() => db.exec(`insert into competitions (week_id, map_id, map_version_id, day_of_week, opens_at, closes_at)
  values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000d9',1, now(), now() + interval '1 day')`),
  '23505', 'UNIQUE (week, day_of_week): one competition per weekday slot');
await expectErr(() => db.exec(`insert into competitions (week_id, map_id, map_version_id, day_of_week, opens_at, closes_at)
  values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000d9',5, now(), now() - interval '1 day')`),
  '23514', 'CHECK closes_at > opens_at');
await expectErr(() => db.exec(`insert into users (wallet_address) values ('0xABCDEFabcdefabcdefabcdefabcdefabcdefabcd')`),
  '23514', 'wallet_address must be lowercase 0x+40 hex');
await db.exec(`insert into users (id, wallet_address, username) values
  ('00000000-0000-0000-0000-00000000f001','0x00000000000000000000000000000000000000a1','alice'),
  ('00000000-0000-0000-0000-00000000f002','0x00000000000000000000000000000000000000a2','bob')`);
await expectErr(() => db.exec(`insert into users (wallet_address) values ('0x00000000000000000000000000000000000000a1')`),
  '23505', 'wallet_address is unique');
const MAXN = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256-1
await db.exec(`insert into world_id_verifications (user_id, action, nullifier, protocol_version, credential, environment)
  values ('00000000-0000-0000-0000-00000000f001','season-1-human', ${MAXN}, '4.0','proof_of_human','production')`);
ok(true, 'NUMERIC(78,0) stores a 256-bit nullifier (2^256-1)');
await expectErr(() => db.exec(`insert into world_id_verifications (user_id, action, nullifier, protocol_version, credential, environment)
  values ('00000000-0000-0000-0000-00000000f002','season-1-human', ${MAXN}, '4.0','proof_of_human','production')`),
  '23505', 'same human (nullifier) cannot bind a 2nd account for the same action');
await expectErr(() => db.exec(`insert into world_id_verifications (user_id, action, nullifier, protocol_version, credential, environment)
  values ('00000000-0000-0000-0000-00000000f001','season-1-human', 12345, '4.0','proof_of_human','production')`),
  '23505', 'one account cannot hold two nullifiers for the same action');
await db.exec(`insert into world_id_verifications (user_id, action, nullifier, protocol_version, credential, environment)
  values ('00000000-0000-0000-0000-00000000f002','season-2-human', ${MAXN}, '4.0','proof_of_human','production')`);
ok(true, 'same nullifier value is allowed under a DIFFERENT action (per-action scoping)');

console.log('== 4. competition_phase = clock is the single source of truth');
const ph = await q(`select c.id, competition_phase(c) p, competition_accepts_scores(c) a from competitions c order by day_of_week`);
ok(ph[0].p === 'open' && ph[1].p === 'closed' && ph[2].p === 'locked', `phases open/closed/locked (got ${ph.map(x => x.p)})`);
ok(ph[0].a === true && ph[1].a === false && ph[2].a === false, 'accepts_scores true/false/false');
const edge = await q(`select competition_phase(c, c.closes_at - interval '1 millisecond') a, competition_phase(c, c.closes_at) b,
                             competition_phase(c, c.opens_at - interval '1 millisecond') x, competition_phase(c, c.opens_at) y
                        from competitions c where id = $1`, [OPEN]);
ok(edge[0].a === 'open' && edge[0].b === 'closed' && edge[0].x === 'locked' && edge[0].y === 'open', 'boundaries are half-open [opens_at, closes_at)');

console.log('== 5. Daily lock enforced by the DB');
await db.exec(`insert into runs (id, user_id, competition_id, ruleset) values ('00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-00000000f001','${OPEN}','r1')`);
ok(true, 'a run can START in the open competition');
await expectErr(() => db.exec(`insert into runs (user_id, competition_id, ruleset) values ('00000000-0000-0000-0000-00000000f001','${CLOSED}','r1')`), 'P0001', 'a run cannot START in a CLOSED competition');
await expectErr(() => db.exec(`insert into runs (user_id, competition_id, ruleset) values ('00000000-0000-0000-0000-00000000f001','${LOCKED}','r1')`), 'P0001', 'a run cannot START in a LOCKED competition');
await expectErr(() => db.exec(`insert into runs (id, user_id, competition_id, status, completed_at, ruleset) values (gen_random_uuid(),'00000000-0000-0000-0000-00000000f001','${OPEN}','valid', now(),'r1')`), '23514', "CHECK: a 'valid' run must carry duration_ms");

console.log('== 6. upsert_best_score is atomic and monotonic');
// Prepare valid runs for alice in the OPEN competition
async function mkRun(user, ms) {
  const id = (await q(`insert into runs (user_id, competition_id, ruleset) values ($1,$2,'r1') returning id`, [user, OPEN]))[0].id;
  await db.query(`update runs set status='valid', duration_ms=$2, completed_at=now(), submitted_at=now() where id=$1`, [id, ms]);
  return id;
}
const A = '00000000-0000-0000-0000-00000000f001';
const r1 = await mkRun(A, 42831), r2 = await mkRun(A, 38201), r3 = await mkRun(A, 35922), r4 = await mkRun(A, 39011), r5 = await mkRun(A, 34801), r6 = await mkRun(A, 34801);
let res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r1, 42831]);
ok(res[0].improved === true && res[0].current_best_ms === 42831, 'attempt 1 (42.831s) → improved, best 42.831');
res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r2, 38201]); ok(res[0].improved && res[0].current_best_ms === 38201, 'attempt 2 (38.201s) → improved');
res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r3, 35922]); ok(res[0].improved && res[0].current_best_ms === 35922, 'attempt 3 (35.922s) → improved');
res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r4, 39011]); ok(res[0].improved === false && res[0].current_best_ms === 35922, 'attempt 4 (39.011s) → NOT improved, best stays 35.922');
res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r5, 34801]); ok(res[0].improved && res[0].current_best_ms === 34801, 'attempt 5 (34.801s) → improved');
const before = (await q(`select achieved_at from best_scores where competition_id=$1 and user_id=$2`, [OPEN, A]))[0].achieved_at;
res = await q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, A, r6, 34801]);
const after = (await q(`select achieved_at, run_id from best_scores where competition_id=$1 and user_id=$2`, [OPEN, A]))[0];
ok(res[0].improved === false && String(after.achieved_at) === String(before) && after.run_id === r5, 'exact tie keeps the EARLIER run/achieved_at (first to set it wins)');
ok((await q(`select count(*)::int n from best_scores where competition_id=$1 and user_id=$2`, [OPEN, A]))[0].n === 1, 'still exactly ONE leaderboard row per player');
ok((await q(`select count(*)::int n from runs where user_id=$1 and competition_id=$2`, [A, OPEN]))[0].n === 7, 'all 7 attempts are preserved in runs (audit/analytics)');
await expectErr(() => db.query(`select * from upsert_best_score($1,$2,$3,$4)`, [CLOSED, A, r1, 30000]), 'P0001', 'best_scores_lock: cannot write a score into a CLOSED competition');
// A concurrent-style burst on the same row: fire 30 upserts in one Promise.all (PGlite serialises, but the SQL semantics is what we validate)
const runsForBurst = [];
for (let i = 0; i < 30; i++) runsForBurst.push([await mkRun('00000000-0000-0000-0000-00000000f002', 50000 - i * 137), 50000 - i * 137]);
await Promise.all(runsForBurst.map(([rid, ms]) => q(`select * from upsert_best_score($1,$2,$3,$4)`, [OPEN, '00000000-0000-0000-0000-00000000f002', rid, ms])));
ok((await q(`select best_time_ms from best_scores where competition_id=$1 and user_id=$2`, [OPEN, '00000000-0000-0000-0000-00000000f002']))[0].best_time_ms === 50000 - 29 * 137,
  'after 30 out-of-order submissions the stored best is the minimum');

console.log('== 7. Bulk data: 200k players in one competition');
await db.exec(`alter table runs disable trigger runs_start_lock; alter table best_scores disable trigger best_scores_lock;`);
let t0 = Date.now();
await db.exec(`
  insert into users (id, wallet_address)
  select gen_random_uuid(), '0x' || lpad(to_hex(g + 1000), 40, '0') from generate_series(1, 200000) g;
  create temp table seed as
    select u.id as user_id, gen_random_uuid() as run_id, (25000 + (random() * 60000))::int as t
      from users u where u.wallet_address >= '0x0000000000000000000000000000000000001000' and u.wallet_address <= '0x00000000000000000000000000000000000fffff';
  insert into runs (id, user_id, competition_id, status, started_at, completed_at, submitted_at, duration_ms, ruleset)
    select run_id, user_id, '${OPEN}', 'valid', now(), now(), now(), t, 'r1' from seed;
  insert into best_scores (competition_id, user_id, best_time_ms, run_id, achieved_at)
    select '${OPEN}', user_id, t, run_id, now() + (t % 977) * interval '1 millisecond' from seed;
  analyze best_scores;
`);
await db.exec('vacuum analyze best_scores');
const total = (await q(`select count(*)::int n from best_scores where competition_id=$1`, [OPEN]))[0].n;
console.log(`  seeded ${total} best_scores in ${Date.now() - t0} ms`);
await db.exec(`alter table runs enable trigger runs_start_lock; alter table best_scores enable trigger best_scores_lock;`);
ok(total >= 190000, `bulk seed loaded (${total} rows) and triggers re-enabled`);

console.log('== 8. Leaderboard queries: correctness');
const ORDER = `best_time_ms, achieved_at, user_id`;
const top = await q(`select b.user_id, b.best_time_ms from best_scores b where b.competition_id=$1 and b.is_visible order by ${ORDER} limit 50`, [OPEN]);
const rn = await q(`select user_id, best_time_ms, row_number() over (order by ${ORDER}) rk from best_scores where competition_id=$1 and is_visible order by rk limit 50`, [OPEN]);
ok(top.every((r, i) => r.user_id === rn[i].user_id), 'top-50 equals row_number() ordering');
// keyset pagination: walk 5 pages of 50 and compare to OFFSET
let cursor = null, walked = [];
for (let p = 0; p < 5; p++) {
  const rows = cursor
    ? await q(`select user_id, best_time_ms, achieved_at from best_scores where competition_id=$1 and is_visible and (best_time_ms, achieved_at, user_id) > ($2,$3,$4) order by ${ORDER} limit 50`, [OPEN, cursor.t, cursor.a, cursor.u])
    : await q(`select user_id, best_time_ms, achieved_at from best_scores where competition_id=$1 and is_visible order by ${ORDER} limit 50`, [OPEN]);
  walked.push(...rows); const last = rows[rows.length - 1]; cursor = { t: last.best_time_ms, a: last.achieved_at, u: last.user_id };
}
const off = await q(`select user_id from best_scores where competition_id=$1 and is_visible order by ${ORDER} limit 250`, [OPEN]);
ok(walked.length === 250 && walked.every((r, i) => r.user_id === off[i].user_id), 'keyset pagination == OFFSET pagination for 250 rows (no dupes/gaps)');
// rank of a user by COUNT == row_number
const sample = await q(`select user_id, best_time_ms, achieved_at, rk from (select user_id, best_time_ms, achieved_at, row_number() over (order by ${ORDER}) rk from best_scores where competition_id=$1 and is_visible) s where rk in (1,2,3,777,15000,99999,150000) order by rk`, [OPEN]);
let rankOk = true;
for (const s of sample) {
  const r = (await q(`select 1 + count(*)::int as rank from best_scores where competition_id=$1 and is_visible and (best_time_ms, achieved_at, user_id) < ($2,$3,$4)`, [OPEN, s.best_time_ms, s.achieved_at, s.user_id]))[0].rank;
  if (Number(r) !== Number(s.rk)) rankOk = false;
}
ok(rankOk, `COUNT-based rank equals row_number for ranks ${sample.map(s => s.rk)}`);
// gap to the player immediately above
const me = sample.find(s => Number(s.rk) === 15000);
const prev = (await q(`select best_time_ms from best_scores where competition_id=$1 and is_visible and (best_time_ms, achieved_at, user_id) < ($2,$3,$4) order by best_time_ms desc, achieved_at desc, user_id desc limit 1`, [OPEN, me.best_time_ms, me.achieved_at, me.user_id]))[0].best_time_ms;
const prevRn = (await q(`select best_time_ms from (select best_time_ms, row_number() over (order by ${ORDER}) rk from best_scores where competition_id=$1 and is_visible) s where rk = 14999`, [OPEN]))[0].best_time_ms;
ok(prev === prevRn && me.best_time_ms >= prev, `"gap to previous" uses player #14999 (${prev} ms) → gap ${me.best_time_ms - prev} ms`);

console.log('== 9. Leaderboard queries: plans + timings (PGlite/WASM, indicative only)');
async function timed(label, sql, params) {
  const plan = (await q(`explain (analyze, timing on) ${sql}`, params)).map(r => r['QUERY PLAN']);
  const ex = plan.find(l => l.includes('Execution Time')) || '';
  const usesIdx = plan.some(l => l.includes('best_scores_rank_idx'));
  console.log(`  ${label.padEnd(34)} ${ex.trim().padEnd(28)} index=${usesIdx ? 'best_scores_rank_idx' : 'OTHER'}`);
  return { usesIdx, plan };
}
const deep = (await q(`select best_time_ms, achieved_at, user_id from (select best_time_ms, achieved_at, user_id, row_number() over (order by ${ORDER}) rk from best_scores where competition_id=$1 and is_visible) s where rk = 150000`, [OPEN]))[0];
const p1 = await timed('top 50 (join users)', `select b.best_time_ms, u.username from best_scores b join users u on u.id=b.user_id where b.competition_id='${OPEN}' and b.is_visible order by ${ORDER} limit 50`);
const p2 = await timed('keyset page @ rank ~150k', `select best_time_ms from best_scores where competition_id='${OPEN}' and is_visible and (best_time_ms, achieved_at, user_id) > (${deep.best_time_ms}, '${deep.achieved_at.toISOString()}', '${deep.user_id}') order by ${ORDER} limit 50`);
const p3 = await timed('rank of player @ ~150k (count)', `select 1 + count(*) from best_scores where competition_id='${OPEN}' and is_visible and (best_time_ms, achieved_at, user_id) < (${deep.best_time_ms}, '${deep.achieved_at.toISOString()}', '${deep.user_id}')`);
const p4 = await timed('gap to previous', `select best_time_ms from best_scores where competition_id='${OPEN}' and is_visible and (best_time_ms, achieved_at, user_id) < (${deep.best_time_ms}, '${deep.achieved_at.toISOString()}', '${deep.user_id}') order by best_time_ms desc, achieved_at desc, user_id desc limit 1`);
console.log('  --- plan of the rank COUNT query:'); p3.plan.slice(0, 8).forEach(l => console.log('     ' + l));
ok(p1.usesIdx && p2.usesIdx && p4.usesIdx, 'top-N, keyset page and gap queries are served by best_scores_rank_idx');

console.log('== 10. Moderation: invalidate + ban');
// bob: invalidate his best run -> best recomputed from remaining valid runs
const B = '00000000-0000-0000-0000-00000000f002';
const bobBest = (await q(`select run_id, best_time_ms from best_scores where competition_id=$1 and user_id=$2`, [OPEN, B]))[0];
const bobSecond = (await q(`select min(duration_ms) m from runs where user_id=$1 and competition_id=$2 and status='valid' and id <> $3`, [B, OPEN, bobBest.run_id]))[0].m;
await db.query(`select admin_invalidate_run($1,$2,$3)`, [bobBest.run_id, '00000000-0000-0000-0000-00000000ad01', 'test: impossible input cadence']);
const bobNow = (await q(`select best_time_ms from best_scores where competition_id=$1 and user_id=$2`, [OPEN, B]))[0].best_time_ms;
ok(bobNow === bobSecond && bobNow > bobBest.best_time_ms, `best recomputed after invalidation (${bobBest.best_time_ms} → ${bobNow})`);
ok((await q(`select count(*)::int n from audit_log where action='run.invalidate'`))[0].n === 1, 'audit_log entry written');
await expectErr(() => db.exec(`update audit_log set reason='tampered'`), '42501', 'audit_log is append-only (UPDATE blocked)');
await expectErr(() => db.exec(`delete from audit_log`), '42501', 'audit_log is append-only (DELETE blocked)');
// alice: invalidate every valid run -> row disappears from the leaderboard
for (const r of (await q(`select id from runs where user_id=$1 and competition_id=$2 and status='valid'`, [A, OPEN]))) await db.query(`select admin_invalidate_run($1,$2,$3)`, [r.id, '00000000-0000-0000-0000-00000000ad01', 'test']);
ok((await q(`select count(*)::int n from best_scores where competition_id=$1 and user_id=$2`, [OPEN, A]))[0].n === 0, 'no valid runs left → no leaderboard row');
const vis0 = (await q(`select count(*)::int n from best_scores where competition_id=$1 and is_visible`, [OPEN]))[0].n;
await db.query(`select admin_ban_user($1,$2,$3)`, [B, '00000000-0000-0000-0000-00000000ad01', 'test ban']);
const vis1 = (await q(`select count(*)::int n from best_scores where competition_id=$1 and is_visible`, [OPEN]))[0].n;
ok(vis1 === vis0 - 1, 'banned user disappears from the leaderboard but history is kept');

console.log('== 11. Finalize (freeze ranks) — closed competition');
// Seed scores into the CLOSED competition using the override (as a migration/backfill would)
await db.exec(`set worldrush.admin_override = 'on'; alter table runs disable trigger runs_start_lock;`);
await db.exec(`
  insert into runs (id, user_id, competition_id, status, started_at, completed_at, submitted_at, duration_ms, ruleset)
    select gen_random_uuid(), u.id, '${CLOSED}', 'valid', now() - interval '30 hours', now() - interval '30 hours', now() - interval '30 hours', 30000 + (row_number() over (order by u.wallet_address)) * 10, 'r1'
      from (select id, wallet_address from users where wallet_address between '0x0000000000000000000000000000000000001000' and '0x0000000000000000000000000000000000001063') u;
  insert into best_scores (competition_id, user_id, best_time_ms, run_id, achieved_at)
    select competition_id, user_id, duration_ms, id, completed_at from runs where competition_id = '${CLOSED}';
`);
await db.exec(`reset worldrush.admin_override; alter table runs enable trigger runs_start_lock;`);
await expectErr(() => db.query(`select finalize_competition($1)`, [OPEN]), 'P0001', 'finalize refuses an OPEN competition');
await db.query(`select finalize_competition($1)`, [CLOSED]);
const fin = (await q(`select status, participants_count, winner_time_ms, finalized_at from competitions where id=$1`, [CLOSED]))[0];
const ranks = (await q(`select array_agg(final_rank order by final_rank) r from best_scores where competition_id=$1`, [CLOSED]))[0].r;
ok(fin.status === 'finalized' && fin.participants_count === 100 && fin.winner_time_ms === 30010, `competition finalized: ${fin.participants_count} participants, winner ${fin.winner_time_ms} ms`);
ok(ranks.length === 100 && ranks.every((v, i) => v === i + 1), 'final_rank is exactly 1..100 with no gaps or duplicates');
const finalizedAt1 = fin.finalized_at;
await db.query(`select finalize_competition($1)`, [CLOSED]);
const fin2 = (await q(`select finalized_at from competitions where id=$1`, [CLOSED]))[0];
ok(String(fin2.finalized_at) === String(finalizedAt1), 'finalize is idempotent (second run changes nothing)');
await expectErr(() => db.query(`select * from upsert_best_score($1,$2,$3,$4)`, [CLOSED, A, r1, 100]), 'P0001', 'after close: new scores are rejected by the DB even from a buggy app');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

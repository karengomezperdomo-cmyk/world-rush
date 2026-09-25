-- =============================================================================
-- WORLD RUSH (nombre provisional) — Esquema PostgreSQL PROPUESTO (Fase 0)
-- =============================================================================
-- Estado: PROPUESTA. No es una migración ejecutada. Se validó en PostgreSQL 18.3
-- (PGlite) con datos sintéticos; ver docs/phase-0/03-database-schema-proposal.md.
--
-- Convenciones
--   * Todas las marcas de tiempo son timestamptz (UTC). El reloj autoritativo es
--     now() de la BASE DE DATOS, nunca el de la app ni el del dispositivo.
--   * Duraciones en milisegundos enteros (integer). Nada de floats para tiempos.
--   * Estados como text + CHECK (más fácil de migrar que ENUM).
--   * Los ids son uuid. La app puede generar UUIDv7 (ordenable por tiempo, mejor
--     localidad de índice); el DEFAULT gen_random_uuid() es solo un respaldo.
--   * Sin exclusion constraints/extensiones (btree_gist) para mantener paridad
--     con el Postgres embebido usado en desarrollo y tests.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Metadatos del sistema: evita apuntar código de staging a la BD de producción
-- ---------------------------------------------------------------------------
create table system_meta (
  id             boolean primary key default true check (id),      -- singleton
  environment    text    not null check (environment in ('development','staging','production')),
  schema_version integer not null default 1,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1. Identidad
-- ---------------------------------------------------------------------------
create table users (
  id                uuid primary key default gen_random_uuid(),
  -- Identificador de autenticación: dirección de wallet verificada con SIWE
  -- (MiniKit.walletAuth). Siempre en minúsculas.
  wallet_address    text not null,
  -- Caché del servicio público de usernames de World. NUNCA se acepta del cliente.
  username          text,
  avatar_url        text,
  profile_synced_at timestamptz,
  locale            text,                                          -- 'es', 'en'…
  status            text not null default 'active'
                      check (status in ('active','suspended','banned','deleted')),
  -- Derivado de world_id_verifications (conveniencia para consultas/filtros).
  human_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_login_at     timestamptz,
  constraint users_wallet_format check (wallet_address ~ '^0x[0-9a-f]{40}$')
);
create unique index users_wallet_uidx on users (wallet_address);

-- Nonces SIWE de un solo uso (válidos entre instancias serverless).
create table auth_nonces (
  nonce       text primary key check (nonce ~ '^[A-Za-z0-9]{16,64}$'),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);
create index auth_nonces_expires_idx on auth_nonces (expires_at);

-- Sesiones opacas y revocables. Se guarda el HASH del token, nunca el token.
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  token_hash          bytea not null,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  expires_at          timestamptz not null,          -- ventana deslizante
  absolute_expires_at timestamptz not null,          -- tope duro
  revoked_at          timestamptz
);
create unique index sessions_token_hash_uidx on sessions (token_hash);
create index sessions_user_active_idx on sessions (user_id) where revoked_at is null;

-- Prueba de humanidad (World ID). Solo el nullifier y metadatos mínimos:
-- el nullifier es no reversible y está acotado por (app, acción).
create table world_id_verifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  action           text not null,                              -- p. ej. 'season-1-human'
  nullifier        numeric(78,0) not null check (nullifier >= 0),  -- 256 bits
  protocol_version text not null check (protocol_version in ('3.0','4.0')),
  credential       text not null,                              -- 'proof_of_human', 'orb'…
  environment      text not null check (environment in ('production','staging')),
  verified_at      timestamptz not null default now(),
  -- Un humano (nullifier) ↔ una cuenta, por acción. El Developer Portal v4
  -- ACEPTA nullifiers repetidos, así que esta restricción es nuestra defensa.
  constraint wid_action_nullifier_uq unique (action, nullifier),
  constraint wid_user_action_uq      unique (user_id, action)
);

-- ---------------------------------------------------------------------------
-- 2. Calendario y contenido: Season → Week → Competition ← Map(Version)
-- ---------------------------------------------------------------------------
create table seasons (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz,                                      -- NULL = abierta
  status     text not null default 'scheduled' check (status in ('scheduled','active','ended')),
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table weeks (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id),
  week_number integer not null check (week_number > 0),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'scheduled'
                check (status in ('scheduled','active','closed','finalized')),
  created_at  timestamptz not null default now(),
  unique (season_id, week_number),
  check (ends_at > starts_at)
);
create index weeks_time_idx on weeks (starts_at, ends_at);

-- Identidad "de catálogo" del mapa (lo que el admin edita sin tocar código).
create table maps (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  catalog_number integer,                       -- "Map 1…N" para mostrar; NO es el día
  name           text not null,
  description    text not null default '',
  difficulty     smallint check (difficulty between 1 and 5),
  thumbnail_key  text,                          -- clave en object storage
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Versión INMUTABLE del contenido jugable. Un replay solo es válido contra la
-- versión exacta de nivel + ruleset con la que se grabó.
create table map_versions (
  id                   uuid primary key default gen_random_uuid(),
  map_id               uuid not null references maps(id),
  version              integer not null check (version > 0),
  level_asset_key      text not null,           -- paquete de nivel compilado
  content_hash         bytea not null,          -- sha256 del paquete
  ruleset              text not null,           -- versión del motor/constantes, p. ej. 'r1'
  config               jsonb not null default '{}'::jsonb,  -- checkpoints, límites, etc.
  par_time_ms          integer check (par_time_ms > 0),
  reference_replay_key text,                    -- prueba de que el nivel es completable
  created_at           timestamptz not null default now(),
  unique (map_id, version),
  unique (id, map_id)                           -- habilita la FK compuesta de competitions
);

create table competitions (
  id             uuid primary key default gen_random_uuid(),
  week_id        uuid not null references weeks(id),
  map_id         uuid not null references maps(id),
  map_version_id uuid not null,
  kind           text not null default 'daily' check (kind in ('daily','special')),
  day_of_week    smallint not null check (day_of_week between 1 and 7),   -- ISO: 1=lunes … 7=domingo
  opens_at       timestamptz not null,
  closes_at      timestamptz not null,
  -- Gracia SOLO para runs iniciados antes del cierre (ver trigger runs_start_lock).
  grace_seconds  integer not null default 120 check (grace_seconds >= 0),
  -- Estado MATERIALIZADO por jobs idempotentes. La verdad es el reloj (ver
  -- competition_phase); este campo solo cachea 'finalized' y 'cancelled'.
  status         text not null default 'scheduled'
                   check (status in ('scheduled','open','closed','finalized','cancelled')),
  participants_count integer,                   -- se rellena al finalizar
  winner_time_ms     integer,                   -- idem
  finalized_at   timestamptz,
  created_at     timestamptz not null default now(),
  check (closes_at > opens_at),
  unique (week_id, day_of_week),
  unique (week_id, map_id),
  -- la versión debe pertenecer al mapa indicado
  foreign key (map_version_id, map_id) references map_versions (id, map_id)
);
create index competitions_time_idx on competitions (opens_at, closes_at);

-- ---------------------------------------------------------------------------
-- 3. Runs (intentos) y mejores marcas
-- ---------------------------------------------------------------------------
create table runs (
  id                 uuid primary key default gen_random_uuid(),   -- run_id emitido por el servidor
  user_id            uuid not null references users(id),
  competition_id     uuid not null references competitions(id),
  status             text not null default 'started'
                       check (status in ('started','verifying','valid','invalid','abandoned','expired')),
  started_at         timestamptz not null default now(),           -- reloj del servidor
  submitted_at       timestamptz,
  completed_at       timestamptz,                                  -- aceptación (servidor)
  duration_ms        integer check (duration_ms > 0),              -- tiempo VALIDADO por el servidor
  claimed_duration_ms integer,                                     -- lo que dijo el cliente (diagnóstico)
  ruleset            text not null,
  client_version     text,
  replay             bytea,                                        -- log de inputs compacto (NULL si se archivó)
  replay_hash        bytea,                                        -- sha256(replay): duplicados
  validation         jsonb not null default '{}'::jsonb,           -- resultado de cada comprobación
  is_suspicious      boolean not null default false,
  suspicion_reasons  text[] not null default '{}',
  review_status      text not null default 'none'
                       check (review_status in ('none','pending','cleared','confirmed')),
  reviewed_by        uuid,
  reviewed_at        timestamptz,
  review_note        text,
  invalidated_at     timestamptz,
  invalidated_by     uuid,
  invalidation_reason text,
  created_at         timestamptz not null default now(),
  check (status <> 'valid' or (duration_ms is not null and completed_at is not null))
);
create index runs_user_comp_idx      on runs (user_id, competition_id, started_at desc);
create index runs_comp_status_idx    on runs (competition_id, status);
create index runs_replay_hash_idx    on runs (competition_id, replay_hash) where replay_hash is not null;
create index runs_review_pending_idx on runs (created_at) where review_status = 'pending';
create index runs_open_idx           on runs (started_at) where status in ('started','verifying');

-- UNA fila por (competición, usuario): su mejor tiempo válido. NO hay tabla de
-- leaderboard aparte: el leaderboard es una consulta ordenada sobre ESTA tabla.
create table best_scores (
  competition_id uuid not null references competitions(id),
  user_id        uuid not null references users(id),
  best_time_ms   integer not null check (best_time_ms > 0),
  run_id         uuid not null references runs(id),
  achieved_at    timestamptz not null default now(),   -- desempate: gana quien lo logró antes
  is_visible     boolean not null default true,         -- moderación (ocultar sin borrar)
  final_rank     integer,                               -- se congela al finalizar
  updated_at     timestamptz not null default now(),
  primary key (competition_id, user_id)
);
-- Orden total y determinista: (tiempo, momento, usuario). Sirve para top-N,
-- paginación por keyset, rango de un usuario y "diferencia con el anterior".
create index best_scores_rank_idx
  on best_scores (competition_id, best_time_ms, achieved_at, user_id) where is_visible;
create index best_scores_user_idx on best_scores (user_id, achieved_at desc);
create unique index best_scores_final_rank_uidx
  on best_scores (competition_id, final_rank) where final_rank is not null;

-- ---------------------------------------------------------------------------
-- 4. Administración, auditoría, límites y analítica mínima
-- ---------------------------------------------------------------------------
create table admin_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null check (role in ('owner','moderator','viewer')),
  created_at  timestamptz not null default now(),
  disabled_at timestamptz
);

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('admin','system','user')),
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  before      jsonb,
  after       jsonb,
  reason      text
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, at desc);

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% on % is not allowed (append-only)', tg_op, tg_table_name using errcode = '42501';
end $$;
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function forbid_mutation();

-- Ventanas de rate limiting de negocio (el límite por IP va en el WAF/edge).
create table rate_limits (
  bucket       text not null,                 -- p. ej. 'run_start:<user_id>'
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket, window_start)
);

-- Ejecución idempotente de jobs (finalizar, rollover, limpiezas) + observabilidad.
create table job_runs (
  job         text not null,
  key         text not null,                  -- p. ej. id de competición o semana
  status      text not null check (status in ('running','done','failed')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  details     jsonb not null default '{}'::jsonb,
  primary key (job, key)
);

-- Analítica propia y mínima (sin PII). Solo eventos de una lista cerrada, y solo
-- los opcionales si MiniKit.user.optedIntoOptionalAnalytics es true.
create table analytics_events (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  event          text not null check (event in (
                   'app_open','login','worldid_verified','race_start','race_finish',
                   'race_crash','race_restart','leaderboard_view','share')),
  user_id        uuid references users(id) on delete set null,
  competition_id uuid references competitions(id) on delete set null,
  props          jsonb not null default '{}'::jsonb
);
create index analytics_events_at_idx       on analytics_events (at);
create index analytics_events_event_at_idx on analytics_events (event, at);

-- =============================================================================
-- 5. Reloj como única fuente de verdad para el estado de una competición
-- =============================================================================
-- 'locked'  = todavía no abre        (UI: LOCKED)
-- 'open'    = jugable ahora          (UI: TODAY)
-- 'closed'  = terminó                (UI: CLOSED / COMPLETED según el jugador)
create function competition_phase(c competitions, at timestamptz default now())
returns text language sql stable as $$
  select case when at < c.opens_at  then 'locked'
              when at < c.closes_at then 'open'
              else 'closed' end
$$;

-- ¿Se aceptan todavía marcas? Un run iniciado antes del cierre puede terminar
-- dentro de la gracia; un run NUEVO ya no puede empezar (ver runs_start_lock).
create function competition_accepts_scores(c competitions, at timestamptz default now())
returns boolean language sql stable as $$
  select at >= c.opens_at and at < c.closes_at + make_interval(secs => c.grace_seconds)
$$;

-- =============================================================================
-- 6. Bloqueo diario aplicado EN LA BASE DE DATOS (defensa en profundidad)
-- =============================================================================
-- Nota: cualquier rol puede fijar un GUC, así que esto protege frente a BUGS de
-- la app, no frente a una app comprometida. Para lo segundo: roles separados
-- (ver sección "Roles" en el documento) y funciones SECURITY DEFINER para admin.

create function runs_start_lock() returns trigger language plpgsql as $$
declare c competitions%rowtype;
begin
  select * into strict c from competitions where id = new.competition_id;
  if competition_phase(c) <> 'open' or c.status = 'cancelled' then
    raise exception 'competition % is not open for new runs (phase=%)', c.id, competition_phase(c)
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger runs_start_lock before insert on runs
  for each row execute function runs_start_lock();

create function best_scores_lock() returns trigger language plpgsql as $$
declare c competitions%rowtype;
begin
  if coalesce(current_setting('worldrush.admin_override', true), 'off') = 'on' then
    return new;
  end if;
  select * into strict c from competitions where id = new.competition_id;
  if c.status = 'cancelled' or not competition_accepts_scores(c) then
    raise exception 'competition % is not accepting scores', c.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger best_scores_lock before insert or update of best_time_ms, run_id on best_scores
  for each row execute function best_scores_lock();

-- =============================================================================
-- 7. Operaciones atómicas
-- =============================================================================

-- 7.1 Registrar un run válido: upsert atómico de la mejor marca. Si dos envíos del
--     mismo usuario llegan a la vez, el bloqueo de fila los serializa y gana el
--     menor tiempo. Con empate exacto NO se actualiza (conserva achieved_at antiguo).
create function upsert_best_score(p_competition uuid, p_user uuid, p_run uuid, p_time_ms integer)
returns table (improved boolean, current_best_ms integer)
language plpgsql as $$
begin
  return query
  with up as (
    insert into best_scores as b (competition_id, user_id, best_time_ms, run_id, achieved_at)
    values (p_competition, p_user, p_time_ms, p_run, now())
    on conflict (competition_id, user_id) do update
      set best_time_ms = excluded.best_time_ms,
          run_id       = excluded.run_id,
          achieved_at  = excluded.achieved_at,
          updated_at   = now()
      where excluded.best_time_ms < b.best_time_ms
    returning b.best_time_ms as t
  )
  select true, up.t from up
  union all
  select false, b2.best_time_ms
    from best_scores b2
   where b2.competition_id = p_competition and b2.user_id = p_user
     and not exists (select 1 from up);
end $$;

-- 7.2 Invalidar un run (moderación) y recalcular la mejor marca del usuario.
create function admin_invalidate_run(p_run uuid, p_admin uuid, p_reason text)
returns void language plpgsql as $$
declare r runs%rowtype; nb record;
begin
  perform set_config('worldrush.admin_override', 'on', true);   -- solo esta transacción
  update runs
     set status = 'invalid', invalidated_at = now(), invalidated_by = p_admin,
         invalidation_reason = p_reason
   where id = p_run and status = 'valid'
   returning * into r;
  if not found then
    raise exception 'run % not found or not valid', p_run;
  end if;

  select id, duration_ms, completed_at into nb
    from runs
   where user_id = r.user_id and competition_id = r.competition_id and status = 'valid'
   order by duration_ms, completed_at, id
   limit 1;

  if nb.id is null then
    delete from best_scores where competition_id = r.competition_id and user_id = r.user_id;
  else
    update best_scores
       set best_time_ms = nb.duration_ms, run_id = nb.id, achieved_at = nb.completed_at,
           updated_at = now()
     where competition_id = r.competition_id and user_id = r.user_id;
  end if;

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, before, after, reason)
  values ('admin', p_admin, 'run.invalidate', 'run', p_run::text,
          jsonb_build_object('duration_ms', r.duration_ms), jsonb_build_object('status', 'invalid'),
          p_reason);
end $$;

-- 7.3 Vetar a un usuario: lo oculta de todos los leaderboards sin borrar historia.
create function admin_ban_user(p_user uuid, p_admin uuid, p_reason text)
returns void language plpgsql as $$
begin
  update users set status = 'banned', updated_at = now() where id = p_user;
  update best_scores set is_visible = false, updated_at = now() where user_id = p_user;
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, after, reason)
  values ('admin', p_admin, 'user.ban', 'user', p_user::text, jsonb_build_object('status', 'banned'), p_reason);
end $$;

-- 7.4 Finalizar una competición (idempotente): congela posiciones. Solo después de
--     cierre + gracia. Se puede ejecutar N veces con el mismo resultado.
create function finalize_competition(p_competition uuid)
returns void language plpgsql as $$
declare c competitions%rowtype;
begin
  select * into strict c from competitions where id = p_competition for update;
  if now() < c.closes_at + make_interval(secs => c.grace_seconds) then
    raise exception 'competition % cannot be finalized yet', c.id using errcode = 'P0001';
  end if;

  perform set_config('worldrush.admin_override', 'on', true);
  update best_scores b
     set final_rank = r.rk
    from (select user_id,
                 row_number() over (order by best_time_ms, achieved_at, user_id) as rk
            from best_scores
           where competition_id = p_competition and is_visible) r
   where b.competition_id = p_competition and b.user_id = r.user_id;

  update best_scores set final_rank = null
   where competition_id = p_competition and not is_visible;

  update competitions
     set status = 'finalized',
         participants_count = (select count(*) from best_scores
                                where competition_id = p_competition and is_visible),
         winner_time_ms = (select min(best_time_ms) from best_scores
                            where competition_id = p_competition and is_visible),
         finalized_at = coalesce(finalized_at, now())
   where id = p_competition;
end $$;

-- =============================================================================
-- 8. Roles propuestos (documentación; los roles son a nivel de clúster)
-- =============================================================================
--   worldrush_app    : lo usa la API pública. SELECT/INSERT/UPDATE en las tablas de
--                      juego; sin DELETE; sin acceso a audit_log/admin_users.
--   worldrush_admin  : lo usa SOLO el panel admin. Puede ejecutar las funciones
--                      admin_* (SECURITY DEFINER recomendado) e INSERT en audit_log.
--   worldrush_ro     : analítica/lectura (sin wallet_address si se crea una vista).
--   worldrush_migrate: solo migraciones (CI). Nunca en tiempo de ejecución.

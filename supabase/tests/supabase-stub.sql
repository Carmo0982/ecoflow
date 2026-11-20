-- Réplica mínima de lo que Supabase trae de fábrica y que importa para RLS,
-- para probar las migraciones en PGlite (Postgres en WebAssembly):
--   * roles anon / authenticated / service_role;
--   * auth.users y auth.uid() / auth.jwt(), que leen el JWT de la variable
--     request.jwt.claims (igual que PostgREST);
--   * "default privileges": todo lo que se crea en public recibe GRANT ALL
--     para anon y authenticated, por eso RLS y los REVOKE son la barrera real;
--   * la publicación supabase_realtime.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id                  uuid primary key,
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create publication supabase_realtime;

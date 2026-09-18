-- Minimal stand-in for Supabase's auth schema so migrations + RLS can be tested
-- on a plain PostgreSQL. NOT used on the real Supabase stack.
create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists auth.identities (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider_id text, provider text, identity_data jsonb,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);

-- auth.uid() reads the JWT claims GUC exactly like Supabase does.
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

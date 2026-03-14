create table if not exists public.admin_documents (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id text primary key,
  location text not null check (location in ('TW', 'NL', 'EN', 'DETOX')),
  locale text not null check (locale in ('zh', 'en')),
  name text not null,
  age integer not null,
  profession text not null,
  email text not null,
  instagram text,
  referral text not null,
  referral_other text,
  bank_account text,
  visitor_id text,
  timestamp timestamptz not null,
  status text not null check (status in ('pending', 'confirmed', 'cancelled')),
  source text not null check (source in ('pending', 'simulated', 'tally', 'notion')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_admin_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_documents_set_updated_at on public.admin_documents;

create trigger admin_documents_set_updated_at
before update on public.admin_documents
for each row
execute function public.set_admin_documents_updated_at();

drop trigger if exists registrations_set_updated_at on public.registrations;

create trigger registrations_set_updated_at
before update on public.registrations
for each row
execute function public.set_admin_documents_updated_at();

create index if not exists registrations_location_status_idx
on public.registrations (location, status);

create index if not exists registrations_created_at_idx
on public.registrations (created_at desc);

create index if not exists registrations_updated_at_idx
on public.registrations (updated_at desc);

alter table public.admin_documents enable row level security;
alter table public.registrations enable row level security;

-- This app writes through the server-side service-role key.
-- No anon/authenticated policies are required for these tables unless you later add browser-authenticated admin access.

insert into public.admin_documents (key, value)
values
  ('books', '[]'::jsonb),
  ('events', '{}'::jsonb),
  ('capacity', '{}'::jsonb),
  ('registration-success-email', '{"enabled": false, "templates": {"zh": {"subject": "", "body": ""}, "en": {"subject": "", "body": ""}}}'::jsonb)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('admin-assets', 'admin-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public read admin assets" on storage.objects;
create policy "Public read admin assets"
on storage.objects
for select
to public
using (bucket_id = 'admin-assets');

-- Optional authenticated browser-upload policies if you later stop using service-role-only uploads:
-- create policy "Authenticated upload admin assets"
-- on storage.objects
-- for insert
-- to authenticated
-- with check (bucket_id = 'admin-assets');
--
-- create policy "Authenticated update admin assets"
-- on storage.objects
-- for update
-- to authenticated
-- using (bucket_id = 'admin-assets')
-- with check (bucket_id = 'admin-assets');
create table if not exists public.admin_documents (
  key text primary key,
  value jsonb not null,
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
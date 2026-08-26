-- Fechamento de Locação — phase 1 schema
create extension if not exists pgcrypto;

create type public.board_role as enum ('admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email text not null,
  initials text not null check (char_length(initials) between 1 and 4),
  color text not null default '#1d4ed8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '',
  external_source text,
  external_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index boards_external_id_unique on public.boards(external_source, external_id)
  where external_source is not null and external_id is not null;

create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.board_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (board_id, profile_id)
);

create table public.board_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  position numeric(30,12) not null,
  completed_state boolean not null default false,
  sla_hours integer check (sla_hours between 1 and 8760),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name),
  unique (board_id, id)
);

create table public.consultants (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name),
  unique (board_id, id)
);

create table public.captors (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name),
  unique (board_id, id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  list_id uuid not null,
  unit_id uuid not null,
  consultant_id uuid not null,
  captor_id uuid not null,
  property text not null check (char_length(property) between 2 and 240),
  tenant_cpf text not null check (tenant_cpf ~ '^[0-9]{11}$'),
  tenant_name text not null check (char_length(tenant_name) between 3 and 240),
  description text not null default '' check (char_length(description) <= 20000),
  position numeric(30,12) not null,
  entered_list_at timestamptz not null default now(),
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_list_board_fk foreign key (board_id, list_id) references public.board_lists(board_id, id) on delete restrict,
  constraint cards_unit_board_fk foreign key (board_id, unit_id) references public.units(board_id, id) on delete restrict,
  constraint cards_consultant_board_fk foreign key (board_id, consultant_id) references public.consultants(board_id, id) on delete restrict,
  constraint cards_captor_board_fk foreign key (board_id, captor_id) references public.captors(board_id, id) on delete restrict
);

create index cards_list_position_idx on public.cards(list_id, position) where archived_at is null;
create index cards_board_active_idx on public.cards(board_id, updated_at desc) where archived_at is null;
create index cards_unit_idx on public.cards(unit_id) where archived_at is null;
create index cards_consultant_idx on public.cards(consultant_id) where archived_at is null;
create index cards_captor_idx on public.cards(captor_id) where archived_at is null;
create index cards_updated_at_idx on public.cards(updated_at desc);
create index board_lists_order_idx on public.board_lists(board_id, position) where archived_at is null;

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  position numeric(30,12) not null,
  created_at timestamptz not null default now()
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  position numeric(30,12) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  position numeric(30,12) not null,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completion_metadata_consistent check (
    (completed = true and completed_at is not null) or
    (completed = false and completed_at is null and completed_by is null)
  )
);

create index checklist_items_order_idx on public.checklist_items(checklist_id, position);
create index checklists_card_order_idx on public.checklists(card_id, position) where archived_at is null;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_card_created_idx on public.comments(card_id, created_at desc) where archived_at is null;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null,
  public_url text,
  uploader_id uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index attachments_card_created_idx on public.attachments(card_id, created_at desc) where archived_at is null;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activities_card_created_idx on public.activities(card_id, created_at desc);
create index activities_board_created_idx on public.activities(board_id, created_at desc);
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, name, email, initials)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    upper(left(coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)), 2))
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_board_member(target_board_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.board_members where board_id = target_board_id and profile_id = auth.uid()) $$;

create or replace function public.is_board_admin(target_board_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.board_members where board_id = target_board_id and profile_id = auth.uid() and role = 'admin') $$;

revoke all on function public.is_board_member(uuid) from public;
revoke all on function public.is_board_admin(uuid) from public;
grant execute on function public.is_board_member(uuid), public.is_board_admin(uuid) to authenticated;

-- Transactional, optimistic card move. A stale client receives no row and must roll back.
create or replace function public.move_card(
  target_card_id uuid,
  target_list_id uuid,
  target_position numeric,
  expected_version integer
)
returns public.cards
language plpgsql
security invoker
set search_path = public
as $$
declare
  moved public.cards;
  old_list_id uuid;
begin
  select list_id into old_list_id from public.cards where id = target_card_id;
  update public.cards
    set list_id = target_list_id,
        position = target_position,
        entered_list_at = case when list_id <> target_list_id then now() else entered_list_at end,
        version = version + 1,
        updated_at = now()
    where id = target_card_id
      and version = expected_version
      and board_id = (select board_id from public.board_lists where id = target_list_id)
    returning * into moved;
  if moved.id is null then
    raise exception 'conflict_or_missing_card' using errcode = '40001';
  end if;
  insert into public.activities(board_id, card_id, actor_id, event_type, message, metadata)
  values (moved.board_id, moved.id, auth.uid(), 'card.moved', 'moveu o card', jsonb_build_object('fromListId', old_list_id, 'toListId', target_list_id, 'position', target_position));
  return moved;
end;
$$;

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_lists enable row level security;
alter table public.cards enable row level security;
alter table public.units enable row level security;
alter table public.consultants enable row level security;
alter table public.captors enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activities enable row level security;

create policy "profiles visible to shared board members" on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.board_members mine join public.board_members theirs on theirs.board_id = mine.board_id
  where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id
));
create policy "profile updates self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "boards visible to members" on public.boards for select to authenticated using (public.is_board_member(id));
create policy "boards managed by admins" on public.boards for update to authenticated using (public.is_board_admin(id)) with check (public.is_board_admin(id));
create policy "members visible to board members" on public.board_members for select to authenticated using (public.is_board_member(board_id));
create policy "members inserted by admins" on public.board_members for insert to authenticated with check (public.is_board_admin(board_id));
create policy "members updated by admins" on public.board_members for update to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));
create policy "members deleted by admins" on public.board_members for delete to authenticated using (public.is_board_admin(board_id));

create policy "lists visible to members" on public.board_lists for select to authenticated using (public.is_board_member(board_id));
create policy "lists inserted by admins" on public.board_lists for insert to authenticated with check (public.is_board_admin(board_id));
create policy "lists updated by admins" on public.board_lists for update to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));
create policy "lists deleted by admins" on public.board_lists for delete to authenticated using (public.is_board_admin(board_id));

create policy "cards visible to members" on public.cards for select to authenticated using (public.is_board_member(board_id));
create policy "cards inserted by members" on public.cards for insert to authenticated with check (public.is_board_member(board_id) and created_by = auth.uid());
create policy "cards updated by members" on public.cards for update to authenticated using (public.is_board_member(board_id)) with check (public.is_board_member(board_id));
create policy "cards deleted by admins" on public.cards for delete to authenticated using (public.is_board_admin(board_id));

create policy "units visible to members" on public.units for select to authenticated using (public.is_board_member(board_id));
create policy "units managed by admins" on public.units for all to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));
create policy "consultants visible to members" on public.consultants for select to authenticated using (public.is_board_member(board_id));
create policy "consultants managed by admins" on public.consultants for all to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));
create policy "captors visible to members" on public.captors for select to authenticated using (public.is_board_member(board_id));
create policy "captors managed by admins" on public.captors for all to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));

create policy "templates visible to members" on public.checklist_templates for select to authenticated using (public.is_board_member(board_id));
create policy "templates managed by admins" on public.checklist_templates for all to authenticated using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));
create policy "template items visible to members" on public.checklist_template_items for select to authenticated using (exists(select 1 from public.checklist_templates t where t.id = template_id and public.is_board_member(t.board_id)));
create policy "template items managed by admins" on public.checklist_template_items for all to authenticated using (exists(select 1 from public.checklist_templates t where t.id = template_id and public.is_board_admin(t.board_id))) with check (exists(select 1 from public.checklist_templates t where t.id = template_id and public.is_board_admin(t.board_id)));

create policy "checklists visible to members" on public.checklists for select to authenticated using (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "checklists inserted by members" on public.checklists for insert to authenticated with check (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "checklists updated by members" on public.checklists for update to authenticated using (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "checklists deleted by members" on public.checklists for delete to authenticated using (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "items visible to members" on public.checklist_items for select to authenticated using (exists(select 1 from public.checklists cl join public.cards c on c.id = cl.card_id where cl.id = checklist_id and public.is_board_member(c.board_id)));
create policy "items inserted by members" on public.checklist_items for insert to authenticated with check (exists(select 1 from public.checklists cl join public.cards c on c.id = cl.card_id where cl.id = checklist_id and public.is_board_member(c.board_id)));
create policy "items updated by members" on public.checklist_items for update to authenticated using (exists(select 1 from public.checklists cl join public.cards c on c.id = cl.card_id where cl.id = checklist_id and public.is_board_member(c.board_id)));
create policy "items deleted by members" on public.checklist_items for delete to authenticated using (exists(select 1 from public.checklists cl join public.cards c on c.id = cl.card_id where cl.id = checklist_id and public.is_board_member(c.board_id)));

create policy "comments visible to members" on public.comments for select to authenticated using (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "comments inserted by members" on public.comments for insert to authenticated with check (author_id = auth.uid() and exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "comments updated by author" on public.comments for update to authenticated using (author_id = auth.uid());
create policy "attachments visible to members" on public.attachments for select to authenticated using (exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "attachments inserted by members" on public.attachments for insert to authenticated with check (uploader_id = auth.uid() and exists(select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "attachments updated by uploader or admin" on public.attachments for update to authenticated using (uploader_id = auth.uid() or exists(select 1 from public.cards c where c.id = card_id and public.is_board_admin(c.board_id)));
create policy "activities visible to members" on public.activities for select to authenticated using (public.is_board_member(board_id));
create policy "activities inserted by members" on public.activities for insert to authenticated with check (actor_id = auth.uid() and public.is_board_member(board_id));

-- Private storage bucket. Access is mediated by attachment records and board membership.
insert into storage.buckets(id, name, public, file_size_limit)
values ('lease-attachments', 'lease-attachments', false, 20971520)
on conflict (id) do nothing;

create policy "board members read lease attachments" on storage.objects for select to authenticated
using (bucket_id = 'lease-attachments' and exists (
  select 1 from public.attachments a join public.cards c on c.id = a.card_id
  where a.storage_path = name and public.is_board_member(c.board_id)
));
create policy "authenticated users upload lease attachments" on storage.objects for insert to authenticated
with check (bucket_id = 'lease-attachments');
create policy "uploaders delete lease attachments" on storage.objects for delete to authenticated
using (bucket_id = 'lease-attachments' and owner_id = auth.uid()::text);

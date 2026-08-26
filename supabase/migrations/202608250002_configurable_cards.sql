-- Valor do aluguel e campos globais configuráveis dos cards.
alter table public.cards
  add column rent_value_cents bigint not null default 0
  check (rent_value_cents >= 0);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  field_type text not null check (
    field_type in ('text', 'currency', 'number', 'percentage', 'select', 'attachment')
  ),
  section text not null check (
    section in ('lease', 'tenants', 'residents', 'guarantors', 'other')
  ),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position numeric(30,12) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, id),
  constraint select_fields_require_options check (
    field_type <> 'select' or jsonb_array_length(options) > 0
  )
);

create index custom_fields_board_order_idx
  on public.custom_fields(board_id, position)
  where archived_at is null;

create table public.card_field_values (
  card_id uuid not null references public.cards(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete restrict,
  value text not null check (char_length(value) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (card_id, field_id)
);

create index card_field_values_field_idx on public.card_field_values(field_id);

alter table public.attachments
  add column field_id uuid references public.custom_fields(id) on delete set null;

create index attachments_field_idx
  on public.attachments(field_id)
  where archived_at is null and field_id is not null;

alter table public.custom_fields enable row level security;
alter table public.card_field_values enable row level security;

create policy "custom fields visible to members"
  on public.custom_fields for select to authenticated
  using (public.is_board_member(board_id));

create policy "custom fields managed by admins"
  on public.custom_fields for all to authenticated
  using (public.is_board_admin(board_id))
  with check (public.is_board_admin(board_id));

create policy "card field values visible to members"
  on public.card_field_values for select to authenticated
  using (exists (
    select 1
    from public.cards c
    join public.custom_fields f on f.id = field_id and f.board_id = c.board_id
    where c.id = card_id and public.is_board_member(c.board_id)
  ));

create policy "card field values inserted by members"
  on public.card_field_values for insert to authenticated
  with check (exists (
    select 1
    from public.cards c
    join public.custom_fields f on f.id = field_id and f.board_id = c.board_id
    where c.id = card_id and public.is_board_member(c.board_id)
  ));

create policy "card field values updated by members"
  on public.card_field_values for update to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.is_board_member(c.board_id)
  ))
  with check (exists (
    select 1
    from public.cards c
    join public.custom_fields f on f.id = field_id and f.board_id = c.board_id
    where c.id = card_id and public.is_board_member(c.board_id)
  ));

create policy "card field values deleted by members"
  on public.card_field_values for delete to authenticated
  using (exists (
    select 1 from public.cards c
    where c.id = card_id and public.is_board_member(c.board_id)
  ));

drop policy "attachments inserted by members" on public.attachments;
drop policy "attachments updated by uploader or admin" on public.attachments;

create policy "attachments inserted by members"
  on public.attachments for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.cards c
      where c.id = card_id
        and public.is_board_member(c.board_id)
        and (
          field_id is null
          or exists (
            select 1 from public.custom_fields f
            where f.id = field_id and f.board_id = c.board_id
          )
        )
    )
  );

create policy "attachments updated by uploader or admin"
  on public.attachments for update to authenticated
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.cards c
      where c.id = card_id and public.is_board_admin(c.board_id)
    )
  )
  with check (
    exists (
      select 1 from public.cards c
      where c.id = card_id
        and public.is_board_member(c.board_id)
        and (
          field_id is null
          or exists (
            select 1 from public.custom_fields f
            where f.id = field_id and f.board_id = c.board_id
          )
        )
    )
  );

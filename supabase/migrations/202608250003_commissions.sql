-- Commission rules, immutable versions and auditable financial calculations.
-- Amounts are stored in integer cents. JSON expressions are validated again in
-- the application with Zod and never executed as SQL or JavaScript.

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  beneficiary_source text not null check (beneficiary_source in ('consultant', 'captor')),
  beneficiary_role text not null check (char_length(btrim(beneficiary_role)) between 2 and 120),
  priority integer not null default 0 check (priority between -10000 and 10000),
  exclusive boolean not null default false,
  valid_from date,
  valid_to date,
  conditions jsonb not null check (jsonb_typeof(conditions) = 'object' and conditions ->> 'kind' = 'group'),
  formula jsonb not null check (jsonb_typeof(formula) = 'object' and formula ->> 'kind' in ('constant', 'field', 'operation', 'percentage')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  active_version_id uuid,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (status <> 'published' or active_version_id is not null),
  unique (id, board_id)
);

create table public.commission_rule_versions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  rule_id uuid not null,
  version integer not null check (version > 0),
  rule_name text not null check (char_length(btrim(rule_name)) between 2 and 160),
  rule_description text not null default '' check (char_length(rule_description) <= 2000),
  beneficiary_source text not null check (beneficiary_source in ('consultant', 'captor')),
  beneficiary_role text not null check (char_length(btrim(beneficiary_role)) between 2 and 120),
  priority integer not null check (priority between -10000 and 10000),
  exclusive boolean not null,
  valid_from date,
  valid_to date,
  conditions jsonb not null check (jsonb_typeof(conditions) = 'object' and conditions ->> 'kind' = 'group'),
  formula jsonb not null check (jsonb_typeof(formula) = 'object' and formula ->> 'kind' in ('constant', 'field', 'operation', 'percentage')),
  referenced_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(referenced_fields) = 'array'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  unique (rule_id, version),
  unique (id, rule_id),
  unique (id, rule_id, board_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  foreign key (rule_id, board_id)
    references public.commission_rules(id, board_id) on delete restrict
);

alter table public.commission_rules
  add constraint commission_rules_active_version_fk
  foreign key (active_version_id, id)
  references public.commission_rule_versions(id, rule_id)
  on delete restrict;

create unique index cards_id_board_commission_fk_idx on public.cards(id, board_id);

create table public.commission_calculations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  card_id uuid not null,
  beneficiary_id uuid not null,
  beneficiary_name text not null check (char_length(btrim(beneficiary_name)) > 0),
  beneficiary_role text not null check (char_length(btrim(beneficiary_role)) > 0),
  rule_id uuid not null,
  rule_version_id uuid not null,
  rule_version integer not null check (rule_version > 0),
  base_value_cents bigint not null check (base_value_cents >= 0),
  original_amount_cents bigint not null check (original_amount_cents >= 0),
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null check (status in ('draft', 'calculated', 'approved', 'paid', 'cancelled', 'reversed')),
  idempotency_key text not null check (char_length(idempotency_key) between 10 and 500),
  revision integer not null default 1 check (revision > 0),
  supersedes_calculation_id uuid,
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ?& array['cardId', 'boardId', 'ruleVersionId', 'conditionsAst', 'formulaAst', 'fieldValues', 'resultCents', 'roundingPolicy']
  ),
  calculated_by uuid not null references public.profiles(id) on delete restrict,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id),
  foreign key (card_id, board_id)
    references public.cards(id, board_id) on delete restrict,
  foreign key (rule_version_id, rule_id, board_id)
    references public.commission_rule_versions(id, rule_id, board_id) on delete restrict,
  foreign key (supersedes_calculation_id, board_id)
    references public.commission_calculations(id, board_id) on delete restrict
);

create table public.commission_status_history (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  calculation_id uuid not null,
  from_status text check (from_status is null or from_status in ('draft', 'calculated', 'approved', 'paid', 'cancelled', 'reversed')),
  to_status text not null check (to_status in ('draft', 'calculated', 'approved', 'paid', 'cancelled', 'reversed')),
  reason text check (reason is null or char_length(btrim(reason)) between 5 and 2000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (calculation_id, board_id)
    references public.commission_calculations(id, board_id) on delete restrict
);

create table public.commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  calculation_id uuid not null,
  previous_amount_cents bigint not null check (previous_amount_cents >= 0),
  new_amount_cents bigint not null check (new_amount_cents >= 0),
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (previous_amount_cents <> new_amount_cents),
  foreign key (calculation_id, board_id)
    references public.commission_calculations(id, board_id) on delete restrict
);

create index commission_rules_board_status_idx on public.commission_rules(board_id, status, priority desc) where archived_at is null;
create index commission_rules_board_validity_idx on public.commission_rules(board_id, valid_from, valid_to);
create index commission_rule_versions_board_rule_idx on public.commission_rule_versions(board_id, rule_id, version desc);
create index commission_calculations_board_date_idx on public.commission_calculations(board_id, calculated_at desc);
create index commission_calculations_board_card_idx on public.commission_calculations(board_id, card_id, calculated_at desc);
create index commission_calculations_beneficiary_idx on public.commission_calculations(board_id, beneficiary_id, calculated_at desc);
create index commission_calculations_status_idx on public.commission_calculations(board_id, status, calculated_at desc);
create index commission_calculations_idempotency_idx on public.commission_calculations(board_id, idempotency_key);
create unique index commission_calculations_active_equivalent_idx
  on public.commission_calculations(card_id, beneficiary_id, rule_version_id)
  where status in ('draft', 'calculated', 'approved', 'paid');
create index commission_status_history_calculation_idx on public.commission_status_history(calculation_id, created_at);
create index commission_adjustments_calculation_idx on public.commission_adjustments(calculation_id, created_at);

create or replace function public.prevent_commission_version_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Versões publicadas de comissão são imutáveis.';
end;
$$;

create trigger commission_rule_versions_immutable
before update or delete on public.commission_rule_versions
for each row execute function public.prevent_commission_version_mutation();

alter table public.commission_rules enable row level security;
alter table public.commission_rule_versions enable row level security;
alter table public.commission_calculations enable row level security;
alter table public.commission_status_history enable row level security;
alter table public.commission_adjustments enable row level security;

create policy "commission rules visible to members" on public.commission_rules
  for select to authenticated using (public.is_board_member(board_id));
create policy "commission rules inserted by admins" on public.commission_rules
  for insert to authenticated with check (public.is_board_admin(board_id) and created_by = auth.uid());
create policy "commission rules updated by admins" on public.commission_rules
  for update to authenticated using (public.is_board_admin(board_id))
  with check (public.is_board_admin(board_id));

create policy "commission rule versions visible to members" on public.commission_rule_versions
  for select to authenticated using (public.is_board_member(board_id));
create policy "commission rule versions inserted by admins" on public.commission_rule_versions
  for insert to authenticated with check (public.is_board_admin(board_id) and created_by = auth.uid());

create policy "commission calculations visible to members" on public.commission_calculations
  for select to authenticated using (public.is_board_member(board_id));
create policy "commission calculations inserted by admins" on public.commission_calculations
  for insert to authenticated with check (public.is_board_admin(board_id) and calculated_by = auth.uid());

create policy "commission status history visible to members" on public.commission_status_history
  for select to authenticated using (public.is_board_member(board_id));
create policy "commission adjustments visible to members" on public.commission_adjustments
  for select to authenticated using (public.is_board_member(board_id));

create or replace function public.create_commission_calculation(
  target_board_id uuid,
  target_card_id uuid,
  target_beneficiary_id uuid,
  target_beneficiary_name text,
  target_beneficiary_role text,
  target_rule_id uuid,
  target_rule_version_id uuid,
  target_rule_version integer,
  target_base_value_cents bigint,
  target_amount_cents bigint,
  target_idempotency_key text,
  target_revision integer,
  target_supersedes_calculation_id uuid,
  target_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  if auth.uid() is null or not public.is_board_admin(target_board_id) then
    raise exception 'Sem permissão para gerar a comissão.';
  end if;
  if target_base_value_cents < 0 or target_amount_cents < 0 then
    raise exception 'Valores financeiros não podem ser negativos.';
  end if;
  if target_revision < 1 then raise exception 'Revisão inválida.'; end if;
  if jsonb_typeof(target_snapshot) <> 'object' then
    raise exception 'Snapshot de cálculo inválido.';
  end if;

  insert into public.commission_calculations (
    board_id, card_id, beneficiary_id, beneficiary_name, beneficiary_role,
    rule_id, rule_version_id, rule_version, base_value_cents,
    original_amount_cents, amount_cents, status, idempotency_key, revision,
    supersedes_calculation_id, snapshot, calculated_by
  ) values (
    target_board_id, target_card_id, target_beneficiary_id,
    btrim(target_beneficiary_name), btrim(target_beneficiary_role), target_rule_id,
    target_rule_version_id, target_rule_version, target_base_value_cents,
    target_amount_cents, target_amount_cents, 'calculated', target_idempotency_key,
    target_revision, target_supersedes_calculation_id, target_snapshot, auth.uid()
  ) returning id into created_id;

  insert into public.commission_status_history
    (board_id, calculation_id, from_status, to_status, reason, actor_id)
  values
    (target_board_id, created_id, null, 'calculated', null, auth.uid());

  return created_id;
end;
$$;

create or replace function public.transition_commission_status(
  target_calculation_id uuid,
  target_status text,
  expected_updated_at timestamptz,
  transition_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_calculation public.commission_calculations%rowtype;
  transition_allowed boolean;
begin
  select * into current_calculation
  from public.commission_calculations
  where id = target_calculation_id
  for update;

  if not found then raise exception 'Comissão não encontrada.'; end if;
  if auth.uid() is null or not public.is_board_admin(current_calculation.board_id) then
    raise exception 'Sem permissão para alterar a comissão.';
  end if;
  if current_calculation.updated_at <> expected_updated_at then
    raise exception 'A comissão foi alterada por outra sessão.';
  end if;

  transition_allowed := case current_calculation.status
    when 'draft' then target_status in ('calculated', 'cancelled')
    when 'calculated' then target_status in ('approved', 'cancelled')
    when 'approved' then target_status in ('paid', 'cancelled')
    when 'paid' then target_status = 'reversed'
    else false
  end;
  if not transition_allowed then raise exception 'Transição de status inválida.'; end if;
  if target_status in ('cancelled', 'reversed') and char_length(btrim(coalesce(transition_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com ao menos cinco caracteres.';
  end if;

  update public.commission_calculations
  set status = target_status, updated_at = now()
  where id = target_calculation_id;

  insert into public.commission_status_history
    (board_id, calculation_id, from_status, to_status, reason, actor_id)
  values
    (current_calculation.board_id, target_calculation_id, current_calculation.status,
     target_status, nullif(btrim(coalesce(transition_reason, '')), ''), auth.uid());
end;
$$;

create or replace function public.adjust_commission_amount(
  target_calculation_id uuid,
  target_amount_cents bigint,
  expected_updated_at timestamptz,
  adjustment_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_calculation public.commission_calculations%rowtype;
begin
  select * into current_calculation
  from public.commission_calculations
  where id = target_calculation_id
  for update;

  if not found then raise exception 'Comissão não encontrada.'; end if;
  if auth.uid() is null or not public.is_board_admin(current_calculation.board_id) then
    raise exception 'Sem permissão para ajustar a comissão.';
  end if;
  if current_calculation.updated_at <> expected_updated_at then
    raise exception 'A comissão foi alterada por outra sessão.';
  end if;
  if current_calculation.status in ('cancelled', 'reversed') then
    raise exception 'Comissões canceladas ou estornadas não podem ser ajustadas.';
  end if;
  if target_amount_cents < 0 or target_amount_cents = current_calculation.amount_cents then
    raise exception 'O novo valor precisa ser não negativo e diferente do atual.';
  end if;
  if char_length(btrim(coalesce(adjustment_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com ao menos cinco caracteres.';
  end if;

  insert into public.commission_adjustments
    (board_id, calculation_id, previous_amount_cents, new_amount_cents, reason, actor_id)
  values
    (current_calculation.board_id, target_calculation_id, current_calculation.amount_cents,
     target_amount_cents, btrim(adjustment_reason), auth.uid());

  update public.commission_calculations
  set amount_cents = target_amount_cents, updated_at = now()
  where id = target_calculation_id;
end;
$$;

revoke all on function public.prevent_commission_version_mutation() from public;
revoke all on function public.create_commission_calculation(uuid, uuid, uuid, text, text, uuid, uuid, integer, bigint, bigint, text, integer, uuid, jsonb) from public;
revoke all on function public.transition_commission_status(uuid, text, timestamptz, text) from public;
revoke all on function public.adjust_commission_amount(uuid, bigint, timestamptz, text) from public;
grant execute on function public.create_commission_calculation(uuid, uuid, uuid, text, text, uuid, uuid, integer, bigint, bigint, text, integer, uuid, jsonb) to authenticated;
grant execute on function public.transition_commission_status(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.adjust_commission_amount(uuid, bigint, timestamptz, text) to authenticated;

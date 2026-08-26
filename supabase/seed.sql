-- Configuração operacional inicial. Não cria usuários, consultores, captadores ou cards.
insert into public.boards(id, name, description)
values (
  '10000000-0000-4000-8000-000000000001',
  'Fechamento Locação',
  'Operação de contratos e entrega de chaves'
)
on conflict (id) do nothing;

insert into public.board_lists(id, board_id, name, position, completed_state, sla_hours)
select
  id::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  name,
  position,
  completed,
  null::integer
from (values
  ('30000000-0000-4000-8000-000000000001', 'FECHAMENTOS EM ANDAMENTO', 1024, false),
  ('30000000-0000-4000-8000-000000000002', 'AGUARDANDO APROVAÇÃO GESTÃO', 2048, false),
  ('30000000-0000-4000-8000-000000000003', 'APROVADOS - AGUARDANDO TERMO', 3072, false),
  ('30000000-0000-4000-8000-000000000004', 'PARA ELABORAÇÃO DE CONTRATO', 4096, false),
  ('30000000-0000-4000-8000-000000000005', 'MINUTA PRONTA - AGUARDANDO VISTORIA', 5120, false),
  ('30000000-0000-4000-8000-000000000006', 'CONTRATO ENVIADO', 6144, false),
  ('30000000-0000-4000-8000-000000000007', 'ADITIVOS ENVIADOS', 7168, false),
  ('30000000-0000-4000-8000-000000000008', 'CONTRATO ASSINADO - FALTANDO CELESC OU PAGAMENTO VISTORIA', 8192, false),
  ('30000000-0000-4000-8000-000000000009', 'PRONTO PARA ENTREGAR AS CHAVES', 9216, false),
  ('30000000-0000-4000-8000-000000000010', 'PEDIR PIZZA', 10240, false),
  ('30000000-0000-4000-8000-000000000011', 'CADASTRAR NO SISTEMA', 11264, false),
  ('30000000-0000-4000-8000-000000000012', 'EMITIR SEGURO INCÊNDIO', 12288, false),
  ('30000000-0000-4000-8000-000000000013', 'PENDENTE CELESC - COBRAR', 13312, false),
  ('30000000-0000-4000-8000-000000000014', 'ENTREGA DE CHAVES FEITA', 14336, true)
) as configured(id, name, position, completed)
on conflict (id) do nothing;

insert into public.units(id, board_id, name)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Itapema'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Balneário Camboriú'
  )
on conflict (id) do nothing;

-- O sistema hospedeiro deve associar o usuário autenticado ao quadro.
-- insert into public.board_members(board_id, profile_id, role)
-- values ('10000000-0000-4000-8000-000000000001', '<AUTH_USER_UUID>', 'admin');

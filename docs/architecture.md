# Arquitetura

## Camadas

- `app/`: App Router, metadata, estados globais e estilos.
- `components/`: Kanban, modais, configurações, comissionamento e acessibilidade.
- `components/theme/`: tema persistente e iluminação ambiente.
- `lib/domain/`: entidades normalizadas, filtros, SLA, permissões, ranking e mutações puras.
- `lib/persistence/`: contrato de repositório, armazenamento local v4 e fronteira Supabase.
- `lib/validation/`: schemas Zod usados na interface e no domínio.
- `supabase/`: esquema, RLS, storage e configuração operacional inicial sem dados fictícios.
- `tests/`: domínio, rollback do provider e fluxos críticos no navegador.

## Decisões principais

**Autenticação incorporada:** a aplicação não renderiza login. `currentUserId` representa a sessão autenticada entregue pelo sistema hospedeiro. A implantação deve mapear essa identidade para `board_members`; o Supabase continua protegendo leitura e escrita com RLS.

**Persistência versionada:** o schema local v4 adiciona regras, versões, cálculos, histórico de status e ajustes de comissão. A migração v3 → v4 preserva todas as entidades existentes e inicializa apenas as coleções novas vazias; as migrações anteriores continuam suportadas.

**SLA por coluna:** `slaHours` pertence à coluna e `enteredListAt` ao card. A entrada em uma nova coluna reinicia o relógio; reordenar o card dentro da mesma coluna preserva o instante. O estado atrasado é derivado, sem gravar flags redundantes.

**Ordenação:** posições usam intervalos fracionários. Um movimento altera somente o card ou as duas colunas afetadas, evitando renumeração global.

**Cadastros normalizados:** unidade, consultor e captador são entidades reutilizáveis referenciadas pelo card. A exclusão é bloqueada enquanto houver vínculo operacional.

**Campos globais:** definições de campo são normalizadas por quadro e seus valores por card. A exclusão é um arquivamento lógico, preservando valores e histórico; anexos podem ser vinculados diretamente à definição do campo.

**Consistência:** mutações materiais de card geram atividade. Movimentos otimistas são revertidos quando a persistência falha. No Supabase, `version` e `move_card` mantêm concorrência otimista e atualização atômica.

**Segurança:** conteúdo livre permanece texto simples. Anexos de produção ficam em bucket privado. Permissões são verificadas no domínio para feedback imediato e novamente no banco por RLS.

## Comissionamento

`lib/domain/commissions/evaluator.ts` é um interpretador puro de AST. Condições e fórmulas passam por schemas Zod, não aceitam JavaScript, SQL ou `eval` e referenciam campos personalizados por UUID. O motor normaliza moedas em centavos, percentuais em pontos percentuais entre 0 e 100 e usa racionais com `BigInt` para impedir erros de ponto flutuante. O único arredondamento ocorre no resultado final, pelo critério meio para longe de zero.

`commission_rules` mantém a definição editável e `commission_rule_versions` preserva cada publicação imutável. Cálculos guardam um snapshot completo do card, beneficiário, versão, campos, condições, AST, etapas e política de arredondamento. Mudanças posteriores no card ou nos campos não alteram esse snapshot. A chave ativa por card, beneficiário e versão evita duplicidade acidental; recálculos explícitos criam uma nova revisão e preservam a anterior.

Membros do quadro podem consultar e simular. Administradores podem editar, publicar e arquivar regras, gerar cálculos e realizar transições ou ajustes financeiros. No Supabase, tabelas históricas não possuem política de exclusão e as transições financeiras passam por RPCs transacionais com verificação de papel e concorrência.

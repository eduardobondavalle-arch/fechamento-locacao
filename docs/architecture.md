# Arquitetura

## Camadas

- `app/`: App Router, metadata, estados globais e estilos.
- `components/`: Kanban, modais, configurações e acessibilidade.
- `components/theme/`: tema persistente e iluminação ambiente.
- `lib/domain/`: entidades normalizadas, filtros, SLA, permissões, ranking e mutações puras.
- `lib/persistence/`: contrato de repositório, armazenamento local v3 e fronteira Supabase.
- `lib/validation/`: schemas Zod usados na interface e no domínio.
- `supabase/`: esquema, RLS, storage e configuração operacional inicial sem dados fictícios.
- `tests/`: domínio, rollback do provider e fluxos críticos no navegador.

## Decisões principais

**Autenticação incorporada:** a aplicação não renderiza login. `currentUserId` representa a sessão autenticada entregue pelo sistema hospedeiro. A implantação deve mapear essa identidade para `board_members`; o Supabase continua protegendo leitura e escrita com RLS.

**Persistência versionada:** o schema local v3 adiciona aluguel e campos configuráveis. Dados operacionais do v2 são migrados e preservados; a chave v1 com dados demonstrativos continua descartada.

**SLA por coluna:** `slaHours` pertence à coluna e `enteredListAt` ao card. A entrada em uma nova coluna reinicia o relógio; reordenar o card dentro da mesma coluna preserva o instante. O estado atrasado é derivado, sem gravar flags redundantes.

**Ordenação:** posições usam intervalos fracionários. Um movimento altera somente o card ou as duas colunas afetadas, evitando renumeração global.

**Cadastros normalizados:** unidade, consultor e captador são entidades reutilizáveis referenciadas pelo card. A exclusão é bloqueada enquanto houver vínculo operacional.

**Campos globais:** definições de campo são normalizadas por quadro e seus valores por card. A exclusão é um arquivamento lógico, preservando valores e histórico; anexos podem ser vinculados diretamente à definição do campo.

**Consistência:** mutações materiais de card geram atividade. Movimentos otimistas são revertidos quando a persistência falha. No Supabase, `version` e `move_card` mantêm concorrência otimista e atualização atômica.

**Segurança:** conteúdo livre permanece texto simples. Anexos de produção ficam em bucket privado. Permissões são verificadas no domínio para feedback imediato e novamente no banco por RLS.

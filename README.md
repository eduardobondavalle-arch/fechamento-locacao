# Fechamento de Locação

Kanban operacional da Adim para acompanhar fechamentos de locação até a entrega das chaves. A aplicação foi preparada para ser incorporada a um sistema que já fornece autenticação, portanto não possui tela de login própria.

## Funcionalidades

- cards ordenáveis por drag-and-drop entre colunas;
- rolagem horizontal automática ao aproximar o ponteiro das bordas do Kanban;
- criação de fechamentos com unidade, consultor, captador, imóvel, CPF e nome do locatário;
- filtros por unidade, consultor e captador;
- criação, renomeação, reordenação e exclusão protegida de colunas;
- SLA configurável por coluna, reiniciado quando o card muda de etapa;
- faixa superior vermelha e aviso visual quando o SLA é extrapolado;
- cadastros configuráveis de unidades, consultores e captadores;
- checklists, comentários, anexos e histórico de atividades;
- tema claro/escuro persistente;
- armazenamento local versionado para desenvolvimento e fronteira tipada para Supabase.

Não há cards, usuários, consultores ou captadores fictícios. A configuração inicial contém apenas o fluxo operacional e as unidades Itapema e Balneário Camboriú.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. No PowerShell, use `npm.cmd` caso a política do sistema bloqueie `npm.ps1`.

## Validação

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Integração e persistência

O `BoardProvider` concentra o estado e recebe um `BoardRepository`. No desenvolvimento, `LocalBoardRepository` grava o schema v2 em `localStorage`; dados antigos do protótipo v1 são descartados automaticamente. Na implantação, conecte o contexto de usuário do sistema hospedeiro e substitua o repositório local pelo adaptador remoto.

O esquema Supabase inclui tabelas normalizadas para unidades, consultores e captadores, campos próprios do fechamento, SLA por coluna, RLS e a RPC transacional `move_card`. Nunca exponha a chave `service_role` no navegador.

## Regras operacionais

- posições usam ranking fracionário, sem renumerar todos os registros em cada movimento;
- mover um card para outra coluna atualiza `entered_list_at` e reinicia seu SLA;
- colunas com cards não podem ser excluídas;
- cadastros vinculados a cards não podem ser excluídos;
- entradas são validadas com Zod, incluindo o dígito verificador do CPF;
- exclusões permanentes de cards exigem confirmação e permissão administrativa.

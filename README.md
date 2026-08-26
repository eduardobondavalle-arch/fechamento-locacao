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
- aba de Comissionamento separada entre captação e locação, com valores agrupados por captador ou consultor, regras visuais por UUID de campo, simulação sem efeitos colaterais, geração individual ou em lote e memória auditável;
- fluxo financeiro de cálculo, aprovação, pagamento, cancelamento, estorno e ajuste justificado, protegido por permissões.

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

O `BoardProvider` concentra o estado e recebe um `BoardRepository`. No desenvolvimento, `LocalBoardRepository` grava o schema v4 em `localStorage`; dados v3 são migrados sem perda e as novas coleções financeiras começam vazias. Dados antigos do protótipo v1 são descartados automaticamente. Na implantação, conecte o contexto de usuário do sistema hospedeiro e substitua o repositório local pelo adaptador remoto.

O esquema Supabase inclui tabelas normalizadas para unidades, consultores e captadores, campos próprios do fechamento, SLA por coluna e comissionamento. A RLS permite leitura financeira a membros e administração somente a administradores; as RPCs `transition_commission_status` e `adjust_commission_amount` executam alterações sensíveis com bloqueio, concorrência otimista e auditoria atômica. Nunca exponha a chave `service_role` no navegador.

## Regras operacionais

- posições usam ranking fracionário, sem renumerar todos os registros em cada movimento;
- mover um card para outra coluna atualiza `entered_list_at` e reinicia seu SLA;
- colunas com cards não podem ser excluídas;
- cadastros vinculados a cards não podem ser excluídos;
- entradas são validadas com Zod, incluindo o dígito verificador do CPF;
- exclusões permanentes de cards exigem confirmação e permissão administrativa.
- campos percentuais usam pontos percentuais decimais (`30` representa 30%); moedas personalizadas usam reais decimais e valores nativos/financeiros usam centavos inteiros;
- o motor de comissões usa aritmética racional exata e a política determinística “meio para longe de zero”, aplicada apenas ao centavo final;
- valores monetários e o resultado final não podem ser negativos; números escalares podem ser negativos quando a fórmula exigir, e percentuais são estritamente limitados de 0 a 100;
- regras referenciam `custom_fields.id`, nunca o nome, e snapshots preservam nomes, tipos, valores, AST e etapas utilizadas no instante do cálculo.

import { RANK_STEP } from "./rank";
import type { AppData, BoardList } from "./types";

export const BOARD_ID = "10000000-0000-4000-8000-000000000001";
export const EXTERNAL_SESSION_ID = "external-authenticated-session";

const listNames = [
  "FECHAMENTOS EM ANDAMENTO",
  "AGUARDANDO APROVAÇÃO GESTÃO",
  "APROVADOS - AGUARDANDO TERMO",
  "PARA ELABORAÇÃO DE CONTRATO",
  "MINUTA PRONTA - AGUARDANDO VISTORIA",
  "CONTRATO ENVIADO",
  "ADITIVOS ENVIADOS",
  "CONTRATO ASSINADO - FALTANDO CELESC OU PAGAMENTO VISTORIA",
  "PRONTO PARA ENTREGAR AS CHAVES",
  "PEDIR PIZZA",
  "CADASTRAR NO SISTEMA",
  "EMITIR SEGURO INCÊNDIO",
  "PENDENTE CELESC - COBRAR",
  "ENTREGA DE CHAVES FEITA",
];

export const initialLists: BoardList[] = listNames.map((name, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  boardId: BOARD_ID,
  name,
  position: (index + 1) * RANK_STEP,
  completedState: index === listNames.length - 1,
  archived: false,
  slaHours: null,
}));

export function createInitialData(): AppData {
  return {
    schemaVersion: 3,
    currentUserId: EXTERNAL_SESSION_ID,
    profiles: [],
    boards: [
      {
        id: BOARD_ID,
        name: "Fechamento Locação",
        description: "Operação de contratos e entrega de chaves",
      },
    ],
    boardMembers: [
      {
        boardId: BOARD_ID,
        profileId: EXTERNAL_SESSION_ID,
        role: "admin",
      },
    ],
    lists: initialLists,
    cards: [],
    units: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        boardId: BOARD_ID,
        name: "Itapema",
      },
      {
        id: "70000000-0000-4000-8000-000000000002",
        boardId: BOARD_ID,
        name: "Balneário Camboriú",
      },
    ],
    consultants: [],
    captors: [],
    customFields: [],
    cardFieldValues: [],
    checklistTemplates: [],
    checklists: [],
    checklistItems: [],
    comments: [],
    attachments: [],
    activities: [],
  };
}

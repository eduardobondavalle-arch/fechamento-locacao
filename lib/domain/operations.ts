import { can } from "./permissions";
import { rankBetween, RANK_STEP } from "./rank";
import type {
  ActivityType,
  AppData,
  Attachment,
  Card,
  ChecklistItem,
  Comment,
  CustomFieldDefinition,
  DirectoryEntry,
} from "./types";
import {
  cardDraftSchema,
  checklistItemSchema,
  commentSchema,
  customFieldDraftSchema,
  directoryEntrySchema,
  listDraftSchema,
  type CardDraftInput,
} from "../validation/cards";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

const clone = (data: AppData): AppData => structuredClone(data);
const id = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();

function requireUser(data: AppData): string {
  return data.currentUserId;
}

function requirePermission(
  data: AppData,
  permission: Parameters<typeof can>[2],
): void {
  if (!can(data, data.boards[0]?.id ?? "", permission)) {
    throw new DomainError("Você não tem permissão para realizar esta ação.");
  }
}

function activity(
  data: AppData,
  cardId: string,
  type: ActivityType,
  message: string,
  metadata: Record<string, string | number | boolean | null> = {},
): void {
  data.activities.unshift({
    id: id(),
    boardId: data.boards[0].id,
    cardId,
    actorId: requireUser(data),
    type,
    message,
    metadata,
    createdAt: timestamp(),
  });
}

function touch(card: Card): void {
  card.updatedAt = timestamp();
  card.version += 1;
}

function requireCardRelations(data: AppData, input: CardDraftInput): void {
  if (!data.lists.some((item) => item.id === input.listId && !item.archived))
    throw new DomainError("Selecione uma etapa válida.");
  if (!data.units.some((item) => item.id === input.unitId))
    throw new DomainError("Selecione uma unidade válida.");
  if (!data.consultants.some((item) => item.id === input.consultantId))
    throw new DomainError("Selecione um consultor válido.");
  if (!data.captors.some((item) => item.id === input.captorId))
    throw new DomainError("Selecione um captador válido.");
}

export function createCard(
  source: AppData,
  input: CardDraftInput,
): { data: AppData; cardId: string } {
  requirePermission(source, "cards.create");
  const parsed = cardDraftSchema.parse(input);
  if (parsed.rentValueCents <= 0)
    throw new DomainError("Informe o valor do aluguel.");
  requireCardRelations(source, parsed);
  const data = clone(source);
  const cards = data.cards
    .filter((card) => card.listId === parsed.listId && !card.archived)
    .sort((a, b) => a.position - b.position);
  const createdAt = timestamp();
  const cardId = id();
  data.cards.push({
    id: cardId,
    boardId: data.boards[0].id,
    listId: parsed.listId,
    unitId: parsed.unitId,
    consultantId: parsed.consultantId,
    captorId: parsed.captorId,
    property: parsed.property,
    rentValueCents: parsed.rentValueCents,
    tenantCpf: parsed.tenantCpf,
    tenantName: parsed.tenantName,
    description: "",
    position: rankBetween(cards.at(-1)?.position, null),
    archived: false,
    enteredListAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  });
  activity(data, cardId, "card.created", "criou este card");
  return { data, cardId };
}

type CardPatch = Partial<
  Pick<
    Card,
    | "listId"
    | "unitId"
    | "consultantId"
    | "captorId"
    | "property"
    | "rentValueCents"
    | "tenantCpf"
    | "tenantName"
    | "description"
  >
>;

export function updateCard(
  source: AppData,
  cardId: string,
  patch: CardPatch,
): AppData {
  requirePermission(source, "cards.edit");
  const currentCard = source.cards.find((item) => item.id === cardId);
  if (!currentCard) throw new DomainError("Card não encontrado.");
  const parsed = cardDraftSchema.parse({ ...currentCard, ...patch });
  if (patch.rentValueCents !== undefined && parsed.rentValueCents <= 0)
    throw new DomainError("Informe o valor do aluguel.");
  requireCardRelations(source, parsed);
  const data = clone(source);
  const card = data.cards.find((item) => item.id === cardId)!;
  const oldListId = card.listId;
  Object.assign(card, parsed);
  if (patch.description !== undefined) card.description = patch.description;
  touch(card);

  if (patch.listId && patch.listId !== oldListId) {
    const siblings = data.cards
      .filter((item) => item.listId === patch.listId && item.id !== cardId)
      .sort((a, b) => a.position - b.position);
    card.position = rankBetween(siblings.at(-1)?.position, null);
    card.enteredListAt = timestamp();
    const to =
      data.lists.find((list) => list.id === patch.listId)?.name ?? outraLista;
    activity(data, cardId, "card.moved", `moveu o card para ${to}`, {
      fromListId: oldListId,
      toListId: patch.listId,
    });
  } else {
    const changedField = Object.keys(patch)[0] as keyof CardPatch | undefined;
    const fieldNames: Partial<Record<keyof CardPatch, string>> = {
      unitId: "a unidade",
      consultantId: "o consultor",
      captorId: "o captador",
      property: "o imóvel",
      rentValueCents: "o valor do aluguel",
      tenantCpf: "o CPF do locatário",
      tenantName: "o nome do locatário",
      description: "as observações",
    };
    const beforeValue = changedField
      ? (currentCard[changedField as keyof Card] ?? null)
      : null;
    const afterValue = changedField
      ? (card[changedField as keyof Card] ?? null)
      : null;
    activity(
      data,
      cardId,
      "card.edited",
      changedField
        ? `alterou ${fieldNames[changedField] ?? "os dados do card"}`
        : "atualizou os dados do card",
      {
        field: changedField ?? null,
        before:
          typeof beforeValue === "string" || typeof beforeValue === "number"
            ? beforeValue
            : null,
        after:
          typeof afterValue === "string" || typeof afterValue === "number"
            ? afterValue
            : null,
      },
    );
  }
  return data;
}

const outraLista = "outra coluna";

export function moveCard(
  source: AppData,
  cardId: string,
  toListId: string,
  beforeCardId?: string | null,
): AppData {
  requirePermission(source, "cards.move");
  const data = clone(source);
  const card = data.cards.find((item) => item.id === cardId);
  const targetList = data.lists.find(
    (list) => list.id === toListId && !list.archived,
  );
  if (!card || !targetList)
    throw new DomainError("Destino do card não encontrado.");
  const oldListId = card.listId;
  const siblings = data.cards
    .filter(
      (item) =>
        item.listId === toListId && item.id !== cardId && !item.archived,
    )
    .sort((a, b) => a.position - b.position);
  const targetIndex = beforeCardId
    ? siblings.findIndex((item) => item.id === beforeCardId)
    : siblings.length;
  const insertionIndex = targetIndex < 0 ? siblings.length : targetIndex;
  const before = siblings[insertionIndex - 1]?.position ?? null;
  const after = siblings[insertionIndex]?.position ?? null;
  card.listId = toListId;
  card.position = rankBetween(before, after);
  if (oldListId !== toListId) card.enteredListAt = timestamp();
  touch(card);
  const from =
    data.lists.find((list) => list.id === oldListId)?.name ?? "coluna anterior";
  activity(
    data,
    cardId,
    "card.moved",
    oldListId === toListId
      ? "reordenou este card"
      : `moveu de ${from} para ${targetList.name}`,
    { fromListId: oldListId, toListId, position: card.position },
  );
  return data;
}

export function addChecklist(
  source: AppData,
  cardId: string,
  fromTemplate = false,
): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const template = fromTemplate ? data.checklistTemplates[0] : undefined;
  const checklistId = id();
  const siblings = data.checklists
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => a.position - b.position);
  data.checklists.push({
    id: checklistId,
    cardId,
    name: template?.name ?? "Nova checklist",
    position: rankBetween(siblings.at(-1)?.position, null),
  });
  if (template) {
    data.checklistItems.push(
      ...template.items.map((title, index) => ({
        id: id(),
        checklistId,
        title,
        position: (index + 1) * RANK_STEP,
        completed: false,
        completedAt: null,
        completedBy: null,
      })),
    );
  }
  activity(data, cardId, "checklist.changed", "adicionou uma checklist");
  return data;
}

export function renameChecklist(
  source: AppData,
  checklistId: string,
  name: string,
): AppData {
  requirePermission(source, "cards.edit");
  if (!name.trim()) throw new DomainError("Informe um nome para a checklist.");
  const data = clone(source);
  const checklist = data.checklists.find((item) => item.id === checklistId);
  if (!checklist) throw new DomainError("Checklist não encontrada.");
  checklist.name = name.trim();
  activity(
    data,
    checklist.cardId,
    "checklist.changed",
    "renomeou uma checklist",
  );
  return data;
}

export function deleteChecklist(source: AppData, checklistId: string): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const checklist = data.checklists.find((item) => item.id === checklistId);
  if (!checklist) return data;
  data.checklists = data.checklists.filter((item) => item.id !== checklistId);
  data.checklistItems = data.checklistItems.filter(
    (item) => item.checklistId !== checklistId,
  );
  activity(
    data,
    checklist.cardId,
    "checklist.changed",
    "excluiu uma checklist",
  );
  return data;
}

export function addChecklistItem(
  source: AppData,
  checklistId: string,
  title: string,
): AppData {
  requirePermission(source, "cards.edit");
  const parsed = checklistItemSchema.parse({ title });
  const data = clone(source);
  const checklist = data.checklists.find((item) => item.id === checklistId);
  if (!checklist) throw new DomainError("Checklist não encontrada.");
  const siblings = data.checklistItems
    .filter((item) => item.checklistId === checklistId)
    .sort((a, b) => a.position - b.position);
  data.checklistItems.push({
    id: id(),
    checklistId,
    title: parsed.title,
    position: rankBetween(siblings.at(-1)?.position, null),
    completed: false,
    completedAt: null,
    completedBy: null,
  });
  activity(
    data,
    checklist.cardId,
    "checklist.changed",
    "adicionou um item à checklist",
  );
  return data;
}

export function updateChecklistItem(
  source: AppData,
  itemId: string,
  patch: Partial<Pick<ChecklistItem, "title" | "completed" | "position">>,
): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const item = data.checklistItems.find((entry) => entry.id === itemId);
  if (!item) throw new DomainError("Item não encontrado.");
  if (patch.title !== undefined)
    item.title = checklistItemSchema.parse({ title: patch.title }).title;
  if (patch.completed !== undefined) {
    item.completed = patch.completed;
    item.completedAt = patch.completed ? timestamp() : null;
    item.completedBy = patch.completed ? requireUser(data) : null;
  }
  if (patch.position !== undefined) item.position = patch.position;
  const checklist = data.checklists.find(
    (entry) => entry.id === item.checklistId,
  );
  if (checklist)
    activity(data, checklist.cardId, "checklist.changed", "atualizou um item");
  return data;
}

export function reorderChecklistItem(
  source: AppData,
  itemId: string,
  direction: -1 | 1,
): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const item = data.checklistItems.find((entry) => entry.id === itemId);
  if (!item) throw new DomainError("Item não encontrado.");
  const siblings = data.checklistItems
    .filter((entry) => entry.checklistId === item.checklistId)
    .sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((entry) => entry.id === itemId);
  const swap = siblings[index + direction];
  if (!swap) return data;
  const currentPosition = item.position;
  item.position = swap.position;
  swap.position = currentPosition;
  const checklist = data.checklists.find(
    (entry) => entry.id === item.checklistId,
  );
  if (checklist)
    activity(
      data,
      checklist.cardId,
      "checklist.changed",
      "reordenou a checklist",
    );
  return data;
}

export function deleteChecklistItem(source: AppData, itemId: string): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const item = data.checklistItems.find((entry) => entry.id === itemId);
  if (!item) return data;
  const checklist = data.checklists.find(
    (entry) => entry.id === item.checklistId,
  );
  data.checklistItems = data.checklistItems.filter(
    (entry) => entry.id !== itemId,
  );
  if (checklist)
    activity(
      data,
      checklist.cardId,
      "checklist.changed",
      "removeu um item da checklist",
    );
  return data;
}

export function addComment(
  source: AppData,
  cardId: string,
  body: string,
): AppData {
  requirePermission(source, "cards.comment");
  const parsed = commentSchema.parse({ body });
  const data = clone(source);
  const comment: Comment = {
    id: id(),
    cardId,
    authorId: requireUser(data),
    body: parsed.body,
    createdAt: timestamp(),
  };
  data.comments.push(comment);
  activity(data, cardId, "comment.added", "adicionou um comentário");
  return data;
}

export function addAttachment(
  source: AppData,
  cardId: string,
  file: Omit<Attachment, "id" | "cardId" | "uploaderId" | "createdAt">,
): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  data.attachments.push({
    id: id(),
    cardId,
    uploaderId: requireUser(data),
    createdAt: timestamp(),
    ...file,
  });
  const card = data.cards.find((item) => item.id === cardId);
  if (card) touch(card);
  activity(data, cardId, "attachment.added", `anexou ${file.filename}`, {
    fieldId: file.fieldId,
  });
  return data;
}

export function removeAttachment(
  source: AppData,
  attachmentId: string,
): AppData {
  requirePermission(source, "cards.edit");
  const data = clone(source);
  const attachment = data.attachments.find((item) => item.id === attachmentId);
  if (!attachment) return data;
  data.attachments = data.attachments.filter(
    (item) => item.id !== attachmentId,
  );
  const card = data.cards.find((item) => item.id === attachment.cardId);
  if (card) touch(card);
  activity(
    data,
    attachment.cardId,
    "attachment.removed",
    `removeu ${attachment.filename}`,
    { fieldId: attachment.fieldId },
  );
  return data;
}

export function setArchived(
  source: AppData,
  cardId: string,
  archived: boolean,
): AppData {
  requirePermission(source, archived ? "cards.archive" : "archives.manage");
  const data = clone(source);
  const card = data.cards.find((item) => item.id === cardId);
  if (!card) throw new DomainError("Card não encontrado.");
  card.archived = archived;
  touch(card);
  activity(
    data,
    cardId,
    archived ? "card.archived" : "card.restored",
    archived ? "arquivou este card" : "restaurou este card",
  );
  return data;
}

export function deleteCard(source: AppData, cardId: string): AppData {
  requirePermission(source, "cards.delete");
  const data = clone(source);
  data.cards = data.cards.filter((item) => item.id !== cardId);
  const checklistIds = data.checklists
    .filter((item) => item.cardId === cardId)
    .map((item) => item.id);
  data.checklists = data.checklists.filter((item) => item.cardId !== cardId);
  data.checklistItems = data.checklistItems.filter(
    (item) => !checklistIds.includes(item.checklistId),
  );
  data.comments = data.comments.filter((item) => item.cardId !== cardId);
  data.attachments = data.attachments.filter((item) => item.cardId !== cardId);
  data.cardFieldValues = data.cardFieldValues.filter(
    (item) => item.cardId !== cardId,
  );
  data.activities = data.activities.filter((item) => item.cardId !== cardId);
  return data;
}

export function createList(
  source: AppData,
  input: { name: string; slaHours: number | null },
): AppData {
  requirePermission(source, "lists.manage");
  const parsed = listDraftSchema.parse(input);
  const data = clone(source);
  const lists = data.lists
    .filter((item) => !item.archived)
    .sort((a, b) => a.position - b.position);
  data.lists.push({
    id: id(),
    boardId: data.boards[0].id,
    name: parsed.name,
    slaHours: parsed.slaHours,
    position: rankBetween(lists.at(-1)?.position, null),
    completedState: false,
    archived: false,
  });
  return data;
}

export function updateList(
  source: AppData,
  listId: string,
  patch: { name?: string; slaHours?: number | null },
): AppData {
  requirePermission(source, "lists.manage");
  const current = source.lists.find((item) => item.id === listId);
  if (!current) throw new DomainError("Coluna não encontrada.");
  const parsed = listDraftSchema.parse({ ...current, ...patch });
  const data = clone(source);
  const list = data.lists.find((item) => item.id === listId)!;
  list.name = parsed.name;
  list.slaHours = parsed.slaHours;
  return data;
}

export function moveList(
  source: AppData,
  listId: string,
  direction: -1 | 1,
): AppData {
  requirePermission(source, "lists.manage");
  const data = clone(source);
  const lists = data.lists
    .filter((item) => !item.archived)
    .sort((a, b) => a.position - b.position);
  const index = lists.findIndex((item) => item.id === listId);
  const swap = lists[index + direction];
  if (index < 0 || !swap) return data;
  const current = lists[index];
  const position = current.position;
  current.position = swap.position;
  swap.position = position;
  return data;
}

export function archiveList(source: AppData, listId: string): AppData {
  requirePermission(source, "lists.manage");
  if (source.cards.some((card) => card.listId === listId)) {
    throw new DomainError(
      "Mova ou exclua os cards desta coluna antes de excluí-la.",
    );
  }
  const data = clone(source);
  const list = data.lists.find((item) => item.id === listId);
  if (!list) throw new DomainError("Coluna não encontrada.");
  list.archived = true;
  return data;
}

type DirectoryKey = "units" | "consultants" | "captors";

function directoryLabel(key: DirectoryKey): string {
  if (key === "units") return "unidade";
  if (key === "consultants") return "consultor";
  return "captador";
}

function createDirectoryItem(
  source: AppData,
  key: DirectoryKey,
  name: string,
): AppData {
  requirePermission(source, "directories.manage");
  const parsed = directoryEntrySchema.parse({ name });
  if (
    source[key].some(
      (item) =>
        item.name.toLocaleLowerCase("pt-BR") ===
        parsed.name.toLocaleLowerCase("pt-BR"),
    )
  )
    throw new DomainError(`Esta ${directoryLabel(key)} já está cadastrada.`);
  const data = clone(source);
  data[key].push({ id: id(), boardId: data.boards[0].id, name: parsed.name });
  return data;
}

function renameDirectoryItem(
  source: AppData,
  key: DirectoryKey,
  itemId: string,
  name: string,
): AppData {
  requirePermission(source, "directories.manage");
  const parsed = directoryEntrySchema.parse({ name });
  const data = clone(source);
  const entries: DirectoryEntry[] = data[key];
  const entry = entries.find((item) => item.id === itemId);
  if (!entry) throw new DomainError("Cadastro não encontrado.");
  if (
    entries.some(
      (item) =>
        item.id !== itemId &&
        item.name.toLocaleLowerCase("pt-BR") ===
          parsed.name.toLocaleLowerCase("pt-BR"),
    )
  )
    throw new DomainError(`Esta ${directoryLabel(key)} já está cadastrada.`);
  entry.name = parsed.name;
  return data;
}

function deleteDirectoryItem(
  source: AppData,
  key: DirectoryKey,
  itemId: string,
): AppData {
  requirePermission(source, "directories.manage");
  const referenceKey =
    key === "units"
      ? "unitId"
      : key === "consultants"
        ? "consultantId"
        : "captorId";
  if (source.cards.some((card) => card[referenceKey] === itemId)) {
    throw new DomainError(
      `Este ${directoryLabel(key)} está vinculado a um card.`,
    );
  }
  const data = clone(source);
  data[key] = data[key].filter((item) => item.id !== itemId);
  return data;
}

export const createUnit = (source: AppData, name: string) =>
  createDirectoryItem(source, "units", name);
export const renameUnit = (source: AppData, itemId: string, name: string) =>
  renameDirectoryItem(source, "units", itemId, name);
export const deleteUnit = (source: AppData, itemId: string) =>
  deleteDirectoryItem(source, "units", itemId);
export const createConsultant = (source: AppData, name: string) =>
  createDirectoryItem(source, "consultants", name);
export const renameConsultant = (
  source: AppData,
  itemId: string,
  name: string,
) => renameDirectoryItem(source, "consultants", itemId, name);
export const deleteConsultant = (source: AppData, itemId: string) =>
  deleteDirectoryItem(source, "consultants", itemId);
export const createCaptor = (source: AppData, name: string) =>
  createDirectoryItem(source, "captors", name);
export const renameCaptor = (source: AppData, itemId: string, name: string) =>
  renameDirectoryItem(source, "captors", itemId, name);
export const deleteCaptor = (source: AppData, itemId: string) =>
  deleteDirectoryItem(source, "captors", itemId);

type CustomFieldDraft = Pick<
  CustomFieldDefinition,
  "name" | "type" | "section" | "options"
>;

function normalizeFieldDraft(input: CustomFieldDraft): CustomFieldDraft {
  const options = Array.from(
    new Set(input.options.map((option) => option.trim()).filter(Boolean)),
  );
  return customFieldDraftSchema.parse({
    ...input,
    options: input.type === "select" ? options : [],
  });
}

export function createCustomField(
  source: AppData,
  input: CustomFieldDraft,
): AppData {
  requirePermission(source, "fields.manage");
  const parsed = normalizeFieldDraft(input);
  const data = clone(source);
  const fields = data.customFields
    .filter((field) => !field.archived)
    .sort((a, b) => a.position - b.position);
  data.customFields.push({
    id: id(),
    boardId: data.boards[0].id,
    ...parsed,
    position: rankBetween(fields.at(-1)?.position, null),
    archived: false,
  });
  return data;
}

export function updateCustomField(
  source: AppData,
  fieldId: string,
  patch: Partial<CustomFieldDraft>,
): AppData {
  requirePermission(source, "fields.manage");
  const current = source.customFields.find((field) => field.id === fieldId);
  if (!current) throw new DomainError("Campo não encontrado.");
  const parsed = normalizeFieldDraft({ ...current, ...patch });
  const data = clone(source);
  const field = data.customFields.find((item) => item.id === fieldId)!;
  Object.assign(field, parsed);
  return data;
}

export function moveCustomField(
  source: AppData,
  fieldId: string,
  direction: -1 | 1,
): AppData {
  requirePermission(source, "fields.manage");
  const data = clone(source);
  const fields = data.customFields
    .filter((field) => !field.archived)
    .sort((a, b) => a.position - b.position);
  const index = fields.findIndex((field) => field.id === fieldId);
  const swap = fields[index + direction];
  if (index < 0 || !swap) return data;
  const current = fields[index];
  const position = current.position;
  current.position = swap.position;
  swap.position = position;
  return data;
}

export function archiveCustomField(source: AppData, fieldId: string): AppData {
  requirePermission(source, "fields.manage");
  const data = clone(source);
  const field = data.customFields.find((item) => item.id === fieldId);
  if (!field) throw new DomainError("Campo não encontrado.");
  field.archived = true;
  return data;
}

function normalizeCustomValue(
  field: CustomFieldDefinition,
  value: string,
): string {
  const normalized = value.trim();
  if (!normalized) return "";
  if (field.type === "attachment")
    throw new DomainError("Use o envio de arquivo para preencher este campo.");
  if (field.type === "select" && !field.options.includes(normalized))
    throw new DomainError("Selecione um item válido.");
  if (field.type === "number" || field.type === "currency") {
    const number = Number(normalized.replace(",", "."));
    if (!Number.isFinite(number))
      throw new DomainError("Informe um número válido.");
    return String(number);
  }
  if (field.type === "percentage") {
    const percentage = Number(normalized.replace(",", "."));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
      throw new DomainError("Informe uma porcentagem entre 0 e 100.");
    return String(percentage);
  }
  if (normalized.length > 20_000)
    throw new DomainError("O texto não pode exceder 20.000 caracteres.");
  return normalized;
}

export function setCardFieldValue(
  source: AppData,
  cardId: string,
  fieldId: string,
  value: string,
): AppData {
  requirePermission(source, "cards.edit");
  const card = source.cards.find((item) => item.id === cardId);
  const field = source.customFields.find(
    (item) => item.id === fieldId && !item.archived,
  );
  if (!card) throw new DomainError("Card não encontrado.");
  if (!field) throw new DomainError("Campo não encontrado.");
  const normalized = normalizeCustomValue(field, value);
  const data = clone(source);
  const existing = data.cardFieldValues.find(
    (item) => item.cardId === cardId && item.fieldId === fieldId,
  );
  const before = existing?.value ?? "";
  data.cardFieldValues = data.cardFieldValues.filter(
    (item) => !(item.cardId === cardId && item.fieldId === fieldId),
  );
  if (normalized) {
    data.cardFieldValues.push({
      cardId,
      fieldId,
      value: normalized,
      updatedAt: timestamp(),
    });
  }
  const updatedCard = data.cards.find((item) => item.id === cardId)!;
  touch(updatedCard);
  activity(data, cardId, "custom_field.changed", `alterou ${field.name}`, {
    fieldId,
    before,
    after: normalized,
  });
  return data;
}

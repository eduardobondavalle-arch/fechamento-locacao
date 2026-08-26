import { can } from "../permissions";
import type { AppData, Card } from "../types";
import {
  commissionAdjustmentSchema,
  commissionRuleDraftSchema,
  type CommissionRuleDraftInput,
} from "../../validation/commissions";
import {
  evaluateCommissionDefinition,
  isActiveCommissionStatus,
  simulatePublishedCommissionRules,
  validateCommissionRuleDefinition,
} from "./evaluator";
import type {
  CommissionCalculation,
  CommissionCalculationSnapshot,
  CommissionGenerationPreview,
  CommissionRuleDefinition,
  CommissionRuleSimulation,
  CommissionRuleVersion,
  CommissionStatus,
} from "./types";

const clone = (data: AppData): AppData => structuredClone(data);
const id = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();

function requirePermission(
  data: AppData,
  permission:
    | "commissions.view"
    | "commissions.simulate"
    | "commissionRules.manage"
    | "commissions.manage",
): void {
  if (!can(data, data.boards[0]?.id ?? "", permission))
    throw new Error("Você não tem permissão para realizar esta ação.");
}

function requireUser(data: AppData): string {
  if (!data.currentUserId)
    throw new Error("Sessão autenticada não encontrada.");
  return data.currentUserId;
}

function definitionFromInput(input: CommissionRuleDraftInput): {
  name: string;
  description: string;
  definition: CommissionRuleDefinition;
} {
  const parsed = commissionRuleDraftSchema.parse(input);
  return {
    name: parsed.name,
    description: parsed.description,
    definition: {
      beneficiarySource: parsed.beneficiarySource,
      beneficiaryRole: parsed.beneficiaryRole,
      priority: parsed.priority,
      exclusive: parsed.exclusive,
      validFrom: parsed.validFrom,
      validTo: parsed.validTo,
      conditions: parsed.conditions,
      formula: parsed.formula,
    },
  };
}

function ruleDefinition(
  rule: AppData["commissionRules"][number],
): CommissionRuleDefinition {
  return {
    beneficiarySource: rule.beneficiarySource,
    beneficiaryRole: rule.beneficiaryRole,
    priority: rule.priority,
    exclusive: rule.exclusive,
    validFrom: rule.validFrom,
    validTo: rule.validTo,
    conditions: rule.conditions,
    formula: rule.formula,
  };
}

function versionDefinition(
  version: CommissionRuleVersion,
): CommissionRuleDefinition {
  return {
    beneficiarySource: version.beneficiarySource,
    beneficiaryRole: version.beneficiaryRole,
    priority: version.priority,
    exclusive: version.exclusive,
    validFrom: version.validFrom,
    validTo: version.validTo,
    conditions: version.conditions,
    formula: version.formula,
  };
}

export function createCommissionRule(
  source: AppData,
  input: CommissionRuleDraftInput,
): { data: AppData; ruleId: string } {
  requirePermission(source, "commissionRules.manage");
  const parsed = definitionFromInput(input);
  const data = clone(source);
  const now = timestamp();
  const ruleId = id();
  data.commissionRules.push({
    id: ruleId,
    boardId: data.boards[0].id,
    name: parsed.name,
    description: parsed.description,
    ...parsed.definition,
    status: "draft",
    activeVersionId: null,
    archived: false,
    createdBy: requireUser(data),
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  });
  return { data, ruleId };
}

export function updateCommissionRule(
  source: AppData,
  ruleId: string,
  input: CommissionRuleDraftInput,
): AppData {
  requirePermission(source, "commissionRules.manage");
  const parsed = definitionFromInput(input);
  const data = clone(source);
  const rule = data.commissionRules.find(
    (item) => item.id === ruleId && !item.archived,
  );
  if (!rule) throw new Error("Regra de comissão não encontrada.");
  Object.assign(rule, parsed.definition, {
    name: parsed.name,
    description: parsed.description,
    updatedAt: timestamp(),
  });
  return data;
}

export function publishCommissionRule(
  source: AppData,
  ruleId: string,
): AppData {
  requirePermission(source, "commissionRules.manage");
  const rule = source.commissionRules.find(
    (item) => item.id === ruleId && !item.archived,
  );
  if (!rule) throw new Error("Regra de comissão não encontrada.");
  const parsed = definitionFromInput({
    name: rule.name,
    description: rule.description,
    ...ruleDefinition(rule),
  });
  const referencedFields = validateCommissionRuleDefinition(
    source,
    parsed.definition,
  );
  const data = clone(source);
  const mutableRule = data.commissionRules.find((item) => item.id === ruleId)!;
  const nextVersion =
    Math.max(
      0,
      ...data.commissionRuleVersions
        .filter((version) => version.ruleId === ruleId)
        .map((version) => version.version),
    ) + 1;
  const now = timestamp();
  const versionId = id();
  data.commissionRuleVersions.push({
    id: versionId,
    boardId: mutableRule.boardId,
    ruleId,
    ruleName: parsed.name,
    ruleDescription: parsed.description,
    version: nextVersion,
    ...structuredClone(parsed.definition),
    referencedFields: structuredClone(referencedFields),
    createdBy: requireUser(data),
    createdAt: now,
    publishedAt: now,
  });
  mutableRule.status = "published";
  mutableRule.activeVersionId = versionId;
  mutableRule.publishedAt = now;
  mutableRule.updatedAt = now;
  return data;
}

export function archiveCommissionRule(
  source: AppData,
  ruleId: string,
): AppData {
  requirePermission(source, "commissionRules.manage");
  const data = clone(source);
  const rule = data.commissionRules.find((item) => item.id === ruleId);
  if (!rule) throw new Error("Regra de comissão não encontrada.");
  rule.archived = true;
  rule.updatedAt = timestamp();
  return data;
}

export function simulateCommissionRule(
  source: AppData,
  ruleId: string,
  cardId: string,
  at = new Date(),
): CommissionRuleSimulation {
  requirePermission(source, "commissions.simulate");
  const rule = source.commissionRules.find(
    (item) => item.id === ruleId && !item.archived,
  );
  if (!rule) throw new Error("Regra de comissão não encontrada.");
  const activeVersion = rule.activeVersionId
    ? source.commissionRuleVersions.find(
        (version) => version.id === rule.activeVersionId,
      )
    : undefined;
  const definition = activeVersion ?? ruleDefinition(rule);
  return evaluateCommissionDefinition(
    source,
    cardId,
    definition,
    {
      ruleId,
      ruleVersionId: activeVersion?.id ?? null,
      ruleName: activeVersion?.ruleName ?? rule.name,
      version: activeVersion?.version ?? null,
      referencedFields: activeVersion?.referencedFields,
    },
    { at, allowArchived: Boolean(activeVersion) },
  );
}

function duplicateFor(
  data: AppData,
  cardId: string,
  simulation: CommissionRuleSimulation,
): CommissionCalculation | undefined {
  return data.commissionCalculations.find(
    (calculation) =>
      calculation.cardId === cardId &&
      calculation.beneficiaryId === simulation.beneficiaryId &&
      calculation.ruleVersionId === simulation.ruleVersionId &&
      isActiveCommissionStatus(calculation.status),
  );
}

export function previewCommissionGeneration(
  source: AppData,
  cardIds: string[],
  at = new Date(),
): CommissionGenerationPreview[] {
  requirePermission(source, "commissions.simulate");
  return Array.from(new Set(cardIds)).map((cardId) => {
    const card = source.cards.find(
      (item) => item.id === cardId && !item.archived,
    );
    if (!card) throw new Error("Card não encontrado.");
    const simulations = simulatePublishedCommissionRules(source, cardId, at);
    return {
      cardId,
      cardTitle: `${card.tenantName} — ${card.property}`,
      simulations,
      duplicates: simulations
        .filter(
          (simulation) =>
            simulation.applied && duplicateFor(source, cardId, simulation),
        )
        .map((simulation) => simulation.ruleName),
    };
  });
}

function directoryName(
  entries: AppData["units"] | AppData["consultants"] | AppData["captors"],
  entryId: string,
): string {
  return entries.find((entry) => entry.id === entryId)?.name ?? "Não informado";
}

function calculationSnapshot(
  data: AppData,
  card: Card,
  simulation: CommissionRuleSimulation,
  version: CommissionRuleVersion,
  calculatedAt: string,
): CommissionCalculationSnapshot {
  return {
    cardId: card.id,
    boardId: card.boardId,
    cardTitle: `${card.tenantName} — ${card.property}`,
    property: card.property,
    unitId: card.unitId,
    unitName: directoryName(data.units, card.unitId),
    consultantId: card.consultantId,
    consultantName: directoryName(data.consultants, card.consultantId),
    captorId: card.captorId,
    captorName: directoryName(data.captors, card.captorId),
    rentValueCents: card.rentValueCents,
    beneficiaryId: simulation.beneficiaryId!,
    beneficiaryName: simulation.beneficiaryName!,
    beneficiaryRole: simulation.beneficiaryRole,
    ruleId: version.ruleId,
    ruleVersionId: version.id,
    ruleName: version.ruleName,
    ruleVersion: version.version,
    conditionsAst: structuredClone(version.conditions),
    formulaAst: structuredClone(version.formula),
    conditions: structuredClone(simulation.conditions),
    formulaSteps: structuredClone(simulation.formulaSteps),
    fieldValues: structuredClone(simulation.fieldValues),
    resultCents: simulation.amountCents!,
    roundingPolicy: "half_away_from_zero_at_final_cent",
    calculatedBy: requireUser(data),
    calculatedAt,
  };
}

function appendCalculation(
  data: AppData,
  card: Card,
  simulation: CommissionRuleSimulation,
  version: CommissionRuleVersion,
  options: { revision?: number; supersedesCalculationId?: string | null } = {},
): string {
  const now = timestamp();
  const calculationId = id();
  const revision = options.revision ?? 1;
  const snapshot = calculationSnapshot(data, card, simulation, version, now);
  data.commissionCalculations.push({
    id: calculationId,
    boardId: card.boardId,
    cardId: card.id,
    beneficiaryId: simulation.beneficiaryId!,
    beneficiaryName: simulation.beneficiaryName!,
    beneficiaryRole: simulation.beneficiaryRole,
    ruleId: version.ruleId,
    ruleVersionId: version.id,
    ruleVersion: version.version,
    baseValueCents: card.rentValueCents,
    originalAmountCents: simulation.amountCents!,
    amountCents: simulation.amountCents!,
    status: "calculated",
    idempotencyKey: `${card.id}:${simulation.beneficiaryId}:${version.id}`,
    revision,
    supersedesCalculationId: options.supersedesCalculationId ?? null,
    snapshot: structuredClone(snapshot),
    calculatedBy: requireUser(data),
    calculatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  data.commissionStatusHistory.push({
    id: id(),
    boardId: card.boardId,
    calculationId,
    fromStatus: null,
    toStatus: "calculated",
    reason: null,
    actorId: requireUser(data),
    createdAt: now,
  });
  return calculationId;
}

export function generateCommissions(
  source: AppData,
  cardIds: string[],
  at = new Date(),
): AppData {
  requirePermission(source, "commissions.manage");
  const previews = previewCommissionGeneration(source, cardIds, at);
  const data = clone(source);
  let generated = 0;
  for (const preview of previews) {
    const card = data.cards.find((item) => item.id === preview.cardId)!;
    for (const simulation of preview.simulations.filter(
      (item) => item.applied,
    )) {
      if (duplicateFor(data, card.id, simulation)) continue;
      if (
        simulation.errors.length > 0 ||
        simulation.amountCents === null ||
        !simulation.beneficiaryId ||
        !simulation.beneficiaryName ||
        !simulation.ruleVersionId
      )
        continue;
      const version = data.commissionRuleVersions.find(
        (item) => item.id === simulation.ruleVersionId,
      );
      if (!version) continue;
      appendCalculation(data, card, simulation, version);
      generated += 1;
    }
  }
  if (generated === 0) {
    const hasDuplicate = previews.some(
      (preview) => preview.duplicates.length > 0,
    );
    throw new Error(
      hasDuplicate
        ? "Já existe um cálculo ativo equivalente para os cards selecionados."
        : "Nenhuma regra publicada aplicável foi encontrada.",
    );
  }
  return data;
}

const allowedTransitions: Record<CommissionStatus, CommissionStatus[]> = {
  draft: ["calculated", "cancelled"],
  calculated: ["approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: ["reversed"],
  cancelled: [],
  reversed: [],
};

export function transitionCommissionStatus(
  source: AppData,
  calculationId: string,
  toStatus: CommissionStatus,
  reason: string | null = null,
): AppData {
  requirePermission(source, "commissions.manage");
  const data = clone(source);
  const calculation = data.commissionCalculations.find(
    (item) => item.id === calculationId,
  );
  if (!calculation) throw new Error("Comissão não encontrada.");
  if (!allowedTransitions[calculation.status].includes(toStatus))
    throw new Error(
      `Transição de ${calculation.status} para ${toStatus} não permitida.`,
    );
  if (
    ["cancelled", "reversed"].includes(toStatus) &&
    (!reason || reason.trim().length < 5)
  )
    throw new Error("Informe uma justificativa para esta transição.");
  const fromStatus = calculation.status;
  const now = timestamp();
  calculation.status = toStatus;
  calculation.updatedAt = now;
  data.commissionStatusHistory.push({
    id: id(),
    boardId: calculation.boardId,
    calculationId,
    fromStatus,
    toStatus,
    reason: reason?.trim() || null,
    actorId: requireUser(data),
    createdAt: now,
  });
  return data;
}

export function adjustCommissionAmount(
  source: AppData,
  calculationId: string,
  input: { amountCents: number; reason: string },
): AppData {
  requirePermission(source, "commissions.manage");
  const parsed = commissionAdjustmentSchema.parse(input);
  const data = clone(source);
  const calculation = data.commissionCalculations.find(
    (item) => item.id === calculationId,
  );
  if (!calculation) throw new Error("Comissão não encontrada.");
  if (["cancelled", "reversed"].includes(calculation.status))
    throw new Error(
      "Não é possível ajustar uma comissão cancelada ou estornada.",
    );
  if (calculation.amountCents === parsed.amountCents)
    throw new Error("O novo valor deve ser diferente do valor atual.");
  const previousAmountCents = calculation.amountCents;
  const now = timestamp();
  calculation.amountCents = parsed.amountCents;
  calculation.updatedAt = now;
  data.commissionAdjustments.push({
    id: id(),
    boardId: calculation.boardId,
    calculationId,
    previousAmountCents,
    newAmountCents: parsed.amountCents,
    reason: parsed.reason,
    actorId: requireUser(data),
    createdAt: now,
  });
  return data;
}

export function recalculateCommission(
  source: AppData,
  calculationId: string,
  at = new Date(),
): AppData {
  requirePermission(source, "commissions.manage");
  const previous = source.commissionCalculations.find(
    (item) => item.id === calculationId,
  );
  if (!previous) throw new Error("Comissão não encontrada.");
  const version = source.commissionRuleVersions.find(
    (item) => item.id === previous.ruleVersionId,
  );
  if (!version) throw new Error("Versão histórica da regra não encontrada.");
  const simulation = evaluateCommissionDefinition(
    source,
    previous.cardId,
    versionDefinition(version),
    {
      ruleId: version.ruleId,
      ruleVersionId: version.id,
      ruleName: version.ruleName,
      version: version.version,
      referencedFields: version.referencedFields,
    },
    { at, allowArchived: true },
  );
  if (
    !simulation.matched ||
    simulation.amountCents === null ||
    !simulation.beneficiaryId ||
    !simulation.beneficiaryName
  )
    throw new Error(
      simulation.errors[0] ?? "A regra não é mais aplicável ao card.",
    );
  const activeEquivalent = source.commissionCalculations.find(
    (item) =>
      item.id !== previous.id &&
      item.cardId === previous.cardId &&
      item.beneficiaryId === simulation.beneficiaryId &&
      item.ruleVersionId === version.id &&
      isActiveCommissionStatus(item.status),
  );
  if (activeEquivalent)
    throw new Error("Já existe um cálculo ativo equivalente para esta versão.");
  const data = clone(source);
  const mutablePrevious = data.commissionCalculations.find(
    (item) => item.id === calculationId,
  )!;
  if (isActiveCommissionStatus(mutablePrevious.status)) {
    const now = timestamp();
    const fromStatus = mutablePrevious.status;
    mutablePrevious.status = "cancelled";
    mutablePrevious.updatedAt = now;
    data.commissionStatusHistory.push({
      id: id(),
      boardId: mutablePrevious.boardId,
      calculationId,
      fromStatus,
      toStatus: "cancelled",
      reason: "Substituída por uma nova revisão de cálculo.",
      actorId: requireUser(data),
      createdAt: now,
    });
  }
  const card = data.cards.find((item) => item.id === previous.cardId)!;
  appendCalculation(data, card, simulation, version, {
    revision: previous.revision + 1,
    supersedesCalculationId: previous.id,
  });
  return data;
}

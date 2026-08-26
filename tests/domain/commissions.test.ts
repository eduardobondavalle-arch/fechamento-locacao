import { describe, expect, it } from "vitest";
import { createInitialData } from "@/lib/domain/initial-data";
import {
  adjustCommissionAmount,
  createCommissionRule,
  generateCommissions,
  publishCommissionRule,
  simulateCommissionRule,
  transitionCommissionStatus,
  updateCommissionRule,
} from "@/lib/domain/operations";
import { simulatePublishedCommissionRules } from "@/lib/domain/commissions/evaluator";
import type { AppData } from "@/lib/domain/types";
import type {
  CommissionConditionGroup,
  CommissionFormulaNode,
} from "@/lib/domain/commissions/types";

const CARD_ID = "90000000-0000-4000-8000-000000000001";
const CONSULTANT_ID = "90000000-0000-4000-8000-000000000002";
const CAPTOR_ID = "90000000-0000-4000-8000-000000000003";
const INTERMEDIATION_ID = "90000000-0000-4000-8000-000000000004";
const PARTNERSHIP_ID = "90000000-0000-4000-8000-000000000005";
const CAPTOR_PERCENT_ID = "90000000-0000-4000-8000-000000000006";
const CAPTURE_TYPE_ID = "90000000-0000-4000-8000-000000000007";
const CONTRACT_TYPE_ID = "90000000-0000-4000-8000-000000000008";
const TEXT_ID = "90000000-0000-4000-8000-000000000009";

function conditions(
  children: CommissionConditionGroup["children"] = [],
): CommissionConditionGroup {
  return { kind: "group", id: "grupo-raiz", combinator: "and", children };
}

function percentageField(
  fieldId: string,
  defaultValue: string | null = null,
): CommissionFormulaNode {
  return {
    kind: "field",
    field: { source: "custom", fieldId },
    defaultValue,
  };
}

function exampleFormula(
  partnershipDefault: string | null = null,
): CommissionFormulaNode {
  return {
    kind: "percentage",
    base: {
      kind: "percentage",
      base: {
        kind: "field",
        field: { source: "native", field: "rentValueCents" },
        defaultValue: null,
      },
      rate: {
        kind: "operation",
        operator: "subtract",
        left: percentageField(INTERMEDIATION_ID),
        right: percentageField(PARTNERSHIP_ID, partnershipDefault),
      },
    },
    rate: percentageField(CAPTOR_PERCENT_ID),
  };
}

function baseData(): AppData {
  const data = createInitialData();
  data.consultants.push({
    id: CONSULTANT_ID,
    boardId: data.boards[0].id,
    name: "Consultora Ana",
  });
  data.captors.push({
    id: CAPTOR_ID,
    boardId: data.boards[0].id,
    name: "Captador Caio",
  });
  data.cards.push({
    id: CARD_ID,
    boardId: data.boards[0].id,
    listId: data.lists[0].id,
    unitId: data.units[0].id,
    consultantId: CONSULTANT_ID,
    captorId: CAPTOR_ID,
    property: "Apartamento 101",
    rentValueCents: 1_000_000,
    tenantCpf: "52998224725",
    tenantName: "Maria da Silva",
    description: "",
    position: 1024,
    archived: false,
    enteredListAt: "2026-08-25T10:00:00.000Z",
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
    version: 1,
  });
  data.customFields.push(
    {
      id: INTERMEDIATION_ID,
      boardId: data.boards[0].id,
      name: "Percentual de intermediação",
      type: "percentage",
      section: "lease",
      options: [],
      position: 1024,
      archived: false,
    },
    {
      id: PARTNERSHIP_ID,
      boardId: data.boards[0].id,
      name: "Percentual de parceria",
      type: "percentage",
      section: "lease",
      options: [],
      position: 2048,
      archived: false,
    },
    {
      id: CAPTOR_PERCENT_ID,
      boardId: data.boards[0].id,
      name: "Percentual do captador",
      type: "percentage",
      section: "lease",
      options: [],
      position: 3072,
      archived: false,
    },
    {
      id: CAPTURE_TYPE_ID,
      boardId: data.boards[0].id,
      name: "Tipo de captação",
      type: "select",
      section: "lease",
      options: ["Ativa", "Passiva"],
      position: 4096,
      archived: false,
    },
    {
      id: CONTRACT_TYPE_ID,
      boardId: data.boards[0].id,
      name: "Tipo de contrato",
      type: "select",
      section: "lease",
      options: ["Garantido", "Sem garantia"],
      position: 5120,
      archived: false,
    },
    {
      id: TEXT_ID,
      boardId: data.boards[0].id,
      name: "Observação operacional",
      type: "text",
      section: "other",
      options: [],
      position: 6144,
      archived: false,
    },
  );
  data.cardFieldValues.push(
    {
      cardId: CARD_ID,
      fieldId: INTERMEDIATION_ID,
      value: "50",
      updatedAt: "2026-08-25T10:00:00.000Z",
    },
    {
      cardId: CARD_ID,
      fieldId: PARTNERSHIP_ID,
      value: "20",
      updatedAt: "2026-08-25T10:00:00.000Z",
    },
    {
      cardId: CARD_ID,
      fieldId: CAPTOR_PERCENT_ID,
      value: "30",
      updatedAt: "2026-08-25T10:00:00.000Z",
    },
    {
      cardId: CARD_ID,
      fieldId: CAPTURE_TYPE_ID,
      value: "Ativa",
      updatedAt: "2026-08-25T10:00:00.000Z",
    },
    {
      cardId: CARD_ID,
      fieldId: CONTRACT_TYPE_ID,
      value: "Garantido",
      updatedAt: "2026-08-25T10:00:00.000Z",
    },
  );
  return data;
}

function draft(
  formula: CommissionFormulaNode = exampleFormula(),
  conditionGroup: CommissionConditionGroup = conditions(),
  overrides: Record<string, unknown> = {},
) {
  return {
    name: "Comissão do captador",
    description: "Regra operacional",
    beneficiarySource: "captor" as const,
    beneficiaryRole: "Captador",
    priority: 100,
    exclusive: true,
    validFrom: null,
    validTo: null,
    conditions: conditionGroup,
    formula,
    ...overrides,
  };
}

function published(data = baseData(), input = draft()) {
  const created = createCommissionRule(data, input);
  return {
    data: publishCommissionRule(created.data, created.ruleId),
    ruleId: created.ruleId,
  };
}

describe("motor de comissões", () => {
  it("calcula R$ 900 para aluguel de R$ 10.000, 50%, 20% e 30%", () => {
    const result = published();
    const simulation = simulateCommissionRule(
      result.data,
      result.ruleId,
      CARD_ID,
    );
    expect(simulation.amountCents).toBe(90_000);
    expect(simulation.errors).toEqual([]);
  });

  it("usa o padrão configurado quando a parceria está vazia", () => {
    const data = baseData();
    data.cardFieldValues = data.cardFieldValues.filter(
      (item) => item.fieldId !== PARTNERSHIP_ID,
    );
    const result = published(data, draft(exampleFormula("0")));
    const simulation = simulateCommissionRule(
      result.data,
      result.ruleId,
      CARD_ID,
    );
    expect(simulation.amountCents).toBe(150_000);
    expect(
      simulation.fieldValues.find(
        (field) =>
          field.reference.source === "custom" &&
          field.reference.fieldId === PARTNERSHIP_ID,
      )?.usedDefault,
    ).toBe(true);
  });

  it("mantém a regra vinculada ao UUID quando o campo é renomeado", () => {
    const result = published();
    const renamed = structuredClone(result.data);
    renamed.customFields.find((field) => field.id === INTERMEDIATION_ID)!.name =
      "Taxa comercial";
    const simulation = simulateCommissionRule(renamed, result.ruleId, CARD_ID);
    expect(simulation.amountCents).toBe(90_000);
    expect(
      simulation.fieldValues.some(
        (field) => field.name === "Percentual de intermediação",
      ),
    ).toBe(true);
  });

  it("preserva cálculo histórico com campo arquivado e bloqueia nova publicação", () => {
    const result = published();
    const archived = structuredClone(result.data);
    archived.customFields.find(
      (field) => field.id === INTERMEDIATION_ID,
    )!.archived = true;
    expect(
      simulateCommissionRule(archived, result.ruleId, CARD_ID).amountCents,
    ).toBe(90_000);
    const created = createCommissionRule(archived, draft());
    expect(() => publishCommissionRule(created.data, created.ruleId)).toThrow(
      /arquivado/i,
    );
  });

  it("protege contra divisão por zero", () => {
    const data = baseData();
    data.cardFieldValues.find(
      (item) => item.fieldId === PARTNERSHIP_ID,
    )!.value = "0";
    const formula: CommissionFormulaNode = {
      kind: "operation",
      operator: "divide",
      left: {
        kind: "field",
        field: { source: "native", field: "rentValueCents" },
        defaultValue: null,
      },
      right: percentageField(PARTNERSHIP_ID),
    };
    const result = published(data, draft(formula));
    expect(
      simulateCommissionRule(result.data, result.ruleId, CARD_ID).errors.join(
        " ",
      ),
    ).toMatch(/divisão por zero/i);
  });

  it("rejeita tipo incompatível na fórmula", () => {
    const formula: CommissionFormulaNode = {
      kind: "field",
      field: { source: "custom", fieldId: TEXT_ID },
      defaultValue: null,
    };
    const created = createCommissionRule(baseData(), draft(formula));
    expect(() => publishCommissionRule(created.data, created.ruleId)).toThrow(
      /não é numérico/i,
    );
  });

  it("avalia grupos E e OU", () => {
    const group = conditions([
      {
        kind: "condition",
        id: "captacao",
        field: { source: "custom", fieldId: CAPTURE_TYPE_ID },
        operator: "equals",
        value: "Ativa",
      },
      {
        kind: "group",
        id: "contrato-ou",
        combinator: "or",
        children: [
          {
            kind: "condition",
            id: "garantido",
            field: { source: "custom", fieldId: CONTRACT_TYPE_ID },
            operator: "equals",
            value: "Garantido",
          },
          {
            kind: "condition",
            id: "sem-garantia",
            field: { source: "custom", fieldId: CONTRACT_TYPE_ID },
            operator: "equals",
            value: "Sem garantia",
          },
        ],
      },
    ]);
    const result = published(baseData(), draft(exampleFormula(), group));
    expect(
      simulateCommissionRule(result.data, result.ruleId, CARD_ID).matched,
    ).toBe(true);
  });

  it("aplica prioridade e exclusividade de forma determinística", () => {
    const first = published(
      baseData(),
      draft(exampleFormula(), conditions(), {
        name: "Prioritária",
        priority: 200,
        exclusive: true,
      }),
    );
    const second = createCommissionRule(
      first.data,
      draft(exampleFormula(), conditions(), {
        name: "Acumulável",
        priority: 100,
        exclusive: false,
      }),
    );
    const data = publishCommissionRule(second.data, second.ruleId);
    const simulations = simulatePublishedCommissionRules(data, CARD_ID);
    expect(simulations.map((item) => [item.ruleName, item.applied])).toEqual([
      ["Prioritária", true],
      ["Acumulável", false],
    ]);
    expect(simulations[1].ignoredReason).toMatch(/exclusiva/i);
  });

  it("respeita a vigência da versão", () => {
    const result = published(
      baseData(),
      draft(exampleFormula(), conditions(), { validFrom: "2026-09-01" }),
    );
    const simulation = simulateCommissionRule(
      result.data,
      result.ruleId,
      CARD_ID,
      new Date("2026-08-25T12:00:00Z"),
    );
    expect(simulation.matched).toBe(false);
    expect(simulation.ignoredReason).toMatch(/vigência/i);
  });

  it("arredonda meio centavo para longe de zero somente no resultado final", () => {
    const data = baseData();
    data.cards[0].rentValueCents = 1;
    const formula: CommissionFormulaNode = {
      kind: "percentage",
      base: {
        kind: "field",
        field: { source: "native", field: "rentValueCents" },
        defaultValue: null,
      },
      rate: { kind: "constant", value: "50", valueType: "percentage" },
    };
    const result = published(data, draft(formula));
    expect(
      simulateCommissionRule(result.data, result.ruleId, CARD_ID).amountCents,
    ).toBe(1);
  });

  it("impede cálculo ativo duplicado para card, beneficiário e versão", () => {
    const result = published();
    const generated = generateCommissions(result.data, [CARD_ID]);
    expect(() => generateCommissions(generated, [CARD_ID])).toThrow(
      /cálculo ativo equivalente/i,
    );
  });

  it("mantém o snapshot imutável após alteração posterior do card", () => {
    const result = published();
    const generated = generateCommissions(result.data, [CARD_ID]);
    const snapshot = structuredClone(
      generated.commissionCalculations[0].snapshot,
    );
    generated.cards[0].rentValueCents = 2_000_000;
    generated.cardFieldValues.find(
      (item) => item.fieldId === INTERMEDIATION_ID,
    )!.value = "60";
    expect(generated.commissionCalculations[0].snapshot).toEqual(snapshot);
    expect(snapshot.resultCents).toBe(90_000);
  });

  it("bloqueia transições inválidas e audita ajustes", () => {
    const generated = generateCommissions(published().data, [CARD_ID]);
    const calculationId = generated.commissionCalculations[0].id;
    expect(() =>
      transitionCommissionStatus(generated, calculationId, "paid"),
    ).toThrow(/não permitida/i);
    const approved = transitionCommissionStatus(
      generated,
      calculationId,
      "approved",
    );
    const paid = transitionCommissionStatus(approved, calculationId, "paid");
    const adjusted = adjustCommissionAmount(paid, calculationId, {
      amountCents: 85_000,
      reason: "Ajuste contratual autorizado",
    });
    expect(adjusted.commissionCalculations[0].amountCents).toBe(85_000);
    expect(adjusted.commissionAdjustments[0]).toMatchObject({
      previousAmountCents: 90_000,
      newAmountCents: 85_000,
    });
    expect(
      adjusted.commissionStatusHistory.map((item) => item.toStatus),
    ).toEqual(["calculated", "approved", "paid"]);
  });

  it("permite visualização e simulação a membro, mas restringe administração", () => {
    const result = published();
    const member = structuredClone(result.data);
    member.boardMembers[0].role = "member";
    expect(
      simulateCommissionRule(member, result.ruleId, CARD_ID).amountCents,
    ).toBe(90_000);
    expect(() => updateCommissionRule(member, result.ruleId, draft())).toThrow(
      /permissão/i,
    );
    expect(() => generateCommissions(member, [CARD_ID])).toThrow(/permissão/i);
  });

  it("preserva versões publicadas anteriores ao publicar uma edição", () => {
    const first = published();
    const firstVersion = structuredClone(first.data.commissionRuleVersions[0]);
    const edited = updateCommissionRule(
      first.data,
      first.ruleId,
      draft(exampleFormula(), conditions(), { priority: 250 }),
    );
    const republished = publishCommissionRule(edited, first.ruleId);
    expect(republished.commissionRuleVersions).toHaveLength(2);
    expect(republished.commissionRuleVersions[0]).toEqual(firstVersion);
    expect(republished.commissionRuleVersions[1]).toMatchObject({
      version: 2,
      priority: 250,
    });
  });

  it("aponta ausência de beneficiário sem gerar resultado", () => {
    const result = published();
    result.data.captors = [];
    const simulation = simulateCommissionRule(
      result.data,
      result.ruleId,
      CARD_ID,
    );
    expect(simulation.amountCents).toBeNull();
    expect(simulation.errors.join(" ")).toMatch(/não foi encontrado/i);
  });

  it("rejeita UUID de campo inexistente na publicação", () => {
    const formula: CommissionFormulaNode = {
      kind: "field",
      field: {
        source: "custom",
        fieldId: "f0000000-0000-4000-8000-000000000099",
      },
      defaultValue: "0",
    };
    const created = createCommissionRule(baseData(), draft(formula));
    expect(() => publishCommissionRule(created.data, created.ruleId)).toThrow(
      /inexistente/i,
    );
  });

  it("rejeita percentual preenchido fora do intervalo canônico", () => {
    const data = baseData();
    data.cardFieldValues.find(
      (item) => item.fieldId === CAPTOR_PERCENT_ID,
    )!.value = "101";
    const result = published(data);
    expect(
      simulateCommissionRule(result.data, result.ruleId, CARD_ID).errors.join(
        " ",
      ),
    ).toMatch(/entre 0 e 100/i);
  });

  it("bloqueia resultado financeiro negativo", () => {
    const formula: CommissionFormulaNode = {
      kind: "operation",
      operator: "subtract",
      left: {
        kind: "field",
        field: { source: "native", field: "rentValueCents" },
        defaultValue: null,
      },
      right: { kind: "constant", value: "20000", valueType: "currency" },
    };
    const result = published(baseData(), draft(formula));
    expect(
      simulateCommissionRule(result.data, result.ruleId, CARD_ID).errors.join(
        " ",
      ),
    ).toMatch(/não pode ser negativo/i);
  });
});

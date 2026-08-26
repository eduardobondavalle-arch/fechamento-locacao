import type { AppData, Card, CustomFieldType } from "../types";
import type {
  CommissionCondition,
  CommissionConditionEvaluation,
  CommissionConditionGroup,
  CommissionFieldReference,
  CommissionFieldValueSnapshot,
  CommissionFormulaNode,
  CommissionFormulaStep,
  CommissionReferencedFieldSnapshot,
  CommissionRuleDefinition,
  CommissionRuleSimulation,
  CommissionRuleVersion,
  FormulaFieldReference,
} from "./types";

type Rational = { numerator: bigint; denominator: bigint };
type EvaluatedValue = {
  amount: Rational;
  kind: "money" | "number" | "ratio";
};

type EvaluationMetadata = {
  ruleId: string;
  ruleVersionId: string | null;
  ruleName: string;
  version: number | null;
  referencedFields?: CommissionReferencedFieldSnapshot[];
};

type ResolvedField = {
  snapshot: CommissionReferencedFieldSnapshot;
  rawValue: string | null;
};

const nativeFieldMetadata = {
  rentValueCents: { name: "Valor do aluguel", type: "currency" },
  unitId: { name: "Unidade", type: "directory" },
  consultantId: { name: "Consultor", type: "directory" },
  captorId: { name: "Captador", type: "directory" },
} as const;

const numericTypes = new Set(["number", "currency", "percentage"]);
const activeCalculationStatuses = new Set([
  "draft",
  "calculated",
  "approved",
  "paid",
]);

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || 1n;
}

function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new Error("Divisão por zero.");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

function parseDecimal(value: string): Rational {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized))
    throw new Error(`Valor numérico inválido: ${value || "vazio"}.`);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer, decimals = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(decimals.length);
  const numerator =
    BigInt(`${integer}${decimals}` || "0") * (negative ? -1n : 1n);
  return rational(numerator, denominator);
}

function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new Error("Divisão por zero.");
  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}

function compare(left: Rational, right: Rational): number {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function roundHalfAwayFromZero(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  if (absoluteRemainder * 2n < value.denominator) return quotient;
  return quotient + (value.numerator < 0n ? -1n : 1n);
}

function rationalToDisplay(value: Rational, precision = 6): string {
  const negative = value.numerator < 0n;
  const absolute = negative ? -value.numerator : value.numerator;
  const integer = absolute / value.denominator;
  let remainder = absolute % value.denominator;
  let decimals = "";
  for (let index = 0; index < precision && remainder !== 0n; index += 1) {
    remainder *= 10n;
    decimals += String(remainder / value.denominator);
    remainder %= value.denominator;
  }
  return `${negative ? "-" : ""}${integer}${decimals ? `.${decimals}` : ""}`;
}

function safeNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("O resultado excede o limite financeiro suportado.");
  return Number(value);
}

function customTypeToCommissionType(
  type: CustomFieldType,
): CommissionReferencedFieldSnapshot["type"] | null {
  if (type === "attachment") return null;
  return type;
}

function sameReference(
  left: CommissionFieldReference | FormulaFieldReference,
  right: CommissionFieldReference,
): boolean {
  return left.source === "native" && right.source === "native"
    ? left.field === right.field
    : left.source === "custom" && right.source === "custom"
      ? left.fieldId === right.fieldId
      : false;
}

function referenceKey(
  reference: CommissionFieldReference | FormulaFieldReference,
): string {
  return reference.source === "native"
    ? `native:${reference.field}`
    : `custom:${reference.fieldId}`;
}

function getCard(data: AppData, cardId: string): Card {
  const card = data.cards.find((item) => item.id === cardId);
  if (!card) throw new Error("Card não encontrado.");
  return card;
}

function resolveField(
  data: AppData,
  card: Card,
  reference: CommissionFieldReference | FormulaFieldReference,
  referencedFields: CommissionReferencedFieldSnapshot[] | undefined,
  allowArchived: boolean,
): ResolvedField {
  if (reference.source === "native") {
    const metadata = nativeFieldMetadata[reference.field];
    const rawValue = String(card[reference.field]);
    return {
      snapshot: {
        reference,
        name: metadata.name,
        type: metadata.type,
        archived: false,
      },
      rawValue,
    };
  }

  const definition = data.customFields.find(
    (field) => field.id === reference.fieldId,
  );
  if (!definition)
    throw new Error(`Campo personalizado inexistente: ${reference.fieldId}.`);
  if (definition.archived && !allowArchived)
    throw new Error(`O campo “${definition.name}” está arquivado.`);
  const historical = referencedFields?.find((field) =>
    sameReference(reference, field.reference),
  );
  const type = historical?.type ?? customTypeToCommissionType(definition.type);
  if (!type)
    throw new Error(
      `O campo “${definition.name}” não é compatível com comissões.`,
    );
  const value = data.cardFieldValues.find(
    (item) => item.cardId === card.id && item.fieldId === reference.fieldId,
  );
  return {
    snapshot: {
      reference,
      name: historical?.name ?? definition.name,
      type,
      archived: definition.archived,
    },
    rawValue: value?.value ?? null,
  };
}

function valueForField(
  resolved: ResolvedField,
  defaultValue: string | null,
): { value: EvaluatedValue; snapshot: CommissionFieldValueSnapshot } {
  const hasValue =
    resolved.rawValue !== null && resolved.rawValue.trim() !== "";
  const raw = hasValue ? resolved.rawValue! : defaultValue;
  if (raw === null || raw.trim() === "")
    throw new Error(`O campo “${resolved.snapshot.name}” não está preenchido.`);
  const parsed = parseDecimal(raw);
  let value: EvaluatedValue;
  if (resolved.snapshot.type === "currency") {
    if (parsed.numerator < 0n)
      throw new Error(
        `O campo monetário “${resolved.snapshot.name}” não pode ser negativo.`,
      );
    const isNativeRent =
      resolved.snapshot.reference.source === "native" &&
      resolved.snapshot.reference.field === "rentValueCents";
    value = {
      amount: isNativeRent ? parsed : multiply(parsed, rational(100n)),
      kind: "money",
    };
  } else if (resolved.snapshot.type === "percentage") {
    if (
      compare(parsed, rational(0n)) < 0 ||
      compare(parsed, rational(100n)) > 0
    )
      throw new Error(
        `A porcentagem “${resolved.snapshot.name}” deve estar entre 0 e 100.`,
      );
    value = { amount: divide(parsed, rational(100n)), kind: "ratio" };
  } else if (resolved.snapshot.type === "number") {
    value = { amount: parsed, kind: "number" };
  } else {
    throw new Error(`O campo “${resolved.snapshot.name}” não é numérico.`);
  }
  return {
    value,
    snapshot: {
      ...resolved.snapshot,
      rawValue: resolved.rawValue,
      normalizedValue: rationalToDisplay(value.amount),
      usedDefault: !hasValue,
    },
  };
}

function constantValue(
  node: Extract<CommissionFormulaNode, { kind: "constant" }>,
): EvaluatedValue {
  const parsed = parseDecimal(node.value);
  if (node.valueType === "currency") {
    if (parsed.numerator < 0n)
      throw new Error("Constantes monetárias não podem ser negativas.");
    return { amount: multiply(parsed, rational(100n)), kind: "money" };
  }
  if (node.valueType === "percentage") {
    if (
      compare(parsed, rational(0n)) < 0 ||
      compare(parsed, rational(100n)) > 0
    )
      throw new Error("Constantes percentuais devem estar entre 0 e 100.");
    return { amount: divide(parsed, rational(100n)), kind: "ratio" };
  }
  return { amount: parsed, kind: "number" };
}

function formulaDescription(node: CommissionFormulaNode): string {
  if (node.kind === "constant") return `Constante ${node.value}`;
  if (node.kind === "field") return "Leitura de campo";
  if (node.kind === "percentage") return "Aplicação de porcentagem";
  const labels = {
    add: "Soma",
    subtract: "Subtração",
    multiply: "Multiplicação",
    divide: "Divisão",
    min: "Mínimo",
    max: "Máximo",
  };
  return labels[node.operator];
}

function combineValues(
  operator: Extract<CommissionFormulaNode, { kind: "operation" }>["operator"],
  left: EvaluatedValue,
  right: EvaluatedValue,
): EvaluatedValue {
  if (["add", "subtract", "min", "max"].includes(operator)) {
    if (left.kind !== right.kind)
      throw new Error(
        "Soma, subtração, mínimo e máximo exigem valores do mesmo tipo.",
      );
    const amount =
      operator === "add"
        ? add(left.amount, right.amount)
        : operator === "subtract"
          ? subtract(left.amount, right.amount)
          : operator === "min"
            ? compare(left.amount, right.amount) <= 0
              ? left.amount
              : right.amount
            : compare(left.amount, right.amount) >= 0
              ? left.amount
              : right.amount;
    return { amount, kind: left.kind };
  }

  if (operator === "multiply") {
    if (left.kind === "money" && right.kind === "money")
      throw new Error("Não é permitido multiplicar dois valores monetários.");
    const kind =
      left.kind === "money" || right.kind === "money"
        ? "money"
        : left.kind === "ratio" && right.kind === "ratio"
          ? "ratio"
          : "number";
    return { amount: multiply(left.amount, right.amount), kind };
  }

  if (right.amount.numerator === 0n) throw new Error("Divisão por zero.");
  if (left.kind === "money" && right.kind === "money")
    return { amount: divide(left.amount, right.amount), kind: "number" };
  if (right.kind === "money")
    throw new Error(
      "Um valor monetário só pode dividir outro valor monetário.",
    );
  return { amount: divide(left.amount, right.amount), kind: left.kind };
}

function evaluateFormula(
  data: AppData,
  card: Card,
  node: CommissionFormulaNode,
  referencedFields: CommissionReferencedFieldSnapshot[] | undefined,
  allowArchived: boolean,
  steps: CommissionFormulaStep[],
  fieldValues: Map<string, CommissionFieldValueSnapshot>,
  path = "fórmula",
): EvaluatedValue {
  try {
    let result: EvaluatedValue;
    if (node.kind === "constant") {
      result = constantValue(node);
    } else if (node.kind === "field") {
      const resolved = resolveField(
        data,
        card,
        node.field,
        referencedFields,
        allowArchived,
      );
      const fieldValue = valueForField(resolved, node.defaultValue);
      fieldValues.set(referenceKey(node.field), fieldValue.snapshot);
      result = fieldValue.value;
    } else if (node.kind === "percentage") {
      const base = evaluateFormula(
        data,
        card,
        node.base,
        referencedFields,
        allowArchived,
        steps,
        fieldValues,
        `${path}.base`,
      );
      const rate = evaluateFormula(
        data,
        card,
        node.rate,
        referencedFields,
        allowArchived,
        steps,
        fieldValues,
        `${path}.percentual`,
      );
      if (rate.kind !== "ratio")
        throw new Error(
          "A aplicação de porcentagem exige um percentual como taxa.",
        );
      result = { amount: multiply(base.amount, rate.amount), kind: base.kind };
    } else {
      const left = evaluateFormula(
        data,
        card,
        node.left,
        referencedFields,
        allowArchived,
        steps,
        fieldValues,
        `${path}.esquerda`,
      );
      const right = evaluateFormula(
        data,
        card,
        node.right,
        referencedFields,
        allowArchived,
        steps,
        fieldValues,
        `${path}.direita`,
      );
      result = combineValues(node.operator, left, right);
    }
    steps.push({
      path,
      description: formulaDescription(node),
      value: rationalToDisplay(result.amount),
      valueKind: result.kind,
      error: null,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro de cálculo.";
    steps.push({
      path,
      description: formulaDescription(node),
      value: null,
      valueKind: null,
      error: message,
    });
    throw error;
  }
}

function allowedOperators(
  type: CommissionReferencedFieldSnapshot["type"],
): Set<string> {
  if (type === "text")
    return new Set([
      "equals",
      "not_equals",
      "contains",
      "filled",
      "not_filled",
    ]);
  if (type === "select")
    return new Set(["equals", "not_equals", "in", "not_in"]);
  if (type === "directory")
    return new Set(["equals", "not_equals", "filled", "not_filled"]);
  return new Set([
    "equals",
    "not_equals",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "filled",
    "not_filled",
  ]);
}

function formulaKindForDefinition(
  node: CommissionFormulaNode,
  snapshots: CommissionReferencedFieldSnapshot[],
): EvaluatedValue["kind"] {
  if (node.kind === "constant") {
    constantValue(node);
    return node.valueType === "currency"
      ? "money"
      : node.valueType === "percentage"
        ? "ratio"
        : "number";
  }
  if (node.kind === "field") {
    const field = snapshots.find((item) =>
      sameReference(node.field, item.reference),
    );
    if (!field) throw new Error("A fórmula referencia um campo inexistente.");
    if (!numericTypes.has(field.type))
      throw new Error(`O campo “${field.name}” não é numérico.`);
    if (node.defaultValue !== null)
      valueForField({ snapshot: field, rawValue: null }, node.defaultValue);
    return field.type === "currency"
      ? "money"
      : field.type === "percentage"
        ? "ratio"
        : "number";
  }
  if (node.kind === "percentage") {
    const base = formulaKindForDefinition(node.base, snapshots);
    const rate = formulaKindForDefinition(node.rate, snapshots);
    if (rate !== "ratio")
      throw new Error(
        "A aplicação de porcentagem exige um percentual como taxa.",
      );
    return base;
  }
  const left = formulaKindForDefinition(node.left, snapshots);
  const right = formulaKindForDefinition(node.right, snapshots);
  if (["add", "subtract", "min", "max"].includes(node.operator)) {
    if (left !== right)
      throw new Error(
        "Soma, subtração, mínimo e máximo exigem valores do mesmo tipo.",
      );
    return left;
  }
  if (node.operator === "multiply") {
    if (left === "money" && right === "money")
      throw new Error("Não é permitido multiplicar dois valores monetários.");
    return left === "money" || right === "money"
      ? "money"
      : left === "ratio" && right === "ratio"
        ? "ratio"
        : "number";
  }
  if (
    node.right.kind === "constant" &&
    compare(parseDecimal(node.right.value), rational(0n)) === 0
  )
    throw new Error("Divisão por zero.");
  if (left === "money" && right === "money") return "number";
  if (right === "money")
    throw new Error(
      "Um valor monetário só pode dividir outro valor monetário.",
    );
  return left;
}

function compareConditionValues(
  field: CommissionReferencedFieldSnapshot,
  actual: string,
  expected: string,
): number {
  const type = field.type;
  if (!numericTypes.has(type)) return actual.localeCompare(expected, "pt-BR");
  let actualNumber = parseDecimal(actual);
  let expectedNumber = parseDecimal(expected);
  if (type === "currency") {
    const nativeRent =
      field.reference.source === "native" &&
      field.reference.field === "rentValueCents";
    if (!nativeRent) actualNumber = multiply(actualNumber, rational(100n));
    expectedNumber = multiply(expectedNumber, rational(100n));
  }
  if (type === "percentage") {
    const min = rational(0n);
    const max = rational(100n);
    if (
      compare(actualNumber, min) < 0 ||
      compare(actualNumber, max) > 0 ||
      compare(expectedNumber, min) < 0 ||
      compare(expectedNumber, max) > 0
    )
      throw new Error("Porcentagens devem estar entre 0 e 100.");
  }
  return compare(actualNumber, expectedNumber);
}

function evaluateCondition(
  data: AppData,
  card: Card,
  condition: CommissionCondition,
  referencedFields: CommissionReferencedFieldSnapshot[] | undefined,
  allowArchived: boolean,
  fieldValues: Map<string, CommissionFieldValueSnapshot>,
): CommissionConditionEvaluation {
  try {
    const resolved = resolveField(
      data,
      card,
      condition.field,
      referencedFields,
      allowArchived,
    );
    const actual = resolved.rawValue?.trim() || null;
    fieldValues.set(referenceKey(condition.field), {
      ...resolved.snapshot,
      rawValue: actual,
      normalizedValue: actual,
      usedDefault: false,
    });
    if (!allowedOperators(resolved.snapshot.type).has(condition.operator))
      throw new Error(
        `O operador não é compatível com o tipo do campo “${resolved.snapshot.name}”.`,
      );
    const filled = actual !== null;
    let matched = false;
    if (condition.operator === "filled") matched = filled;
    else if (condition.operator === "not_filled") matched = !filled;
    else if (!actual) matched = false;
    else if (condition.operator === "in" || condition.operator === "not_in") {
      if (!Array.isArray(condition.value))
        throw new Error("A condição exige uma lista de valores.");
      const included = condition.value.includes(actual);
      matched = condition.operator === "in" ? included : !included;
    } else {
      if (typeof condition.value !== "string")
        throw new Error("A condição exige um valor de comparação.");
      if (condition.operator === "contains") {
        matched = actual
          .toLocaleLowerCase("pt-BR")
          .includes(condition.value.toLocaleLowerCase("pt-BR"));
      } else {
        const comparison = compareConditionValues(
          resolved.snapshot,
          actual,
          condition.value,
        );
        matched =
          condition.operator === "equals"
            ? comparison === 0
            : condition.operator === "not_equals"
              ? comparison !== 0
              : condition.operator === "greater_than"
                ? comparison > 0
                : condition.operator === "greater_or_equal"
                  ? comparison >= 0
                  : condition.operator === "less_than"
                    ? comparison < 0
                    : comparison <= 0;
      }
    }
    return {
      conditionId: condition.id,
      field: resolved.snapshot,
      operator: condition.operator,
      actualValue: actual,
      expectedValue: condition.value,
      matched,
      error: null,
    };
  } catch (error) {
    const fallback: CommissionReferencedFieldSnapshot = {
      reference: condition.field,
      name:
        condition.field.source === "native"
          ? nativeFieldMetadata[condition.field.field].name
          : condition.field.fieldId,
      type: "text",
      archived: false,
    };
    return {
      conditionId: condition.id,
      field: fallback,
      operator: condition.operator,
      actualValue: null,
      expectedValue: condition.value,
      matched: false,
      error:
        error instanceof Error ? error.message : "Erro ao avaliar condição.",
    };
  }
}

function evaluateGroup(
  data: AppData,
  card: Card,
  group: CommissionConditionGroup,
  referencedFields: CommissionReferencedFieldSnapshot[] | undefined,
  allowArchived: boolean,
  fieldValues: Map<string, CommissionFieldValueSnapshot>,
  results: CommissionConditionEvaluation[],
): boolean {
  const matches = group.children.map((child) => {
    if (child.kind === "group")
      return evaluateGroup(
        data,
        card,
        child,
        referencedFields,
        allowArchived,
        fieldValues,
        results,
      );
    const result = evaluateCondition(
      data,
      card,
      child,
      referencedFields,
      allowArchived,
      fieldValues,
    );
    results.push(result);
    return result.matched;
  });
  if (matches.length === 0) return true;
  return group.combinator === "and"
    ? matches.every(Boolean)
    : matches.some(Boolean);
}

function beneficiaryFor(
  data: AppData,
  card: Card,
  source: CommissionRuleDefinition["beneficiarySource"],
): { id: string | null; name: string | null } {
  const id = source === "consultant" ? card.consultantId : card.captorId;
  const directory = source === "consultant" ? data.consultants : data.captors;
  return {
    id: id || null,
    name: directory.find((item) => item.id === id)?.name ?? null,
  };
}

function isWithinValidity(
  definition: CommissionRuleDefinition,
  at: Date,
): boolean {
  const day = at.toISOString().slice(0, 10);
  return (
    (!definition.validFrom || day >= definition.validFrom) &&
    (!definition.validTo || day <= definition.validTo)
  );
}

export function collectCommissionFieldReferences(
  definition: CommissionRuleDefinition,
): CommissionFieldReference[] {
  const references = new Map<string, CommissionFieldReference>();
  const visitGroup = (group: CommissionConditionGroup) => {
    for (const child of group.children) {
      if (child.kind === "group") visitGroup(child);
      else references.set(referenceKey(child.field), child.field);
    }
  };
  const visitFormula = (node: CommissionFormulaNode) => {
    if (node.kind === "field")
      references.set(referenceKey(node.field), node.field);
    else if (node.kind === "operation") {
      visitFormula(node.left);
      visitFormula(node.right);
    } else if (node.kind === "percentage") {
      visitFormula(node.base);
      visitFormula(node.rate);
    }
  };
  visitGroup(definition.conditions);
  visitFormula(definition.formula);
  return [...references.values()];
}

export function buildCommissionFieldSnapshots(
  data: AppData,
  definition: CommissionRuleDefinition,
  rejectArchived: boolean,
): CommissionReferencedFieldSnapshot[] {
  const card =
    data.cards[0] ??
    ({
      rentValueCents: 0,
      unitId: "",
      consultantId: "",
      captorId: "",
    } as Card);
  return collectCommissionFieldReferences(definition).map(
    (reference) =>
      resolveField(data, card, reference, undefined, !rejectArchived).snapshot,
  );
}

export function validateCommissionRuleDefinition(
  data: AppData,
  definition: CommissionRuleDefinition,
): CommissionReferencedFieldSnapshot[] {
  const snapshots = buildCommissionFieldSnapshots(data, definition, true);
  const visitConditions = (group: CommissionConditionGroup): void => {
    for (const child of group.children) {
      if (child.kind === "group") {
        visitConditions(child);
        continue;
      }
      const field = snapshots.find((item) =>
        sameReference(child.field, item.reference),
      );
      if (!field)
        throw new Error("A condição referencia um campo inexistente.");
      if (!allowedOperators(field.type).has(child.operator))
        throw new Error(
          `O operador não é compatível com o tipo do campo “${field.name}”.`,
        );
      if (["filled", "not_filled"].includes(child.operator)) continue;
      if (["in", "not_in"].includes(child.operator)) {
        if (!Array.isArray(child.value) || child.value.length === 0)
          throw new Error(`Informe os valores da condição de “${field.name}”.`);
      } else if (typeof child.value !== "string" || child.value.trim() === "") {
        throw new Error(`Informe o valor da condição de “${field.name}”.`);
      }
      const expectedValues = Array.isArray(child.value)
        ? child.value
        : typeof child.value === "string"
          ? [child.value]
          : [];
      if (field.type === "select" && child.field.source === "custom") {
        const fieldId = child.field.fieldId;
        const definition = data.customFields.find(
          (item) => item.id === fieldId,
        );
        const invalid = expectedValues.find(
          (value) => !definition?.options.includes(value),
        );
        if (invalid)
          throw new Error(
            `A opção “${invalid}” não existe mais no campo “${field.name}”.`,
          );
      }
      if (field.type === "directory" && child.field.source === "native") {
        const entries =
          child.field.field === "unitId"
            ? data.units
            : child.field.field === "consultantId"
              ? data.consultants
              : data.captors;
        const invalid = expectedValues.find(
          (value) => !entries.some((entry) => entry.id === value),
        );
        if (invalid)
          throw new Error(
            `O valor selecionado para “${field.name}” não existe mais.`,
          );
      }
      if (numericTypes.has(field.type)) {
        for (const value of expectedValues) {
          const parsed = parseDecimal(value);
          if (field.type === "currency" && parsed.numerator < 0n)
            throw new Error(
              `O valor monetário de “${field.name}” não pode ser negativo.`,
            );
          if (
            field.type === "percentage" &&
            (compare(parsed, rational(0n)) < 0 ||
              compare(parsed, rational(100n)) > 0)
          )
            throw new Error(
              `A porcentagem de “${field.name}” deve estar entre 0 e 100.`,
            );
        }
      }
    }
  };
  visitConditions(definition.conditions);
  const resultKind = formulaKindForDefinition(definition.formula, snapshots);
  if (resultKind !== "money")
    throw new Error("A fórmula final deve resultar em um valor monetário.");
  return snapshots;
}

export function evaluateCommissionDefinition(
  data: AppData,
  cardId: string,
  definition: CommissionRuleDefinition,
  metadata: EvaluationMetadata,
  options: { at?: Date; allowArchived?: boolean } = {},
): CommissionRuleSimulation {
  const card = getCard(data, cardId);
  const at = options.at ?? new Date();
  const allowArchived = options.allowArchived ?? false;
  const conditionResults: CommissionConditionEvaluation[] = [];
  const formulaSteps: CommissionFormulaStep[] = [];
  const fieldValues = new Map<string, CommissionFieldValueSnapshot>();
  const errors: string[] = [];
  const beneficiary = beneficiaryFor(data, card, definition.beneficiarySource);
  if (!beneficiary.id || !beneficiary.name)
    errors.push(
      `O ${definition.beneficiaryRole.toLocaleLowerCase("pt-BR")} do card não foi encontrado.`,
    );

  const withinValidity = isWithinValidity(definition, at);
  const matchedConditions = evaluateGroup(
    data,
    card,
    definition.conditions,
    metadata.referencedFields,
    allowArchived,
    fieldValues,
    conditionResults,
  );
  errors.push(
    ...conditionResults
      .map((condition) => condition.error)
      .filter((error): error is string => Boolean(error)),
  );

  let amountCents: number | null = null;
  if (withinValidity && matchedConditions && errors.length === 0) {
    try {
      const formulaResult = evaluateFormula(
        data,
        card,
        definition.formula,
        metadata.referencedFields,
        allowArchived,
        formulaSteps,
        fieldValues,
      );
      if (formulaResult.kind !== "money")
        throw new Error("A fórmula final deve resultar em um valor monetário.");
      if (formulaResult.amount.numerator < 0n)
        throw new Error("O resultado da comissão não pode ser negativo.");
      amountCents = safeNumber(roundHalfAwayFromZero(formulaResult.amount));
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Erro ao calcular comissão.",
      );
    }
  }

  return {
    ruleId: metadata.ruleId,
    ruleVersionId: metadata.ruleVersionId,
    ruleName: metadata.ruleName,
    version: metadata.version,
    priority: definition.priority,
    exclusive: definition.exclusive,
    matched: withinValidity && matchedConditions && errors.length === 0,
    applied: false,
    ignoredReason: withinValidity ? null : "Regra fora da vigência.",
    beneficiaryId: beneficiary.id,
    beneficiaryName: beneficiary.name,
    beneficiaryRole: definition.beneficiaryRole,
    baseValueCents: card.rentValueCents,
    amountCents,
    conditions: conditionResults,
    formulaSteps,
    fieldValues: [...fieldValues.values()],
    errors: Array.from(new Set(errors)),
  };
}

export function simulatePublishedCommissionRules(
  data: AppData,
  cardId: string,
  at = new Date(),
): CommissionRuleSimulation[] {
  const versions = data.commissionRules
    .filter(
      (rule) =>
        rule.status === "published" && !rule.archived && rule.activeVersionId,
    )
    .map((rule) => ({
      rule,
      version: data.commissionRuleVersions.find(
        (version) => version.id === rule.activeVersionId,
      ),
    }))
    .filter(
      (
        entry,
      ): entry is {
        rule: (typeof data.commissionRules)[number];
        version: CommissionRuleVersion;
      } => Boolean(entry.version),
    )
    .sort(
      (left, right) =>
        right.version.priority - left.version.priority ||
        left.version.ruleId.localeCompare(right.version.ruleId),
    );

  let exclusiveRuleApplied = false;
  return versions.map(({ version }) => {
    const simulation = evaluateCommissionDefinition(
      data,
      cardId,
      version,
      {
        ruleId: version.ruleId,
        ruleVersionId: version.id,
        ruleName: version.ruleName,
        version: version.version,
        referencedFields: version.referencedFields,
      },
      { at, allowArchived: true },
    );
    if (!simulation.matched) return simulation;
    if (exclusiveRuleApplied) {
      return {
        ...simulation,
        ignoredReason: "Ignorada por uma regra exclusiva de maior prioridade.",
      };
    }
    simulation.applied = true;
    if (simulation.exclusive) exclusiveRuleApplied = true;
    return simulation;
  });
}

export function isActiveCommissionStatus(status: string): boolean {
  return activeCalculationStatuses.has(status);
}

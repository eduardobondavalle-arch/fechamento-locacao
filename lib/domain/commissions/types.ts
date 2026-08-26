export type CommissionRuleStatus = "draft" | "published";

export type CommissionStatus =
  "draft" | "calculated" | "approved" | "paid" | "cancelled" | "reversed";

export type CommissionBeneficiarySource = "consultant" | "captor";

export type NativeCommissionField =
  "rentValueCents" | "unitId" | "consultantId" | "captorId";

export type NativeFormulaField = "rentValueCents";

export type CommissionFieldReference =
  | { source: "native"; field: NativeCommissionField }
  | { source: "custom"; fieldId: string };

export type FormulaFieldReference =
  | { source: "native"; field: NativeFormulaField }
  | { source: "custom"; fieldId: string };

export type CommissionConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  | "not_in"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "filled"
  | "not_filled";

export type CommissionCondition = {
  kind: "condition";
  id: string;
  field: CommissionFieldReference;
  operator: CommissionConditionOperator;
  value: string | string[] | null;
};

export type CommissionConditionGroup = {
  kind: "group";
  id: string;
  combinator: "and" | "or";
  children: Array<CommissionCondition | CommissionConditionGroup>;
};

export type CommissionFormulaOperator =
  "add" | "subtract" | "multiply" | "divide" | "min" | "max";

export type CommissionFormulaNode =
  | {
      kind: "constant";
      value: string;
      valueType: "number" | "currency" | "percentage";
    }
  | {
      kind: "field";
      field: FormulaFieldReference;
      defaultValue: string | null;
    }
  | {
      kind: "operation";
      operator: CommissionFormulaOperator;
      left: CommissionFormulaNode;
      right: CommissionFormulaNode;
    }
  | {
      kind: "percentage";
      base: CommissionFormulaNode;
      rate: CommissionFormulaNode;
    };

export type CommissionRuleDefinition = {
  beneficiarySource: CommissionBeneficiarySource;
  beneficiaryRole: string;
  priority: number;
  exclusive: boolean;
  validFrom: string | null;
  validTo: string | null;
  conditions: CommissionConditionGroup;
  formula: CommissionFormulaNode;
};

export type CommissionRule = CommissionRuleDefinition & {
  id: string;
  boardId: string;
  name: string;
  description: string;
  status: CommissionRuleStatus;
  activeVersionId: string | null;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CommissionReferencedFieldSnapshot = {
  reference: CommissionFieldReference;
  name: string;
  type: "text" | "select" | "number" | "currency" | "percentage" | "directory";
  archived: boolean;
};

export type CommissionRuleVersion = CommissionRuleDefinition & {
  id: string;
  boardId: string;
  ruleId: string;
  ruleName: string;
  ruleDescription: string;
  version: number;
  referencedFields: CommissionReferencedFieldSnapshot[];
  createdBy: string;
  createdAt: string;
  publishedAt: string;
};

export type CommissionConditionEvaluation = {
  conditionId: string;
  field: CommissionReferencedFieldSnapshot;
  operator: CommissionConditionOperator;
  actualValue: string | null;
  expectedValue: string | string[] | null;
  matched: boolean;
  error: string | null;
};

export type CommissionFormulaStep = {
  path: string;
  description: string;
  value: string | null;
  valueKind: "money" | "number" | "ratio" | null;
  error: string | null;
};

export type CommissionFieldValueSnapshot = CommissionReferencedFieldSnapshot & {
  rawValue: string | null;
  normalizedValue: string | null;
  usedDefault: boolean;
};

export type CommissionRuleSimulation = {
  ruleId: string;
  ruleVersionId: string | null;
  ruleName: string;
  version: number | null;
  priority: number;
  exclusive: boolean;
  matched: boolean;
  applied: boolean;
  ignoredReason: string | null;
  beneficiaryId: string | null;
  beneficiaryName: string | null;
  beneficiaryRole: string;
  baseValueCents: number;
  amountCents: number | null;
  conditions: CommissionConditionEvaluation[];
  formulaSteps: CommissionFormulaStep[];
  fieldValues: CommissionFieldValueSnapshot[];
  errors: string[];
};

export type CommissionCalculationSnapshot = {
  cardId: string;
  boardId: string;
  cardTitle: string;
  property: string;
  unitId: string;
  unitName: string;
  consultantId: string;
  consultantName: string;
  captorId: string;
  captorName: string;
  rentValueCents: number;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryRole: string;
  ruleId: string;
  ruleVersionId: string;
  ruleName: string;
  ruleVersion: number;
  conditionsAst: CommissionConditionGroup;
  formulaAst: CommissionFormulaNode;
  conditions: CommissionConditionEvaluation[];
  formulaSteps: CommissionFormulaStep[];
  fieldValues: CommissionFieldValueSnapshot[];
  resultCents: number;
  roundingPolicy: "half_away_from_zero_at_final_cent";
  calculatedBy: string;
  calculatedAt: string;
};

export type CommissionCalculation = {
  id: string;
  boardId: string;
  cardId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryRole: string;
  ruleId: string;
  ruleVersionId: string;
  ruleVersion: number;
  baseValueCents: number;
  originalAmountCents: number;
  amountCents: number;
  status: CommissionStatus;
  idempotencyKey: string;
  revision: number;
  supersedesCalculationId: string | null;
  snapshot: CommissionCalculationSnapshot;
  calculatedBy: string;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CommissionStatusHistory = {
  id: string;
  boardId: string;
  calculationId: string;
  fromStatus: CommissionStatus | null;
  toStatus: CommissionStatus;
  reason: string | null;
  actorId: string;
  createdAt: string;
};

export type CommissionAdjustment = {
  id: string;
  boardId: string;
  calculationId: string;
  previousAmountCents: number;
  newAmountCents: number;
  reason: string;
  actorId: string;
  createdAt: string;
};

export type CommissionGenerationPreview = {
  cardId: string;
  cardTitle: string;
  simulations: CommissionRuleSimulation[];
  duplicates: string[];
};

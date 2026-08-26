import { z } from "zod";
import type {
  CommissionConditionGroup,
  CommissionFormulaNode,
} from "../domain/commissions/types";

export const commissionFieldReferenceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("native"),
    field: z.enum(["rentValueCents", "unitId", "consultantId", "captorId"]),
  }),
  z.object({ source: z.literal("custom"), fieldId: z.string().uuid() }),
]);

export const formulaFieldReferenceSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("native"), field: z.literal("rentValueCents") }),
  z.object({ source: z.literal("custom"), fieldId: z.string().uuid() }),
]);

export const commissionConditionSchema = z.object({
  kind: z.literal("condition"),
  id: z.string().min(1).max(120),
  field: commissionFieldReferenceSchema,
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "in",
    "not_in",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "filled",
    "not_filled",
  ]),
  value: z.union([
    z.string().max(500),
    z.array(z.string().max(500)).max(100),
    z.null(),
  ]),
});

export const commissionConditionGroupSchema: z.ZodType<CommissionConditionGroup> =
  z.lazy(() =>
    z.object({
      kind: z.literal("group"),
      id: z.string().min(1).max(120),
      combinator: z.enum(["and", "or"]),
      children: z
        .array(
          z.union([commissionConditionSchema, commissionConditionGroupSchema]),
        )
        .max(100),
    }),
  );

const decimalStringSchema = z
  .string()
  .trim()
  .min(1, "Informe um valor.")
  .max(40)
  .regex(/^-?\d+(?:[.,]\d+)?$/, "Informe um número decimal válido.");

export const commissionFormulaNodeSchema: z.ZodType<CommissionFormulaNode> =
  z.lazy(() =>
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("constant"),
        value: decimalStringSchema,
        valueType: z.enum(["number", "currency", "percentage"]),
      }),
      z.object({
        kind: z.literal("field"),
        field: formulaFieldReferenceSchema,
        defaultValue: z.union([decimalStringSchema, z.null()]),
      }),
      z.object({
        kind: z.literal("operation"),
        operator: z.enum([
          "add",
          "subtract",
          "multiply",
          "divide",
          "min",
          "max",
        ]),
        left: commissionFormulaNodeSchema,
        right: commissionFormulaNodeSchema,
      }),
      z.object({
        kind: z.literal("percentage"),
        base: commissionFormulaNodeSchema,
        rate: commissionFormulaNodeSchema,
      }),
    ]),
  );

export const commissionRuleDraftSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da regra.").max(160),
    description: z.string().trim().max(2_000),
    beneficiarySource: z.enum(["consultant", "captor"]),
    beneficiaryRole: z.string().trim().min(2, "Informe a função.").max(120),
    priority: z.number().int().min(-10_000).max(10_000),
    exclusive: z.boolean(),
    validFrom: z.string().date().nullable(),
    validTo: z.string().date().nullable(),
    conditions: commissionConditionGroupSchema,
    formula: commissionFormulaNodeSchema,
  })
  .superRefine((value, context) => {
    if (value.validFrom && value.validTo && value.validFrom > value.validTo) {
      context.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "A vigência final deve ser posterior à inicial.",
      });
    }
  });

export const commissionAdjustmentSchema = z.object({
  amountCents: z
    .number()
    .int()
    .nonnegative("O valor ajustado não pode ser negativo."),
  reason: z.string().trim().min(5, "Informe uma justificativa.").max(2_000),
});

export type CommissionRuleDraftInput = z.input<
  typeof commissionRuleDraftSchema
>;

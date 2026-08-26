import { z } from "zod";

function hasValidCpfChecksum(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(9) === Number(digits[9]) &&
    calculateDigit(10) === Number(digits[10])
  );
}

export const cardDraftSchema = z.object({
  listId: z.string().uuid("Selecione uma etapa válida."),
  unitId: z.string().uuid("Selecione uma unidade."),
  consultantId: z.string().uuid("Selecione um consultor."),
  captorId: z.string().uuid("Selecione um captador."),
  property: z.string().trim().min(2, "Informe o imóvel.").max(240),
  rentValueCents: z
    .number({ error: "Informe o valor do aluguel." })
    .int("Informe um valor válido para o aluguel.")
    .nonnegative("O valor do aluguel não pode ser negativo."),
  tenantCpf: z
    .string()
    .trim()
    .refine(hasValidCpfChecksum, "Informe um CPF válido.")
    .transform((value) => value.replace(/\D/g, "")),
  tenantName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do locatário.")
    .max(240),
});

export const listDraftSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da coluna.").max(120),
  slaHours: z
    .number()
    .int("O SLA deve ser informado em horas inteiras.")
    .min(1, "O SLA deve ser de pelo menos 1 hora.")
    .max(8760, "O SLA não pode exceder 8.760 horas.")
    .nullable(),
});

export const directoryEntrySchema = z.object({
  name: z.string().trim().min(2, "Informe um nome.").max(120),
});

export const customFieldDraftSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do campo.").max(120),
    type: z.enum([
      "text",
      "currency",
      "number",
      "percentage",
      "select",
      "attachment",
    ]),
    section: z.enum(["lease", "tenants", "residents", "guarantors", "other"]),
    options: z.array(z.string().trim().min(1).max(120)).max(100),
  })
  .superRefine((value, context) => {
    if (value.type === "select" && value.options.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Defina ao menos um item para a lista.",
      });
    }
  });

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva um comentário.").max(5_000),
});

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, "Informe o item.").max(500),
});

export type CardDraftInput = z.input<typeof cardDraftSchema>;

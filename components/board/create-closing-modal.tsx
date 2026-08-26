"use client";

import { AlertCircle, Building2, UserRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createCard } from "@/lib/domain/operations";
import { cardDraftSchema } from "@/lib/validation/cards";
import { currencyInputToCents } from "@/lib/utils";
import { useBoard } from "../providers/board-provider";
import { Modal } from "../ui/modal";

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

type Draft = {
  unitId: string;
  consultantId: string;
  captorId: string;
  property: string;
  rentValue: string;
  tenantCpf: string;
  tenantName: string;
};

export function CreateClosingModal({
  onClose,
  onCreated,
  onOpenSettings,
}: {
  onClose: () => void;
  onCreated: (cardId: string) => void;
  onOpenSettings: () => void;
}) {
  const { data, mutate } = useBoard();
  const lists = useMemo(
    () =>
      [...data.lists]
        .filter((list) => !list.archived)
        .sort((a, b) => a.position - b.position),
    [data.lists],
  );
  const [draft, setDraft] = useState<Draft>({
    unitId: data.units[0]?.id ?? "",
    consultantId: data.consultants[0]?.id ?? "",
    captorId: data.captors[0]?.id ?? "",
    property: "",
    rentValue: "",
    tenantCpf: "",
    tenantName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const missingConfiguration =
    lists.length === 0 ||
    data.units.length === 0 ||
    data.consultants.length === 0 ||
    data.captors.length === 0;

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: "",
      ...(field === "rentValue" ? { rentValueCents: "" } : {}),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !lists[0]) return;

    const parsed = cardDraftSchema.safeParse({
      ...draft,
      rentValueCents: currencyInputToCents(draft.rentValue),
      listId: lists[0].id,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        nextErrors[field] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    let createdCardId = "";
    try {
      const ok = await mutate(
        (current) => {
          const result = createCard(current, parsed.data);
          createdCardId = result.cardId;
          return result.data;
        },
        { success: "Fechamento adicionado." },
      );
      if (ok) {
        onClose();
        onCreated(createdCardId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Adicionar fechamento"
      description="O novo fechamento entra automaticamente na primeira coluna do fluxo."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="overflow-y-auto p-5 sm:p-6"
      >
        {missingConfiguration && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
            <p className="flex items-start gap-2 font-semibold">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              Cadastre ao menos uma coluna, unidade, consultor e captador antes
              de adicionar um fechamento.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="mt-3 font-bold underline underline-offset-2"
            >
              Abrir configurações
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unidade" error={errors.unitId} icon={Building2}>
            <select
              value={draft.unitId}
              onChange={(event) => update("unitId", event.target.value)}
              className="input mt-1"
              aria-label="Unidade"
            >
              <option value="">Selecione</option>
              {data.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Consultor" error={errors.consultantId} icon={UserRound}>
            <select
              value={draft.consultantId}
              onChange={(event) => update("consultantId", event.target.value)}
              className="input mt-1"
              aria-label="Consultor"
            >
              <option value="">Selecione</option>
              {data.consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Captador" error={errors.captorId} icon={UserRound}>
            <select
              value={draft.captorId}
              onChange={(event) => update("captorId", event.target.value)}
              className="input mt-1"
              aria-label="Captador"
            >
              <option value="">Selecione</option>
              {data.captors.map((captor) => (
                <option key={captor.id} value={captor.id}>
                  {captor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Imóvel" error={errors.property}>
            <input
              value={draft.property}
              onChange={(event) => update("property", event.target.value)}
              className="input mt-1"
              placeholder="Código ou endereço do imóvel"
              aria-label="Imóvel"
            />
          </Field>
          <Field label="Valor do aluguel" error={errors.rentValueCents}>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-2.5 text-xs text-[var(--muted-foreground)]">
                R$
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={draft.rentValue}
                onChange={(event) => update("rentValue", event.target.value)}
                className="input pl-9"
                placeholder="0,00"
                aria-label="Valor do aluguel"
              />
            </div>
          </Field>
          <Field label="CPF do locatário" error={errors.tenantCpf}>
            <input
              value={draft.tenantCpf}
              onChange={(event) =>
                update("tenantCpf", formatCpfInput(event.target.value))
              }
              className="input mt-1"
              inputMode="numeric"
              placeholder="000.000.000-00"
              aria-label="CPF do locatário"
            />
          </Field>
          <Field label="Nome completo do locatário" error={errors.tenantName}>
            <input
              value={draft.tenantName}
              onChange={(event) => update("tenantName", event.target.value)}
              className="input mt-1"
              placeholder="Nome completo"
              aria-label="Nome completo do locatário"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onClose} className="button-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || missingConfiguration}
            className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Salvando…" : "Adicionar fechamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  error,
  icon: Icon,
  children,
}: {
  label: string;
  error?: string;
  icon?: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <label className="field-label">
      <span className="flex items-center gap-1.5">
        {Icon && <Icon size={13} />} {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block normal-case tracking-normal text-rose-600 dark:text-rose-300">
          {error}
        </span>
      )}
    </label>
  );
}

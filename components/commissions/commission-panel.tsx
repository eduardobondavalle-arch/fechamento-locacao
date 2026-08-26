"use client";

import {
  Archive,
  Calculator,
  CircleDollarSign,
  Pencil,
  Plus,
  Send,
  Settings2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { can } from "@/lib/domain/permissions";
import {
  adjustCommissionAmount,
  archiveCommissionRule,
  generateCommissions,
  previewCommissionGeneration,
  publishCommissionRule,
  transitionCommissionStatus,
} from "@/lib/domain/operations";
import type {
  CommissionCalculation,
  CommissionGenerationPreview,
  CommissionStatus,
} from "@/lib/domain/commissions/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "../ui/modal";
import { useBoard } from "../providers/board-provider";
import {
  CommissionRuleBuilder,
  CommissionSimulator,
} from "./commission-rule-builder";

const statusLabels: Record<CommissionStatus, string> = {
  draft: "Rascunho",
  calculated: "Calculada",
  approved: "Aprovada",
  paid: "Paga",
  cancelled: "Cancelada",
  reversed: "Estornada",
};

type ResultFilters = {
  from: string;
  to: string;
  unitId: string;
  consultantId: string;
};

const emptyFilters: ResultFilters = {
  from: "",
  to: "",
  unitId: "",
  consultantId: "",
};

type CommissionView = "capture" | "lease";

type BeneficiarySummary = {
  id: string;
  name: string;
  amountCents: number;
  calculationIds: string[];
};

type DialogState =
  | { type: "builder"; ruleId: string | null }
  | { type: "simulator"; ruleId: string }
  | { type: "memory"; calculationId: string }
  | { type: "rules" }
  | {
      type: "beneficiary";
      title: string;
      calculationIds: string[];
    }
  | { type: "generation" }
  | null;

export function CommissionPanel() {
  const { data, ready, mutate } = useBoard();
  const boardId = data.boards[0]?.id ?? "";
  const admin = can(data, boardId, "commissions.manage");
  const [view, setView] = useState<CommissionView>("capture");
  const [filters, setFilters] = useState<ResultFilters>(emptyFilters);
  const [dialog, setDialog] = useState<DialogState>(null);

  const calculations = useMemo(() => {
    const source = view === "capture" ? "captor" : "consultant";
    return [...data.commissionCalculations]
      .filter((calculation) => {
        const snapshot = calculation.snapshot;
        const day = calculation.calculatedAt.slice(0, 10);
        const version = data.commissionRuleVersions.find(
          (item) => item.id === calculation.ruleVersionId,
        );
        return (
          version?.beneficiarySource === source &&
          !["cancelled", "reversed"].includes(calculation.status) &&
          (!filters.from || day >= filters.from) &&
          (!filters.to || day <= filters.to) &&
          (!filters.unitId || snapshot.unitId === filters.unitId) &&
          (!filters.consultantId ||
            snapshot.consultantId === filters.consultantId)
        );
      })
      .sort((left, right) =>
        right.calculatedAt.localeCompare(left.calculatedAt),
      );
  }, [data.commissionCalculations, data.commissionRuleVersions, filters, view]);

  const beneficiaries = useMemo<BeneficiarySummary[]>(() => {
    const directory = view === "capture" ? data.captors : data.consultants;
    const grouped = new Map<string, BeneficiarySummary>(
      directory.map((entry) => [
        entry.id,
        {
          id: entry.id,
          name: entry.name,
          amountCents: 0,
          calculationIds: [],
        },
      ]),
    );
    for (const calculation of calculations) {
      const current = grouped.get(calculation.beneficiaryId) ?? {
        id: calculation.beneficiaryId,
        name: calculation.beneficiaryName,
        amountCents: 0,
        calculationIds: [],
      };
      current.amountCents += calculation.amountCents;
      current.calculationIds.push(calculation.id);
      grouped.set(current.id, current);
    }
    return [...grouped.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }, [calculations, data.captors, data.consultants, view]);

  const candidateCards = useMemo(() => {
    return data.cards.filter((card) => {
      const day = card.createdAt.slice(0, 10);
      return (
        !card.archived &&
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to) &&
        (!filters.unitId || card.unitId === filters.unitId) &&
        (!filters.consultantId || card.consultantId === filters.consultantId)
      );
    });
  }, [data.cards, filters]);

  if (!ready)
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        Carregando comissionamento…
      </div>
    );

  return (
    <div className="h-full overflow-y-auto px-4 pb-8 pt-6 sm:px-6 sm:pt-7">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps mb-2 flex items-center gap-2">
              <CircleDollarSign size={14} /> Gestão financeira
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Comissionamento
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              Configure regras versionadas, simule cenários e acompanhe
              pagamentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-secondary h-10"
              onClick={() => setDialog({ type: "rules" })}
            >
              <Settings2 size={16} /> Regras de comissão
            </button>
            {admin && (
              <button
                type="button"
                className="button-primary h-10"
                onClick={() => setDialog({ type: "generation" })}
              >
                <Calculator size={16} /> Calcular comissões
              </button>
            )}
          </div>
        </div>

        <div
          className="bg-[var(--secondary)]/50 mt-5 flex w-fit rounded-full border border-[var(--border)] p-1"
          role="tablist"
          aria-label="Tipos de comissão"
        >
          <SectionButton
            active={view === "capture"}
            onClick={() => setView("capture")}
          >
            Comissões de captação
          </SectionButton>
          <SectionButton
            active={view === "lease"}
            onClick={() => setView("lease")}
          >
            Comissões de locação
          </SectionButton>
        </div>

        <CommissionFilters filters={filters} onChange={setFilters} />
        <BeneficiaryList
          view={view}
          beneficiaries={beneficiaries}
          onOpen={(beneficiary) =>
            setDialog({
              type: "beneficiary",
              title: beneficiary.name,
              calculationIds: beneficiary.calculationIds,
            })
          }
        />
      </div>

      {dialog?.type === "builder" && (
        <Modal
          size="fullscreen"
          title={
            dialog.ruleId
              ? "Editar regra de comissão"
              : "Nova regra de comissão"
          }
          description="As alterações ficam em rascunho até a publicação de uma versão imutável."
          onClose={() => setDialog(null)}
        >
          <CommissionRuleBuilder
            ruleId={dialog.ruleId}
            onClose={() => setDialog(null)}
          />
        </Modal>
      )}
      {dialog?.type === "simulator" && (
        <Modal
          size="large"
          title="Testar regra"
          description="A simulação não gera comissão nem altera o card."
          onClose={() => setDialog(null)}
        >
          <CommissionSimulator ruleId={dialog.ruleId} />
        </Modal>
      )}
      {dialog?.type === "memory" && (
        <CalculationMemory
          calculationId={dialog.calculationId}
          admin={admin}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "rules" && (
        <Modal
          size="large"
          title="Regras de comissão"
          description="Consulte, simule e administre as regras de cálculo."
          onClose={() => setDialog(null)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <RulesSection admin={admin} onDialog={setDialog} />
          </div>
        </Modal>
      )}
      {dialog?.type === "beneficiary" && (
        <Modal
          size="large"
          title={dialog.title}
          description="Fechamentos que compõem o valor apresentado."
          onClose={() => setDialog(null)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {dialog.calculationIds.length > 0 ? (
              <CommissionTable
                calculations={data.commissionCalculations.filter((item) =>
                  dialog.calculationIds.includes(item.id),
                )}
                admin={admin}
                onOpen={(calculationId) =>
                  setDialog({ type: "memory", calculationId })
                }
                mutate={mutate}
              />
            ) : (
              <div className="empty-box m-5 py-12">
                Nenhuma comissão calculada para esta pessoa no período.
              </div>
            )}
          </div>
        </Modal>
      )}
      {dialog?.type === "generation" && (
        <GenerationDialog
          cards={candidateCards}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function SectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${active ? "bg-[var(--glass-strong)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
    >
      {children}
    </button>
  );
}

function BeneficiaryList({
  view,
  beneficiaries,
  onOpen,
}: {
  view: CommissionView;
  beneficiaries: BeneficiarySummary[];
  onOpen: (beneficiary: BeneficiarySummary) => void;
}) {
  return (
    <section className="panel mt-4 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <UserRound size={16} className="text-[var(--primary)]" />
        <h2 className="text-sm font-semibold">
          {view === "capture" ? "Captadores" : "Consultores"}
        </h2>
      </div>
      {beneficiaries.length > 0 ? (
        <div className="divide-y divide-[var(--border)]">
          {beneficiaries.map((beneficiary) => (
            <button
              key={beneficiary.id}
              type="button"
              className="hover:bg-[var(--secondary)]/45 flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
              onClick={() => onOpen(beneficiary)}
              aria-label={`Abrir comissões de ${beneficiary.name}`}
            >
              <span className="text-sm font-semibold">{beneficiary.name}</span>
              <strong className="whitespace-nowrap text-sm tabular-nums">
                {formatCurrency(beneficiary.amountCents)}
              </strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-box m-4 py-12">
          Nenhum {view === "capture" ? "captador" : "consultor"} cadastrado.
        </div>
      )}
    </section>
  );
}

function CommissionFilters({
  filters,
  onChange,
}: {
  filters: ResultFilters;
  onChange: (filters: ResultFilters) => void;
}) {
  const { data } = useBoard();
  return (
    <div className="panel mt-4 p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(150px,1fr))_auto]">
        <FilterSelect
          label="Filtrar por unidade"
          value={filters.unitId}
          onChange={(unitId) => onChange({ ...filters, unitId })}
          empty="Unidades"
          options={data.units}
        />
        <FilterSelect
          label="Filtrar por consultor"
          value={filters.consultantId}
          onChange={(consultantId) => onChange({ ...filters, consultantId })}
          empty="Consultores"
          options={data.consultants}
        />
        <input
          className="input h-9 text-xs"
          type="date"
          aria-label="Período inicial"
          value={filters.from}
          onChange={(event) =>
            onChange({ ...filters, from: event.target.value })
          }
        />
        <input
          className="input h-9 text-xs"
          type="date"
          aria-label="Período final"
          value={filters.to}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
        <button
          type="button"
          className="button-ghost"
          onClick={() => onChange(emptyFilters)}
        >
          Limpar
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  empty,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  empty: string;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <select
      className="input h-9 text-xs"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{empty}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function CommissionTable({
  calculations,
  admin,
  onOpen,
  mutate,
}: {
  calculations: CommissionCalculation[];
  admin: boolean;
  onOpen: (id: string) => void;
  mutate: ReturnType<typeof useBoard>["mutate"];
}) {
  const transition = (
    calculation: CommissionCalculation,
    status: CommissionStatus,
  ) => {
    const needsReason = ["cancelled", "reversed"].includes(status);
    const reason = needsReason
      ? window.prompt("Informe a justificativa obrigatória:")
      : null;
    if (needsReason && !reason) return;
    void mutate(
      (current) =>
        transitionCommissionStatus(current, calculation.id, status, reason),
      {
        success: `Comissão ${statusLabels[status].toLocaleLowerCase("pt-BR")}.`,
      },
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-xs">
        <thead className="bg-[var(--secondary)]/55 text-[var(--muted-foreground)]">
          <tr>
            <TableHead>Imóvel / card</TableHead>
            <TableHead>Beneficiário</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Valor-base</TableHead>
            <TableHead>Regra aplicada</TableHead>
            <TableHead>Valor final</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Calculada em</TableHead>
            <TableHead>Ações</TableHead>
          </tr>
        </thead>
        <tbody>
          {calculations.map((calculation) => (
            <tr
              key={calculation.id}
              className="border-t border-[var(--border)]"
            >
              <TableCell>
                <strong className="block text-[var(--foreground)]">
                  {calculation.snapshot.property}
                </strong>
                <span className="text-[var(--muted-foreground)]">
                  {calculation.snapshot.cardTitle}
                </span>
              </TableCell>
              <TableCell>{calculation.beneficiaryName}</TableCell>
              <TableCell>{calculation.beneficiaryRole}</TableCell>
              <TableCell>
                {formatCurrency(calculation.baseValueCents)}
              </TableCell>
              <TableCell>
                {calculation.snapshot.ruleName}
                <span className="block text-[var(--muted-foreground)]">
                  versão {calculation.ruleVersion}
                </span>
              </TableCell>
              <TableCell>
                <strong>{formatCurrency(calculation.amountCents)}</strong>
                {calculation.amountCents !==
                  calculation.originalAmountCents && (
                  <span className="block text-[10px] text-amber-600">
                    ajustada
                  </span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={calculation.status} />
              </TableCell>
              <TableCell>
                {formatDate(calculation.calculatedAt, true)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => onOpen(calculation.id)}
                  >
                    Memória
                  </button>
                  {admin && calculation.status === "calculated" && (
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => transition(calculation, "approved")}
                    >
                      Aprovar
                    </button>
                  )}
                  {admin && calculation.status === "approved" && (
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => transition(calculation, "paid")}
                    >
                      Marcar paga
                    </button>
                  )}
                  {admin && calculation.status === "paid" && (
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => transition(calculation, "reversed")}
                    >
                      Estornar
                    </button>
                  )}
                  {admin &&
                    ["draft", "calculated", "approved"].includes(
                      calculation.status,
                    ) && (
                      <button
                        type="button"
                        className="button-ghost text-red-600"
                        onClick={() => transition(calculation, "cancelled")}
                      >
                        Cancelar
                      </button>
                    )}
                </div>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>
  );
}
function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
function StatusBadge({ status }: { status: CommissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${status === "paid" ? "bg-emerald-500/12 text-emerald-600" : status === "approved" ? "bg-blue-500/12 text-blue-600" : ["cancelled", "reversed"].includes(status) ? "bg-red-500/12 text-red-600" : "bg-amber-500/12 text-amber-600"}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function RulesSection({
  admin,
  onDialog,
}: {
  admin: boolean;
  onDialog: (dialog: DialogState) => void;
}) {
  const { data, mutate } = useBoard();
  const rules = [...data.commissionRules]
    .filter((rule) => !rule.archived)
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.name.localeCompare(right.name, "pt-BR"),
    );
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Regras de comissão</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Versões publicadas são imutáveis; edições posteriores geram uma nova
            versão.
          </p>
        </div>
        {admin && (
          <button
            type="button"
            className="button-primary"
            onClick={() => onDialog({ type: "builder", ruleId: null })}
          >
            <Plus size={15} /> Nova regra
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {rules.map((rule) => {
          const version = rule.activeVersionId
            ? data.commissionRuleVersions.find(
                (item) => item.id === rule.activeVersionId,
              )
            : undefined;
          return (
            <article key={rule.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${rule.status === "published" ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"}`}
                    >
                      {rule.status === "published"
                        ? `Publicada · v${version?.version ?? "—"}`
                        : "Rascunho"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    {rule.description || "Sem descrição."}
                  </p>
                </div>
                <span className="rounded-lg bg-[var(--secondary)] px-2 py-1 font-mono text-xs">
                  P{rule.priority}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="field-label">Beneficiário</dt>
                  <dd className="mt-1">{rule.beneficiaryRole}</dd>
                </div>
                <div>
                  <dt className="field-label">Comportamento</dt>
                  <dd className="mt-1">
                    {rule.exclusive ? "Exclusiva" : "Acumulável"}
                  </dd>
                </div>
                <div>
                  <dt className="field-label">Vigência</dt>
                  <dd className="mt-1">
                    {rule.validFrom || "Sem início"} —{" "}
                    {rule.validTo || "sem fim"}
                  </dd>
                </div>
                <div>
                  <dt className="field-label">Publicação</dt>
                  <dd className="mt-1">
                    {rule.publishedAt
                      ? formatDate(rule.publishedAt, true)
                      : "Não publicada"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    onDialog({ type: "simulator", ruleId: rule.id })
                  }
                >
                  <Calculator size={14} /> Simular
                </button>
                {admin && (
                  <>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        onDialog({ type: "builder", ruleId: rule.id })
                      }
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        void mutate(
                          (current) => publishCommissionRule(current, rule.id),
                          { success: "Nova versão publicada." },
                        )
                      }
                    >
                      <Send size={14} /> Publicar
                    </button>
                    <button
                      type="button"
                      className="button-ghost text-red-600"
                      onClick={() =>
                        void mutate(
                          (current) => archiveCommissionRule(current, rule.id),
                          { success: "Regra arquivada." },
                        )
                      }
                    >
                      <Archive size={14} /> Arquivar
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {rules.length === 0 && (
          <div className="empty-box col-span-full py-14">
            Nenhuma regra cadastrada. O sistema não cria regras comerciais
            automaticamente.
          </div>
        )}
      </div>
    </div>
  );
}

function GenerationDialog({
  cards,
  onClose,
}: {
  cards: AppDataCard[];
  onClose: () => void;
}) {
  const { data, mutate } = useBoard();
  const [selected, setSelected] = useState(
    () => new Set(cards.map((card) => card.id)),
  );
  const [previews, setPreviews] = useState<
    CommissionGenerationPreview[] | null
  >(null);
  const [error, setError] = useState("");
  const preview = () => {
    try {
      setPreviews(previewCommissionGeneration(data, [...selected]));
      setError("");
    } catch (cause) {
      setPreviews(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a prévia.",
      );
    }
  };
  const confirm = async () => {
    const saved = await mutate(
      (current) => generateCommissions(current, [...selected]),
      { success: "Comissões calculadas e registradas." },
    );
    if (saved) onClose();
  };
  return (
    <Modal
      size="large"
      title="Calcular comissões"
      description="Selecione um ou vários cards, revise a prévia e confirme a geração."
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((card) => (
            <label
              key={card.id}
              className="flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] p-3 text-xs"
            >
              <input
                type="checkbox"
                checked={selected.has(card.id)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(card.id);
                  else next.delete(card.id);
                  setSelected(next);
                  setPreviews(null);
                }}
              />
              <span>
                <strong className="block">{card.tenantName}</strong>
                <span className="text-[var(--muted-foreground)]">
                  {card.property} · {formatCurrency(card.rentValueCents)}
                </span>
              </span>
            </label>
          ))}
          {cards.length === 0 && (
            <div className="empty-box col-span-full">
              Nenhum card corresponde aos filtros atuais.
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        {previews && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">
              Prévia — nenhuma alteração foi feita
            </h3>
            {previews.map((item) => (
              <section
                key={item.cardId}
                className="rounded-xl border border-[var(--border)] p-3"
              >
                <strong className="text-sm">{item.cardTitle}</strong>
                {item.duplicates.map((name) => (
                  <p key={name} className="mt-1 text-xs text-amber-600">
                    {name}: cálculo ativo equivalente já existe.
                  </p>
                ))}
                {item.simulations.map((simulation) => (
                  <div
                    key={simulation.ruleId}
                    className="mt-2 flex items-start justify-between gap-3 border-t border-[var(--border)] pt-2 text-xs"
                  >
                    <span>
                      {simulation.ruleName}
                      <small className="block text-[var(--muted-foreground)]">
                        {simulation.applied
                          ? "Aplicada"
                          : (simulation.ignoredReason ??
                            (simulation.matched
                              ? "Compatível"
                              : "Não compatível"))}
                      </small>
                    </span>
                    <strong>
                      {simulation.amountCents === null
                        ? "—"
                        : formatCurrency(simulation.amountCents)}
                    </strong>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={selected.size === 0}
          onClick={preview}
        >
          Gerar prévia
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={!previews || previews.length === 0}
          onClick={() => void confirm()}
        >
          Confirmar geração
        </button>
      </div>
    </Modal>
  );
}

type AppDataCard = ReturnType<typeof useBoard>["data"]["cards"][number];

function CalculationMemory({
  calculationId,
  admin,
  onClose,
}: {
  calculationId: string;
  admin: boolean;
  onClose: () => void;
}) {
  const { data, mutate } = useBoard();
  const calculation = data.commissionCalculations.find(
    (item) => item.id === calculationId,
  );
  if (!calculation) return null;
  const history = data.commissionStatusHistory
    .filter((item) => item.calculationId === calculationId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const adjustments = data.commissionAdjustments.filter(
    (item) => item.calculationId === calculationId,
  );
  const adjust = () => {
    const raw = window.prompt(
      "Novo valor da comissão em reais:",
      (calculation.amountCents / 100).toFixed(2).replace(".", ","),
    );
    if (!raw) return;
    const value = Number(raw.replace(/\./g, "").replace(",", "."));
    const reason = window.prompt("Justificativa obrigatória para o ajuste:");
    if (!reason) return;
    void mutate(
      (current) =>
        adjustCommissionAmount(current, calculation.id, {
          amountCents: Math.round(value * 100),
          reason,
        }),
      { success: "Ajuste registrado na auditoria." },
    );
  };
  return (
    <Modal
      size="large"
      title="Memória de cálculo"
      description={`${calculation.snapshot.cardTitle} · ${statusLabels[calculation.status]}`}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <MemoryBlock title="Origem">
            <MemoryRow label="Imóvel" value={calculation.snapshot.property} />
            <MemoryRow label="Unidade" value={calculation.snapshot.unitName} />
            <MemoryRow
              label="Aluguel"
              value={formatCurrency(calculation.snapshot.rentValueCents)}
            />
            <MemoryRow
              label="Regra"
              value={`${calculation.snapshot.ruleName} · v${calculation.snapshot.ruleVersion}`}
            />
          </MemoryBlock>
          <MemoryBlock title="Beneficiário e resultado">
            <MemoryRow
              label="Beneficiário"
              value={calculation.snapshot.beneficiaryName}
            />
            <MemoryRow
              label="Função"
              value={calculation.snapshot.beneficiaryRole}
            />
            <MemoryRow
              label="Valor original"
              value={formatCurrency(calculation.originalAmountCents)}
            />
            <MemoryRow
              label="Valor vigente"
              value={formatCurrency(calculation.amountCents)}
            />
            {admin &&
              !["cancelled", "reversed"].includes(calculation.status) && (
                <button
                  type="button"
                  className="button-secondary mt-3"
                  onClick={adjust}
                >
                  Ajustar com justificativa
                </button>
              )}
          </MemoryBlock>
          <MemoryBlock title="Auditoria">
            <MemoryRow
              label="Calculada em"
              value={formatDate(calculation.calculatedAt, true)}
            />
            <MemoryRow
              label="Política"
              value="Meio centavo para longe de zero, apenas no resultado final"
            />
            <MemoryRow label="Revisão" value={String(calculation.revision)} />
            <MemoryRow label="ID da versão" value={calculation.ruleVersionId} />
          </MemoryBlock>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MemoryBlock title="Campos utilizados">
            {calculation.snapshot.fieldValues.map((field, index) => (
              <MemoryRow
                key={`${index}-${field.name}`}
                label={`${field.name}${field.archived ? " (arquivado)" : ""}`}
                value={
                  field.rawValue ??
                  (field.usedDefault
                    ? `Padrão: ${field.normalizedValue}`
                    : "Não preenchido")
                }
              />
            ))}
          </MemoryBlock>
          <MemoryBlock title="Condições">
            {calculation.snapshot.conditions.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Regra sem condições.
              </p>
            )}
            {calculation.snapshot.conditions.map((condition) => (
              <MemoryRow
                key={condition.conditionId}
                label={condition.field.name}
                value={
                  condition.error ??
                  (condition.matched ? "Atendida" : "Não atendida")
                }
              />
            ))}
          </MemoryBlock>
          <MemoryBlock title="Etapas da fórmula">
            {calculation.snapshot.formulaSteps.map((step) => (
              <MemoryRow
                key={step.path}
                label={`${step.path} · ${step.description}`}
                value={step.error ?? step.value ?? "—"}
              />
            ))}
          </MemoryBlock>
          <MemoryBlock title="Histórico financeiro">
            {history.map((entry) => (
              <MemoryRow
                key={entry.id}
                label={`${entry.fromStatus ? statusLabels[entry.fromStatus] : "Início"} → ${statusLabels[entry.toStatus]}`}
                value={`${formatDate(entry.createdAt, true)}${entry.reason ? ` · ${entry.reason}` : ""}`}
              />
            ))}
            {adjustments.map((entry) => (
              <MemoryRow
                key={entry.id}
                label={`${formatCurrency(entry.previousAmountCents)} → ${formatCurrency(entry.newAmountCents)}`}
                value={`${formatDate(entry.createdAt, true)} · ${entry.reason}`}
              />
            ))}
          </MemoryBlock>
        </div>
      </div>
    </Modal>
  );
}

function MemoryBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
function MemoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--border)] py-2 text-xs last:border-0">
      <strong className="block text-[var(--foreground)]">{label}</strong>
      <span className="break-words text-[var(--muted-foreground)]">
        {value}
      </span>
    </div>
  );
}

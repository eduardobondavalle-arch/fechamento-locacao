"use client";

import { Calculator, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type {
  CommissionCondition,
  CommissionConditionGroup,
  CommissionConditionOperator,
  CommissionFieldReference,
  CommissionFormulaNode,
  FormulaFieldReference,
} from "@/lib/domain/commissions/types";
import {
  createCommissionRule,
  simulateCommissionRule,
  updateCommissionRule,
} from "@/lib/domain/operations";
import type { AppData, CustomFieldType } from "@/lib/domain/types";
import { useBoard } from "../providers/board-provider";

type FieldOption = {
  token: string;
  label: string;
  type: CustomFieldType | "directory";
  options: string[];
  archived: boolean;
  reference: CommissionFieldReference;
};

type FormulaFieldOption = FieldOption & { reference: FormulaFieldReference };

const operatorLabels: Record<CommissionConditionOperator, string> = {
  equals: "Igual",
  not_equals: "Diferente",
  contains: "Contém",
  in: "Está em",
  not_in: "Não está em",
  greater_than: "Maior",
  greater_or_equal: "Maior ou igual",
  less_than: "Menor",
  less_or_equal: "Menor ou igual",
  filled: "Preenchido",
  not_filled: "Não preenchido",
};

function referenceToken(
  reference: CommissionFieldReference | FormulaFieldReference,
): string {
  return reference.source === "native"
    ? `native:${reference.field}`
    : `custom:${reference.fieldId}`;
}

function conditionOperators(
  type: FieldOption["type"],
): CommissionConditionOperator[] {
  if (type === "text")
    return ["equals", "not_equals", "contains", "filled", "not_filled"];
  if (type === "select") return ["equals", "not_equals", "in", "not_in"];
  if (type === "directory")
    return ["equals", "not_equals", "filled", "not_filled"];
  return [
    "equals",
    "not_equals",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "filled",
    "not_filled",
  ];
}

function allFieldOptions(data: AppData): FieldOption[] {
  return [
    {
      token: "native:rentValueCents",
      label: "Valor do aluguel",
      type: "currency",
      options: [],
      archived: false,
      reference: { source: "native", field: "rentValueCents" },
    },
    {
      token: "native:unitId",
      label: "Unidade",
      type: "directory",
      options: data.units.map((entry) => entry.id),
      archived: false,
      reference: { source: "native", field: "unitId" },
    },
    {
      token: "native:consultantId",
      label: "Consultor",
      type: "directory",
      options: data.consultants.map((entry) => entry.id),
      archived: false,
      reference: { source: "native", field: "consultantId" },
    },
    {
      token: "native:captorId",
      label: "Captador",
      type: "directory",
      options: data.captors.map((entry) => entry.id),
      archived: false,
      reference: { source: "native", field: "captorId" },
    },
    ...data.customFields
      .filter((field) => field.type !== "attachment")
      .sort((left, right) => left.position - right.position)
      .map((field) => ({
        token: `custom:${field.id}`,
        label: `${field.name}${field.archived ? " (arquivado)" : ""}`,
        type: field.type,
        options: field.options,
        archived: field.archived,
        reference: { source: "custom" as const, fieldId: field.id },
      })),
  ];
}

function directoryOptions(data: AppData, field: CommissionFieldReference) {
  if (field.source !== "native") return [];
  if (field.field === "unitId") return data.units;
  if (field.field === "consultantId") return data.consultants;
  if (field.field === "captorId") return data.captors;
  return [];
}

function defaultCondition(fields: FieldOption[]): CommissionCondition {
  const field = fields.find((item) => !item.archived) ?? fields[0];
  return {
    kind: "condition",
    id: crypto.randomUUID(),
    field: structuredClone(field.reference),
    operator: conditionOperators(field.type)[0],
    value: "",
  };
}

function defaultFormula(): CommissionFormulaNode {
  return {
    kind: "percentage",
    base: {
      kind: "field",
      field: { source: "native", field: "rentValueCents" },
      defaultValue: null,
    },
    rate: { kind: "constant", value: "0", valueType: "percentage" },
  };
}

export function CommissionRuleBuilder({
  ruleId,
  onClose,
}: {
  ruleId: string | null;
  onClose: () => void;
}) {
  const { data, mutate } = useBoard();
  const existing = ruleId
    ? data.commissionRules.find((rule) => rule.id === ruleId)
    : undefined;
  const fields = useMemo(() => allFieldOptions(data), [data]);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [beneficiarySource, setBeneficiarySource] = useState<
    "consultant" | "captor"
  >(existing?.beneficiarySource ?? "consultant");
  const [beneficiaryRole, setBeneficiaryRole] = useState(
    existing?.beneficiaryRole ?? "Consultor",
  );
  const [priority, setPriority] = useState(existing?.priority ?? 0);
  const [exclusive, setExclusive] = useState(existing?.exclusive ?? true);
  const [validFrom, setValidFrom] = useState(existing?.validFrom ?? "");
  const [validTo, setValidTo] = useState(existing?.validTo ?? "");
  const [conditionTree, setConditionTree] = useState<CommissionConditionGroup>(
    () =>
      structuredClone(
        existing?.conditions ?? {
          kind: "group",
          id: crypto.randomUUID(),
          combinator: "and",
          children: [],
        },
      ),
  );
  const [formula, setFormula] = useState<CommissionFormulaNode>(() =>
    structuredClone(existing?.formula ?? defaultFormula()),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      name,
      description,
      beneficiarySource,
      beneficiaryRole,
      priority,
      exclusive,
      validFrom: validFrom || null,
      validTo: validTo || null,
      conditions: conditionTree,
      formula,
    };
    const saved = await mutate(
      (current) =>
        ruleId
          ? updateCommissionRule(current, ruleId, input)
          : createCommissionRule(current, input).data,
      { success: ruleId ? "Regra atualizada." : "Rascunho de regra criado." },
    );
    if (saved) onClose();
  };

  return (
    <form
      onSubmit={submit}
      className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-5">
          <section className="panel p-4">
            <h3 className="text-sm font-semibold">Identificação e aplicação</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="field-label">Nome da regra</span>
                <input
                  className="input mt-1"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Descrição opcional</span>
                <textarea
                  className="input mt-1 min-h-20 resize-y"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Beneficiário nativo</span>
                <select
                  className="input mt-1"
                  value={beneficiarySource}
                  onChange={(event) => {
                    const source = event.target.value as
                      "consultant" | "captor";
                    setBeneficiarySource(source);
                    setBeneficiaryRole(
                      source === "consultant" ? "Consultor" : "Captador",
                    );
                  }}
                >
                  <option value="consultant">Consultor do card</option>
                  <option value="captor">Captador do card</option>
                </select>
              </label>
              <label>
                <span className="field-label">Função exibida</span>
                <input
                  className="input mt-1"
                  value={beneficiaryRole}
                  onChange={(event) => setBeneficiaryRole(event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="field-label">Prioridade</span>
                <input
                  className="input mt-1"
                  type="number"
                  min={-10000}
                  max={10000}
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value))}
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={exclusive}
                  onChange={(event) => setExclusive(event.target.checked)}
                />
                Exclusiva quando aplicada
              </label>
              <label>
                <span className="field-label">Vigência inicial</span>
                <input
                  className="input mt-1"
                  type="date"
                  value={validFrom}
                  onChange={(event) => setValidFrom(event.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Vigência final</span>
                <input
                  className="input mt-1"
                  type="date"
                  value={validTo}
                  onChange={(event) => setValidTo(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="panel p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Condições</h3>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Combine grupos E e OU. As referências são persistidas pelo UUID
                do campo.
              </p>
            </div>
            <ConditionGroupEditor
              group={conditionTree}
              fields={fields}
              data={data}
              root
              onChange={setConditionTree}
            />
          </section>
        </div>

        <section className="panel h-fit p-4">
          <h3 className="text-sm font-semibold">Fórmula de cálculo</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            Monte a expressão em blocos. Moedas são calculadas em centavos e
            arredondadas somente ao final.
          </p>
          <div className="mt-4">
            <FormulaEditor
              node={formula}
              fields={fields}
              onChange={setFormula}
            />
          </div>
        </section>
      </div>
      <div className="bg-[var(--background)]/90 sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-[var(--border)] py-4 backdrop-blur-xl">
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="button-primary">
          Salvar rascunho
        </button>
      </div>
    </form>
  );
}

function ConditionGroupEditor({
  group,
  fields,
  data,
  onChange,
  root = false,
  onRemove,
}: {
  group: CommissionConditionGroup;
  fields: FieldOption[];
  data: AppData;
  onChange: (group: CommissionConditionGroup) => void;
  root?: boolean;
  onRemove?: () => void;
}) {
  const updateChild = (
    index: number,
    child: CommissionCondition | CommissionConditionGroup,
  ) => {
    const children = [...group.children];
    children[index] = child;
    onChange({ ...group, children });
  };
  const removeChild = (index: number) =>
    onChange({
      ...group,
      children: group.children.filter((_, childIndex) => childIndex !== index),
    });

  return (
    <div
      className={`rounded-2xl border p-3 ${root ? "border-[var(--border)]" : "bg-[var(--secondary)]/25 border-dashed border-[var(--border)]"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Combinar por</span>
        <select
          className="select-compact"
          value={group.combinator}
          onChange={(event) =>
            onChange({
              ...group,
              combinator: event.target.value as "and" | "or",
            })
          }
          aria-label="Combinação do grupo"
        >
          <option value="and">E — todas</option>
          <option value="or">OU — qualquer</option>
        </select>
        {!root && (
          <button
            type="button"
            className="icon-button ml-auto"
            onClick={onRemove}
            aria-label="Remover grupo"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {group.children.map((child, index) =>
          child.kind === "group" ? (
            <ConditionGroupEditor
              key={child.id}
              group={child}
              fields={fields}
              data={data}
              onChange={(next) => updateChild(index, next)}
              onRemove={() => removeChild(index)}
            />
          ) : (
            <ConditionEditor
              key={child.id}
              condition={child}
              fields={fields}
              data={data}
              onChange={(next) => updateChild(index, next)}
              onRemove={() => removeChild(index)}
            />
          ),
        )}
        {group.children.length === 0 && (
          <p className="empty-box">
            Sem condições: a regra será considerada para todos os cards dentro
            da vigência.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="button-ghost"
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, defaultCondition(fields)],
            })
          }
        >
          <Plus size={14} /> Condição
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={() =>
            onChange({
              ...group,
              children: [
                ...group.children,
                {
                  kind: "group",
                  id: crypto.randomUUID(),
                  combinator: "and",
                  children: [],
                },
              ],
            })
          }
        >
          <Plus size={14} /> Grupo E/OU
        </button>
      </div>
    </div>
  );
}

function ConditionEditor({
  condition,
  fields,
  data,
  onChange,
  onRemove,
}: {
  condition: CommissionCondition;
  fields: FieldOption[];
  data: AppData;
  onChange: (condition: CommissionCondition) => void;
  onRemove: () => void;
}) {
  const selected =
    fields.find((field) => field.token === referenceToken(condition.field)) ??
    fields[0];
  const operators = conditionOperators(selected.type);
  const needsValue = !["filled", "not_filled"].includes(condition.operator);
  const valueOptions =
    selected.type === "directory"
      ? directoryOptions(data, condition.field).map((item) => ({
          id: item.id,
          name: item.name,
        }))
      : selected.options.map((option) => ({ id: option, name: option }));
  const multiple = ["in", "not_in"].includes(condition.operator);

  return (
    <div className="bg-[var(--secondary)]/55 grid gap-2 rounded-xl p-2 sm:grid-cols-[minmax(150px,1fr)_150px_minmax(140px,1fr)_32px]">
      <select
        className="input h-9 text-xs"
        aria-label="Campo da condição"
        value={selected.token}
        onChange={(event) => {
          const field = fields.find(
            (item) => item.token === event.target.value,
          )!;
          onChange({
            ...condition,
            field: structuredClone(field.reference),
            operator: conditionOperators(field.type)[0],
            value: "",
          });
        }}
      >
        {fields.map((field) => (
          <option
            key={field.token}
            value={field.token}
            disabled={field.archived}
          >
            {field.label}
          </option>
        ))}
      </select>
      <select
        className="input h-9 text-xs"
        aria-label="Operador da condição"
        value={condition.operator}
        onChange={(event) =>
          onChange({
            ...condition,
            operator: event.target.value as CommissionConditionOperator,
            value: ["in", "not_in"].includes(event.target.value) ? [] : "",
          })
        }
      >
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {operatorLabels[operator]}
          </option>
        ))}
      </select>
      {needsValue ? (
        valueOptions.length > 0 ? (
          <select
            className="input h-9 text-xs"
            aria-label="Valor da condição"
            multiple={multiple}
            value={
              multiple
                ? Array.isArray(condition.value)
                  ? condition.value
                  : []
                : typeof condition.value === "string"
                  ? condition.value
                  : ""
            }
            onChange={(event) =>
              onChange({
                ...condition,
                value: multiple
                  ? Array.from(event.currentTarget.selectedOptions).map(
                      (option) => option.value,
                    )
                  : event.currentTarget.value,
              })
            }
          >
            {!multiple && <option value="">Selecione</option>}
            {valueOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input h-9 text-xs"
            aria-label="Valor da condição"
            value={
              typeof condition.value === "string"
                ? condition.value
                : (condition.value?.join(", ") ?? "")
            }
            onChange={(event) =>
              onChange({
                ...condition,
                value: multiple
                  ? event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                  : event.target.value,
              })
            }
            inputMode={
              ["number", "currency", "percentage"].includes(selected.type)
                ? "decimal"
                : undefined
            }
          />
        )
      ) : (
        <span className="flex items-center px-2 text-xs text-[var(--muted-foreground)]">
          Sem valor
        </span>
      )}
      <button
        type="button"
        className="icon-button"
        onClick={onRemove}
        aria-label="Remover condição"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function FormulaEditor({
  node,
  fields,
  onChange,
}: {
  node: CommissionFormulaNode;
  fields: FieldOption[];
  onChange: (node: CommissionFormulaNode) => void;
}) {
  const formulaFields = fields.filter((field): field is FormulaFieldOption =>
    field.reference.source === "custom"
      ? ["number", "currency", "percentage"].includes(field.type)
      : field.reference.field === "rentValueCents",
  );
  const replaceKind = (kind: CommissionFormulaNode["kind"]) => {
    if (kind === "constant")
      onChange({ kind, value: "0", valueType: "number" });
    else if (kind === "field")
      onChange({
        kind,
        field: structuredClone(formulaFields[0].reference),
        defaultValue: null,
      });
    else if (kind === "percentage") onChange(defaultFormula());
    else
      onChange({
        kind,
        operator: "add",
        left: { kind: "constant", value: "0", valueType: "currency" },
        right: { kind: "constant", value: "0", valueType: "currency" },
      });
  };

  return (
    <div className="bg-[var(--secondary)]/25 rounded-2xl border border-[var(--border)] p-3">
      <div className="flex items-center gap-2">
        <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
        <select
          className="select-compact"
          aria-label="Tipo do bloco da fórmula"
          value={node.kind}
          onChange={(event) =>
            replaceKind(event.target.value as CommissionFormulaNode["kind"])
          }
        >
          <option value="field">Campo</option>
          <option value="constant">Constante</option>
          <option value="operation">Operação</option>
          <option value="percentage">Aplicar porcentagem</option>
        </select>
      </div>
      <div className="mt-3">
        {node.kind === "constant" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="input h-9 text-xs"
              aria-label="Tipo da constante"
              value={node.valueType}
              onChange={(event) =>
                onChange({
                  ...node,
                  valueType: event.target.value as
                    "number" | "currency" | "percentage",
                })
              }
            >
              <option value="number">Número</option>
              <option value="currency">Valor em reais</option>
              <option value="percentage">Porcentagem</option>
            </select>
            <input
              className="input h-9 text-xs"
              aria-label="Valor da constante"
              inputMode="decimal"
              value={node.value}
              onChange={(event) =>
                onChange({ ...node, value: event.target.value })
              }
            />
          </div>
        )}
        {node.kind === "field" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="input h-9 text-xs"
              aria-label="Campo da fórmula"
              value={referenceToken(node.field)}
              onChange={(event) =>
                onChange({
                  ...node,
                  field: structuredClone(
                    formulaFields.find(
                      (field) => field.token === event.target.value,
                    )!.reference,
                  ),
                })
              }
            >
              {formulaFields.map((field) => (
                <option
                  key={field.token}
                  value={field.token}
                  disabled={field.archived}
                >
                  {field.label}
                </option>
              ))}
            </select>
            <input
              className="input h-9 text-xs"
              aria-label="Valor padrão para campo vazio"
              placeholder="Padrão para vazio (opcional)"
              inputMode="decimal"
              value={node.defaultValue ?? ""}
              onChange={(event) =>
                onChange({ ...node, defaultValue: event.target.value || null })
              }
            />
          </div>
        )}
        {node.kind === "operation" && (
          <>
            <label className="field-label">Operação</label>
            <select
              className="input mt-1 h-9 text-xs"
              aria-label="Operação da fórmula"
              value={node.operator}
              onChange={(event) =>
                onChange({
                  ...node,
                  operator: event.target.value as typeof node.operator,
                })
              }
            >
              <option value="add">Soma</option>
              <option value="subtract">Subtração</option>
              <option value="multiply">Multiplicação</option>
              <option value="divide">Divisão protegida</option>
              <option value="min">Mínimo</option>
              <option value="max">Máximo</option>
            </select>
            <div className="mt-3 grid gap-3">
              <FormulaEditor
                node={node.left}
                fields={fields}
                onChange={(left) => onChange({ ...node, left })}
              />
              <FormulaEditor
                node={node.right}
                fields={fields}
                onChange={(right) => onChange({ ...node, right })}
              />
            </div>
          </>
        )}
        {node.kind === "percentage" && (
          <div className="grid gap-3">
            <div>
              <span className="field-label mb-1">Valor-base</span>
              <FormulaEditor
                node={node.base}
                fields={fields}
                onChange={(base) => onChange({ ...node, base })}
              />
            </div>
            <div>
              <span className="field-label mb-1">Taxa percentual</span>
              <FormulaEditor
                node={node.rate}
                fields={fields}
                onChange={(rate) => onChange({ ...node, rate })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommissionSimulator({ ruleId }: { ruleId: string }) {
  const { data } = useBoard();
  const cards = data.cards.filter((card) => !card.archived);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [result, setResult] = useState<ReturnType<
    typeof simulateCommissionRule
  > | null>(null);
  const [error, setError] = useState("");
  const selectedCardId = cardId || cards[0]?.id || "";

  const simulate = () => {
    try {
      setResult(simulateCommissionRule(data, ruleId, selectedCardId));
      setError("");
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error ? cause.message : "Não foi possível simular.",
      );
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1">
          <span className="field-label">Card real</span>
          <select
            className="input mt-1"
            value={selectedCardId}
            onChange={(event) => setCardId(event.target.value)}
          >
            {cards.length === 0 && (
              <option value="">Nenhum card disponível</option>
            )}
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.tenantName} — {card.property}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button-primary"
          disabled={!selectedCardId}
          onClick={simulate}
        >
          <Calculator size={15} /> Simular sem gerar
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {result && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SimulationSection title="Valores lidos">
            {result.fieldValues.map((field) => (
              <SimulationRow
                key={referenceToken(field.reference)}
                label={`${field.name}${field.archived ? " (arquivado)" : ""}`}
                value={field.rawValue ?? "Não preenchido"}
                detail={field.usedDefault ? "padrão aplicado" : undefined}
              />
            ))}
          </SimulationSection>
          <SimulationSection title="Condições avaliadas">
            {result.conditions.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Regra sem condições.
              </p>
            )}
            {result.conditions.map((condition) => (
              <SimulationRow
                key={condition.conditionId}
                label={condition.field.name}
                value={
                  condition.error ??
                  (condition.matched ? "Atendida" : "Não atendida")
                }
                detail={operatorLabels[condition.operator]}
              />
            ))}
          </SimulationSection>
          <SimulationSection title="Memória da fórmula">
            {result.formulaSteps.map((step) => (
              <SimulationRow
                key={step.path}
                label={step.description}
                value={step.error ?? step.value ?? "—"}
                detail={step.path}
              />
            ))}
          </SimulationSection>
          <SimulationSection title="Resultado">
            <p className="text-2xl font-semibold">
              {result.amountCents === null
                ? "Não calculado"
                : new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(result.amountCents / 100)}
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {result.matched
                ? "Regra compatível."
                : (result.ignoredReason ?? "Regra não compatível.")}
            </p>
            {result.errors.map((message) => (
              <p key={message} className="mt-2 text-xs text-red-600">
                {message}
              </p>
            ))}
          </SimulationSection>
        </div>
      )}
    </div>
  );
}

function SimulationSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SimulationRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-2 text-xs last:border-0">
      <span>
        <strong className="block text-[var(--foreground)]">{label}</strong>
        {detail && (
          <span className="text-[var(--muted-foreground)]">{detail}</span>
        )}
      </span>
      <span className="max-w-[55%] text-right text-[var(--muted-foreground)]">
        {value}
      </span>
    </div>
  );
}

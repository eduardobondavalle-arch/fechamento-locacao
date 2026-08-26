"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  Clock3,
  ListPlus,
  Plus,
  Save,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  archiveCustomField,
  archiveList,
  createCaptor,
  createConsultant,
  createCustomField,
  createList,
  createUnit,
  deleteCaptor,
  deleteConsultant,
  deleteUnit,
  moveCustomField,
  moveList,
  renameCaptor,
  renameConsultant,
  renameUnit,
  updateCustomField,
  updateList,
} from "@/lib/domain/operations";
import type {
  AppData,
  CustomFieldDefinition,
  CustomFieldSection,
  CustomFieldType,
  DirectoryEntry,
} from "@/lib/domain/types";
import { useBoard } from "../providers/board-provider";

type SettingsTab = "columns" | "directories" | "fields";

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: "Texto",
  currency: "Valor",
  number: "Número",
  percentage: "Porcentagem",
  select: "Lista",
  attachment: "Anexo",
};

export const fieldSectionLabels: Record<CustomFieldSection, string> = {
  lease: "Informações da locação",
  tenants: "Locatários",
  residents: "Moradores",
  guarantors: "Fiadores",
  other: "Outras informações",
};

export function BoardSettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>("columns");

  return (
    <div className="page-transition h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-[1500px]">
        <div>
          <p className="label-caps mb-2 flex items-center gap-2">
            <Settings2 size={13} /> Administração do painel
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Configurações
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-[var(--muted-foreground)]">
            Organize o fluxo, os cadastros e os campos que serão exibidos em
            todos os cards.
          </p>
        </div>

        <div className="panel mt-6 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-[var(--border)] px-3 sm:px-5">
            <TabButton
              active={tab === "columns"}
              onClick={() => setTab("columns")}
            >
              Colunas e SLA
            </TabButton>
            <TabButton
              active={tab === "directories"}
              onClick={() => setTab("directories")}
            >
              Unidades e equipe
            </TabButton>
            <TabButton
              active={tab === "fields"}
              onClick={() => setTab("fields")}
            >
              Campos dos cards
            </TabButton>
          </div>
          <div className="p-4 sm:p-6">
            {tab === "columns" && <ColumnsSettings />}
            {tab === "directories" && <DirectoriesSettings />}
            {tab === "fields" && <FieldsSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnsSettings() {
  const { data, mutate } = useBoard();
  const [name, setName] = useState("");
  const [sla, setSla] = useState("");
  const lists = [...data.lists]
    .filter((list) => !list.archived)
    .sort((a, b) => a.position - b.position);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(
      (current) =>
        createList(current, { name, slaHours: sla ? Number(sla) : null }),
      { success: "Coluna adicionada." },
    );
    if (ok) {
      setName("");
      setSla("");
    }
  };

  return (
    <section>
      <h2 className="text-sm font-bold text-[var(--foreground)]">
        Colunas do Kanban
      </h2>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        O SLA começa a contar quando o card entra na coluna.
      </p>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-4 grid gap-2 rounded-xl bg-[var(--secondary)] p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="input h-9"
          placeholder="Nome da nova coluna"
          aria-label="Nome da nova coluna"
        />
        <label className="relative">
          <Clock3
            size={14}
            className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted-foreground)]"
          />
          <input
            type="number"
            min="1"
            max="8760"
            value={sla}
            onChange={(event) => setSla(event.target.value)}
            className="input h-9 pl-8"
            placeholder="SLA em horas"
            aria-label="SLA da nova coluna em horas"
          />
        </label>
        <button className="button-primary h-9" type="submit">
          <Plus size={15} /> Adicionar coluna
        </button>
      </form>
      <div className="mt-4 space-y-2">
        {lists.map((list, index) => (
          <div
            key={list.id}
            className="grid items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 sm:grid-cols-[28px_minmax(180px,1fr)_150px_auto]"
          >
            <span className="text-center font-mono text-[10px] font-bold text-[var(--muted-foreground)]">
              {index + 1}
            </span>
            <input
              defaultValue={list.name}
              key={`${list.id}:${list.name}`}
              onBlur={(event) =>
                event.target.value !== list.name &&
                void mutate(
                  (current) =>
                    updateList(current, list.id, { name: event.target.value }),
                  { success: "Coluna renomeada." },
                )
              }
              className="input h-8 min-w-0 text-xs font-semibold"
              aria-label={`Nome da coluna ${index + 1}`}
            />
            <input
              type="number"
              min="1"
              max="8760"
              defaultValue={list.slaHours ?? ""}
              key={`${list.id}:${list.slaHours ?? "none"}`}
              onBlur={(event) => {
                const value = event.target.value
                  ? Number(event.target.value)
                  : null;
                if (value !== list.slaHours)
                  void mutate(
                    (current) =>
                      updateList(current, list.id, { slaHours: value }),
                    { success: "SLA atualizado." },
                  );
              }}
              className="input h-8 text-xs"
              placeholder="Sem SLA"
              aria-label={`SLA da coluna ${list.name} em horas`}
            />
            <div className="flex justify-end gap-1">
              <IconAction
                disabled={index === 0}
                label="Mover coluna para a esquerda"
                onClick={() =>
                  void mutate((current) => moveList(current, list.id, -1), {
                    success: "Coluna reordenada.",
                  })
                }
              >
                <ArrowLeft size={14} />
              </IconAction>
              <IconAction
                disabled={index === lists.length - 1}
                label="Mover coluna para a direita"
                onClick={() =>
                  void mutate((current) => moveList(current, list.id, 1), {
                    success: "Coluna reordenada.",
                  })
                }
              >
                <ArrowRight size={14} />
              </IconAction>
              <IconAction
                label={`Excluir coluna ${list.name}`}
                danger
                onClick={() =>
                  window.confirm(
                    `Excluir a coluna “${list.name}”? A exclusão só será concluída se ela não contiver cards.`,
                  ) &&
                  void mutate((current) => archiveList(current, list.id), {
                    success: "Coluna excluída.",
                  })
                }
              >
                <Trash2 size={14} />
              </IconAction>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DirectoriesSettings() {
  const { data } = useBoard();
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <DirectorySection
        title="Unidades"
        singular="unidade"
        icon={Building2}
        entries={data.units}
        create={createUnit}
        rename={renameUnit}
        remove={deleteUnit}
      />
      <DirectorySection
        title="Consultores"
        singular="consultor"
        icon={UserRound}
        entries={data.consultants}
        create={createConsultant}
        rename={renameConsultant}
        remove={deleteConsultant}
      />
      <DirectorySection
        title="Captadores"
        singular="captador"
        icon={UserRound}
        entries={data.captors}
        create={createCaptor}
        rename={renameCaptor}
        remove={deleteCaptor}
      />
    </div>
  );
}

function FieldsSettings() {
  const { data, mutate } = useBoard();
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [section, setSection] = useState<CustomFieldSection>("lease");
  const [options, setOptions] = useState("");
  const fields = [...data.customFields]
    .filter((field) => !field.archived)
    .sort((a, b) => a.position - b.position);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(
      (current) =>
        createCustomField(current, {
          name,
          type,
          section,
          options: parseOptions(options),
        }),
      { success: "Campo adicionado a todos os cards." },
    );
    if (ok) {
      setName("");
      setOptions("");
    }
  };

  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
        <ListPlus size={16} /> Campos personalizados
      </h2>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        A configuração é global: cada campo ativo aparece automaticamente em
        todos os cards.
      </p>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-4 grid gap-3 rounded-xl bg-[var(--secondary)] p-4 md:grid-cols-4"
      >
        <label className="field-label">
          Nome do campo
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input mt-1"
            placeholder="Ex.: Renda mensal"
          />
        </label>
        <label className="field-label">
          Tipo
          <select
            value={type}
            onChange={(event) => setType(event.target.value as CustomFieldType)}
            className="input mt-1"
          >
            {Object.entries(fieldTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Seção
          <select
            value={section}
            onChange={(event) =>
              setSection(event.target.value as CustomFieldSection)
            }
            className="input mt-1"
          >
            {Object.entries(fieldSectionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="button-primary h-10 w-full">
            <Plus size={15} /> Adicionar campo
          </button>
        </div>
        {type === "select" && (
          <label className="field-label md:col-span-4">
            Itens da lista
            <textarea
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              className="input mt-1 min-h-20"
              placeholder="Um item por linha ou separado por vírgula"
            />
          </label>
        )}
      </form>
      <div className="mt-5 space-y-3">
        {fields.map((field, index) => (
          <FieldEditor
            key={field.id}
            field={field}
            index={index}
            total={fields.length}
          />
        ))}
        {fields.length === 0 && (
          <div className="empty-box">
            Nenhum campo personalizado configurado.
          </div>
        )}
      </div>
    </section>
  );
}

function FieldEditor({
  field,
  index,
  total,
}: {
  field: CustomFieldDefinition;
  index: number;
  total: number;
}) {
  const { mutate } = useBoard();
  const [name, setName] = useState(field.name);
  const [type, setType] = useState(field.type);
  const [section, setSection] = useState(field.section);
  const [options, setOptions] = useState(field.options.join("\n"));

  const save = () =>
    void mutate(
      (current) =>
        updateCustomField(current, field.id, {
          name,
          type,
          section,
          options: type === "select" ? parseOptions(options) : [],
        }),
      { success: "Campo atualizado." },
    );

  return (
    <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 lg:grid-cols-[minmax(180px,1fr)_150px_220px_auto]">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="input h-9 text-xs font-semibold"
        aria-label={`Nome do campo ${field.name}`}
      />
      <select
        value={type}
        onChange={(event) => setType(event.target.value as CustomFieldType)}
        className="input h-9 text-xs"
        aria-label={`Tipo do campo ${field.name}`}
      >
        {Object.entries(fieldTypeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={section}
        onChange={(event) =>
          setSection(event.target.value as CustomFieldSection)
        }
        className="input h-9 text-xs"
        aria-label={`Seção do campo ${field.name}`}
      >
        {Object.entries(fieldSectionLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-1">
        <IconAction label="Salvar alterações do campo" onClick={save}>
          <Save size={14} />
        </IconAction>
        <IconAction
          disabled={index === 0}
          label="Mover campo para cima"
          onClick={() =>
            void mutate((current) => moveCustomField(current, field.id, -1), {
              success: "Campo reordenado.",
            })
          }
        >
          <ArrowUp size={14} />
        </IconAction>
        <IconAction
          disabled={index === total - 1}
          label="Mover campo para baixo"
          onClick={() =>
            void mutate((current) => moveCustomField(current, field.id, 1), {
              success: "Campo reordenado.",
            })
          }
        >
          <ArrowDown size={14} />
        </IconAction>
        <IconAction
          danger
          label={`Excluir campo ${field.name}`}
          onClick={() =>
            window.confirm(
              `Remover o campo “${field.name}” de todos os cards? Os valores existentes serão preservados para auditoria.`,
            ) &&
            void mutate((current) => archiveCustomField(current, field.id), {
              success: "Campo removido dos cards.",
            })
          }
        >
          <Trash2 size={14} />
        </IconAction>
      </div>
      {type === "select" && (
        <label className="field-label lg:col-span-4">
          Itens da lista
          <textarea
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            className="input mt-1 min-h-20"
          />
        </label>
      )}
    </div>
  );
}

type DirectoryMutation = (
  source: AppData,
  itemId: string,
  name: string,
) => AppData;

function DirectorySection({
  title,
  singular,
  icon: Icon,
  entries,
  create,
  rename,
  remove,
}: {
  title: string;
  singular: string;
  icon: typeof Building2;
  entries: DirectoryEntry[];
  create: (source: AppData, name: string) => AppData;
  rename: DirectoryMutation;
  remove: (source: AppData, itemId: string) => AppData;
}) {
  const { mutate } = useBoard();
  const [name, setName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate((current) => create(current, name), {
      success: `${title.slice(0, -1)} adicionado.`,
    });
    if (ok) setName("");
  };
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
        <Icon size={16} /> {title}
      </h2>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-3 flex gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="input h-9 min-w-0 text-xs"
          placeholder={`Novo ${singular}`}
          aria-label={`Novo ${singular}`}
        />
        <button
          className="icon-button shrink-0 bg-[var(--secondary)]"
          aria-label={`Adicionar ${singular}`}
        >
          <Plus size={15} />
        </button>
      </form>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-1.5">
            <input
              defaultValue={entry.name}
              key={`${entry.id}:${entry.name}`}
              onBlur={(event) =>
                event.target.value !== entry.name &&
                void mutate(
                  (current) => rename(current, entry.id, event.target.value),
                  { success: "Cadastro renomeado." },
                )
              }
              className="input h-8 min-w-0 text-xs"
            />
            <IconAction
              danger
              label={`Excluir ${entry.name}`}
              onClick={() =>
                window.confirm(`Excluir “${entry.name}”?`) &&
                void mutate((current) => remove(current, entry.id), {
                  success: "Cadastro excluído.",
                })
              }
            >
              <Trash2 size={14} />
            </IconAction>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="empty-box">Nenhum cadastro.</div>
        )}
      </div>
    </section>
  );
}

function TabButton({
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
      onClick={onClick}
      className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold ${active ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
    >
      {children}
    </button>
  );
}

function IconAction({
  disabled,
  danger,
  label,
  onClick,
  children,
}: {
  disabled?: boolean;
  danger?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`icon-button disabled:opacity-20 ${danger ? "hover:text-rose-600" : ""}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function parseOptions(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

"use client";

import {
  Archive,
  ArrowRightLeft,
  Building2,
  Clock3,
  Download,
  FileText,
  History,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  addAttachment,
  addComment,
  deleteCard,
  removeAttachment,
  setArchived,
  setCardFieldValue,
  updateCard,
} from "@/lib/domain/operations";
import { can } from "@/lib/domain/permissions";
import { isCardSlaOverdue } from "@/lib/domain/sla";
import type {
  Activity,
  ActivityType,
  Attachment,
  Card,
  CustomFieldDefinition,
  CustomFieldSection,
} from "@/lib/domain/types";
import {
  cn,
  currencyInputToCents,
  formatBytes,
  formatCurrency,
  formatDate,
} from "@/lib/utils";
import { fieldSectionLabels } from "../board/board-settings-panel";
import { useBoard } from "../providers/board-provider";
import { Modal } from "../ui/modal";

const sectionIcons: Record<CustomFieldSection, typeof Building2> = {
  lease: Building2,
  tenants: UserRound,
  residents: UsersRound,
  guarantors: ShieldCheck,
  other: FileText,
};

const activityIcons: Record<ActivityType, typeof History> = {
  "card.created": FileText,
  "card.edited": FileText,
  "card.moved": ArrowRightLeft,
  "card.archived": Archive,
  "card.restored": RotateCcw,
  "card.deleted": Trash2,
  "custom_field.changed": FileText,
  "checklist.changed": FileText,
  "comment.added": MessageSquare,
  "attachment.added": Paperclip,
  "attachment.removed": Trash2,
};

const sections: CustomFieldSection[] = [
  "lease",
  "tenants",
  "residents",
  "guarantors",
  "other",
];

export function CardDetailModal({
  cardId,
  onClose,
}: {
  cardId: string;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useBoard();
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const card = data.cards.find((item) => item.id === cardId);
  if (!card) return null;

  const currentList = data.lists.find((list) => list.id === card.listId);
  const comments = data.comments
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const activities = data.activities
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const customFields = [...data.customFields]
    .filter((field) => !field.archived && field.boardId === card.boardId)
    .sort((a, b) => a.position - b.position);
  const titleRent =
    card.rentValueCents > 0
      ? formatCurrency(card.rentValueCents)
      : "Aluguel não informado";

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (commenting || !comment.trim()) return;
    setCommenting(true);
    try {
      const ok = await mutate(
        (current) => addComment(current, cardId, comment),
        { success: "Comentário adicionado." },
      );
      if (ok) setComment("");
    } finally {
      setCommenting(false);
    }
  };

  const upload = (fieldId: string | null, file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify("Cada anexo pode ter até 2 MB no armazenamento local.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => notify("Não foi possível ler o arquivo.", "error");
    reader.onload = () => {
      void mutate(
        (current) =>
          addAttachment(current, cardId, {
            fieldId,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storagePath: `local/${cardId}/${file.name}`,
            url: String(reader.result),
          }),
        { success: "Anexo adicionado." },
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{card.tenantName}</span>
          <span className="text-[var(--muted-foreground)]">·</span>
          <span className="truncate font-medium">{card.property}</span>
          <span className="text-[var(--muted-foreground)]">·</span>
          <span className="shrink-0 text-[var(--primary)]">{titleRent}</span>
        </span>
      }
      description={`Card em ${currentList?.name ?? "coluna não encontrada"}`}
      onClose={onClose}
      size="fullscreen"
    >
      <div className="grid min-h-0 flex-1 overflow-y-auto bg-[var(--background)] xl:grid-cols-[minmax(320px,0.85fr)_minmax(420px,1.35fr)_minmax(330px,0.9fr)] xl:overflow-hidden">
        <aside className="border-b border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 xl:overflow-y-auto xl:border-b-0 xl:border-r">
          {card.archived && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <Archive size={15} /> Este card está arquivado.
            </div>
          )}

          {sections.map((section) => {
            const fields = customFields.filter(
              (field) => field.section === section,
            );
            const isCoreSection = section === "lease" || section === "tenants";
            if (!isCoreSection && fields.length === 0) return null;
            const Icon = sectionIcons[section];
            return (
              <section key={section} className="mb-7 last:mb-0">
                <SectionTitle icon={Icon}>
                  {fieldSectionLabels[section]}
                </SectionTitle>
                <div className="space-y-3">
                  {section === "lease" && <LeaseCoreFields card={card} />}
                  {section === "tenants" && <TenantCoreFields card={card} />}
                  {fields.map((field) => (
                    <CustomFieldControl
                      key={field.id}
                      card={card}
                      field={field}
                      attachments={data.attachments.filter(
                        (attachment) =>
                          attachment.cardId === cardId &&
                          attachment.fieldId === field.id,
                      )}
                      onUpload={(file) => upload(field.id, file)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <section>
            <SectionTitle icon={FileText}>Observações</SectionTitle>
            <textarea
              defaultValue={card.description}
              key={card.description}
              onBlur={(event) =>
                event.target.value !== card.description &&
                void mutate(
                  (current) =>
                    updateCard(current, cardId, {
                      description: event.target.value,
                    }),
                  { success: "Observações salvas." },
                )
              }
              className="input min-h-28 resize-y text-sm leading-6"
              placeholder="Informações adicionais sobre a locação…"
              aria-label="Observações do card"
            />
          </section>

          {data.attachments.some(
            (attachment) =>
              attachment.cardId === cardId && attachment.fieldId === null,
          ) && (
            <section className="mt-7">
              <AttachmentField
                label="Anexos gerais"
                attachments={data.attachments.filter(
                  (attachment) =>
                    attachment.cardId === cardId && attachment.fieldId === null,
                )}
                onUpload={(file) => upload(null, file)}
              />
            </section>
          )}
        </aside>

        <main className="flex min-h-[560px] flex-col border-b border-[var(--border)] p-5 sm:p-6 xl:min-h-0 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <SectionTitle icon={MessageSquare}>Comentários</SectionTitle>
            <span className="rounded-full bg-[var(--secondary)] px-2 py-1 text-[10px] font-bold text-[var(--muted-foreground)]">
              {comments.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5 pr-1">
            {comments.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <SystemAvatar />
                <div className="min-w-0 max-w-[85%]">
                  <p className="text-xs">
                    <strong className="text-[var(--foreground)]">
                      Usuário autenticado
                    </strong>
                    <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">
                      {formatDate(entry.createdAt, true)}
                    </span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[var(--secondary)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
                    {entry.body}
                  </p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center text-center text-[var(--muted-foreground)]">
                <MessageSquare size={28} className="opacity-40" />
                <p className="mt-2 text-sm font-semibold">
                  Ainda não há comentários.
                </p>
                <p className="mt-1 text-xs">
                  Registre decisões e alinhamentos deste fechamento.
                </p>
              </div>
            )}
          </div>
          <form
            onSubmit={(event) => void submitComment(event)}
            className="border-t border-[var(--border)] pt-4"
          >
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="input min-h-24 resize-none text-sm"
              placeholder="Escreva um comentário…"
              aria-label="Novo comentário"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!comment.trim() || commenting}
                className="button-primary disabled:opacity-50"
              >
                <Send size={14} /> {commenting ? "Enviando…" : "Comentar"}
              </button>
            </div>
          </form>
        </main>

        <aside className="flex min-h-[600px] flex-col bg-[var(--card)] p-5 sm:p-6 xl:min-h-0 xl:overflow-hidden">
          <SlaPanel card={card} />
          <section className="mt-5">
            <label className="field-label">Etapa atual</label>
            <select
              value={card.listId}
              onChange={(event) =>
                void mutate(
                  (current) =>
                    updateCard(current, cardId, {
                      listId: event.target.value,
                    }),
                  { success: "Card movido." },
                )
              }
              className="input mt-1 text-xs"
              aria-label="Etapa atual"
            >
              {data.lists
                .filter((list) => !list.archived)
                .sort((a, b) => a.position - b.position)
                .map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
            </select>
          </section>

          <section className="mt-6 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-5">
            <div className="flex items-center justify-between">
              <SectionTitle icon={History}>Histórico e auditoria</SectionTitle>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {activities.length} eventos
              </span>
            </div>
            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {activities.map((entry) => (
                <ActivityEntry key={entry.id} entry={entry} />
              ))}
              {activities.length === 0 && (
                <div className="empty-box">Nenhuma atividade registrada.</div>
              )}
            </div>
          </section>

          <section className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
              <Clock3 size={12} /> Atualizado em{" "}
              {formatDate(card.updatedAt, true)}
            </p>
            {card.archived ? (
              <button
                type="button"
                disabled={!can(data, card.boardId, "archives.manage")}
                onClick={() =>
                  void mutate(
                    (current) => setArchived(current, cardId, false),
                    { success: "Card restaurado." },
                  )
                }
                className="button-secondary w-full disabled:opacity-50"
              >
                <RotateCcw size={15} /> Restaurar card
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void mutate((current) => setArchived(current, cardId, true), {
                    success: "Card arquivado.",
                  })
                }
                className="button-secondary w-full"
              >
                <Archive size={15} /> Arquivar card
              </button>
            )}
            {can(data, card.boardId, "cards.delete") && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Excluir este card permanentemente? Esta ação não pode ser desfeita.",
                    )
                  ) {
                    void mutate((current) => deleteCard(current, cardId), {
                      success: "Card excluído.",
                    });
                    onClose();
                  }
                }}
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 size={14} /> Excluir permanentemente
              </button>
            )}
          </section>
        </aside>
      </div>
    </Modal>
  );
}

function LeaseCoreFields({ card }: { card: Card }) {
  const { data, mutate } = useBoard();
  return (
    <>
      <EditField
        label="Imóvel"
        defaultValue={card.property}
        onCommit={(property) =>
          mutate((current) => updateCard(current, card.id, { property }), {
            success: "Imóvel atualizado.",
          })
        }
      />
      <EditField
        label="Valor do aluguel"
        type="number"
        step="0.01"
        min="0.01"
        defaultValue={
          card.rentValueCents > 0 ? String(card.rentValueCents / 100) : ""
        }
        onCommit={(rent) =>
          mutate(
            (current) =>
              updateCard(current, card.id, {
                rentValueCents: currencyInputToCents(rent),
              }),
            { success: "Valor do aluguel atualizado." },
          )
        }
      />
      <SelectCore
        label="Unidade"
        value={card.unitId}
        options={data.units}
        onChange={(unitId) =>
          mutate((current) => updateCard(current, card.id, { unitId }), {
            success: "Unidade atualizada.",
          })
        }
      />
      <SelectCore
        label="Consultor"
        value={card.consultantId}
        options={data.consultants}
        onChange={(consultantId) =>
          mutate((current) => updateCard(current, card.id, { consultantId }), {
            success: "Consultor atualizado.",
          })
        }
      />
      <SelectCore
        label="Captador"
        value={card.captorId}
        options={data.captors}
        onChange={(captorId) =>
          mutate((current) => updateCard(current, card.id, { captorId }), {
            success: "Captador atualizado.",
          })
        }
      />
    </>
  );
}

function TenantCoreFields({ card }: { card: Card }) {
  const { mutate } = useBoard();
  return (
    <>
      <EditField
        label="Nome completo"
        defaultValue={card.tenantName}
        onCommit={(tenantName) =>
          mutate((current) => updateCard(current, card.id, { tenantName }), {
            success: "Locatário atualizado.",
          })
        }
      />
      <EditField
        label="CPF"
        defaultValue={formatCpf(card.tenantCpf)}
        inputMode="numeric"
        onCommit={(tenantCpf) =>
          mutate((current) => updateCard(current, card.id, { tenantCpf }), {
            success: "CPF atualizado.",
          })
        }
      />
    </>
  );
}

function CustomFieldControl({
  card,
  field,
  attachments,
  onUpload,
}: {
  card: Card;
  field: CustomFieldDefinition;
  attachments: Attachment[];
  onUpload: (file?: File) => void;
}) {
  const { data, mutate } = useBoard();
  const value =
    data.cardFieldValues.find(
      (item) => item.cardId === card.id && item.fieldId === field.id,
    )?.value ?? "";
  if (field.type === "attachment") {
    return (
      <AttachmentField
        label={field.name}
        attachments={attachments}
        onUpload={onUpload}
      />
    );
  }
  const commit = (nextValue: string) =>
    nextValue !== value &&
    void mutate(
      (current) => setCardFieldValue(current, card.id, field.id, nextValue),
      { success: `${field.name} atualizado.` },
    );
  return (
    <label className="field-label">
      {field.name}
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(event) => commit(event.target.value)}
          className="input mt-1 text-xs"
        >
          <option value="">Selecione</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative mt-1">
          {field.type === "currency" && (
            <span className="pointer-events-none absolute left-3 top-2.5 text-xs text-[var(--muted-foreground)]">
              R$
            </span>
          )}
          <input
            type={field.type === "text" ? "text" : "number"}
            min={field.type === "percentage" ? "0" : undefined}
            max={field.type === "percentage" ? "100" : undefined}
            step={
              field.type === "number"
                ? "1"
                : field.type === "text"
                  ? undefined
                  : "0.01"
            }
            defaultValue={value}
            key={value}
            onBlur={(event) => commit(event.target.value)}
            className={cn("input text-xs", field.type === "currency" && "pl-9")}
            aria-label={field.name}
          />
          {field.type === "percentage" && (
            <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)]">
              %
            </span>
          )}
        </div>
      )}
    </label>
  );
}

function AttachmentField({
  label,
  attachments,
  onUpload,
}: {
  label: string;
  attachments: Attachment[];
  onUpload: (file?: File) => void;
}) {
  const { mutate } = useBoard();
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="field-label">{label}</span>
        <label className="button-secondary h-8 cursor-pointer px-2.5 text-[11px]">
          <Paperclip size={13} /> Anexar
          <input
            type="file"
            className="sr-only"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
      </div>
      <div className="mt-2 space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-2.5"
          >
            <Paperclip
              size={14}
              className="shrink-0 text-[var(--muted-foreground)]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                {attachment.filename}
              </p>
              <p className="text-[9px] text-[var(--muted-foreground)]">
                {formatBytes(attachment.size)}
              </p>
            </div>
            <a
              href={attachment.url}
              download={attachment.filename}
              className="icon-button h-7 w-7"
              aria-label={`Baixar ${attachment.filename}`}
            >
              <Download size={13} />
            </a>
            <button
              type="button"
              onClick={() =>
                void mutate(
                  (current) => removeAttachment(current, attachment.id),
                  { success: "Anexo removido." },
                )
              }
              className="icon-button h-7 w-7 hover:text-rose-600"
              aria-label={`Remover ${attachment.filename}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlaPanel({ card }: { card: Card }) {
  const { data } = useBoard();
  const list = data.lists.find((item) => item.id === card.listId);
  const overdue = list ? isCardSlaOverdue(card, list) : false;
  const dueAt =
    list?.slaHours &&
    new Date(
      new Date(card.enteredListAt).getTime() + list.slaHours * 60 * 60 * 1000,
    ).toISOString();
  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        overdue
          ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
          : "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        <Clock3 size={15} /> SLA da etapa
      </p>
      {list?.slaHours ? (
        <>
          <p className="mt-3 text-lg font-bold">
            {overdue ? "SLA extrapolado" : `${list.slaHours} horas`}
          </p>
          <p className="mt-1 text-xs opacity-75">
            Entrou em {formatDate(card.enteredListAt, true)} · limite{" "}
            {formatDate(dueAt || null, true)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Esta etapa não possui SLA configurado.
        </p>
      )}
    </section>
  );
}

function ActivityEntry({ entry }: { entry: Activity }) {
  const Icon = activityIcons[entry.type];
  const before = entry.metadata.before;
  const after = entry.metadata.after;
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
        <Icon size={13} />
      </span>
      <div className="min-w-0">
        <p className="leading-5 text-[var(--muted-foreground)]">
          <strong className="text-[var(--foreground)]">
            Usuário autenticado
          </strong>{" "}
          {entry.message}
        </p>
        {(before !== undefined || after !== undefined) && (
          <p className="mt-1 truncate rounded-lg bg-[var(--secondary)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
            {String(before || "vazio")} → {String(after || "vazio")}
          </p>
        )}
        <p className="mt-1 text-[9px] text-[var(--muted-foreground)]">
          {formatDate(entry.createdAt, true)}
        </p>
      </div>
    </div>
  );
}

function SelectCore({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => Promise<boolean>;
}) {
  return (
    <label className="field-label">
      {label}
      <select
        value={value}
        onChange={(event) => void onChange(event.target.value)}
        className="input mt-1 text-xs"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditField({
  label,
  defaultValue,
  onCommit,
  ...inputProps
}: {
  label: string;
  defaultValue: string;
  onCommit: (value: string) => Promise<boolean>;
  type?: string;
  step?: string;
  min?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label className="field-label">
      {label}
      <input
        {...inputProps}
        defaultValue={defaultValue}
        key={defaultValue}
        onBlur={(event) =>
          event.target.value !== defaultValue &&
          void onCommit(event.target.value)
        }
        className="input mt-1 text-xs"
      />
    </label>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--foreground)]">
      <Icon size={15} className="text-[var(--primary)]" /> {children}
    </h2>
  );
}

function SystemAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
      UA
    </span>
  );
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

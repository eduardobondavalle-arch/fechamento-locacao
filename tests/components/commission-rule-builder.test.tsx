import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommissionRuleBuilder,
  CommissionSimulator,
} from "@/components/commissions/commission-rule-builder";
import { CommissionPanel } from "@/components/commissions/commission-panel";
import { BoardProvider } from "@/components/providers/board-provider";
import { createInitialData } from "@/lib/domain/initial-data";
import {
  createCommissionRule,
  publishCommissionRule,
} from "@/lib/domain/operations";
import type { AppData } from "@/lib/domain/types";
import type { BoardRepository } from "@/lib/persistence/local-repository";

afterEach(cleanup);

function repository(data: AppData): BoardRepository {
  return {
    load: vi.fn().mockResolvedValue(data),
    save: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(data),
  };
}

function dataWithPublishedRule() {
  const data = createInitialData();
  const consultantId = "a0000000-0000-4000-8000-000000000001";
  const captorId = "a0000000-0000-4000-8000-000000000002";
  const cardId = "a0000000-0000-4000-8000-000000000003";
  data.consultants.push({
    id: consultantId,
    boardId: data.boards[0].id,
    name: "Ana",
  });
  data.captors.push({ id: captorId, boardId: data.boards[0].id, name: "Caio" });
  data.cards.push({
    id: cardId,
    boardId: data.boards[0].id,
    listId: data.lists[0].id,
    unitId: data.units[0].id,
    consultantId,
    captorId,
    property: "Apartamento 101",
    rentValueCents: 1_000_000,
    tenantCpf: "52998224725",
    tenantName: "Maria",
    description: "",
    position: 1024,
    archived: false,
    enteredListAt: "2026-08-25T10:00:00.000Z",
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
    version: 1,
  });
  const created = createCommissionRule(data, {
    name: "Comissão integral",
    description: "",
    beneficiarySource: "consultant",
    beneficiaryRole: "Consultor",
    priority: 10,
    exclusive: true,
    validFrom: null,
    validTo: null,
    conditions: { kind: "group", id: "root", combinator: "and", children: [] },
    formula: {
      kind: "field",
      field: { source: "native", field: "rentValueCents" },
      defaultValue: null,
    },
  });
  return {
    data: publishCommissionRule(created.data, created.ruleId),
    ruleId: created.ruleId,
  };
}

describe("construtor e simulador de comissão", () => {
  it("exibe somente as abas por tipo e os filtros solicitados", async () => {
    const source = dataWithPublishedRule();
    render(
      <BoardProvider repository={repository(source.data)}>
        <CommissionPanel />
      </BoardProvider>,
    );

    await screen.findByRole("heading", { name: "Comissionamento" });
    expect(
      screen.getByRole("tab", { name: "Comissões de captação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Comissões de locação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir comissões de Caio" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir comissões de Ana" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("tab", { name: "Comissões de locação" }),
    );
    expect(
      screen.getByRole("button", { name: "Abrir comissões de Ana" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir comissões de Caio" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por unidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por consultor")).toBeInTheDocument();
    expect(screen.getByLabelText("Período inicial")).toBeInTheDocument();
    expect(screen.getByLabelText("Período final")).toBeInTheDocument();
    expect(screen.queryByText("Total calculado")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar comissões")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filtrar por captador"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filtrar por status"),
    ).not.toBeInTheDocument();
  });

  it("monta visualmente grupos e operações sem código livre", async () => {
    render(
      <BoardProvider repository={repository(createInitialData())}>
        <CommissionRuleBuilder ruleId={null} onClose={() => undefined} />
      </BoardProvider>,
    );
    await screen.findByLabelText("Nome da regra");
    await userEvent.click(screen.getByRole("button", { name: /Grupo E\/OU/i }));
    expect(screen.getAllByLabelText("Combinação do grupo")).toHaveLength(2);
    const blockTypes = screen.getAllByLabelText("Tipo do bloco da fórmula");
    await userEvent.selectOptions(blockTypes[0], "operation");
    expect(screen.getByLabelText("Operação da fórmula")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /javascript|sql/i }),
    ).not.toBeInTheDocument();
  });

  it("simula um card real e exibe a memória sem persistir alterações", async () => {
    const source = dataWithPublishedRule();
    const boardRepository = repository(source.data);
    render(
      <BoardProvider repository={boardRepository}>
        <CommissionSimulator ruleId={source.ruleId} />
      </BoardProvider>,
    );
    await screen.findByRole("button", { name: /Simular sem gerar/i });
    await userEvent.click(
      screen.getByRole("button", { name: /Simular sem gerar/i }),
    );
    expect(await screen.findByText(/10\.000,00/)).toBeInTheDocument();
    expect(boardRepository.save).not.toHaveBeenCalled();
  });
});

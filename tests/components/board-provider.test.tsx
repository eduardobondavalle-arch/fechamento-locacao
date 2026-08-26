import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardProvider, useBoard } from "@/components/providers/board-provider";
import { createInitialData, initialLists } from "@/lib/domain/initial-data";
import {
  createCaptor,
  createCard,
  createConsultant,
  moveCard,
} from "@/lib/domain/operations";
import type { BoardRepository } from "@/lib/persistence/local-repository";

function sourceWithCard() {
  let data = createInitialData();
  data = createConsultant(data, "Consultor Operacional");
  data = createCaptor(data, "Captador Operacional");
  return createCard(data, {
    listId: initialLists[0].id,
    unitId: data.units[0].id,
    consultantId: data.consultants[0].id,
    captorId: data.captors[0].id,
    property: "Apartamento 101",
    rentValueCents: 325000,
    tenantCpf: "529.982.247-25",
    tenantName: "Maria da Silva",
  }).data;
}

function Probe() {
  const { data, ready, mutate, toast } = useBoard();
  const card = data.cards[0];
  if (!ready) return <p>carregando</p>;
  return (
    <div>
      <span data-testid="list">{card.listId}</span>
      <button
        type="button"
        onClick={() =>
          void mutate(
            (current) => moveCard(current, card.id, initialLists[1].id),
            { optimistic: true },
          )
        }
      >
        Mover
      </button>
      {toast && <div role="alert">{toast.message}</div>}
    </div>
  );
}

describe("BoardProvider", () => {
  it("desfaz o movimento otimista e exibe erro quando a persistência falha", async () => {
    const source = sourceWithCard();
    const repository: BoardRepository = {
      load: vi.fn().mockResolvedValue(source),
      save: vi.fn().mockRejectedValue(new Error("Banco indisponível")),
      reset: vi.fn().mockResolvedValue(source),
    };
    render(
      <BoardProvider repository={repository}>
        <Probe />
      </BoardProvider>,
    );
    await screen.findByRole("button", { name: "Mover" });
    await userEvent.click(screen.getByRole("button", { name: "Mover" }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByTestId("list")).toHaveTextContent(initialLists[0].id),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Alteração desfeita.*Banco indisponível/i,
    );
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { createInitialData } from "@/lib/domain/initial-data";
import { LocalBoardRepository } from "@/lib/persistence/local-repository";

describe("migração do repositório local", () => {
  beforeEach(() => window.localStorage.clear());

  it("migra o schema v3 para v4 sem alterar dados existentes", async () => {
    const current = createInitialData();
    const legacy = {
      ...current,
      schemaVersion: 3,
      cards: [
        {
          id: "b0000000-0000-4000-8000-000000000001",
          boardId: current.boards[0].id,
          listId: current.lists[0].id,
          unitId: current.units[0].id,
          consultantId: "consultor-preservado",
          captorId: "captador-preservado",
          property: "Imóvel preservado",
          rentValueCents: 450000,
          tenantCpf: "52998224725",
          tenantName: "Locatário preservado",
          description: "",
          position: 1024,
          archived: false,
          enteredListAt: "2026-08-25T10:00:00.000Z",
          createdAt: "2026-08-25T10:00:00.000Z",
          updatedAt: "2026-08-25T10:00:00.000Z",
          version: 1,
        },
      ],
    } as Record<string, unknown>;
    delete legacy.commissionRules;
    delete legacy.commissionRuleVersions;
    delete legacy.commissionCalculations;
    delete legacy.commissionStatusHistory;
    delete legacy.commissionAdjustments;
    window.localStorage.setItem(
      "fechamento-locacao:v3",
      JSON.stringify(legacy),
    );

    const loaded = await new LocalBoardRepository().load();

    expect(loaded.schemaVersion).toBe(4);
    expect(loaded.cards[0]).toMatchObject({
      property: "Imóvel preservado",
      rentValueCents: 450000,
    });
    expect(loaded.commissionRules).toEqual([]);
    expect(loaded.commissionCalculations).toEqual([]);
    expect(window.localStorage.getItem("fechamento-locacao:v3")).toBeNull();
    expect(window.localStorage.getItem("fechamento-locacao:v4")).not.toBeNull();
  });
});

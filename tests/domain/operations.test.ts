import { describe, expect, it } from "vitest";
import { filterCards } from "@/lib/domain/filters";
import { createInitialData, initialLists } from "@/lib/domain/initial-data";
import {
  addComment,
  archiveList,
  createCaptor,
  createCard,
  createConsultant,
  createCustomField,
  createList,
  createUnit,
  deleteConsultant,
  moveCard,
  renameConsultant,
  setCardFieldValue,
  setArchived,
  updateList,
} from "@/lib/domain/operations";
import { isCardSlaOverdue } from "@/lib/domain/sla";
import { EMPTY_FILTERS, type AppData } from "@/lib/domain/types";

function configuredData(): AppData {
  let data = createInitialData();
  data = createConsultant(data, "Consultor Operacional");
  data = createCaptor(data, "Captador Operacional");
  return data;
}

function cardInput(data: AppData, listId = initialLists[0].id) {
  return {
    listId,
    unitId: data.units[0].id,
    consultantId: data.consultants[0].id,
    captorId: data.captors[0].id,
    property: "Apartamento 101",
    rentValueCents: 325000,
    tenantCpf: "529.982.247-25",
    tenantName: "Maria da Silva",
  };
}

describe("operações do quadro", () => {
  it("inicia sem pessoas, cards ou atividades fictícias", () => {
    const data = createInitialData();
    expect(data.schemaVersion).toBe(4);
    expect(data.profiles).toEqual([]);
    expect(data.cards).toEqual([]);
    expect(data.activities).toEqual([]);
    expect(data.consultants).toEqual([]);
    expect(data.captors).toEqual([]);
  });

  it("cria um fechamento com os campos obrigatórios e registra atividade", () => {
    const source = configuredData();
    const result = createCard(source, cardInput(source));
    const card = result.data.cards.find((item) => item.id === result.cardId);
    expect(card).toMatchObject({
      tenantName: "Maria da Silva",
      tenantCpf: "52998224725",
      property: "Apartamento 101",
      rentValueCents: 325000,
      unitId: source.units[0].id,
      consultantId: source.consultants[0].id,
      captorId: source.captors[0].id,
    });
    expect(result.data.activities[0].type).toBe("card.created");
  });

  it("rejeita CPF inválido", () => {
    const source = configuredData();
    expect(() =>
      createCard(source, { ...cardInput(source), tenantCpf: "111.111.111-11" }),
    ).toThrow(/CPF válido/i);
  });

  it("exige um valor de aluguel positivo", () => {
    const source = configuredData();
    expect(() =>
      createCard(source, { ...cardInput(source), rentValueCents: 0 }),
    ).toThrow(/valor do aluguel/i);
  });

  it("cria campos globais e registra alterações no histórico do card", () => {
    let source = configuredData();
    source = createCustomField(source, {
      name: "Nome do fiador",
      type: "text",
      section: "guarantors",
      options: [],
    });
    const created = createCard(source, cardInput(source));
    const field = created.data.customFields[0];
    const updated = setCardFieldValue(
      created.data,
      created.cardId,
      field.id,
      "Carlos da Silva",
    );
    expect(updated.cardFieldValues[0]).toMatchObject({
      cardId: created.cardId,
      fieldId: field.id,
      value: "Carlos da Silva",
    });
    expect(updated.activities[0]).toMatchObject({
      type: "custom_field.changed",
      message: "alterou Nome do fiador",
    });
  });

  it("valida os itens de campos do tipo lista", () => {
    const source = configuredData();
    expect(() =>
      createCustomField(source, {
        name: "Tipo de garantia",
        type: "select",
        section: "guarantors",
        options: [],
      }),
    ).toThrow(/item/i);
  });

  it("reinicia o SLA quando o card muda de coluna", () => {
    const source = configuredData();
    const created = createCard(source, cardInput(source));
    created.data.cards[0].enteredListAt = "2020-01-01T00:00:00.000Z";
    const next = moveCard(created.data, created.cardId, initialLists[1].id);
    const moved = next.cards.find((item) => item.id === created.cardId)!;
    expect(moved.listId).toBe(initialLists[1].id);
    expect(moved.enteredListAt).not.toBe("2020-01-01T00:00:00.000Z");
    expect(next.activities[0].type).toBe("card.moved");
  });

  it("reordena dentro da mesma coluna sem reiniciar o SLA", () => {
    let source = configuredData();
    const first = createCard(source, cardInput(source));
    source = first.data;
    const second = createCard(source, {
      ...cardInput(source),
      tenantName: "Joana de Souza",
      tenantCpf: "168.995.350-09",
    });
    const enteredListAt = second.data.cards.find(
      (item) => item.id === second.cardId,
    )!.enteredListAt;
    const next = moveCard(
      second.data,
      second.cardId,
      initialLists[0].id,
      first.cardId,
    );
    expect(
      next.cards.find((item) => item.id === second.cardId)?.enteredListAt,
    ).toBe(enteredListAt);
  });

  it("identifica um card com SLA extrapolado", () => {
    const source = configuredData();
    const created = createCard(source, cardInput(source));
    const card = created.data.cards[0];
    const list = { ...created.data.lists[0], slaHours: 24 };
    card.enteredListAt = "2026-08-20T12:00:00.000Z";
    expect(
      isCardSlaOverdue(card, list, new Date("2026-08-22T12:00:01.000Z")),
    ).toBe(true);
    expect(
      isCardSlaOverdue(card, list, new Date("2026-08-21T11:59:59.000Z")),
    ).toBe(false);
  });

  it("cria, renomeia, configura SLA e exclui uma coluna vazia", () => {
    let data = createList(createInitialData(), {
      name: "Nova etapa",
      slaHours: 12,
    });
    const list = data.lists.at(-1)!;
    data = updateList(data, list.id, { name: "Etapa revisada", slaHours: 24 });
    expect(data.lists.find((item) => item.id === list.id)).toMatchObject({
      name: "Etapa revisada",
      slaHours: 24,
    });
    data = archiveList(data, list.id);
    expect(data.lists.find((item) => item.id === list.id)?.archived).toBe(true);
  });

  it("impede excluir uma coluna que contém cards", () => {
    const source = configuredData();
    const created = createCard(source, cardInput(source));
    expect(() => archiveList(created.data, initialLists[0].id)).toThrow(
      /mova.*cards/i,
    );
  });

  it("gerencia consultores e protege cadastros em uso", () => {
    let data = configuredData();
    const consultantId = data.consultants[0].id;
    data = renameConsultant(data, consultantId, "Consultor Atualizado");
    expect(data.consultants[0].name).toBe("Consultor Atualizado");
    const created = createCard(data, cardInput(data));
    expect(() => deleteConsultant(created.data, consultantId)).toThrow(
      /vinculado/i,
    );
    expect(createUnit(data, "Porto Belo").units).toHaveLength(3);
  });

  it("filtra por unidade, consultor, captador e texto", () => {
    let data = configuredData();
    data = createConsultant(data, "Outro Consultor");
    data = createCaptor(data, "Outro Captador");
    const first = createCard(data, cardInput(data));
    const second = createCard(first.data, {
      ...cardInput(first.data),
      unitId: first.data.units[1].id,
      consultantId: first.data.consultants[1].id,
      captorId: first.data.captors[1].id,
      tenantCpf: "168.995.350-09",
      tenantName: "Joana de Souza",
    });
    expect(
      filterCards(second.data, {
        ...EMPTY_FILTERS,
        unitId: second.data.units[1].id,
      }),
    ).toHaveLength(1);
    expect(
      filterCards(second.data, {
        ...EMPTY_FILTERS,
        consultantId: second.data.consultants[0].id,
      }),
    ).toHaveLength(1);
    expect(
      filterCards(second.data, {
        ...EMPTY_FILTERS,
        captorId: second.data.captors[1].id,
      }),
    ).toHaveLength(1);
    expect(
      filterCards(second.data, { ...EMPTY_FILTERS, query: "Joana" }),
    ).toHaveLength(1);
  });

  it("mantém comentários e arquivamento com autorização", () => {
    const source = configuredData();
    const created = createCard(source, cardInput(source));
    const commented = addComment(
      created.data,
      created.cardId,
      "Documentação revisada.",
    );
    const archived = setArchived(commented, created.cardId, true);
    expect(archived.comments.at(-1)?.body).toBe("Documentação revisada.");
    expect(archived.cards[0].archived).toBe(true);
  });
});

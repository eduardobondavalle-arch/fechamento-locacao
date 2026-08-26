import type { AppData, Card, CardFilters } from "./types";

export function filterCards(data: AppData, filters: CardFilters): Card[] {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");

  return data.cards.filter((card) => {
    if (card.archived) return false;
    if (filters.unitId && card.unitId !== filters.unitId) return false;
    if (filters.consultantId && card.consultantId !== filters.consultantId)
      return false;
    if (filters.captorId && card.captorId !== filters.captorId) return false;

    if (query) {
      const unit =
        data.units.find((item) => item.id === card.unitId)?.name ?? "";
      const consultant =
        data.consultants.find((item) => item.id === card.consultantId)?.name ??
        "";
      const captor =
        data.captors.find((item) => item.id === card.captorId)?.name ?? "";
      const haystack =
        `${card.tenantName} ${card.tenantCpf} ${card.property} ${unit} ${consultant} ${captor}`.toLocaleLowerCase(
          "pt-BR",
        );
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

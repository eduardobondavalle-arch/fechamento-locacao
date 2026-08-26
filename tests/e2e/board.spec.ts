import { expect, test, type Page } from "@playwright/test";

async function resetLocalData(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function configureTeam(page: Page) {
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("button", { name: "Unidades e equipe" }).click();
  await page.getByLabel("Novo consultor").fill("Consultor Operacional");
  await page.getByRole("button", { name: "Adicionar consultor" }).click();
  await page.getByLabel("Novo captador").fill("Captador Operacional");
  await page.getByRole("button", { name: "Adicionar captador" }).click();
  await page.getByRole("button", { name: "Fechamentos" }).click();
}

async function addClosing(page: Page) {
  await page.getByRole("button", { name: "Adicionar fechamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Unidade", { exact: true })
    .selectOption({ label: "Itapema" });
  await dialog
    .getByLabel("Consultor", { exact: true })
    .selectOption({ label: "Consultor Operacional" });
  await dialog
    .getByLabel("Captador", { exact: true })
    .selectOption({ label: "Captador Operacional" });
  await dialog.getByLabel("Imóvel").fill("Apartamento 101 - Centro");
  await dialog.getByLabel("Valor do aluguel").fill("3250.50");
  await dialog.getByLabel("CPF do locatário").fill("529.982.247-25");
  await dialog.getByLabel("Nome completo do locatário").fill("Maria da Silva");
  await dialog
    .getByRole("button", { name: "Adicionar fechamento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("R$ 3.250,50");
}

test("abre direto no Kanban sem login e sem dados fictícios", async ({
  page,
}) => {
  await resetLocalData(page);
  await expect(
    page.getByText("Fechamento Locação", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Marina Costa/i })).toHaveCount(
    0,
  );
  await expect(page.getByText(/ANA MARTINS/i)).toHaveCount(0);
  await expect(
    page
      .getByLabel("Quadro Kanban de fechamento de locação")
      .locator("section"),
  ).toHaveCount(14);
  await expect(
    page.getByRole("button", { name: "Adicionar fechamento" }),
  ).toBeVisible();
});

test("configura equipe, adiciona fechamento e mantém os dados após atualizar", async ({
  page,
}) => {
  await resetLocalData(page);
  await configureTeam(page);
  await addClosing(page);
  await page.screenshot({
    path: "test-results/closing-detail.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fechar diálogo" }).click();
  await expect(page.getByText("Maria da Silva", { exact: true })).toBeVisible();

  await page
    .getByLabel("Filtrar por unidade")
    .selectOption({ label: "Itapema" });
  await expect(page.getByText("Maria da Silva", { exact: true })).toBeVisible();
  await page
    .getByLabel("Filtrar por unidade")
    .selectOption({ label: "Balneário Camboriú" });
  await expect(page.getByText("Maria da Silva", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Filtrar por unidade").selectOption("");

  await page.reload();
  await expect(page.getByText("Maria da Silva", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const key = "fechamento-locacao:v4";
    const data = JSON.parse(localStorage.getItem(key) ?? "null") as {
      lists: Array<{ id: string; slaHours: number | null }>;
      cards: Array<{ listId: string; enteredListAt: string }>;
    } | null;
    if (!data?.cards[0] || !data.lists[0]) return;
    data.lists[0].slaHours = 1;
    data.cards[0].enteredListAt = "2020-01-01T00:00:00.000Z";
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('[aria-label="SLA atrasado"]')).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-sla.png",
    fullPage: true,
  });
});

test("adiciona, renomeia e exclui uma coluna com SLA", async ({ page }) => {
  await resetLocalData(page);
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByLabel("Nome da nova coluna").fill("ANÁLISE DOCUMENTAL");
  await page.getByLabel("SLA da nova coluna em horas").fill("12");
  await page.getByRole("button", { name: "Adicionar coluna" }).click();
  await expect(
    page.getByLabel("SLA da coluna ANÁLISE DOCUMENTAL em horas"),
  ).toHaveValue("12");
  await page.getByLabel("Nome da coluna 15").fill("ANÁLISE FINAL");
  await page.getByLabel("Nome da coluna 15").blur();
  await expect(
    page.getByLabel("SLA da coluna ANÁLISE FINAL em horas"),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Excluir coluna ANÁLISE FINAL" })
    .click();
  await expect(page.getByLabel("Nome da coluna 15")).toHaveCount(0);
});

test("configura um campo global e audita o valor no card fullscreen", async ({
  page,
}) => {
  await resetLocalData(page);
  await configureTeam(page);
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("button", { name: "Campos dos cards" }).click();
  await page.getByLabel("Nome do campo").fill("Nome do fiador");
  await page.getByLabel("Seção").selectOption("guarantors");
  await page.getByRole("button", { name: "Adicionar campo" }).click();
  await page.screenshot({
    path: "test-results/card-fields-settings.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fechamentos" }).click();
  await addClosing(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Fiadores", { exact: true })).toBeVisible();
  await dialog.getByLabel("Nome do fiador").fill("Carlos da Silva");
  await dialog.getByLabel("Nome do fiador").blur();
  await expect(dialog.getByText("alterou Nome do fiador")).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
    )
    .toEqual({ width: 1280, height: 720 });
});

test("alterna e mantém o modo escuro com o glow atrás do conteúdo", async ({
  page,
}) => {
  await resetLocalData(page);
  await page.getByRole("button", { name: "Ativar modo escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".background-glow")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".background-glow")).toBeVisible();
});

test("rola o quadro automaticamente pelas duas bordas", async ({ page }) => {
  await resetLocalData(page);
  const board = page.getByLabel("Quadro Kanban de fechamento de locação");
  const bounds = await board.boundingBox();
  if (!bounds) throw new Error("Não foi possível localizar o quadro Kanban.");

  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
  );
  await expect
    .poll(() => board.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);

  const scrollAfterRightEdge = await board.evaluate(
    (element) => element.scrollLeft,
  );
  await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
  await expect
    .poll(() => board.evaluate((element) => element.scrollLeft))
    .toBeLessThan(scrollAfterRightEdge);
});

test("cria, simula, gera e paga uma comissão preservando o Kanban", async ({
  page,
}) => {
  await resetLocalData(page);
  await configureTeam(page);
  await addClosing(page);
  await page.getByRole("button", { name: "Fechar diálogo" }).click();

  await page.getByRole("button", { name: "Comissionamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Comissionamento" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Regras de comissão" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nova regra" })
    .click();
  const builder = page.getByRole("dialog");
  await builder.getByLabel("Nome da regra").fill("Comissão padrão de teste");
  await builder.getByLabel("Valor da constante").fill("10");
  await builder.getByRole("button", { name: "Salvar rascunho" }).click();

  await page.getByRole("button", { name: "Regras de comissão" }).click();
  const rules = page.getByRole("dialog");
  await rules.getByRole("button", { name: "Publicar" }).click();
  await expect(rules.getByText(/Publicada · v1/)).toBeVisible();
  await rules.getByRole("button", { name: "Simular" }).click();
  const simulator = page.getByRole("dialog");
  await simulator.getByRole("button", { name: "Simular sem gerar" }).click();
  await expect(simulator.getByText(/325,05/)).toBeVisible();
  await simulator.getByRole("button", { name: "Fechar diálogo" }).click();

  await page.getByRole("button", { name: "Calcular comissões" }).click();
  const generation = page.getByRole("dialog");
  await generation.getByRole("button", { name: "Gerar prévia" }).click();
  await expect(generation.getByText(/325,05/)).toBeVisible();
  await generation.getByRole("button", { name: "Confirmar geração" }).click();
  await page.getByRole("tab", { name: "Comissões de locação" }).click();
  await page
    .getByRole("button", {
      name: "Abrir comissões de Consultor Operacional",
    })
    .click();
  const resultsTable = page.getByRole("table");
  await expect(
    resultsTable.getByText("Calculada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(
    resultsTable.getByText("Aprovada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Marcar paga" }).click();
  await expect(resultsTable.getByText("Paga", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Comissionamento" }).click();
  await page.getByRole("tab", { name: "Comissões de locação" }).click();
  await page
    .getByRole("button", {
      name: "Abrir comissões de Consultor Operacional",
    })
    .click();
  await expect(
    page.getByRole("table").getByText("Paga", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar diálogo" }).click();
  await page.getByRole("button", { name: "Fechamentos" }).click();
  await expect(page.getByText("Maria da Silva", { exact: true })).toBeVisible();
  await expect(
    page
      .getByLabel("Quadro Kanban de fechamento de locação")
      .locator("section"),
  ).toHaveCount(14);
});

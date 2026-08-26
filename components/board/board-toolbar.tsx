"use client";

import {
  Building2,
  Filter,
  KanbanSquare,
  Plus,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { ADIM_LOGO_SRC } from "@/lib/brand/adim-logo";
import type { CardFilters } from "@/lib/domain/types";
import { useBoard } from "../providers/board-provider";
import { ThemeToggle } from "../theme/theme-toggle";

export function BoardToolbar({
  filters,
  onFiltersChange,
  activeView,
  onViewChange,
  onAddClosing,
}: {
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
  activeView: "board" | "settings";
  onViewChange: (view: "board" | "settings") => void;
  onAddClosing: () => void;
}) {
  const { data } = useBoard();
  const board = data.boards[0];
  const filterCount = [
    filters.unitId,
    filters.consultantId,
    filters.captorId,
  ].filter(Boolean).length;

  return (
    <>
      <header className="glass sticky top-0 z-30 border-b border-[color-mix(in_oklab,var(--border)_60%,transparent)]">
        <div className="mx-auto flex min-h-16 max-w-[1800px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={ADIM_LOGO_SRC}
              alt="Adim Aluguéis"
              className="h-8 w-auto shrink-0 object-contain"
              width={277}
              height={122}
              unoptimized
              priority
            />
            <span className="hidden h-8 w-px shrink-0 bg-[var(--border)] sm:block" />
            <span className="label-caps hidden truncate sm:block">
              Gestão de locações
            </span>
          </div>

          <nav
            className="ml-1 flex items-center rounded-full border border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-[color-mix(in_oklab,var(--secondary)_50%,transparent)] p-1 sm:ml-2"
            aria-label="Navegação principal"
          >
            <NavButton
              active={activeView === "board"}
              onClick={() => onViewChange("board")}
              icon={KanbanSquare}
            >
              Fechamentos
            </NavButton>
            <NavButton
              active={activeView === "settings"}
              onClick={() => onViewChange("settings")}
              icon={Settings2}
            >
              Configurações
            </NavButton>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {activeView === "board" && (
              <button
                type="button"
                onClick={onAddClosing}
                className="button-primary press h-10 px-3 text-xs sm:px-4"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Adicionar fechamento</span>
                <span className="sm:hidden">Adicionar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {activeView === "board" && (
        <div className="page-transition relative z-20 px-4 pt-6 sm:px-6 sm:pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="label-caps mb-2 flex items-center gap-2">
                <UserRound size={13} /> Operação de contratos
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {board.name}
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
                {board.description}. Acompanhe cada fechamento até a entrega das
                chaves.
              </p>
            </div>
          </div>

          <div className="panel mt-5 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full min-w-52 flex-1 lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted-foreground)]"
                  size={16}
                />
                <input
                  value={filters.query}
                  onChange={(event) =>
                    onFiltersChange({ ...filters, query: event.target.value })
                  }
                  className="input h-9 pl-9 pr-8"
                  placeholder="Buscar cards…"
                  aria-label="Buscar cards"
                />
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, query: "" })}
                    className="absolute right-2 top-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    aria-label="Limpar busca"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                <Filter size={14} /> Filtros
                {filterCount > 0 && (
                  <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--primary-foreground)]">
                    {filterCount}
                  </span>
                )}
              </span>
              <label className="relative">
                <Building2
                  size={13}
                  className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted-foreground)]"
                />
                <select
                  className="select-compact min-w-40 pl-8"
                  value={filters.unitId}
                  onChange={(event) =>
                    onFiltersChange({ ...filters, unitId: event.target.value })
                  }
                  aria-label="Filtrar por unidade"
                >
                  <option value="">Todas as unidades</option>
                  {data.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <select
                className="select-compact min-w-40"
                value={filters.consultantId}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    consultantId: event.target.value,
                  })
                }
                aria-label="Filtrar por consultor"
              >
                <option value="">Todos os consultores</option>
                {data.consultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.name}
                  </option>
                ))}
              </select>
              <select
                className="select-compact min-w-40"
                value={filters.captorId}
                onChange={(event) =>
                  onFiltersChange({ ...filters, captorId: event.target.value })
                }
                aria-label="Filtrar por captador"
              >
                <option value="">Todos os captadores</option>
                {data.captors.map((captor) => (
                  <option key={captor.id} value={captor.id}>
                    {captor.name}
                  </option>
                ))}
              </select>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onFiltersChange({
                      query: filters.query,
                      unitId: "",
                      consultantId: "",
                      captorId: "",
                    })
                  }
                  className="button-ghost"
                >
                  <X size={14} /> Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof KanbanSquare;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`press flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-[var(--glass-strong)] text-[var(--foreground)] shadow-sm backdrop-blur-xl"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon size={17} /> <span className="hidden md:inline">{children}</span>
    </button>
  );
}

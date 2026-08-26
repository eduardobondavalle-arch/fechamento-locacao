import { createInitialData } from "../domain/initial-data";
import type { AppData } from "../domain/types";

const STORAGE_KEY = "fechamento-locacao:v4";
const LEGACY_V3_STORAGE_KEY = "fechamento-locacao:v3";
const LEGACY_V2_STORAGE_KEY = "fechamento-locacao:v2";
const LEGACY_V1_STORAGE_KEY = "fechamento-locacao:v1";

function migrateV2(raw: string): AppData | null {
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown> & {
      schemaVersion?: number;
      cards?: Array<Record<string, unknown>>;
      attachments?: Array<Record<string, unknown>>;
    };
    if (legacy.schemaVersion !== 2) return null;
    return {
      ...legacy,
      schemaVersion: 4,
      cards: (legacy.cards ?? []).map((card) => ({
        ...card,
        rentValueCents: 0,
      })),
      attachments: (legacy.attachments ?? []).map((attachment) => ({
        ...attachment,
        fieldId: null,
      })),
      customFields: [],
      cardFieldValues: [],
      commissionRules: [],
      commissionRuleVersions: [],
      commissionCalculations: [],
      commissionStatusHistory: [],
      commissionAdjustments: [],
    } as unknown as AppData;
  } catch {
    return null;
  }
}

function migrateV3(raw: string): AppData | null {
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown> & {
      schemaVersion?: number;
    };
    if (legacy.schemaVersion !== 3) return null;
    return {
      ...legacy,
      schemaVersion: 4,
      commissionRules: [],
      commissionRuleVersions: [],
      commissionCalculations: [],
      commissionStatusHistory: [],
      commissionAdjustments: [],
    } as unknown as AppData;
  } catch {
    return null;
  }
}

export interface BoardRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  reset(): Promise<AppData>;
}

export class LocalBoardRepository implements BoardRepository {
  async load(): Promise<AppData> {
    window.localStorage.removeItem(LEGACY_V1_STORAGE_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppData;
        if (parsed.schemaVersion === 4) return parsed;
      } catch {
        // A estrutura inválida é substituída pela configuração inicial abaixo.
      }
    }

    const legacyV3Raw = window.localStorage.getItem(LEGACY_V3_STORAGE_KEY);
    if (legacyV3Raw) {
      const migrated = migrateV3(legacyV3Raw);
      if (migrated) {
        await this.save(migrated);
        window.localStorage.removeItem(LEGACY_V3_STORAGE_KEY);
        return migrated;
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_V2_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateV2(legacyRaw);
      if (migrated) {
        await this.save(migrated);
        window.localStorage.removeItem(LEGACY_V2_STORAGE_KEY);
        return migrated;
      }
    }
    return createInitialData();
  }

  async save(data: AppData): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async reset(): Promise<AppData> {
    const data = createInitialData();
    await this.save(data);
    return data;
  }
}

export const localBoardRepository = new LocalBoardRepository();

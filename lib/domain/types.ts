import type {
  CommissionAdjustment,
  CommissionCalculation,
  CommissionRule,
  CommissionRuleVersion,
  CommissionStatusHistory,
} from "./commissions/types";

export type {
  CommissionAdjustment,
  CommissionCalculation,
  CommissionRule,
  CommissionRuleVersion,
  CommissionStatusHistory,
} from "./commissions/types";

export type Role = "admin" | "member";

export type Profile = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
};

export type Board = {
  id: string;
  name: string;
  description: string;
};

export type BoardMember = {
  boardId: string;
  profileId: string;
  role: Role;
};

export type BoardList = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  completedState: boolean;
  archived: boolean;
  slaHours: number | null;
};

export type DirectoryEntry = {
  id: string;
  boardId: string;
  name: string;
};

export type Unit = DirectoryEntry;
export type Consultant = DirectoryEntry;
export type Captor = DirectoryEntry;

export type CustomFieldType =
  "text" | "currency" | "number" | "percentage" | "select" | "attachment";

export type CustomFieldSection =
  "lease" | "tenants" | "residents" | "guarantors" | "other";

export type CustomFieldDefinition = {
  id: string;
  boardId: string;
  name: string;
  type: CustomFieldType;
  section: CustomFieldSection;
  options: string[];
  position: number;
  archived: boolean;
};

export type CardFieldValue = {
  cardId: string;
  fieldId: string;
  value: string;
  updatedAt: string;
};

export type Card = {
  id: string;
  boardId: string;
  listId: string;
  unitId: string;
  consultantId: string;
  captorId: string;
  property: string;
  rentValueCents: number;
  tenantCpf: string;
  tenantName: string;
  description: string;
  position: number;
  archived: boolean;
  enteredListAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ChecklistTemplate = {
  id: string;
  boardId: string;
  name: string;
  items: string[];
};

export type Checklist = {
  id: string;
  cardId: string;
  name: string;
  position: number;
};

export type ChecklistItem = {
  id: string;
  checklistId: string;
  title: string;
  position: number;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
};

export type Comment = {
  id: string;
  cardId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  cardId: string;
  fieldId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url: string;
  uploaderId: string;
  createdAt: string;
};

export type ActivityType =
  | "card.created"
  | "card.edited"
  | "card.moved"
  | "card.archived"
  | "card.restored"
  | "card.deleted"
  | "custom_field.changed"
  | "checklist.changed"
  | "comment.added"
  | "attachment.added"
  | "attachment.removed";

export type Activity = {
  id: string;
  boardId: string;
  cardId: string;
  actorId: string;
  type: ActivityType;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type AppData = {
  schemaVersion: 4;
  currentUserId: string;
  profiles: Profile[];
  boards: Board[];
  boardMembers: BoardMember[];
  lists: BoardList[];
  cards: Card[];
  units: Unit[];
  consultants: Consultant[];
  captors: Captor[];
  customFields: CustomFieldDefinition[];
  cardFieldValues: CardFieldValue[];
  checklistTemplates: ChecklistTemplate[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  activities: Activity[];
  commissionRules: CommissionRule[];
  commissionRuleVersions: CommissionRuleVersion[];
  commissionCalculations: CommissionCalculation[];
  commissionStatusHistory: CommissionStatusHistory[];
  commissionAdjustments: CommissionAdjustment[];
};

export type CardFilters = {
  query: string;
  unitId: string;
  consultantId: string;
  captorId: string;
};

export const EMPTY_FILTERS: CardFilters = {
  query: "",
  unitId: "",
  consultantId: "",
  captorId: "",
};

import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseBoardSnapshot = {
  board: Record<string, unknown>;
  lists: Record<string, unknown>[];
  cards: Record<string, unknown>[];
  units: Record<string, unknown>[];
  consultants: Record<string, unknown>[];
  captors: Record<string, unknown>[];
  customFields: Record<string, unknown>[];
  cardFieldValues: Record<string, unknown>[];
  checklists: Record<string, unknown>[];
  checklistItems: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  commissionRules: Record<string, unknown>[];
  commissionRuleVersions: Record<string, unknown>[];
  commissionCalculations: Record<string, unknown>[];
  commissionStatusHistory: Record<string, unknown>[];
  commissionAdjustments: Record<string, unknown>[];
};

/**
 * Typed boundary for the production repository. UI code does not query Supabase
 * directly; mapping from database rows to domain entities belongs here.
 */
export class SupabaseDataAccess {
  constructor(private readonly client: SupabaseClient) {}

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async loadBoard(boardId: string): Promise<SupabaseBoardSnapshot> {
    const boardQuery = this.client
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .single();
    const listsQuery = this.client
      .from("board_lists")
      .select("*")
      .eq("board_id", boardId)
      .order("position");
    const cardsQuery = this.client
      .from("cards")
      .select("*")
      .eq("board_id", boardId)
      .order("position");
    const unitsQuery = this.client
      .from("units")
      .select("*")
      .eq("board_id", boardId)
      .order("name");
    const consultantsQuery = this.client
      .from("consultants")
      .select("*")
      .eq("board_id", boardId)
      .order("name");
    const captorsQuery = this.client
      .from("captors")
      .select("*")
      .eq("board_id", boardId)
      .order("name");
    const customFieldsQuery = this.client
      .from("custom_fields")
      .select("*")
      .eq("board_id", boardId)
      .order("position");
    const activitiesQuery = this.client
      .from("activities")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(1000);
    const commissionRulesQuery = this.client
      .from("commission_rules")
      .select("*")
      .eq("board_id", boardId)
      .order("priority", { ascending: false });
    const commissionRuleVersionsQuery = this.client
      .from("commission_rule_versions")
      .select("*")
      .eq("board_id", boardId)
      .order("version", { ascending: false });
    const commissionCalculationsQuery = this.client
      .from("commission_calculations")
      .select("*")
      .eq("board_id", boardId)
      .order("calculated_at", { ascending: false });
    const commissionStatusHistoryQuery = this.client
      .from("commission_status_history")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });
    const commissionAdjustmentsQuery = this.client
      .from("commission_adjustments")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });
    const [
      board,
      lists,
      cards,
      units,
      consultants,
      captors,
      customFields,
      activities,
      commissionRules,
      commissionRuleVersions,
      commissionCalculations,
      commissionStatusHistory,
      commissionAdjustments,
    ] = await Promise.all([
      boardQuery,
      listsQuery,
      cardsQuery,
      unitsQuery,
      consultantsQuery,
      captorsQuery,
      customFieldsQuery,
      activitiesQuery,
      commissionRulesQuery,
      commissionRuleVersionsQuery,
      commissionCalculationsQuery,
      commissionStatusHistoryQuery,
      commissionAdjustmentsQuery,
    ]);
    for (const result of [
      board,
      lists,
      cards,
      units,
      consultants,
      captors,
      customFields,
      activities,
      commissionRules,
      commissionRuleVersions,
      commissionCalculations,
      commissionStatusHistory,
      commissionAdjustments,
    ])
      if (result.error) throw result.error;
    const cardIds = (cards.data ?? []).map((card) => String(card.id));
    if (!cardIds.length) {
      return {
        board: board.data as Record<string, unknown>,
        lists: lists.data ?? [],
        cards: [],
        units: units.data ?? [],
        consultants: consultants.data ?? [],
        captors: captors.data ?? [],
        customFields: customFields.data ?? [],
        cardFieldValues: [],
        checklists: [],
        checklistItems: [],
        comments: [],
        attachments: [],
        activities: activities.data ?? [],
        commissionRules: commissionRules.data ?? [],
        commissionRuleVersions: commissionRuleVersions.data ?? [],
        commissionCalculations: commissionCalculations.data ?? [],
        commissionStatusHistory: commissionStatusHistory.data ?? [],
        commissionAdjustments: commissionAdjustments.data ?? [],
      };
    }
    const [checklists, comments, attachments, cardFieldValues] =
      await Promise.all([
        this.client
          .from("checklists")
          .select("*")
          .in("card_id", cardIds)
          .order("position"),
        this.client
          .from("comments")
          .select("*")
          .in("card_id", cardIds)
          .order("created_at", { ascending: false }),
        this.client
          .from("attachments")
          .select("*")
          .in("card_id", cardIds)
          .order("created_at", { ascending: false }),
        this.client
          .from("card_field_values")
          .select("*")
          .in("card_id", cardIds),
      ]);
    for (const result of [checklists, comments, attachments, cardFieldValues])
      if (result.error) throw result.error;
    const checklistIds = (checklists.data ?? []).map((checklist) =>
      String(checklist.id),
    );
    const checklistItems = checklistIds.length
      ? await this.client
          .from("checklist_items")
          .select("*")
          .in("checklist_id", checklistIds)
          .order("position")
      : { data: [], error: null };
    if (checklistItems.error) throw checklistItems.error;
    return {
      board: board.data as Record<string, unknown>,
      lists: lists.data ?? [],
      cards: cards.data ?? [],
      units: units.data ?? [],
      consultants: consultants.data ?? [],
      captors: captors.data ?? [],
      customFields: customFields.data ?? [],
      cardFieldValues: cardFieldValues.data ?? [],
      checklists: checklists.data ?? [],
      checklistItems: checklistItems.data ?? [],
      comments: comments.data ?? [],
      attachments: attachments.data ?? [],
      activities: activities.data ?? [],
      commissionRules: commissionRules.data ?? [],
      commissionRuleVersions: commissionRuleVersions.data ?? [],
      commissionCalculations: commissionCalculations.data ?? [],
      commissionStatusHistory: commissionStatusHistory.data ?? [],
      commissionAdjustments: commissionAdjustments.data ?? [],
    };
  }

  async moveCard(input: {
    cardId: string;
    listId: string;
    position: number;
    expectedVersion: number;
  }): Promise<void> {
    const { error } = await this.client.rpc("move_card", {
      target_card_id: input.cardId,
      target_list_id: input.listId,
      target_position: input.position,
      expected_version: input.expectedVersion,
    });
    if (error) throw error;
  }

  async transitionCommissionStatus(input: {
    calculationId: string;
    status: string;
    expectedUpdatedAt: string;
    reason?: string | null;
  }): Promise<void> {
    const { error } = await this.client.rpc("transition_commission_status", {
      target_calculation_id: input.calculationId,
      target_status: input.status,
      expected_updated_at: input.expectedUpdatedAt,
      transition_reason: input.reason ?? null,
    });
    if (error) throw error;
  }

  async createCommissionCalculation(input: {
    boardId: string;
    cardId: string;
    beneficiaryId: string;
    beneficiaryName: string;
    beneficiaryRole: string;
    ruleId: string;
    ruleVersionId: string;
    ruleVersion: number;
    baseValueCents: number;
    amountCents: number;
    idempotencyKey: string;
    revision: number;
    supersedesCalculationId?: string | null;
    snapshot: Record<string, unknown>;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "create_commission_calculation",
      {
        target_board_id: input.boardId,
        target_card_id: input.cardId,
        target_beneficiary_id: input.beneficiaryId,
        target_beneficiary_name: input.beneficiaryName,
        target_beneficiary_role: input.beneficiaryRole,
        target_rule_id: input.ruleId,
        target_rule_version_id: input.ruleVersionId,
        target_rule_version: input.ruleVersion,
        target_base_value_cents: input.baseValueCents,
        target_amount_cents: input.amountCents,
        target_idempotency_key: input.idempotencyKey,
        target_revision: input.revision,
        target_supersedes_calculation_id: input.supersedesCalculationId ?? null,
        target_snapshot: input.snapshot,
      },
    );
    if (error) throw error;
    return String(data);
  }

  async adjustCommission(input: {
    calculationId: string;
    amountCents: number;
    expectedUpdatedAt: string;
    reason: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("adjust_commission_amount", {
      target_calculation_id: input.calculationId,
      target_amount_cents: input.amountCents,
      expected_updated_at: input.expectedUpdatedAt,
      adjustment_reason: input.reason,
    });
    if (error) throw error;
  }

  async uploadAttachment(input: {
    boardId: string;
    cardId: string;
    file: File;
  }): Promise<string> {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${input.boardId}/${input.cardId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await this.client.storage
      .from("lease-attachments")
      .upload(path, input.file, { upsert: false });
    if (error) throw error;
    return path;
  }
}

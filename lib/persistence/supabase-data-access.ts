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
    const [
      board,
      lists,
      cards,
      units,
      consultants,
      captors,
      customFields,
      activities,
    ] = await Promise.all([
      boardQuery,
      listsQuery,
      cardsQuery,
      unitsQuery,
      consultantsQuery,
      captorsQuery,
      customFieldsQuery,
      activitiesQuery,
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

import type { AppData, Role } from "./types";

export type Permission =
  | "board.manage"
  | "lists.manage"
  | "directories.manage"
  | "fields.manage"
  | "members.manage"
  | "archives.manage"
  | "cards.create"
  | "cards.edit"
  | "cards.move"
  | "cards.archive"
  | "cards.delete"
  | "cards.comment";

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "board.manage",
    "lists.manage",
    "directories.manage",
    "fields.manage",
    "members.manage",
    "archives.manage",
    "cards.create",
    "cards.edit",
    "cards.move",
    "cards.archive",
    "cards.delete",
    "cards.comment",
  ],
  member: [
    "cards.create",
    "cards.edit",
    "cards.move",
    "cards.archive",
    "cards.comment",
  ],
};

export function roleFor(
  data: AppData,
  boardId: string,
  profileId: string | null,
): Role | null {
  if (!profileId) return null;
  return (
    data.boardMembers.find(
      (member) => member.boardId === boardId && member.profileId === profileId,
    )?.role ?? null
  );
}

export function can(
  data: AppData,
  boardId: string,
  permission: Permission,
): boolean {
  const role = roleFor(data, boardId, data.currentUserId);
  return role ? rolePermissions[role].includes(permission) : false;
}

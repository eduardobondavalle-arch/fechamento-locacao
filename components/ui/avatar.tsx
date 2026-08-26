import type { Profile } from "@/lib/domain/types";

export function Avatar({
  profile,
  size = "md",
  title,
}: {
  profile: Profile;
  size?: "sm" | "md";
  title?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]"}`}
      style={{ backgroundColor: profile.color }}
      title={title ?? profile.name}
      aria-label={profile.name}
    >
      {profile.initials}
    </span>
  );
}

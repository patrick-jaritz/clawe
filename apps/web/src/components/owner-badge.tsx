import { OWNER_STYLE, type CronOwner } from "@/lib/owner";

interface Props {
  owner: CronOwner;
  size?: "xs" | "sm";
}

export function OwnerBadge({ owner, size = "xs" }: Props) {
  const { label, cls } = OWNER_STYLE[owner];
  const padding = size === "xs" ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span className={`inline-block rounded font-semibold shrink-0 ${padding} ${cls}`}>
      {label}
    </span>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PreviewBadge({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <Badge
      variant={dark ? "dark" : "outline"}
      className={cn(dark ? "border-paper/30 text-paper/80" : "border-obsidian/30", className)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      Preview data
    </Badge>
  );
}

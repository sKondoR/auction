import { ThumbsUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/lib";

export function RatingBadge({ score, positivePercent, total }: { score: number; positivePercent: number | null; total: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">новичок, нет отзывов</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ThumbsUp className="h-3.5 w-3.5 text-success" />
      <span className={cn("font-semibold", score >= 0 ? "text-success" : "text-danger")}>{score > 0 ? `+${score}` : score}</span>
      {positivePercent !== null && <span>· {positivePercent}% положительных</span>}
    </span>
  );
}

export function UserLink({ id, name, deleted }: { id: string; name: string; deleted?: boolean }) {
  if (deleted) return <span className="text-muted-foreground">{name}</span>;
  return (
    <Link href={`/users/${id}`} className="font-medium hover:text-primary hover:underline">
      {name}
    </Link>
  );
}

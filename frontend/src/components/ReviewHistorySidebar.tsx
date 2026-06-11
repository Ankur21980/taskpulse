import type { SourceSummary } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HistoryFilter = "all" | "draft" | "completed";

interface Props {
  sources: SourceSummary[];
  activeSourceId: string | null;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onSelect: (sourceId: string) => void;
}

function sourceLabel(source: SourceSummary): string {
  if (source.original_filename) return source.original_filename;
  const date = new Date(source.created_at).toLocaleDateString();
  return `${source.type} · ${date}`;
}

export function ReviewHistorySidebar({
  sources,
  activeSourceId,
  filter,
  onFilterChange,
  onSelect,
}: Props) {
  const filtered = sources.filter((s) =>
    filter === "all" ? true : s.review_status === filter
  );

  return (
    <aside className="w-full shrink-0 border-b border-border pb-4 md:w-60 md:border-b-0 md:border-r md:pr-4 md:pb-0">
      <h3 className="text-sm font-semibold text-foreground">Review History</h3>
      <div className="mt-2 flex flex-wrap gap-1">
        {(["all", "draft", "completed"] as HistoryFilter[]).map((f) => (
          <Button
            key={f}
            type="button"
            size="xs"
            variant={filter === f ? "secondary" : "ghost"}
            className={cn(
              "capitalize",
              filter === f && "bg-primary font-semibold text-primary-foreground"
            )}
            onClick={() => onFilterChange(f)}
          >
            {f}
          </Button>
        ))}
      </div>
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto md:max-h-[calc(100vh-12rem)]">
        {filtered.length === 0 && (
          <li className="text-xs text-muted-foreground">No reviews in this filter.</li>
        )}
        {filtered.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                activeSourceId === s.id
                  ? "border-primary/50 bg-primary/30"
                  : "border-transparent hover:bg-muted"
              )}
            >
              <div className="truncate text-sm font-medium">{sourceLabel(s)}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    s.review_status === "completed" &&
                      "border-success/50 bg-success/25 text-success",
                    s.review_status === "draft" &&
                      "border-warning/50 bg-warning/25 text-warning"
                  )}
                >
                  {s.review_status}
                </Badge>
                <span className="text-xs text-muted-foreground">{s.task_count} tasks</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

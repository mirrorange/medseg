import { ChevronRight, Home } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { BreadcrumbItem } from "~/api/types.gen";
import { useLibraryStore } from "~/stores/library";

export function LibraryBreadcrumb() {
  const { breadcrumb, navigateTo, isLoading } = useLibraryStore();

  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2"
        disabled={isLoading}
        onClick={() => navigateTo(null)}
      >
        <Home className="size-3.5" />
        <span>Library</span>
      </Button>

      {breadcrumb.map((crumb, idx) => (
        <span key={crumb.id ?? idx} className="flex items-center gap-0.5">
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
          {idx === breadcrumb.length - 1 ? (
            <span className="truncate px-2 font-medium">{crumb.name}</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 max-w-40 shrink px-2"
              disabled={isLoading}
              onClick={() => navigateTo(crumb.id)}
            >
              <span className="truncate">{crumb.name}</span>
            </Button>
          )}
        </span>
      ))}
    </nav>
  );
}

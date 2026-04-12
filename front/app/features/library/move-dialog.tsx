import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Folder, Home, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { contentsApiLibraryContentsGet } from "~/api";
import type { LibraryItem, BreadcrumbItem } from "~/api/types.gen";
import { cn } from "~/lib/utils";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNames: string[];
  onConfirm: (targetFolderId: string | null) => Promise<void>;
}

export function MoveDialog({
  open,
  onOpenChange,
  itemNames,
  onConfirm,
}: MoveDialogProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [folders, setFolders] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const loadFolder = useCallback(async (folderId: string | null) => {
    setIsLoading(true);
    try {
      const { data } = await contentsApiLibraryContentsGet({
        query: { folder_id: folderId ?? undefined, sort_by: "name", sort_order: "asc" },
      });
      if (data) {
        setCurrentFolderId(data.folder_id ?? null);
        setBreadcrumb(data.breadcrumb);
        setFolders(data.items.filter((i) => i.type === "folder"));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadFolder(null);
    }
  }, [open, loadFolder]);

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await onConfirm(currentFolderId);
      onOpenChange(false);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {itemNames.length === 1 ? `"${itemNames[0]}"` : `${itemNames.length} items`}
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-0.5 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2"
            disabled={isLoading}
            onClick={() => loadFolder(null)}
          >
            <Home className="size-3.5" />
            Library
          </Button>
          {breadcrumb.map((crumb, idx) => (
            <span key={crumb.id ?? idx} className="flex items-center gap-0.5">
              <ChevronRight className="text-muted-foreground size-3.5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 max-w-32 px-2"
                disabled={isLoading}
                onClick={() => loadFolder(crumb.id)}
              >
                <span className="truncate">{crumb.name}</span>
              </Button>
            </span>
          ))}
        </nav>

        {/* Folder list */}
        <ScrollArea className="h-64 rounded-md border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No subfolders
            </div>
          ) : (
            <div className="p-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm",
                    "hover:bg-accent",
                  )}
                  onDoubleClick={() => loadFolder(folder.id)}
                  onClick={() => loadFolder(folder.id)}
                >
                  <Folder className="size-4 text-amber-500" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <p className="text-muted-foreground text-xs">
          Move to: {breadcrumb.length > 0 ? breadcrumb.map((c) => c.name).join(" / ") : "Library (root)"}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving}>
            {isMoving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

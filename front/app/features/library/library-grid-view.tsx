import { useState } from "react";
import { LibraryItemIcon } from "./library-item-icon";
import { useLibraryStore } from "~/stores/library";
import type { LibraryItem } from "~/api/types.gen";
import { cn } from "~/lib/utils";

interface LibraryGridViewProps {
  items: LibraryItem[];
  selectedIds: string[];
  onOpen: (item: LibraryItem) => void;
  onContextMenu: (e: React.MouseEvent, item: LibraryItem) => void;
  onDropOnFolder?: (targetFolderId: string, draggedIds: string[]) => void;
}

export function LibraryGridView({
  items,
  selectedIds,
  onOpen,
  onContextMenu,
  onDropOnFolder,
}: LibraryGridViewProps) {
  const { select, selectRange } = useLibraryStore();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent, item: LibraryItem) => {
    if (e.shiftKey) {
      selectRange(item.id);
    } else if (e.metaKey || e.ctrlKey) {
      select(item.id, true);
    } else {
      select(item.id);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: LibraryItem) => {
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    e.dataTransfer.setData("application/x-library-ids", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, item: LibraryItem) => {
    if (item.type !== "folder") return;
    if (selectedIds.includes(item.id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId(item.id);
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, item: LibraryItem) => {
    e.preventDefault();
    setDropTargetId(null);
    if (item.type !== "folder" || !onDropOnFolder) return;
    const raw = e.dataTransfer.getData("application/x-library-ids");
    if (!raw) return;
    try {
      const ids = JSON.parse(raw) as string[];
      if (ids.includes(item.id)) return;
      onDropOnFolder(item.id, ids);
    } catch {
      // ignore malformed data
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center py-12">
        This folder is empty
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-2">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const isDropTarget = dropTargetId === item.id;
        return (
          <div
            key={item.id}
            data-library-item
            data-item-id={item.id}
            data-selected={isSelected || undefined}
            draggable
            className={cn(
              "flex cursor-pointer select-none flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
              "hover:bg-accent/50",
              isSelected && "bg-accent border-primary/30",
              isDropTarget && "ring-primary ring-2",
            )}
            onClick={(e) => handleClick(e, item)}
            onDoubleClick={() => onOpen(item)}
            onContextMenu={(e) => onContextMenu(e, item)}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
          >
            <LibraryItemIcon item={item} className="size-10" />
            <span className="w-full truncate text-center text-xs" title={item.name}>
              {item.name}
            </span>
            {item.type === "folder" && item.child_count != null && (
              <span className="text-muted-foreground text-xs">
                {item.child_count} item{item.child_count !== 1 ? "s" : ""}
              </span>
            )}
            {item.type === "sample_set" && item.description && (
              <span className="text-muted-foreground w-full text-center text-xs line-clamp-2">
                {item.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

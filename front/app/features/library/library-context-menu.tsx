import { useRef, useEffect, useCallback } from "react";
import {
  Edit,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Move,
  Trash2,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import type { LibraryItem } from "~/api/types.gen";

export type LibraryAction =
  | "open"
  | "rename"
  | "move"
  | "delete"
  | "new-folder"
  | "new-sample-set"
  | "select-all"
  | "refresh";

interface LibraryContextMenuProps {
  x: number;
  y: number;
  item: LibraryItem | null;
  selectionCount: number;
  onAction: (action: LibraryAction) => void;
  onClose: () => void;
}

export function LibraryContextMenu({
  x,
  y,
  item,
  selectionCount,
  onAction,
  onClose,
}: LibraryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("contextmenu", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [handleClickOutside]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const handleAction = (action: LibraryAction) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="bg-popover text-popover-foreground fixed z-50 min-w-48 rounded-md border p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {item && (
        <>
          <MenuItem
            icon={<FolderOpen className="size-4" />}
            label="Open"
            onClick={() => handleAction("open")}
          />
          <MenuItem
            icon={<Edit className="size-4" />}
            label="Rename"
            onClick={() => handleAction("rename")}
          />
          <MenuItem
            icon={<Move className="size-4" />}
            label={selectionCount > 1 ? `Move ${selectionCount} items` : "Move"}
            onClick={() => handleAction("move")}
          />
          <MenuItem
            icon={<Trash2 className="size-4" />}
            label={selectionCount > 1 ? `Delete ${selectionCount} items` : "Delete"}
            destructive
            onClick={() => handleAction("delete")}
          />
          <div className="bg-border my-1 h-px" />
        </>
      )}
      <MenuItem
        icon={<FolderPlus className="size-4" />}
        label="New Folder"
        onClick={() => handleAction("new-folder")}
      />
      <MenuItem
        icon={<FilePlus className="size-4" />}
        label="New Sample Set"
        onClick={() => handleAction("new-sample-set")}
      />
      <div className="bg-border my-1 h-px" />
      <MenuItem
        icon={<ListChecks className="size-4" />}
        label="Select All"
        onClick={() => handleAction("select-all")}
      />
      <MenuItem
        icon={<RefreshCw className="size-4" />}
        label="Refresh"
        onClick={() => handleAction("refresh")}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
        destructive ? "text-destructive hover:text-destructive" : ""
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

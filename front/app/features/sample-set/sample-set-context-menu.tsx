import { useRef, useEffect, useCallback } from "react";
import {
  FolderOpen, Edit, Trash2, FolderPlus, Upload, ListChecks, RefreshCw,
  Play, ChevronRight, Info, Eye,
} from "lucide-react";
import type { SubsetRead, ImageRead, AwarenessResponse, ModuleAwarenessItem } from "~/api/types.gen";
import type { BrowseLevel } from "~/stores/sample-set";

export type SampleSetAction =
  | "open" | "rename" | "delete" | "preview"
  | "new-subset" | "upload-images"
  | "select-all" | "refresh" | "properties"
  | { type: "run-pipeline"; module: ModuleAwarenessItem };

interface SampleSetContextMenuProps {
  x: number;
  y: number;
  item: SubsetRead | ImageRead | null;
  level: BrowseLevel;
  selectionCount: number;
  selectedIds: string[];
  awareness: AwarenessResponse | null;
  onAction: (action: SampleSetAction) => void;
  onClose: () => void;
}

export function SampleSetContextMenu({
  x, y, item, level, selectionCount, selectedIds, awareness, onAction, onClose,
}: SampleSetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
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

  // Adjust menu position if it exceeds viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) menuRef.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menuRef.current.style.top = `${y - rect.height}px`;
  }, [x, y]);

  const fire = (action: SampleSetAction) => { onAction(action); onClose(); };

  // Compute pipeline suggestions for the selected subsets
  const { suggested, available } = computePipelineActions(awareness, selectedIds, level);

  return (
    <div
      ref={menuRef}
      className="bg-popover text-popover-foreground fixed z-50 min-w-52 rounded-md border p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {/* Item-specific actions */}
      {item && (
        <>
          {level === "subsets" && (
            <MenuItem icon={<FolderOpen className="size-4" />} label="Open" onClick={() => fire("open")} />
          )}
          <MenuItem icon={<Eye className="size-4" />} label="Preview" onClick={() => fire("preview")} />
          <MenuItem icon={<Edit className="size-4" />} label="Rename" onClick={() => fire("rename")} />
          <MenuItem
            icon={<Trash2 className="size-4" />}
            label={selectionCount > 1 ? `Delete ${selectionCount} items` : "Delete"}
            destructive
            onClick={() => fire("delete")}
          />
          <MenuItem icon={<Info className="size-4" />} label="Properties" onClick={() => fire("properties")} />

          {/* Pipeline actions for subsets */}
          {level === "subsets" && (suggested.length > 0 || available.length > 0) && (
            <>
              <Divider />
              {suggested.map((mod) => (
                <MenuItem
                  key={mod.module_name}
                  icon={<Play className="size-4" />}
                  label={selectionCount > 1
                    ? `Run ${mod.module_name} (${selectionCount} subsets)`
                    : `Run ${mod.module_name}`
                  }
                  sublabel={mod.reason ?? undefined}
                  onClick={() => fire({ type: "run-pipeline", module: mod })}
                />
              ))}
              {available.length > 0 && (
                <SubmenuItem label="More Actions" icon={<ChevronRight className="size-3" />}>
                  {available.map((mod) => (
                    <MenuItem
                      key={mod.module_name}
                      icon={<Play className="size-4" />}
                      label={`Run ${mod.module_name}`}
                      sublabel={mod.reason ?? undefined}
                      onClick={() => fire({ type: "run-pipeline", module: mod })}
                    />
                  ))}
                </SubmenuItem>
              )}
            </>
          )}

          <Divider />
        </>
      )}

      {/* Background actions */}
      {level === "subsets" && (
        <MenuItem icon={<FolderPlus className="size-4" />} label="New Subset" onClick={() => fire("new-subset")} />
      )}
      {level === "images" && (
        <MenuItem icon={<Upload className="size-4" />} label="Upload Images" onClick={() => fire("upload-images")} />
      )}
      <Divider />
      <MenuItem icon={<ListChecks className="size-4" />} label="Select All" onClick={() => fire("select-all")} />
      <MenuItem icon={<RefreshCw className="size-4" />} label="Refresh" onClick={() => fire("refresh")} />
    </div>
  );
}

// -- Helpers -------------------------------------------------------

/**
 * Compute which pipeline modules to show as "suggested" (recommended for all
 * selected subsets) and "available" (remaining) in the context menu.
 */
function computePipelineActions(
  awareness: AwarenessResponse | null,
  selectedIds: string[],
  level: BrowseLevel,
): { suggested: ModuleAwarenessItem[]; available: ModuleAwarenessItem[] } {
  if (!awareness || level !== "subsets" || selectedIds.length === 0) {
    return { suggested: [], available: [] };
  }

  const suggested: ModuleAwarenessItem[] = [];
  const available: ModuleAwarenessItem[] = [];

  // Combine primary + suggested + available from awareness
  const allModules: ModuleAwarenessItem[] = [
    ...(awareness.primary ? [awareness.primary] : []),
    ...awareness.suggested,
    ...awareness.available,
  ];

  for (const mod of allModules) {
    // A module is "suggested" if all selected subsets are in its recommended list
    const allRecommended = selectedIds.every((id) =>
      mod.recommended_subset_ids.includes(id),
    );
    if (allRecommended) {
      suggested.push(mod);
    } else {
      // Check if at least one selected subset is in available or recommended
      const anyAvailable = selectedIds.some(
        (id) => mod.available_subset_ids.includes(id) || mod.recommended_subset_ids.includes(id),
      );
      if (anyAvailable) available.push(mod);
    }
  }

  return { suggested, available };
}

// -- Sub-components -----------------------------------------------

function MenuItem({
  icon, label, sublabel, destructive, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
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
      <div className="flex flex-col items-start">
        <span>{label}</span>
        {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
      </div>
    </button>
  );
}

function Divider() {
  return <div className="bg-border my-1 h-px" />;
}

function SubmenuItem({
  label, icon, children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <div className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="bg-popover text-popover-foreground absolute top-0 left-full z-50 hidden min-w-44 rounded-md border p-1 shadow-md group-hover:block">
        {children}
      </div>
    </div>
  );
}

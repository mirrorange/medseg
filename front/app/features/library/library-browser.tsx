import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useLibraryStore } from "~/stores/library";
import { LibraryToolbar } from "./library-toolbar";
import { LibraryListView } from "./library-list-view";
import { LibraryGridView } from "./library-grid-view";
import {
  LibraryContextMenu,
  type LibraryAction,
} from "./library-context-menu";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateSampleSetDialog } from "./create-sample-set-dialog";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { MoveDialog } from "./move-dialog";
import { useLassoSelection, LassoOverlay } from "./use-lasso-selection";
import { useLibraryRouteNavigation } from "./use-library-route-navigation";
import {
  deleteApiLibraryFoldersFolderIdDelete,
  deleteApiSampleSetsSampleSetIdDelete,
  updateApiSampleSetsSampleSetIdPut,
} from "~/api";
import type { LibraryItem } from "~/api/types.gen";

interface ContextMenuState {
  x: number;
  y: number;
  item: LibraryItem | null;
}

interface LibraryBrowserProps {
  initialFolderId?: string | null;
}

export function LibraryBrowser({ initialFolderId }: LibraryBrowserProps) {
  const navigate = useNavigate();
  const lastLoadedFolderRef = useRef<string | null | undefined>(undefined);
  const { goToChild, goUp } = useLibraryRouteNavigation();
  const {
    folderId,
    items,
    selectedIds,
    isLoading,
    error,
    viewMode,
    navigateTo,
    refresh,
    selectAll,
    clearSelection,
  } = useLibraryStore();

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createSSOpen, setCreateSSOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renameSS, setRenameSS] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<LibraryItem[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Lasso selection
  const lassoContainerRef = useRef<HTMLDivElement>(null);
  const lassoState = useLassoSelection({
    containerRef: lassoContainerRef,
    itemSelector: "[data-library-item]",
    getIdFromElement: (el) => el.getAttribute("data-item-id"),
    onSelect: useCallback(
      (ids: string[], additive: boolean) => {
        if (additive) {
          const merged = [...selectedIds];
          const set = new globalThis.Set(selectedIds);
          for (const id of ids) {
            if (!set.has(id)) merged.push(id);
          }
          useLibraryStore.getState().setSelection(merged);
        } else {
          useLibraryStore.getState().setSelection(ids);
        }
      },
      [selectedIds],
    ),
    enabled: !isLoading,
  });

  // Load contents from the path-driven route state.
  useEffect(() => {
    const targetFolderId = initialFolderId ?? null;
    if (lastLoadedFolderRef.current === targetFolderId) return;
    lastLoadedFolderRef.current = targetFolderId;
    void navigateTo(targetFolderId);
  }, [initialFolderId, navigateTo]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;

      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      }
      if (e.key === "Escape") {
        clearSelection();
        setContextMenu(null);
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goUp();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, goUp, selectAll]);

  // Handle opening an item
  const handleOpen = useCallback(
    (item: LibraryItem) => {
      if (item.type === "folder") {
        goToChild(item.name);
      } else {
        navigate(`/app/sample-sets/${item.id}`);
      }
    },
    [goToChild, navigate],
  );

  // Handle context menu on items
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: LibraryItem) => {
      e.preventDefault();
      // If item is not in selection, select it
      if (!selectedIds.includes(item.id)) {
        useLibraryStore.getState().select(item.id);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [selectedIds],
  );

  // Handle context menu on empty area
  const handleEmptyContextMenu = useCallback((e: React.MouseEvent) => {
    // Only trigger for background clicks, not item clicks
    if ((e.target as HTMLElement).closest("[data-library-item]")) return;
    e.preventDefault();
    clearSelection();
    setContextMenu({ x: e.clientX, y: e.clientY, item: null });
  }, [clearSelection]);

  // Handle context menu actions
  const handleAction = useCallback(
    (action: LibraryAction) => {
      const firstSelected = items.find((i) => selectedIds.includes(i.id));

      switch (action) {
        case "open":
          if (firstSelected) handleOpen(firstSelected);
          break;

        case "rename":
          if (firstSelected) {
            if (firstSelected.type === "folder") {
              setRenameFolderId(firstSelected.id);
              setRenameFolderName(firstSelected.name);
              setRenameOpen(true);
            } else {
              setRenameSS({ id: firstSelected.id, name: firstSelected.name });
            }
          }
          break;

        case "move":
          if (selectedIds.length > 0) {
            setMoveOpen(true);
          }
          break;

        case "delete":
          if (selectedIds.length > 0) {
            setDeleteTargets(items.filter((item) => selectedIds.includes(item.id)));
            setDeleteOpen(true);
          } else if (firstSelected) {
            setDeleteTargets([firstSelected]);
            setDeleteOpen(true);
          }
          break;

        case "new-folder":
          setCreateFolderOpen(true);
          break;

        case "new-sample-set":
          setCreateSSOpen(true);
          break;

        case "select-all":
          selectAll();
          break;

        case "refresh":
          void refresh();
          break;
      }
    },
    [items, selectedIds, handleOpen, selectAll, refresh],
  );

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deleteTargets.length === 0) return;

    setDeleteLoading(true);

    try {
      let deletedCount = 0;

      for (const target of deleteTargets) {
        if (target.type === "folder") {
          await deleteApiLibraryFoldersFolderIdDelete({
            path: { folder_id: target.id },
            query: { recursive: true },
          });
        } else {
          await deleteApiSampleSetsSampleSetIdDelete({
            path: { sample_set_id: target.id },
          });
        }

        deletedCount += 1;
      }

      toast.success(
        deletedCount === 1
          ? `Deleted "${deleteTargets[0].name}"`
          : `Deleted ${deletedCount} items`,
      );

      setDeleteOpen(false);
      setDeleteTargets([]);
      useLibraryStore.getState().clearSelection();
      void refresh();
    } catch {
      toast.error(deleteTargets.length > 1 ? "Failed to delete selected items" : "Failed to delete item");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTargets, refresh]);

  // Handle sample set rename
  const handleRenameSS = useCallback(async () => {
    if (!renameSS) return;
    try {
      await updateApiSampleSetsSampleSetIdPut({
        path: { sample_set_id: renameSS.id },
        body: { name: renameSS.name },
      });
      toast.success("Renamed successfully");
      setRenameSS(null);
      void refresh();
    } catch {
      toast.error("Failed to rename");
    }
  }, [renameSS, refresh]);

  // Handle drag-and-drop onto a folder
  const handleDropOnFolder = useCallback(
    async (targetFolderId: string, draggedIds: string[]) => {
      const moveItems = items
        .filter((i) => draggedIds.includes(i.id))
        .map((i) => ({ id: i.id, type: i.type }));
      if (moveItems.length === 0) return;
      try {
        await useLibraryStore.getState().batchMove(targetFolderId, moveItems);
        toast.success(`Moved ${moveItems.length} item${moveItems.length > 1 ? "s" : ""}`);
      } catch {
        toast.error("Failed to move items");
      }
    },
    [items],
  );

  return (
    <div className="flex h-full flex-col">
      <LibraryToolbar
        onCreateFolder={() => setCreateFolderOpen(true)}
        onCreateSampleSet={() => setCreateSSOpen(true)}
      />

      {/* Main content area */}
      <div
        ref={lassoContainerRef}
        className="relative flex-1"
        onContextMenu={handleEmptyContextMenu}
        onClick={() => {
          // Don't clear selection if a lasso selection just completed
          if (lassoState.justFinished) return;
          clearSelection();
          setContextMenu(null);
        }}
      >
        <LassoOverlay rect={lassoState.rect} />
        {isLoading && items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-destructive flex h-full items-center justify-center">
            {error}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div onClick={(e) => e.stopPropagation()}>
              {viewMode === "list" ? (
                <LibraryListView
                  items={items}
                  selectedIds={selectedIds}
                  onOpen={handleOpen}
                  onContextMenu={handleContextMenu}
                  onDropOnFolder={handleDropOnFolder}
                />
              ) : (
                <LibraryGridView
                  items={items}
                  selectedIds={selectedIds}
                  onOpen={handleOpen}
                  onContextMenu={handleContextMenu}
                  onDropOnFolder={handleDropOnFolder}
                />
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Status bar */}
      <div className="text-muted-foreground flex h-7 items-center gap-3 border-t px-3 text-xs">
        <span>{items.length} items</span>
        {selectedIds.length > 0 && (
          <span>{selectedIds.length} selected</span>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <LibraryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          selectionCount={selectedIds.length}
          onAction={handleAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        parentId={folderId}
        onCreated={() => {
          setCreateFolderOpen(false);
          void refresh();
        }}
      />

      <CreateSampleSetDialog
        open={createSSOpen}
        onOpenChange={setCreateSSOpen}
        folderId={folderId}
        onCreated={() => {
          setCreateSSOpen(false);
          void refresh();
        }}
      />

      {renameOpen && renameFolderId && (
        <RenameFolderDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          folderId={renameFolderId}
          currentName={renameFolderName}
          onRenamed={() => {
            setRenameOpen(false);
            void refresh();
          }}
        />
      )}

      {/* Sample set rename — simple inline dialog */}
      {renameSS && (
        <RenameSampleSetInline
          name={renameSS.name}
          onNameChange={(name) => setRenameSS({ ...renameSS, name })}
          onConfirm={handleRenameSS}
          onCancel={() => setRenameSS(null)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteTargets([]);
          }
        }}
        title="Delete"
        description={deleteTargets.length > 1
          ? `Are you sure you want to delete ${deleteTargets.length} items? This action cannot be undone.`
          : `Are you sure you want to delete "${deleteTargets[0]?.name}"? This action cannot be undone.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        destructive
      />

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        itemNames={items.filter((i) => selectedIds.includes(i.id)).map((i) => i.name)}
        onConfirm={async (targetFolderId) => {
          const moveItems = items
            .filter((i) => selectedIds.includes(i.id))
            .map((i) => ({ id: i.id, type: i.type }));
          try {
            await useLibraryStore.getState().batchMove(targetFolderId, moveItems);
            toast.success("Moved successfully");
          } catch {
            toast.error("Failed to move items");
            throw new Error("move failed");
          }
        }}
      />
    </div>
  );
}

// Simple inline rename for sample sets
function RenameSampleSetInline({
  name,
  onNameChange,
  onConfirm,
  onCancel,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-popover w-80 rounded-lg border p-4 shadow-lg">
        <h3 className="mb-3 font-medium">Rename Sample Set</h3>
        <input
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="text-muted-foreground rounded px-3 py-1.5 text-sm hover:bg-accent"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm"
            onClick={onConfirm}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

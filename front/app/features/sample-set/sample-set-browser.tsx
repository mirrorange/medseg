import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useSampleSetStore, useCurrentItems } from "~/stores/sample-set";
import { SampleSetToolbar } from "./sample-set-toolbar";
import { SampleSetListView } from "./sample-set-list-view";
import { SampleSetGridView } from "./sample-set-grid-view";
import { SampleSetContextMenu, type SampleSetAction } from "./sample-set-context-menu";
import { useLassoSelection, LassoOverlay } from "~/features/library/use-lasso-selection";
import type { SubsetRead, ImageRead, ModuleAwarenessItem } from "~/api/types.gen";

interface SampleSetBrowserProps {
  sampleSetId: string;
  sampleSetName: string;

  // Dialog triggers (managed by parent route)
  onCreateSubset: () => void;
  onUploadImages: () => void;
  onDeleteSelected: () => void;
  onShare: () => void;
  onDeleteSampleSet: () => void;
  onRename: (item: SubsetRead | ImageRead) => void;
  onProperties: (item: SubsetRead | ImageRead) => void;
  onRunPipeline: (module: ModuleAwarenessItem, subsetIds: string[]) => void;
  onPrimaryAction: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: SubsetRead | ImageRead | null;
}

export function SampleSetBrowser({
  sampleSetId,
  sampleSetName,
  onCreateSubset,
  onUploadImages,
  onDeleteSelected,
  onShare,
  onDeleteSampleSet,
  onRename,
  onProperties,
  onRunPipeline,
  onPrimaryAction,
}: SampleSetBrowserProps) {
  const {
    level,
    isLoading,
    error,
    viewMode,
    selectedIds,
    awareness,
    loadSampleSet,
    openSubset,
    selectAll,
    clearSelection,
    refresh,
  } = useSampleSetStore();

  const items = useCurrentItems();
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Lasso selection
  const lassoState = useLassoSelection({
    containerRef,
    itemSelector: "[data-ss-item]",
    getIdFromElement: (el) => el.getAttribute("data-item-id"),
    onSelect: useCallback(
      (ids: string[], additive: boolean) => {
        if (additive) {
          const merged = [...selectedIds];
          const seen = new globalThis.Set(selectedIds);
          for (const id of ids) {
            if (!seen.has(id)) merged.push(id);
          }
          useSampleSetStore.getState().setSelection(merged);
        } else {
          useSampleSetStore.getState().setSelection(ids);
        }
      },
      [selectedIds],
    ),
    enabled: !isLoading,
  });

  // Load data on mount / when sampleSetId changes
  useEffect(() => {
    void loadSampleSet(sampleSetId);
  }, [sampleSetId, loadSampleSet]);

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
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useSampleSetStore.getState().goBack();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection]);

  // Double-click on a subset → navigate into it
  const handleOpen = useCallback(
    (item: SubsetRead | ImageRead) => {
      if (level === "subsets") {
        void openSubset(item.id);
      }
      // For images: could open viewer in future
    },
    [level, openSubset],
  );

  // Context menu on item
  const handleItemContextMenu = useCallback(
    (e: React.MouseEvent, item: SubsetRead | ImageRead) => {
      e.preventDefault();
      if (!selectedIds.includes(item.id)) {
        useSampleSetStore.getState().select(item.id);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [selectedIds],
  );

  // Context menu on empty area
  const handleEmptyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-ss-item]")) return;
      e.preventDefault();
      clearSelection();
      setContextMenu({ x: e.clientX, y: e.clientY, item: null });
    },
    [clearSelection],
  );

  // Handle context menu actions
  const handleAction = useCallback(
    (action: SampleSetAction) => {
      if (typeof action === "object" && action.type === "run-pipeline") {
        onRunPipeline(action.module, selectedIds);
        return;
      }

      const firstSelected = items.find((i) => selectedIds.includes(i.id));

      switch (action) {
        case "open":
          if (firstSelected && level === "subsets") void openSubset(firstSelected.id);
          break;
        case "rename":
          if (firstSelected) onRename(firstSelected);
          break;
        case "delete":
          onDeleteSelected();
          break;
        case "properties":
          if (firstSelected) onProperties(firstSelected);
          break;
        case "new-subset":
          onCreateSubset();
          break;
        case "upload-images":
          onUploadImages();
          break;
        case "select-all":
          selectAll();
          break;
        case "refresh":
          void refresh();
          break;
      }
    },
    [items, selectedIds, level, openSubset, onRename, onDeleteSelected, onProperties, onCreateSubset, onUploadImages, selectAll, refresh, onRunPipeline],
  );

  return (
    <div className="flex h-full flex-col rounded-lg border">
      <SampleSetToolbar
        sampleSetName={sampleSetName}
        awareness={awareness}
        onCreateSubset={onCreateSubset}
        onUploadImages={onUploadImages}
        onDeleteSelected={onDeleteSelected}
        onShare={onShare}
        onDeleteSampleSet={onDeleteSampleSet}
        onPrimaryAction={onPrimaryAction}
      />

      <ScrollArea className="flex-1">
        <div ref={containerRef} className="min-h-0 flex-1" onContextMenu={handleEmptyContextMenu}>
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-destructive py-12 text-center text-sm">{error}</div>
          ) : viewMode === "list" ? (
            <SampleSetListView
              items={items}
              level={level}
              selectedIds={selectedIds}
              onOpen={handleOpen}
              onContextMenu={handleItemContextMenu}
            />
          ) : (
            <SampleSetGridView
              items={items}
              level={level}
              selectedIds={selectedIds}
              onOpen={handleOpen}
              onContextMenu={handleItemContextMenu}
            />
          )}
        </div>
      </ScrollArea>

      <LassoOverlay rect={lassoState.rect} />

      {contextMenu && (
        <SampleSetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          level={level}
          selectionCount={selectedIds.length}
          selectedIds={selectedIds}
          awareness={awareness}
          onAction={handleAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

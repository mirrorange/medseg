import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useSampleSetStore, useCurrentItems } from "~/stores/sample-set";
import { SampleSetToolbar } from "./sample-set-toolbar";
import type { SubsetRead, ImageRead } from "~/api/types.gen";

interface SampleSetBrowserProps {
  sampleSetId: string;
  sampleSetName: string;

  // Dialog triggers (managed by parent route)
  onCreateSubset: () => void;
  onUploadImages: () => void;
  onDeleteSelected: () => void;
  onShare: () => void;
  onDeleteSampleSet: () => void;

  // Context menu trigger
  onContextMenu: (e: React.MouseEvent, item: SubsetRead | ImageRead | null) => void;
}

export function SampleSetBrowser({
  sampleSetId,
  sampleSetName,
  onCreateSubset,
  onUploadImages,
  onDeleteSelected,
  onShare,
  onDeleteSampleSet,
  onContextMenu,
}: SampleSetBrowserProps) {
  const {
    level,
    isLoading,
    error,
    viewMode,
    selectedIds,
    loadSampleSet,
    openSubset,
    selectAll,
    clearSelection,
  } = useSampleSetStore();

  const items = useCurrentItems();
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Click handler for items
  const handleClick = useCallback(
    (e: React.MouseEvent, item: SubsetRead | ImageRead) => {
      if (e.shiftKey) {
        useSampleSetStore.getState().selectRange(item.id);
      } else if (e.metaKey || e.ctrlKey) {
        useSampleSetStore.getState().select(item.id, true);
      } else {
        useSampleSetStore.getState().select(item.id);
      }
    },
    [],
  );

  // Context menu on item
  const handleItemContextMenu = useCallback(
    (e: React.MouseEvent, item: SubsetRead | ImageRead) => {
      e.preventDefault();
      if (!selectedIds.includes(item.id)) {
        useSampleSetStore.getState().select(item.id);
      }
      onContextMenu(e, item);
    },
    [selectedIds, onContextMenu],
  );

  // Context menu on empty area
  const handleEmptyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-ss-item]")) return;
      e.preventDefault();
      clearSelection();
      onContextMenu(e, null);
    },
    [clearSelection, onContextMenu],
  );

  return (
    <div className="flex h-full flex-col rounded-lg border">
      <SampleSetToolbar
        sampleSetName={sampleSetName}
        onCreateSubset={onCreateSubset}
        onUploadImages={onUploadImages}
        onDeleteSelected={onDeleteSelected}
        onShare={onShare}
        onDeleteSampleSet={onDeleteSampleSet}
      />

      <ScrollArea className="flex-1">
        <div ref={containerRef} className="min-h-0 flex-1" onContextMenu={handleEmptyContextMenu}>
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-destructive py-12 text-center text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {level === "subsets"
                ? "No subsets yet. Create a subset or upload images to get started."
                : "No images in this subset."}
            </div>
          ) : viewMode === "list" ? (
            <SampleSetListViewPlaceholder
              items={items}
              level={level}
              selectedIds={selectedIds}
              onClick={handleClick}
              onDoubleClick={handleOpen}
              onContextMenu={handleItemContextMenu}
            />
          ) : (
            <SampleSetGridViewPlaceholder
              items={items}
              level={level}
              selectedIds={selectedIds}
              onClick={handleClick}
              onDoubleClick={handleOpen}
              onContextMenu={handleItemContextMenu}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// -- Temporary inline views (will be extracted to separate files in Stage 4) --

function SampleSetListViewPlaceholder({
  items,
  level,
  selectedIds,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  items: (SubsetRead | ImageRead)[];
  level: "subsets" | "images";
  selectedIds: string[];
  onClick: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
  onDoubleClick: (item: SubsetRead | ImageRead) => void;
  onContextMenu: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
}) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-left text-xs">
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Created</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <tr
              key={item.id}
              data-ss-item
              data-item-id={item.id}
              data-selected={isSelected || undefined}
              className={`cursor-pointer select-none border-b transition-colors hover:bg-accent/50 ${
                isSelected ? "bg-accent" : ""
              }`}
              onClick={(e) => onClick(e, item)}
              onDoubleClick={() => onDoubleClick(item)}
              onContextMenu={(e) => onContextMenu(e, item)}
            >
              <td className="px-3 py-2 font-medium">
                {"filename" in item ? item.filename : item.name}
              </td>
              <td className="text-muted-foreground px-3 py-2">
                {level === "subsets" ? (item as SubsetRead).type : (item as ImageRead).format}
              </td>
              <td className="text-muted-foreground px-3 py-2 text-xs">
                {formatDate(item.created_at)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SampleSetGridViewPlaceholder({
  items,
  level,
  selectedIds,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  items: (SubsetRead | ImageRead)[];
  level: "subsets" | "images";
  selectedIds: string[];
  onClick: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
  onDoubleClick: (item: SubsetRead | ImageRead) => void;
  onContextMenu: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-2">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const name = "filename" in item ? item.filename : item.name;
        return (
          <div
            key={item.id}
            data-ss-item
            data-item-id={item.id}
            data-selected={isSelected || undefined}
            className={`flex cursor-pointer select-none flex-col items-center gap-1 rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
              isSelected ? "bg-accent border-primary/30" : ""
            }`}
            onClick={(e) => onClick(e, item)}
            onDoubleClick={() => onDoubleClick(item)}
            onContextMenu={(e) => onContextMenu(e, item)}
          >
            <div className="text-muted-foreground flex size-10 items-center justify-center text-2xl">
              {level === "subsets" ? "📁" : "🖼️"}
            </div>
            <span className="w-full truncate text-center text-xs" title={name}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

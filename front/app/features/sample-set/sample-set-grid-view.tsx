import { SampleSetItemIcon, itemName } from "./sample-set-item-icon";
import { useSampleSetStore } from "~/stores/sample-set";
import type { SubsetRead, ImageRead } from "~/api/types.gen";
import type { BrowseLevel } from "~/stores/sample-set";
import { cn } from "~/lib/utils";

interface SampleSetGridViewProps {
  items: (SubsetRead | ImageRead)[];
  level: BrowseLevel;
  selectedIds: string[];
  onOpen: (item: SubsetRead | ImageRead) => void;
  onContextMenu: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
}

export function SampleSetGridView({
  items, level, selectedIds, onOpen, onContextMenu,
}: SampleSetGridViewProps) {
  const { select, selectRange } = useSampleSetStore();

  const handleClick = (e: React.MouseEvent, item: SubsetRead | ImageRead) => {
    if (e.shiftKey) selectRange(item.id);
    else if (e.metaKey || e.ctrlKey) select(item.id, true);
    else select(item.id);
  };

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center py-12">
        {level === "subsets" ? "No subsets yet" : "No images in this subset"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-2">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const name = itemName(item);
        return (
          <div
            key={item.id}
            data-ss-item
            data-item-id={item.id}
            data-selected={isSelected || undefined}
            className={cn(
              "flex cursor-pointer select-none flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
              "hover:bg-accent/50",
              isSelected && "bg-accent border-primary/30",
            )}
            onClick={(e) => handleClick(e, item)}
            onDoubleClick={() => onOpen(item)}
            onContextMenu={(e) => onContextMenu(e, item)}
          >
            <SampleSetItemIcon item={item} level={level} className="size-10" />
            <span className="w-full truncate text-center text-xs" title={name}>
              {name}
            </span>
            {level === "subsets" && (
              <span className="text-muted-foreground text-xs">
                {(item as SubsetRead).type}
              </span>
            )}
            {level === "images" && (
              <span className="text-muted-foreground text-xs">
                {(item as ImageRead).format}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

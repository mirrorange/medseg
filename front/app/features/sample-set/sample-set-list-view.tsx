import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "~/components/ui/table";
import { SampleSetItemIcon, itemName } from "./sample-set-item-icon";
import { useSampleSetStore } from "~/stores/sample-set";
import type { SubsetRead, ImageRead } from "~/api/types.gen";
import type { BrowseLevel } from "~/stores/sample-set";
import { cn } from "~/lib/utils";

type SortField = "name" | "type" | "created_at";

interface SampleSetListViewProps {
  items: (SubsetRead | ImageRead)[];
  level: BrowseLevel;
  selectedIds: string[];
  onOpen: (item: SubsetRead | ImageRead) => void;
  onContextMenu: (e: React.MouseEvent, item: SubsetRead | ImageRead) => void;
}

export function SampleSetListView({
  items, level, selectedIds, onOpen, onContextMenu,
}: SampleSetListViewProps) {
  const { select, selectRange } = useSampleSetStore();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = itemName(a).localeCompare(itemName(b));
        break;
      case "type":
        cmp = typeLabel(a, level).localeCompare(typeLabel(b, level));
        break;
      case "created_at":
        cmp = a.created_at.localeCompare(b.created_at);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? <span className="ml-1">{sortAsc ? "↑" : "↓"}</span> : null;

  const handleClick = (e: React.MouseEvent, item: SubsetRead | ImageRead) => {
    if (e.shiftKey) selectRange(item.id);
    else if (e.metaKey || e.ctrlKey) select(item.id, true);
    else select(item.id);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50%] cursor-pointer select-none" onClick={() => handleSort("name")}>
            Name <SortIcon field="name" />
          </TableHead>
          <TableHead className="w-[20%] cursor-pointer select-none" onClick={() => handleSort("type")}>
            Type <SortIcon field="type" />
          </TableHead>
          <TableHead className="w-[30%] cursor-pointer select-none" onClick={() => handleSort("created_at")}>
            Created <SortIcon field="created_at" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-muted-foreground py-12 text-center">
              {level === "subsets" ? "No subsets yet" : "No images in this subset"}
            </TableCell>
          </TableRow>
        )}
        {sorted.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TableRow
              key={item.id}
              data-ss-item
              data-item-id={item.id}
              data-selected={isSelected || undefined}
              className={cn(
                "cursor-pointer select-none",
                isSelected && "bg-accent",
              )}
              onClick={(e) => handleClick(e, item)}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(e) => onContextMenu(e, item)}
            >
              <TableCell className="flex items-center gap-2">
                <SampleSetItemIcon item={item} level={level} />
                <span className="truncate">{itemName(item)}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {typeLabel(item, level)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(item.created_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function typeLabel(item: SubsetRead | ImageRead, level: BrowseLevel): string {
  if (level === "images") return (item as ImageRead).format;
  return (item as SubsetRead).type;
}

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { LibraryItemIcon } from "./library-item-icon";
import { useLibraryStore, type SortField } from "~/stores/library";
import type { LibraryItem } from "~/api/types.gen";
import { cn } from "~/lib/utils";

interface LibraryListViewProps {
  items: LibraryItem[];
  selectedIds: string[];
  onOpen: (item: LibraryItem) => void;
  onContextMenu: (e: React.MouseEvent, item: LibraryItem) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LibraryListView({
  items,
  selectedIds,
  onOpen,
  onContextMenu,
}: LibraryListViewProps) {
  const { sortField, sortDirection, setSortField, select, selectRange } =
    useLibraryStore();

  const handleClick = (e: React.MouseEvent, item: LibraryItem) => {
    if (e.shiftKey) {
      selectRange(item.id);
    } else if (e.metaKey || e.ctrlKey) {
      select(item.id, true);
    } else {
      select(item.id);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline size-3" />
    ) : (
      <ArrowDown className="ml-1 inline size-3" />
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="w-[50%] cursor-pointer select-none"
            onClick={() => setSortField("name")}
          >
            Name
            <SortIcon field="name" />
          </TableHead>
          <TableHead className="w-[15%]">Type</TableHead>
          <TableHead
            className="w-[17.5%] cursor-pointer select-none"
            onClick={() => setSortField("created_at")}
          >
            Created
            <SortIcon field="created_at" />
          </TableHead>
          <TableHead
            className="w-[17.5%] cursor-pointer select-none"
            onClick={() => setSortField("updated_at")}
          >
            Modified
            <SortIcon field="updated_at" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground py-12 text-center">
              This folder is empty
            </TableCell>
          </TableRow>
        )}
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TableRow
              key={item.id}
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
                <LibraryItemIcon item={item} />
                <span className="truncate">{item.name}</span>
                {item.type === "folder" && item.child_count != null && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({item.child_count})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.type === "folder" ? "Folder" : "Sample Set"}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(item.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(item.updated_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

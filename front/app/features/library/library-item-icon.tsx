import { Folder, FileBox } from "lucide-react";
import type { LibraryItem } from "~/api/types.gen";
import { cn } from "~/lib/utils";

interface LibraryItemIconProps {
  item: LibraryItem;
  className?: string;
}

export function LibraryItemIcon({ item, className }: LibraryItemIconProps) {
  if (item.type === "folder") {
    return <Folder className={cn("size-4 text-amber-500", className)} />;
  }
  return <FileBox className={cn("size-4 text-blue-500", className)} />;
}

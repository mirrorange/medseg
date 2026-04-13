import { FolderOpen, FileImage } from "lucide-react";
import type { SubsetRead, ImageRead } from "~/api/types.gen";
import type { BrowseLevel } from "~/stores/sample-set";
import { cn } from "~/lib/utils";

interface SampleSetItemIconProps {
  item: SubsetRead | ImageRead;
  level: BrowseLevel;
  className?: string;
}

export function SampleSetItemIcon({ item, level, className }: SampleSetItemIconProps) {
  if (level === "images") {
    return <FileImage className={cn("text-muted-foreground size-4", className)} />;
  }
  return <FolderOpen className={cn("text-muted-foreground size-4", className)} />;
}

/** Display name for an item depending on current level */
export function itemName(item: SubsetRead | ImageRead): string {
  return "filename" in item ? item.filename : item.name;
}

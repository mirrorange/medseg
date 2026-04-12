import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, MoreHorizontal, Pencil, Trash2, FolderPlus, FilePlus } from "lucide-react";
import { NavLink } from "react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import type { FolderTreeNode } from "~/api/types.gen";

interface FolderTreeItemProps {
  node: FolderTreeNode;
  onRename: (id: string, currentName: string) => void;
  onDelete: (id: string, name: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onCreateSampleSet: (folderId: string) => void;
}

export function FolderTreeItem({
  node,
  onRename,
  onDelete,
  onCreateSubfolder,
  onCreateSampleSet,
}: FolderTreeItemProps) {
  const [open, setOpen] = useState(true);
  const hasChildren =
    (node.children && node.children.length > 0) ||
    (node.sample_sets && node.sample_sets.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""} ${!hasChildren ? "invisible" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        {open ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-sm">{node.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateSubfolder(node.id)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateSampleSet(node.id)}>
              <FilePlus className="mr-2 h-4 w-4" />
              New Sample Set
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(node.id, node.name)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(node.id, node.name)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CollapsibleContent>
        <div className="ml-4 border-l pl-2">
          {node.children?.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              onRename={onRename}
              onDelete={onDelete}
              onCreateSubfolder={onCreateSubfolder}
              onCreateSampleSet={onCreateSampleSet}
            />
          ))}
          {node.sample_sets?.map((ss) => (
            <NavLink
              key={ss.id}
              to={`/app/sample-sets/${ss.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent ${isActive ? "bg-accent font-medium" : ""}`
              }
            >
              <span className="truncate">{ss.name}</span>
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

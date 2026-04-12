import { useState } from "react";
import { NavLink } from "react-router";
import { FolderPlus, FilePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { FolderTreeItem } from "./folder-tree-item";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateSampleSetDialog } from "./create-sample-set-dialog";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { deleteApiLibraryFoldersFolderIdDelete } from "~/api";
import type { LibraryTree } from "~/api/types.gen";

interface FolderTreeProps {
  tree: LibraryTree;
  onRefresh: () => void;
}

export function FolderTree({ tree, onRefresh }: FolderTreeProps) {
  // Create folder dialog
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  // Create sample set dialog
  const [createSSOpen, setCreateSSOpen] = useState(false);
  const [createSSFolderId, setCreateSSFolderId] = useState<string | null>(null);

  // Rename folder dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteFolderName, setDeleteFolderName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleCreateSubfolder(parentId: string) {
    setCreateFolderParentId(parentId);
    setCreateFolderOpen(true);
  }

  function handleCreateSampleSet(folderId: string) {
    setCreateSSFolderId(folderId);
    setCreateSSOpen(true);
  }

  function handleRename(id: string, name: string) {
    setRenameFolderId(id);
    setRenameFolderName(name);
    setRenameOpen(true);
  }

  function handleDelete(id: string, name: string) {
    setDeleteFolderId(id);
    setDeleteFolderName(name);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteFolderId) return;
    setDeleteLoading(true);
    await deleteApiLibraryFoldersFolderIdDelete({
      path: { folder_id: deleteFolderId },
    });
    setDeleteLoading(false);
    setDeleteOpen(false);
    onRefresh();
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-lg font-semibold">Library</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setCreateFolderParentId(null);
              setCreateFolderOpen(true);
            }}
            title="New Folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setCreateSSFolderId(null);
              setCreateSSOpen(true);
            }}
            title="New Sample Set"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5">
          {tree.folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              node={folder}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreateSubfolder={handleCreateSubfolder}
              onCreateSampleSet={handleCreateSampleSet}
            />
          ))}
          {tree.root_sample_sets.map((ss) => (
            <NavLink
              key={ss.id}
              to={`/app/sample-sets/${ss.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${isActive ? "bg-accent font-medium" : ""}`
              }
            >
              <span className="truncate">{ss.name}</span>
            </NavLink>
          ))}
          {tree.folders.length === 0 && tree.root_sample_sets.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No items yet. Create a folder or sample set to get started.
            </div>
          )}
        </div>
      </ScrollArea>

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        parentId={createFolderParentId}
        onCreated={onRefresh}
      />
      <CreateSampleSetDialog
        open={createSSOpen}
        onOpenChange={setCreateSSOpen}
        folderId={createSSFolderId}
        onCreated={onRefresh}
      />
      <RenameFolderDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        folderId={renameFolderId}
        currentName={renameFolderName}
        onRenamed={onRefresh}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Folder"
        description={`Are you sure you want to delete "${deleteFolderName}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        destructive
      />
    </>
  );
}

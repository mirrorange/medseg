import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  updateApiSampleSetsSampleSetIdSubsetsSubsetIdPut,
  updateApiSampleSetsSampleSetIdSubsetsSubsetIdImagesImageIdPut,
} from "~/api";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleSetId: string;
  /** "subset" or "image" */
  type: "subset" | "image";
  itemId: string;
  /** subsetId is needed when renaming an image */
  subsetId?: string;
  currentName: string;
  onRenamed: () => void;
}

export function RenameDialog({
  open, onOpenChange, sampleSetId, type, itemId, subsetId, currentName, onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
    setError(null);
  }, [currentName, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let apiError: unknown = null;

    if (type === "subset") {
      const res = await updateApiSampleSetsSampleSetIdSubsetsSubsetIdPut({
        path: { sample_set_id: sampleSetId, subset_id: itemId },
        body: { name },
      });
      apiError = res.error;
    } else if (subsetId) {
      const res = await updateApiSampleSetsSampleSetIdSubsetsSubsetIdImagesImageIdPut({
        path: { sample_set_id: sampleSetId, subset_id: subsetId, image_id: itemId },
        body: { filename: name },
      });
      apiError = res.error;
    }

    setLoading(false);
    if (apiError) {
      setError(
        (apiError as { detail?: { message?: string } })?.detail?.message ?? "Failed to rename",
      );
      return;
    }

    onOpenChange(false);
    onRenamed();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {type === "subset" ? "Subset" : "Image"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-input">Name</Label>
              <Input
                id="rename-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

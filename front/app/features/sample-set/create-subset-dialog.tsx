import { useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createApiSampleSetsSampleSetIdSubsetsPost } from "~/api";

interface CreateSubsetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleSetId: string;
  onCreated: () => void;
}

export function CreateSubsetDialog({
  open, onOpenChange, sampleSetId, onCreated,
}: CreateSubsetDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: apiError } = await createApiSampleSetsSampleSetIdSubsetsPost({
      path: { sample_set_id: sampleSetId },
      body: { name, type: "raw" },
    });

    setLoading(false);
    if (apiError) {
      setError(
        (apiError as { detail?: { message?: string } })?.detail?.message ?? "Failed to create subset",
      );
      return;
    }

    setName("");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Subset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="subset-name">Name</Label>
              <Input
                id="subset-name"
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
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

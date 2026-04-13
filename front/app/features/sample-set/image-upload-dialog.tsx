import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  uploadApiSampleSetsSampleSetIdSubsetsSubsetIdImagesPost,
} from "~/api";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleSetId: string;
  subsetId: string;
  onUploaded: () => void;
}

export function ImageUploadDialog({
  open, onOpenChange, sampleSetId, subsetId, onUploaded,
}: ImageUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles(Array.from(selected));
    setError(null);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress(0);

    let uploaded = 0;
    for (const file of files) {
      const { error: apiError } = await uploadApiSampleSetsSampleSetIdSubsetsSubsetIdImagesPost({
        path: { sample_set_id: sampleSetId, subset_id: subsetId },
        body: { file },
      });

      if (apiError) {
        setError(
          (apiError as { detail?: { message?: string } })?.detail?.message ??
            `Failed to upload ${file.name}`,
        );
        break;
      }

      uploaded++;
      setProgress(uploaded);
    }

    setUploading(false);

    if (inputRef.current) inputRef.current.value = "";

    if (uploaded > 0) {
      onUploaded();
      if (uploaded === files.length) {
        setFiles([]);
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); setFiles([]); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Images</DialogTitle>
          <DialogDescription>Select medical image files to upload to this subset.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6">
            <Upload className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">
              {files.length > 0
                ? `${files.length} file(s) selected`
                : "Click to select files"}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".nii,.nii.gz,.dcm,.nrrd"
              onChange={handleFileChange}
              className="hidden"
              id="upload-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Browse Files
            </Button>
          </div>

          {uploading && (
            <div className="text-muted-foreground text-center text-sm">
              Uploading {progress} / {files.length}...
            </div>
          )}

          {files.length > 0 && !uploading && (
            <div className="max-h-32 overflow-auto text-xs">
              {files.map((f, i) => (
                <div key={i} className="text-muted-foreground truncate">{f.name}</div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => { onOpenChange(false); setFiles([]); }}>
            Cancel
          </Button>
          <Button disabled={uploading || files.length === 0} onClick={handleUpload}>
            {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

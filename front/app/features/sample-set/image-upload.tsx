import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "~/components/ui/button";
import { uploadApiSampleSetsSampleSetIdSubsetsSubsetIdImagesPost } from "~/api";

interface ImageUploadProps {
  sampleSetId: string;
  subsetId: string;
  onUploaded: () => void;
}

export function ImageUpload({ sampleSetId, subsetId, onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const { error: apiError } =
      await uploadApiSampleSetsSampleSetIdSubsetsSubsetIdImagesPost({
        path: { sample_set_id: sampleSetId, subset_id: subsetId },
        body: { file },
      });

    setUploading(false);

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";

    if (apiError) {
      setError(
        (apiError as { detail?: { message?: string } })?.detail?.message ??
          "Upload failed"
      );
      return;
    }

    onUploaded();
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".nii,.nii.gz,.dcm,.nrrd"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

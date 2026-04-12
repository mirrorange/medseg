import { useState, useEffect, useCallback } from "react";
import { redirect, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/viewer.$setId.$subsetId";
import { Button } from "~/components/ui/button";
import {
  getDetailApiSampleSetsSampleSetIdSubsetsSubsetIdGet,
  listAllApiSampleSetsSampleSetIdSubsetsSubsetIdImagesGet,
} from "~/api";
import type { ImageRead, SubsetDetail } from "~/api/types.gen";
import { useAuthStore } from "~/stores/auth";

// Lazy imports — Cornerstone modules are heavy
let cornerstoneInitialized = false;

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: `Viewer - ${data?.subset?.name ?? "Image"} - MedSeg Cloud`,
    },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { data: subset, error: subsetErr } =
    await getDetailApiSampleSetsSampleSetIdSubsetsSubsetIdGet({
      path: {
        sample_set_id: params.setId!,
        subset_id: params.subsetId!,
      },
    });
  if (subsetErr || !subset) throw redirect("/app/library");

  return {
    subset,
    setId: params.setId!,
    subsetId: params.subsetId!,
  };
}

export default function ViewerPage({ loaderData }: Route.ComponentProps) {
  const { subset, setId, subsetId } = loaderData;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const [volumeId, setVolumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamically import heavy modules
  const [ViewerComponents, setViewerComponents] = useState<{
    MprViewer: typeof import("~/features/viewer/mpr-viewer").MprViewer;
    ViewerToolbar: typeof import("~/features/viewer/viewer-toolbar").ViewerToolbar;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        { initCornerstone },
        { MprViewer },
        { ViewerToolbar },
      ] = await Promise.all([
        import("~/features/viewer/cornerstone-init"),
        import("~/features/viewer/mpr-viewer"),
        import("~/features/viewer/viewer-toolbar"),
      ]);

      if (cancelled) return;

      await initCornerstone();
      cornerstoneInitialized = true;

      setViewerComponents({ MprViewer, ViewerToolbar });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the first image from the subset as a volume
  useEffect(() => {
    if (!ViewerComponents) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      // Fetch images in this subset
      const { data: images } =
        await listAllApiSampleSetsSampleSetIdSubsetsSubsetIdImagesGet({
          path: { sample_set_id: setId, subset_id: subsetId },
        });

      if (cancelled) return;

      if (!images || images.length === 0) {
        setError("No images in this subset");
        setLoading(false);
        return;
      }

      try {
        const image = images[0];
        const vid = await loadImageAsVolume(image, setId, subsetId, token!);
        if (!cancelled) {
          setVolumeId(vid);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load image"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ViewerComponents, setId, subsetId, token]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/app/sample-sets/${setId}`)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <span className="text-sm font-medium">{subset.name}</span>
        <div className="flex-1" />
        {ViewerComponents && <ViewerComponents.ViewerToolbar />}
      </div>

      {/* Viewer area */}
      <div className="flex-1">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading volume...
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && ViewerComponents && (
          <ViewerComponents.MprViewer volumeId={volumeId} />
        )}
      </div>
    </div>
  );
}

/**
 * Download an image file and load it as a Cornerstone volume.
 */
async function loadImageAsVolume(
  image: ImageRead,
  sampleSetId: string,
  subsetId: string,
  token: string
): Promise<string> {
  const { volumeLoader, imageLoader } = await import("@cornerstonejs/core");
  const { createNiftiImageIdsAndCacheMetadata } = await import(
    "@cornerstonejs/nifti-volume-loader"
  );

  const downloadUrl = `/api/sample-sets/${sampleSetId}/subsets/${subsetId}/images/${image.id}/download`;

  const format = image.format.toLowerCase();

  if (format === "nifti") {
    // Download the file, create a blob URL, then use the NIfTI loader
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to download image");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const imageIds = await createNiftiImageIdsAndCacheMetadata({
      url: blobUrl,
    });

    const volumeId = `niftiVolume:${image.id}`;
    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageIds,
    });
    await volume.load();
    return volumeId;
  }

  if (format === "dicom") {
    // For DICOM, we'd need multiple imageIds for a series
    // For now, load single file via wadouri
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to download image");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const imageId = `wadouri:${blobUrl}`;
    const volumeId = `cornerstoneStreamingImageVolume:${image.id}`;
    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageIds: [imageId],
    });
    await volume.load();
    return volumeId;
  }

  throw new Error(`Unsupported image format: ${image.format}`);
}

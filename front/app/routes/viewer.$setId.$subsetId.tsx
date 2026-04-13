import { useState, useEffect, useCallback, useRef } from "react";
import { redirect, useNavigate, useSearchParams } from "react-router";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useAuthStore((s) => s.token);

  const [images, setImages] = useState<ImageRead[]>([]);
  const [currentImageId, setCurrentImageId] = useState<string | null>(
    searchParams.get("imageId"),
  );
  const [volumeId, setVolumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track loaded volume IDs for cleanup
  const loadedVolumesRef = useRef<string[]>([]);

  // Dynamically import heavy modules
  const [ViewerComponents, setViewerComponents] = useState<{
    MprViewer: typeof import("~/features/viewer/mpr-viewer").MprViewer;
    ViewerToolbar: typeof import("~/features/viewer/viewer-toolbar").ViewerToolbar;
    ImageNavigator: typeof import("~/features/viewer/image-navigator").ImageNavigator;
    addSegmentationOverlay: typeof import("~/features/viewer/segmentation-overlay").addSegmentationOverlay;
    removeSegmentationOverlay: typeof import("~/features/viewer/segmentation-overlay").removeSegmentationOverlay;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        { initCornerstone },
        { MprViewer },
        { ViewerToolbar },
        { ImageNavigator },
        { addSegmentationOverlay, removeSegmentationOverlay },
      ] = await Promise.all([
        import("~/features/viewer/cornerstone-init"),
        import("~/features/viewer/mpr-viewer"),
        import("~/features/viewer/viewer-toolbar"),
        import("~/features/viewer/image-navigator"),
        import("~/features/viewer/segmentation-overlay"),
      ]);

      if (cancelled) return;

      await initCornerstone();
      setViewerComponents({
        MprViewer,
        ViewerToolbar,
        ImageNavigator,
        addSegmentationOverlay,
        removeSegmentationOverlay,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch images list for this subset
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } =
        await listAllApiSampleSetsSampleSetIdSubsetsSubsetIdImagesGet({
          path: { sample_set_id: setId, subset_id: subsetId },
        });
      if (cancelled) return;

      const list = data ?? [];
      setImages(list);

      // If no imageId in URL, default to first image
      if (!currentImageId && list.length > 0) {
        setCurrentImageId(list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId, subsetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the current image as a volume whenever it changes
  useEffect(() => {
    if (!ViewerComponents || !currentImageId || images.length === 0) return;

    const image = images.find((img) => img.id === currentImageId);
    if (!image) return;

    let cancelled = false;
    const { addSegmentationOverlay, removeSegmentationOverlay } = ViewerComponents;

    (async () => {
      setLoading(true);
      setError(null);

      // Clean up previous segmentation overlay
      try {
        removeSegmentationOverlay("seg_overlay");
      } catch {
        // ignore
      }

      try {
        const vid = await loadImageAsVolume(image, setId, subsetId, token!);
        if (cancelled) return;

        loadedVolumesRef.current.push(vid);
        setVolumeId(vid);

        // Check if this is a segmentation subset — load source overlay
        const isSegmentation = subset.metadata_?.is_segmentation === true;
        const sourceSubsetId = subset.source_subset_id;

        if (isSegmentation && sourceSubsetId && image.source_image_id) {
          try {
            // Load the corresponding source image
            const sourceImage: ImageRead = {
              id: image.source_image_id,
              filename: "",
              format: image.format,
              subset_id: sourceSubsetId,
              storage_path: "",
              source_image_id: null,
              metadata_: {},
              created_at: "",
            };
            const sourceVid = await loadImageAsVolume(
              sourceImage,
              setId,
              sourceSubsetId,
              token!,
            );
            if (!cancelled) {
              loadedVolumesRef.current.push(sourceVid);
              // Swap: show source as base, segmentation as overlay
              setVolumeId(sourceVid);
              await addSegmentationOverlay(sourceVid, vid, "seg_overlay");
            }
          } catch {
            // If source fails, still show the segmentation volume alone
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load image",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ViewerComponents, currentImageId, images, setId, subsetId, subset, token]);

  // Handle image selection from navigator
  const handleSelectImage = useCallback(
    (imageId: string) => {
      setCurrentImageId(imageId);
      setSearchParams({ imageId }, { replace: true });
    },
    [setSearchParams],
  );

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

      {/* Viewer area + image navigator */}
      <div className="flex flex-1 min-h-0">
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

        {/* Side panel: image navigator */}
        {ViewerComponents && images.length > 0 && (
          <ViewerComponents.ImageNavigator
            images={images}
            currentImageId={currentImageId}
            onSelect={handleSelectImage}
          />
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

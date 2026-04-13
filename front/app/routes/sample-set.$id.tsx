import { useState, useCallback } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/sample-set.$id";
import { toast } from "sonner";
import {
  getDetailApiSampleSetsSampleSetIdGet,
  deleteApiSampleSetsSampleSetIdDelete,
  deleteApiSampleSetsSampleSetIdSubsetsSubsetIdDelete,
  deleteApiSampleSetsSampleSetIdSubsetsSubsetIdImagesImageIdDelete,
  publishSharedApiLibrarySharedSampleSetIdPost,
} from "~/api";
import type { SubsetRead, ImageRead } from "~/api/types.gen";
import { SampleSetBrowser } from "~/features/sample-set/sample-set-browser";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSampleSetStore } from "~/stores/sample-set";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.sampleSet?.name ?? "Sample Set"} - MedSeg Cloud` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { data, error } = await getDetailApiSampleSetsSampleSetIdGet({
    path: { sample_set_id: params.id! },
  });
  if (error || !data) throw redirect("/app/library");
  return { sampleSet: data };
}

export default function SampleSetDetailPage({
  loaderData,
}: Route.ComponentProps) {
  const { sampleSet } = loaderData;

  // Delete sample set
  const [deleteSSOpen, setDeleteSSOpen] = useState(false);
  const [deleteSSLoading, setDeleteSSLoading] = useState(false);

  // Delete confirmation (subsets or images)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDescription, setDeleteDescription] = useState("");

  // Context menu (placeholder for Stage 5)
  const handleContextMenu = useCallback(
    (_e: React.MouseEvent, _item: SubsetRead | ImageRead | null) => {
      // Will be implemented in Stage 5
    },
    [],
  );

  // Share
  const handleShare = useCallback(() => {
    publishSharedApiLibrarySharedSampleSetIdPost({
      path: { sample_set_id: sampleSet.id },
    }).then(() => toast.success("Sample set shared"));
  }, [sampleSet.id]);

  // Delete sample set
  async function handleDeleteSampleSet() {
    setDeleteSSLoading(true);
    await deleteApiSampleSetsSampleSetIdDelete({
      path: { sample_set_id: sampleSet.id },
    });
    setDeleteSSLoading(false);
    window.location.href = "/app/library";
  }

  // Delete selected items
  const handleDeleteSelected = useCallback(() => {
    const store = useSampleSetStore.getState();
    const count = store.selectedIds.length;
    if (count === 0) return;

    const noun = store.level === "subsets" ? "subset" : "image";
    setDeleteDescription(
      `Are you sure you want to delete ${count} ${noun}${count > 1 ? "s" : ""}? This action cannot be undone.`,
    );
    setDeleteOpen(true);
  }, []);

  async function confirmDeleteSelected() {
    const store = useSampleSetStore.getState();
    const ids = [...store.selectedIds];
    setDeleteLoading(true);

    if (store.level === "subsets") {
      for (const id of ids) {
        await deleteApiSampleSetsSampleSetIdSubsetsSubsetIdDelete({
          path: { sample_set_id: sampleSet.id, subset_id: id },
        });
      }
    } else if (store.currentSubsetId) {
      for (const id of ids) {
        await deleteApiSampleSetsSampleSetIdSubsetsSubsetIdImagesImageIdDelete({
          path: {
            sample_set_id: sampleSet.id,
            subset_id: store.currentSubsetId,
            image_id: id,
          },
        });
      }
    }

    setDeleteLoading(false);
    setDeleteOpen(false);
    store.clearSelection();
    void store.refresh();
  }

  // Placeholder callbacks for Stage 6
  const handleCreateSubset = useCallback(() => {
    // Will be implemented in Stage 6
    toast.info("Create subset dialog coming in Stage 6");
  }, []);

  const handleUploadImages = useCallback(() => {
    // Will be implemented in Stage 6
    toast.info("Upload dialog coming in Stage 6");
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <SampleSetBrowser
        sampleSetId={sampleSet.id}
        sampleSetName={sampleSet.name}
        onCreateSubset={handleCreateSubset}
        onUploadImages={handleUploadImages}
        onDeleteSelected={handleDeleteSelected}
        onShare={handleShare}
        onDeleteSampleSet={() => setDeleteSSOpen(true)}
        onContextMenu={handleContextMenu}
      />

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteSSOpen}
        onOpenChange={setDeleteSSOpen}
        title="Delete Sample Set"
        description={`Are you sure you want to delete "${sampleSet.name}"? All subsets and images will be permanently deleted.`}
        onConfirm={handleDeleteSampleSet}
        loading={deleteSSLoading}
        destructive
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Selected"
        description={deleteDescription}
        onConfirm={confirmDeleteSelected}
        loading={deleteLoading}
        destructive
      />
    </div>
  );
}

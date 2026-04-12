import { useState, useCallback } from "react";
import { redirect, useRevalidator } from "react-router";
import type { Route } from "./+types/sample-set.$id";
import { Pencil, Trash2, Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  getDetailApiSampleSetsSampleSetIdGet,
  deleteApiSampleSetsSampleSetIdDelete,
  deleteApiSampleSetsSampleSetIdSubsetsSubsetIdDelete,
  publishSharedApiLibrarySharedSampleSetIdPost,
  unpublishSharedApiLibrarySharedSampleSetIdDelete,
} from "~/api";
import type { ModuleAwarenessItem } from "~/api/types.gen";
import { SubsetList } from "~/features/sample-set/subset-list";
import { ImageUpload } from "~/features/sample-set/image-upload";
import { PipelineAwareness } from "~/features/sample-set/pipeline-awareness";
import { RunPipelineDialog } from "~/features/sample-set/run-pipeline-dialog";
import { ConfirmDialog } from "~/components/confirm-dialog";

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
  const revalidator = useRevalidator();

  // Delete sample set
  const [deleteSSOpen, setDeleteSSOpen] = useState(false);
  const [deleteSSLoading, setDeleteSSLoading] = useState(false);

  // Delete subset
  const [deleteSubsetOpen, setDeleteSubsetOpen] = useState(false);
  const [deleteSubsetId, setDeleteSubsetId] = useState<string | null>(null);
  const [deleteSubsetName, setDeleteSubsetName] = useState("");
  const [deleteSubsetLoading, setDeleteSubsetLoading] = useState(false);

  // Run pipeline
  const [runPipelineOpen, setRunPipelineOpen] = useState(false);
  const [selectedModule, setSelectedModule] =
    useState<ModuleAwarenessItem | null>(null);

  const refresh = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  async function handleDeleteSampleSet() {
    setDeleteSSLoading(true);
    await deleteApiSampleSetsSampleSetIdDelete({
      path: { sample_set_id: sampleSet.id },
    });
    setDeleteSSLoading(false);
    window.location.href = "/app/library";
  }

  function handleDeleteSubset(subsetId: string, name: string) {
    setDeleteSubsetId(subsetId);
    setDeleteSubsetName(name);
    setDeleteSubsetOpen(true);
  }

  async function confirmDeleteSubset() {
    if (!deleteSubsetId) return;
    setDeleteSubsetLoading(true);
    await deleteApiSampleSetsSampleSetIdSubsetsSubsetIdDelete({
      path: { sample_set_id: sampleSet.id, subset_id: deleteSubsetId },
    });
    setDeleteSubsetLoading(false);
    setDeleteSubsetOpen(false);
    refresh();
  }

  // Find the first "raw" subset for image upload
  const rawSubset = sampleSet.subsets?.find((s) => s.type === "raw");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {sampleSet.name}
          </h1>
          {sampleSet.description && (
            <p className="mt-1 text-muted-foreground">
              {sampleSet.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Created {new Date(sampleSet.created_at).toLocaleDateString()}
            </span>
            <span>·</span>
            <span>{sampleSet.subsets?.length ?? 0} subsets</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              publishSharedApiLibrarySharedSampleSetIdPost({
                path: { sample_set_id: sampleSet.id },
              })
            }
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setDeleteSSOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Image upload (only if raw subset exists) */}
      {rawSubset && (
        <ImageUpload
          sampleSetId={sampleSet.id}
          subsetId={rawSubset.id}
          onUploaded={refresh}
        />
      )}

      {/* Pipeline Awareness */}
      <PipelineAwareness
        sampleSetId={sampleSet.id}
        onRunModule={(item) => {
          setSelectedModule(item);
          setRunPipelineOpen(true);
        }}
      />

      {/* Subsets */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Subsets</h2>
        <SubsetList
          subsets={sampleSet.subsets ?? []}
          sampleSetId={sampleSet.id}
          onDelete={handleDeleteSubset}
        />
      </div>

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
        open={deleteSubsetOpen}
        onOpenChange={setDeleteSubsetOpen}
        title="Delete Subset"
        description={`Are you sure you want to delete "${deleteSubsetName}"? All images in this subset will be permanently deleted.`}
        onConfirm={confirmDeleteSubset}
        loading={deleteSubsetLoading}
        destructive
      />
      <RunPipelineDialog
        open={runPipelineOpen}
        onOpenChange={setRunPipelineOpen}
        sampleSetId={sampleSet.id}
        subsets={sampleSet.subsets ?? []}
        preselectedModule={selectedModule}
        onSubmitted={refresh}
      />
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/sample-set.$id";
import { toast } from "sonner";
import {
  getDetailApiSampleSetsSampleSetIdGet,
  deleteApiSampleSetsSampleSetIdDelete,
  deleteApiSampleSetsSampleSetIdSubsetsSubsetIdDelete,
  deleteApiSampleSetsSampleSetIdSubsetsSubsetIdImagesImageIdDelete,
} from "~/api";
import type { SubsetRead, ImageRead, ModuleAwarenessItem } from "~/api/types.gen";
import { SampleSetBrowser } from "~/features/sample-set/sample-set-browser";
import { SampleSetHeader } from "~/features/sample-set/sample-set-header";
import { CreateSubsetDialog } from "~/features/sample-set/create-subset-dialog";
import { RenameDialog } from "~/features/sample-set/rename-dialog";
import { PropertiesDialog } from "~/features/sample-set/properties-dialog";
import { ImageUploadDialog } from "~/features/sample-set/image-upload-dialog";
import { RunPipelineDialog } from "~/features/sample-set/run-pipeline-dialog";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSampleSetStore } from "~/stores/sample-set";
import { useTaskStore } from "~/stores/task";

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
  const tasks = useTaskStore((s) => s.tasks);
  const taskStatusesRef = useRef<Record<string, string>>({});

  // Delete sample set
  const [deleteSSOpen, setDeleteSSOpen] = useState(false);
  const [deleteSSLoading, setDeleteSSLoading] = useState(false);

  // Delete confirmation (subsets or images)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDescription, setDeleteDescription] = useState("");

  // Create subset
  const [createSubsetOpen, setCreateSubsetOpen] = useState(false);

  // Upload images
  const [uploadOpen, setUploadOpen] = useState(false);

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    type: "subset" | "image";
    id: string;
    subsetId?: string;
    name: string;
  } | null>(null);

  // Properties
  const [propsOpen, setPropsOpen] = useState(false);
  const [propsItem, setPropsItem] = useState<SubsetRead | ImageRead | null>(null);

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

  // Run pipeline dialog state
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineModule, setPipelineModule] = useState<ModuleAwarenessItem | null>(null);
  const [pipelineSubsetIds, setPipelineSubsetIds] = useState<string[]>([]);

  // Run pipeline on specific subsets (from context menu or primary action)
  const handleRunPipeline = useCallback(
    (module: ModuleAwarenessItem, subsetIds: string[]) => {
      setPipelineModule(module);
      setPipelineSubsetIds(subsetIds);
      setPipelineOpen(true);
    },
    [],
  );

  const handlePipelineSubmitted = useCallback(() => {
    toast.success("Pipeline task(s) submitted");
    void useSampleSetStore.getState().refresh();
  }, []);

  // Create subset
  const handleCreateSubset = useCallback(() => {
    setCreateSubsetOpen(true);
  }, []);

  // Upload images (only available when inside a subset)
  const handleUploadImages = useCallback(() => {
    setUploadOpen(true);
  }, []);

  // Rename item
  const handleRename = useCallback((item: SubsetRead | ImageRead) => {
    const store = useSampleSetStore.getState();
    if (store.level === "subsets") {
      setRenameTarget({ type: "subset", id: item.id, name: (item as SubsetRead).name });
    } else {
      setRenameTarget({
        type: "image",
        id: item.id,
        subsetId: store.currentSubsetId ?? undefined,
        name: (item as ImageRead).filename,
      });
    }
    setRenameOpen(true);
  }, []);

  // Properties
  const handleProperties = useCallback((item: SubsetRead | ImageRead) => {
    setPropsItem(item);
    setPropsOpen(true);
  }, []);

  const storeLevel = useSampleSetStore((s) => s.level);
  const storeAwareness = useSampleSetStore((s) => s.awareness);
  const storeSampleSet = useSampleSetStore((s) => s.sampleSet);
  const currentSubsetId = useSampleSetStore((s) => s.currentSubsetId);

  const storeRefresh = useCallback(() => {
    void useSampleSetStore.getState().refresh();
  }, []);

  useEffect(() => {
    const nextStatuses: Record<string, string> = {};
    let shouldRefresh = false;

    for (const task of tasks) {
      if (task.sample_set_id !== sampleSet.id) {
        continue;
      }

      nextStatuses[task.id] = task.status;

      const previousStatus = taskStatusesRef.current[task.id];
      if (previousStatus && previousStatus !== "completed" && task.status === "completed") {
        shouldRefresh = true;
      }
    }

    taskStatusesRef.current = nextStatuses;

    if (shouldRefresh) {
      void useSampleSetStore.getState().refresh();
    }
  }, [tasks, sampleSet.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SampleSetHeader
        sampleSet={storeSampleSet ?? sampleSet}
        awareness={storeAwareness}
        onPrimaryAction={handleRunPipeline}
        onUpdated={storeRefresh}
      />
      <SampleSetBrowser
        sampleSetId={sampleSet.id}
        sampleSetName={sampleSet.name}
        onCreateSubset={handleCreateSubset}
        onUploadImages={handleUploadImages}
        onDeleteSelected={handleDeleteSelected}
        onDeleteSampleSet={() => setDeleteSSOpen(true)}
        onRename={handleRename}
        onProperties={handleProperties}
        onRunPipeline={handleRunPipeline}
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
      <CreateSubsetDialog
        open={createSubsetOpen}
        onOpenChange={setCreateSubsetOpen}
        sampleSetId={sampleSet.id}
        onCreated={storeRefresh}
      />
      {renameTarget && (
        <RenameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          sampleSetId={sampleSet.id}
          type={renameTarget.type}
          itemId={renameTarget.id}
          subsetId={renameTarget.subsetId}
          currentName={renameTarget.name}
          onRenamed={storeRefresh}
        />
      )}
      <PropertiesDialog
        open={propsOpen}
        onOpenChange={setPropsOpen}
        item={propsItem}
        level={storeLevel}
      />
      {currentSubsetId && (
        <ImageUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          sampleSetId={sampleSet.id}
          subsetId={currentSubsetId}
          onUploaded={storeRefresh}
        />
      )}
      {pipelineModule && (
        <RunPipelineDialog
          open={pipelineOpen}
          onOpenChange={setPipelineOpen}
          sampleSetId={sampleSet.id}
          module={pipelineModule}
          inputSubsetIds={pipelineSubsetIds}
          subsets={sampleSet.subsets ?? []}
          onSubmitted={handlePipelineSubmitted}
        />
      )}
    </div>
  );
}

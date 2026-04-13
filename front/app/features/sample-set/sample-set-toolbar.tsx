import {
  ArrowLeft,
  FolderPlus,
  Upload,
  Grid3X3,
  List,
  RefreshCw,
  Trash2,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { useSampleSetStore, useCurrentSubsetName } from "~/stores/sample-set";
import type { AwarenessResponse } from "~/api/types.gen";

interface SampleSetToolbarProps {
  sampleSetName: string;
  awareness: AwarenessResponse | null;
  onCreateSubset: () => void;
  onUploadImages: () => void;
  onDeleteSelected: () => void;
  onShare: () => void;
  onDeleteSampleSet: () => void;
  onPrimaryAction: () => void;
}

export function SampleSetToolbar({
  sampleSetName,
  awareness,
  onCreateSubset,
  onUploadImages,
  onDeleteSelected,
  onShare,
  onDeleteSampleSet,
  onPrimaryAction,
}: SampleSetToolbarProps) {
  const level = useSampleSetStore((s) => s.level);
  const isLoading = useSampleSetStore((s) => s.isLoading);
  const viewMode = useSampleSetStore((s) => s.viewMode);
  const setViewMode = useSampleSetStore((s) => s.setViewMode);
  const goBack = useSampleSetStore((s) => s.goBack);
  const refresh = useSampleSetStore((s) => s.refresh);
  const selectedCount = useSampleSetStore((s) => s.selectedIds.length);
  const subsetName = useCurrentSubsetName();

  const isSubsets = level === "subsets";
  const isImages = level === "images";
  const hasSelection = selectedCount > 0;
  const hasPrimary = isSubsets && !!awareness?.primary;

  return (
    <div className="flex h-10 items-center gap-1 border-b px-2">
      {/* Back button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!isImages || isLoading}
            onClick={goBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Back to subsets</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isLoading}
            onClick={refresh}
          >
            <RefreshCw className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Refresh</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        <button
          className="text-muted-foreground hover:text-foreground truncate transition-colors"
          onClick={() => { if (isImages) goBack(); }}
          disabled={isSubsets}
        >
          {sampleSetName}
        </button>
        {subsetName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium">{subsetName}</span>
          </>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Primary action - always rendered, hidden when not applicable */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            hidden={!hasPrimary}
            onClick={onPrimaryAction}
          >
            <Sparkles className="size-3.5" />
            {awareness?.primary?.module_name ?? "Run"}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {hasPrimary
            ? `Run ${awareness!.primary!.module_name} on ${awareness!.primary!.recommended_subset_ids.length} recommended subset(s)`
            : "No primary action"}
        </TooltipContent>
      </Tooltip>

      {/* New Subset (subsets level only) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" hidden={!isSubsets} onClick={onCreateSubset}>
            <FolderPlus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New Subset</TooltipContent>
      </Tooltip>

      {/* Share (subsets level only) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" hidden={!isSubsets} onClick={onShare}>
            <Share2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Share</TooltipContent>
      </Tooltip>

      {/* Upload (images level only) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" hidden={!isImages} onClick={onUploadImages}>
            <Upload className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Upload Images</TooltipContent>
      </Tooltip>

      {/* Delete selected (when selection exists) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive size-7"
            hidden={!hasSelection}
            onClick={onDeleteSelected}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Delete {selectedCount || 0} selected
        </TooltipContent>
      </Tooltip>

      {/* Delete sample set (subsets level, no selection) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive size-7"
            hidden={!isSubsets || hasSelection}
            onClick={onDeleteSampleSet}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Delete Sample Set</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* View mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          >
            {viewMode === "list" ? <Grid3X3 className="size-4" /> : <List className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {viewMode === "list" ? "Grid view" : "List view"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

import {
  ArrowLeft,
  FolderPlus,
  Upload,
  Grid3X3,
  List,
  RefreshCw,
  Trash2,
  Share2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { useSampleSetStore, useCurrentSubsetName } from "~/stores/sample-set";

interface SampleSetToolbarProps {
  sampleSetName: string;
  onCreateSubset: () => void;
  onUploadImages: () => void;
  onDeleteSelected: () => void;
  onShare: () => void;
  onDeleteSampleSet: () => void;
}

export function SampleSetToolbar({
  sampleSetName,
  onCreateSubset,
  onUploadImages,
  onDeleteSelected,
  onShare,
  onDeleteSampleSet,
}: SampleSetToolbarProps) {
  const { level, isLoading, viewMode, setViewMode, goBack, refresh, selectedIds } =
    useSampleSetStore();
  const subsetName = useCurrentSubsetName();

  const hasSelection = selectedIds.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-10 items-center gap-1 border-b px-2">
        {/* Back button (only in images level) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={level !== "images" || isLoading}
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
            onClick={() => { if (level === "images") goBack(); }}
            disabled={level === "subsets"}
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

        {/* Context-sensitive actions */}
        {level === "subsets" && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={onCreateSubset}>
                  <FolderPlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Subset</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={onShare}>
                  <Share2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Share</TooltipContent>
            </Tooltip>
          </>
        )}

        {level === "images" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={onUploadImages}>
                <Upload className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Upload Images</TooltipContent>
          </Tooltip>
        )}

        {hasSelection && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-7"
                onClick={onDeleteSelected}
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Delete {selectedIds.length} selected
            </TooltipContent>
          </Tooltip>
        )}

        {level === "subsets" && !hasSelection && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-7"
                onClick={onDeleteSampleSet}
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Delete Sample Set</TooltipContent>
          </Tooltip>
        )}

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
    </TooltipProvider>
  );
}

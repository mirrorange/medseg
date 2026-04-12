import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FolderPlus,
  FilePlus,
  Grid3X3,
  List,
  RefreshCw,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { useLibraryStore } from "~/stores/library";

interface LibraryToolbarProps {
  onCreateFolder: () => void;
  onCreateSampleSet: () => void;
}

export function LibraryToolbar({
  onCreateFolder,
  onCreateSampleSet,
}: LibraryToolbarProps) {
  const {
    history,
    historyIndex,
    breadcrumb,
    isLoading,
    viewMode,
    setViewMode,
    goBack,
    goForward,
    goUp,
    refresh,
  } = useLibraryStore();

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;
  const canGoUp = breadcrumb.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-10 items-center gap-1 border-b px-2">
        {/* Navigation buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canGoBack || isLoading}
              onClick={goBack}
            >
              <ArrowLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canGoForward || isLoading}
              onClick={goForward}
            >
              <ArrowRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Forward</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!canGoUp || isLoading}
              onClick={goUp}
            >
              <ArrowUp className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Up</TooltipContent>
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
        <div className="min-w-0 flex-1">
          <LibraryBreadcrumb />
        </div>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onCreateFolder}
            >
              <FolderPlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Folder</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onCreateSampleSet}
            >
              <FilePlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Sample Set</TooltipContent>
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
              {viewMode === "list" ? (
                <Grid3X3 className="size-4" />
              ) : (
                <List className="size-4" />
              )}
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

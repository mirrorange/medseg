import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router";
import { Share2, Sparkles, Check, X, LinkIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  updateApiSampleSetsSampleSetIdPut,
  pathApiLibraryPathFolderIdGet,
  publishSharedApiLibrarySharedSampleSetIdPost,
  unpublishSharedApiLibrarySharedSampleSetIdDelete,
} from "~/api";
import type { SampleSetDetail, AwarenessResponse, ModuleAwarenessItem } from "~/api/types.gen";
import { buildLibraryUrlFromBreadcrumb } from "~/features/library/library-path";

interface SampleSetHeaderProps {
  sampleSet: SampleSetDetail;
  awareness: AwarenessResponse | null;
  onPrimaryAction: (module: ModuleAwarenessItem, subsetIds: string[]) => void;
  onUpdated: () => void;
}

export function SampleSetHeader({
  sampleSet,
  awareness,
  onPrimaryAction,
  onUpdated,
}: SampleSetHeaderProps) {
  const hasPrimary = !!awareness?.primary;
  const isShared = sampleSet.is_shared ?? false;

  // Inline edit: name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(sampleSet.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Inline edit: description
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(sampleSet.description ?? "");
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // Sharing state
  const [shareLoading, setShareLoading] = useState(false);
  const [folderLink, setFolderLink] = useState("/app/library");

  // Sync values if sampleSet changes externally
  useEffect(() => {
    setNameValue(sampleSet.name);
    setDescValue(sampleSet.description ?? "");
  }, [sampleSet.name, sampleSet.description]);

  useEffect(() => {
    let cancelled = false;

    async function loadFolderLink() {
      if (!sampleSet.folder_id) {
        setFolderLink("/app/library");
        return;
      }

      const { data } = await pathApiLibraryPathFolderIdGet({
        path: { folder_id: sampleSet.folder_id },
      });

      if (!cancelled) {
        setFolderLink(data ? buildLibraryUrlFromBreadcrumb(data) : "/app/library");
      }
    }

    void loadFolderLink();

    return () => {
      cancelled = true;
    };
  }, [sampleSet.folder_id]);

  // Focus input on edit start
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingDesc) descInputRef.current?.focus();
  }, [editingDesc]);

  // Save name
  const saveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === sampleSet.name) {
      setEditingName(false);
      setNameValue(sampleSet.name);
      return;
    }
    const { error } = await updateApiSampleSetsSampleSetIdPut({
      path: { sample_set_id: sampleSet.id },
      body: { name: trimmed },
    });
    if (error) {
      toast.error("Failed to update name");
      setNameValue(sampleSet.name);
    }
    setEditingName(false);
    onUpdated();
  }, [nameValue, sampleSet.id, sampleSet.name, onUpdated]);

  // Save description
  const saveDesc = useCallback(async () => {
    const trimmed = descValue.trim();
    if (trimmed === (sampleSet.description ?? "")) {
      setEditingDesc(false);
      return;
    }
    const { error } = await updateApiSampleSetsSampleSetIdPut({
      path: { sample_set_id: sampleSet.id },
      body: { description: trimmed || null },
    });
    if (error) {
      toast.error("Failed to update description");
      setDescValue(sampleSet.description ?? "");
    }
    setEditingDesc(false);
    onUpdated();
  }, [descValue, sampleSet.id, sampleSet.description, onUpdated]);

  // Toggle share
  const toggleShare = useCallback(async () => {
    setShareLoading(true);
    if (isShared) {
      const { error } = await unpublishSharedApiLibrarySharedSampleSetIdDelete({
        path: { sample_set_id: sampleSet.id },
      });
      if (error) toast.error("Failed to unshare");
      else toast.success("Sample set unshared");
    } else {
      const { error } = await publishSharedApiLibrarySharedSampleSetIdPost({
        path: { sample_set_id: sampleSet.id },
      });
      if (error) toast.error("Failed to share");
      else toast.success("Sample set shared");
    }
    setShareLoading(false);
    onUpdated();
  }, [isShared, sampleSet.id, onUpdated]);

  // Primary action handler
  const handlePrimaryAction = useCallback(() => {
    const primary = awareness?.primary;
    if (!primary) return;
    onPrimaryAction(primary, primary.recommended_subset_ids);
  }, [awareness, onPrimaryAction]);

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to="/app/library"
          className="hover:text-foreground transition-colors"
        >
          Library
        </Link>
        {sampleSet.folder_id && sampleSet.folder_name && (
          <>
            <ChevronRight className="size-3.5 shrink-0" />
            <Link
              to={folderLink}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {sampleSet.folder_name}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground truncate max-w-[300px]">
          {sampleSet.name}
        </span>
      </nav>

      <div className="flex items-start justify-between gap-4">
      {/* Left: name + description */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Name */}
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameInputRef}
              className="bg-transparent text-lg font-semibold outline-none border-b border-primary"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName();
                if (e.key === "Escape") {
                  setNameValue(sampleSet.name);
                  setEditingName(false);
                }
              }}
              onBlur={() => void saveName()}
            />
          </div>
        ) : (
          <button
            className="w-fit text-left text-lg font-semibold hover:text-primary transition-colors"
            onClick={() => setEditingName(true)}
            title="Click to edit name"
          >
            {sampleSet.name}
          </button>
        )}

        {/* Description */}
        {editingDesc ? (
          <div className="flex items-start gap-1">
            <textarea
              ref={descInputRef}
              className="min-h-[2.5rem] w-full resize-none bg-transparent text-sm text-muted-foreground outline-none border-b border-primary"
              value={descValue}
              rows={3}
              placeholder="Add a description…"
              onChange={(e) => setDescValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveDesc();
                }
                if (e.key === "Escape") {
                  setDescValue(sampleSet.description ?? "");
                  setEditingDesc(false);
                }
              }}
              onBlur={() => void saveDesc()}
            />
          </div>
        ) : (
          <button
            className="w-fit max-w-full text-left text-sm text-muted-foreground whitespace-pre-line hover:text-foreground transition-colors"
            onClick={() => setEditingDesc(true)}
            title="Click to edit description"
          >
            {sampleSet.description || "Add a description…"}
          </button>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Primary action */}
        {hasPrimary && (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={handlePrimaryAction}
          >
            <Sparkles className="size-4" />
            {awareness!.primary!.module_name}
          </Button>
        )}

        {/* Share / Unshare */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isShared ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              disabled={shareLoading}
              onClick={toggleShare}
            >
              {isShared ? (
                <>
                  <LinkIcon className="size-4" />
                  Shared
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  Share
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isShared ? "Click to unshare" : "Share this sample set"}
          </TooltipContent>
        </Tooltip>
      </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useLibraryStore } from "~/stores/library";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  formatLibraryDisplayPath,
  normalizeLibraryInput,
} from "./library-path";
import { useLibraryRouteNavigation } from "./use-library-route-navigation";

/**
 * Dual-mode address bar (inspired by XDeck / Windows Explorer):
 * - Display mode: clickable path segments, click empty area to enter edit mode
 * - Edit mode: text input showing the path, Enter to navigate / Escape to cancel
 */
export function LibraryAddressBar() {
  const { breadcrumb, isLoading } = useLibraryStore();
  const { goRoot, goToBreadcrumb, goToSegments } = useLibraryRouteNavigation();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pathText = formatLibraryDisplayPath(breadcrumb.map((crumb) => crumb.name));

  const enterEdit = () => {
    setInputValue(pathText);
    setEditing(true);
  };

  const handleSubmit = () => {
    setEditing(false);
    const trimmed = inputValue.trim();
    if (!trimmed || trimmed === pathText) return;

    const segments = normalizeLibraryInput(trimmed);
    if (segments === null) return;
    goToSegments(segments);
  };

  const handleCancel = () => {
    setEditing(false);
    setInputValue(pathText);
  };

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className="h-7 flex-1 font-mono text-sm"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
          }
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-7 flex-1 cursor-text items-center gap-0.5 overflow-x-auto rounded-md bg-muted/50 px-2 text-sm",
        isLoading && "pointer-events-none opacity-50",
      )}
      onClick={enterEdit}
    >
      {/* Root "Library" segment */}
      <button
        className="text-muted-foreground hover:text-foreground shrink-0 px-1 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          goRoot();
        }}
      >
        Library
      </button>

      {/* Path segments */}
      {breadcrumb.map((crumb, i) => {
        const isLast = i === breadcrumb.length - 1;
        return (
          <span key={crumb.id} className="flex shrink-0 items-center gap-0.5">
            <span className="text-muted-foreground/40">/</span>
            <button
              className={cn(
                "px-0.5 transition-colors hover:text-foreground",
                isLast ? "font-medium text-foreground" : "text-muted-foreground",
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLast) goToBreadcrumb(i);
              }}
            >
              {crumb.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}

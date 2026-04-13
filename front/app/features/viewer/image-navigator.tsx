import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { ImageRead } from "~/api/types.gen";

interface ImageNavigatorProps {
  images: ImageRead[];
  currentImageId: string | null;
  onSelect: (imageId: string) => void;
}

export function ImageNavigator({
  images,
  currentImageId,
  onSelect,
}: ImageNavigatorProps) {
  const currentIndex = images.findIndex((img) => img.id === currentImageId);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onSelect(images[currentIndex - 1].id);
  }, [currentIndex, images, onSelect]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) onSelect(images[currentIndex + 1].id);
  }, [currentIndex, images, onSelect]);

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  if (images.length === 0) return null;

  return (
    <div className="flex w-48 flex-col border-l">
      {/* Header: counter + prev/next */}
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={currentIndex <= 0}
          onClick={goPrev}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentIndex >= 0 ? currentIndex + 1 : "–"} / {images.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={currentIndex >= images.length - 1}
          onClick={goNext}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Image list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1">
          {images.map((img) => (
            <button
              key={img.id}
              className={`truncate rounded px-2 py-1 text-left text-xs transition-colors ${
                img.id === currentImageId
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-accent/50"
              }`}
              onClick={() => onSelect(img.id)}
              title={img.filename}
            >
              {img.filename}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

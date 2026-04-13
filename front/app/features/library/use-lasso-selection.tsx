import { useCallback, useEffect, useRef, useState } from "react";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LassoState {
  active: boolean;
  rect: Rect | null;
}

interface UseLassoSelectionOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  itemSelector: string;
  getIdFromElement: (el: Element) => string | null;
  onSelect: (ids: string[], additive: boolean) => void;
  enabled?: boolean;
}

export function useLassoSelection({
  containerRef,
  itemSelector,
  getIdFromElement,
  onSelect,
  enabled = true,
}: UseLassoSelectionOptions): LassoState {
  const [state, setState] = useState<LassoState>({ active: false, rect: null });
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const additiveRef = useRef(false);
  const activeRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Don't start lasso on items, buttons, or inputs
      if (
        target.closest("[data-library-item]") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("[data-slot='context-menu']")
      ) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      e.preventDefault();
      startPoint.current = { x: e.clientX, y: e.clientY };
      additiveRef.current = e.shiftKey || e.metaKey || e.ctrlKey;
      activeRef.current = false;
    },
    [containerRef, enabled],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!startPoint.current) return;

      const dx = e.clientX - startPoint.current.x;
      const dy = e.clientY - startPoint.current.y;

      // 5px threshold to avoid accidental lassos
      if (!activeRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        return;
      }
      activeRef.current = true;

      const rect: Rect = {
        x: Math.min(startPoint.current.x, e.clientX),
        y: Math.min(startPoint.current.y, e.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };

      setState({ active: true, rect });

      const container = containerRef.current;
      if (!container) return;

      const items = container.querySelectorAll(itemSelector);
      const selectedIds: string[] = [];

      for (const item of items) {
        const itemRect = item.getBoundingClientRect();
        if (rectsIntersect(rect, itemRect)) {
          const id = getIdFromElement(item);
          if (id) selectedIds.push(id);
        }
      }

      onSelect(selectedIds, additiveRef.current);
    },
    [containerRef, itemSelector, getIdFromElement, onSelect],
  );

  const handleMouseUp = useCallback(() => {
    if (startPoint.current) {
      startPoint.current = null;
      activeRef.current = false;
      setState({ active: false, rect: null });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, enabled, handleMouseDown, handleMouseMove, handleMouseUp]);

  return state;
}

export function LassoOverlay({ rect }: { rect: Rect | null }) {
  if (!rect) return null;

  return (
    <div
      className="pointer-events-none fixed z-40 rounded-sm border border-primary/60 bg-primary/10"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}

function rectsIntersect(a: Rect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    a.x > b.right ||
    a.y + a.height < b.top ||
    a.y > b.bottom
  );
}

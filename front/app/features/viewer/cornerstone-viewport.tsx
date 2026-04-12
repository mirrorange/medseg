import { useEffect, useRef } from "react";
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  getRenderingEngine,
} from "@cornerstonejs/core";
import { ToolGroupManager } from "@cornerstonejs/tools";
import { RENDERING_ENGINE_ID, TOOL_GROUP_ID } from "./cornerstone-init";

const { ViewportType, OrientationAxis } = Enums;

export type Orientation = "axial" | "sagittal" | "coronal";

const ORIENTATION_MAP: Record<Orientation, Enums.OrientationAxis> = {
  axial: OrientationAxis.AXIAL,
  sagittal: OrientationAxis.SAGITTAL,
  coronal: OrientationAxis.CORONAL,
};

interface CornerstoneViewportProps {
  viewportId: string;
  orientation: Orientation;
  volumeId: string | null;
  className?: string;
}

export function CornerstoneViewport({
  viewportId,
  orientation,
  volumeId,
  className,
}: CornerstoneViewportProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    // Create or reuse rendering engine
    let renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) {
      renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    }

    const viewportInput = {
      viewportId,
      element: elementRef.current,
      type: ViewportType.ORTHOGRAPHIC,
      defaultOptions: {
        orientation: ORIENTATION_MAP[orientation],
      },
    };

    renderingEngine.enableElement(viewportInput);

    // Add viewport to tool group
    const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
    toolGroup?.addViewport(viewportId, RENDERING_ENGINE_ID);

    return () => {
      const engine = getRenderingEngine(RENDERING_ENGINE_ID);
      engine?.disableElement(viewportId);
      toolGroup?.removeViewports(RENDERING_ENGINE_ID, viewportId);
    };
  }, [viewportId, orientation]);

  // When volumeId changes, set the volume
  useEffect(() => {
    if (!volumeId) return;

    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) return;

    setVolumesForViewports(
      renderingEngine,
      [{ volumeId }],
      [viewportId]
    ).then(() => {
      renderingEngine.render();
    });
  }, [volumeId, viewportId]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

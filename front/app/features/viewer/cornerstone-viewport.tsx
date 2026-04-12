import { useEffect, useRef } from "react";
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  getRenderingEngine,
  VolumeViewport3D,
} from "@cornerstonejs/core";
import type { Types } from "@cornerstonejs/core";
import { ToolGroupManager } from "@cornerstonejs/tools";
import { RENDERING_ENGINE_ID, TOOL_GROUP_ID } from "./cornerstone-init";

const { ViewportType, OrientationAxis } = Enums;

export type Orientation = "axial" | "sagittal" | "coronal";

const ORIENTATION_MAP: Record<Orientation, Enums.OrientationAxis> = {
  axial: OrientationAxis.AXIAL,
  sagittal: OrientationAxis.SAGITTAL,
  coronal: OrientationAxis.CORONAL,
};

interface CornerstoneViewportBaseProps {
  viewportId: string;
  volumeId: string | null;
  className?: string;
}

interface OrthographicProps extends CornerstoneViewportBaseProps {
  type?: "orthographic";
  orientation: Orientation;
  preset?: never;
}

interface Volume3DProps extends CornerstoneViewportBaseProps {
  type: "volume3d";
  orientation?: never;
  preset?: string;
}

export type CornerstoneViewportProps = OrthographicProps | Volume3DProps;

export function CornerstoneViewport(props: CornerstoneViewportProps) {
  const { viewportId, volumeId, className } = props;
  const elementRef = useRef<HTMLDivElement>(null);
  const is3D = props.type === "volume3d";

  useEffect(() => {
    if (!elementRef.current) return;

    let renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) {
      renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    }

    const viewportInput: Types.PublicViewportInput = is3D
      ? {
          viewportId,
          element: elementRef.current,
          type: ViewportType.VOLUME_3D,
          defaultOptions: {
            background: [0.2, 0.2, 0.2] as Types.Point3,
          },
        }
      : {
          viewportId,
          element: elementRef.current,
          type: ViewportType.ORTHOGRAPHIC,
          defaultOptions: {
            orientation: ORIENTATION_MAP[props.orientation],
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
  }, [viewportId, is3D, props.type === "orthographic" ? props.orientation : undefined]);

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
      if (is3D) {
        const viewport = renderingEngine.getViewport(viewportId) as VolumeViewport3D;
        const presetName = (props.type === "volume3d" && props.preset) || "CT-Bone";
        viewport.setProperties({ preset: presetName });
      }
      renderingEngine.render();
    });
  }, [volumeId, viewportId, is3D, props.type === "volume3d" ? props.preset : undefined]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

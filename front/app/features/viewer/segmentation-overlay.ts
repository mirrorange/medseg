import { volumeLoader, getRenderingEngine } from "@cornerstonejs/core";
import {
  segmentation,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { RENDERING_ENGINE_ID } from "./cornerstone-init";

const VIEWPORT_IDS = ["MPR_AXIAL", "MPR_SAGITTAL", "MPR_CORONAL"];

/**
 * Add a segmentation labelmap overlay to the MPR viewports.
 *
 * @param sourceVolumeId - The base volume to derive the labelmap from
 * @param segVolumeId - The loaded segmentation volume ID
 * @param segmentationId - A unique segmentation identifier
 */
export async function addSegmentationOverlay(
  sourceVolumeId: string,
  segVolumeId: string,
  segmentationId: string
) {
  // Register the segmentation in the state manager
  segmentation.addSegmentations([
    {
      segmentationId,
      representation: {
        type: csToolsEnums.SegmentationRepresentations.Labelmap,
        data: {
          volumeId: segVolumeId,
        },
      },
    },
  ]);

  // Build viewport → segmentation representation map
  const viewportMap: Record<string, Array<{ segmentationId: string }>> = {};
  for (const vpId of VIEWPORT_IDS) {
    viewportMap[vpId] = [{ segmentationId }];
  }

  await segmentation.addLabelmapRepresentationToViewportMap(viewportMap);

  // Re-render
  const engine = getRenderingEngine(RENDERING_ENGINE_ID);
  engine?.render();
}

/**
 * Remove a segmentation overlay from state.
 */
export function removeSegmentationOverlay(segmentationId: string) {
  segmentation.removeSegmentation(segmentationId);
  const engine = getRenderingEngine(RENDERING_ENGINE_ID);
  engine?.render();
}

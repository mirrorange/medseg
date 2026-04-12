import {
  init as coreInit,
  imageLoader,
  volumeLoader,
} from "@cornerstonejs/core";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import {
  cornerstoneNiftiImageLoader,
} from "@cornerstonejs/nifti-volume-loader";
import {
  init as cornerstoneToolsInit,
  addTool,
  WindowLevelTool,
  ZoomTool,
  PanTool,
  StackScrollTool,
  BrushTool,
  ToolGroupManager,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { useAuthStore } from "~/stores/auth";

let initialized = false;

export const TOOL_GROUP_ID = "MEDSEG_TOOL_GROUP";
export const RENDERING_ENGINE_ID = "MEDSEG_RENDERING_ENGINE";

export async function initCornerstone(): Promise<void> {
  if (initialized) return;

  await coreInit();
  await dicomImageLoaderInit();

  // Register NIfTI image loader
  imageLoader.registerImageLoader("nifti", cornerstoneNiftiImageLoader);

  await cornerstoneToolsInit();

  // Register tools globally
  addTool(WindowLevelTool);
  addTool(ZoomTool);
  addTool(PanTool);
  addTool(StackScrollTool);
  addTool(BrushTool);

  // Create default tool group
  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
  if (toolGroup) {
    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);

    // Brush tool instances
    toolGroup.addToolInstance("CircularBrush", BrushTool.toolName, {
      activeStrategy: "FILL_INSIDE_CIRCLE",
    });
    toolGroup.addToolInstance("CircularEraser", BrushTool.toolName, {
      activeStrategy: "ERASE_INSIDE_CIRCLE",
    });

    // Default bindings
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    });
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
    });
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
    });
    toolGroup.setToolActive(StackScrollTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
    });
  }

  initialized = true;
}

/**
 * Build the download URL for an image, including auth token.
 */
export function getImageDownloadUrl(
  sampleSetId: string,
  subsetId: string,
  imageId: string
): string {
  const token = useAuthStore.getState().token;
  return `/api/sample-sets/${sampleSetId}/subsets/${subsetId}/images/${imageId}/download?token=${encodeURIComponent(token ?? "")}`;
}

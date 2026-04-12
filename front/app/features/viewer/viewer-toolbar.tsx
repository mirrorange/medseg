import { useState } from "react";
import {
  SunDim,
  Move,
  ZoomIn,
  Paintbrush,
  Eraser,
  RotateCcw,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  ToolGroupManager,
  Enums as csToolsEnums,
  WindowLevelTool,
  PanTool,
  ZoomTool,
} from "@cornerstonejs/tools";
import { getRenderingEngine } from "@cornerstonejs/core";
import { TOOL_GROUP_ID, RENDERING_ENGINE_ID } from "./cornerstone-init";

type ToolName = "windowLevel" | "pan" | "zoom" | "brush" | "eraser";

const tools: Array<{ name: ToolName; icon: React.ElementType; label: string }> =
  [
    { name: "windowLevel", icon: SunDim, label: "Window/Level" },
    { name: "pan", icon: Move, label: "Pan" },
    { name: "zoom", icon: ZoomIn, label: "Zoom" },
    { name: "brush", icon: Paintbrush, label: "Brush" },
    { name: "eraser", icon: Eraser, label: "Eraser" },
  ];

const toolNameMap: Record<ToolName, string> = {
  windowLevel: WindowLevelTool.toolName,
  pan: PanTool.toolName,
  zoom: ZoomTool.toolName,
  brush: "CircularBrush",
  eraser: "CircularEraser",
};

export function ViewerToolbar() {
  const [activeTool, setActiveTool] = useState<ToolName>("windowLevel");

  function handleToolClick(name: ToolName) {
    const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
    if (!toolGroup) return;

    // Set the selected tool as active on primary mouse
    const cornerstoneName = toolNameMap[name];
    toolGroup.setToolActive(cornerstoneName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    });

    // Demote previous primary tool to passive (except the newly activated)
    const prevName = toolNameMap[activeTool];
    if (prevName !== cornerstoneName) {
      toolGroup.setToolPassive(prevName);
    }

    setActiveTool(name);
  }

  function handleReset() {
    const engine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!engine) return;

    for (const vpId of ["MPR_AXIAL", "MPR_SAGITTAL", "MPR_CORONAL"]) {
      const viewport = engine.getViewport(vpId);
      viewport?.resetCamera();
    }
    engine.render();
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-1">
      {tools.map(({ name, icon: Icon, label }) => (
        <Button
          key={name}
          variant={activeTool === name ? "default" : "ghost"}
          size="icon"
          title={label}
          onClick={() => handleToolClick(name)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <Button variant="ghost" size="icon" title="Reset View" onClick={handleReset}>
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

import { useState } from "react";
import { CornerstoneViewport } from "./cornerstone-viewport";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const PRESETS_3D = [
  { value: "CT-Bone", label: "Bone" },
  { value: "CT-Soft-Tissue", label: "Soft Tissue" },
  { value: "CT-Lung", label: "Lung" },
  { value: "CT-Muscle", label: "Muscle" },
  { value: "CT-Fat", label: "Fat" },
  { value: "CT-Cardiac", label: "Cardiac" },
  { value: "CT-Chest-Contrast-Enhanced", label: "Chest (Enhanced)" },
  { value: "CT-Air", label: "Air" },
  { value: "CT-MIP", label: "MIP" },
  { value: "MR-Default", label: "MR Default" },
  { value: "MR-T2-Brain", label: "MR T2 Brain" },
  { value: "MR-MIP", label: "MR MIP" },
] as const;

interface MprViewerProps {
  volumeId: string | null;
}

export function MprViewer({ volumeId }: MprViewerProps) {
  const [preset3D, setPreset3D] = useState("CT-Bone");

  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 bg-black">
      <div className="relative">
        <span className="absolute left-2 top-2 z-10 text-xs font-semibold text-yellow-400">
          Axial
        </span>
        <CornerstoneViewport
          viewportId="MPR_AXIAL"
          orientation="axial"
          volumeId={volumeId}
        />
      </div>
      <div className="relative">
        <span className="absolute left-2 top-2 z-10 text-xs font-semibold text-yellow-400">
          Sagittal
        </span>
        <CornerstoneViewport
          viewportId="MPR_SAGITTAL"
          orientation="sagittal"
          volumeId={volumeId}
        />
      </div>
      <div className="relative">
        <span className="absolute left-2 top-2 z-10 text-xs font-semibold text-yellow-400">
          Coronal
        </span>
        <CornerstoneViewport
          viewportId="MPR_CORONAL"
          orientation="coronal"
          volumeId={volumeId}
        />
      </div>
      <div className="relative">
        <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
          <span className="text-xs font-semibold text-yellow-400">3D</span>
          {volumeId && (
            <Select value={preset3D} onValueChange={setPreset3D}>
              <SelectTrigger className="h-6 w-32 border-yellow-400/50 bg-black/60 text-xs text-yellow-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS_3D.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {volumeId ? (
          <CornerstoneViewport
            viewportId="MPR_3D"
            type="volume3d"
            preset={preset3D}
            volumeId={volumeId}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No volume loaded
          </div>
        )}
      </div>
    </div>
  );
}

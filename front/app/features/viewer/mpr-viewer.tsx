import { CornerstoneViewport } from "./cornerstone-viewport";

interface MprViewerProps {
  volumeId: string | null;
}

export function MprViewer({ volumeId }: MprViewerProps) {
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
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        {volumeId ? "3D View (coming soon)" : "No volume loaded"}
      </div>
    </div>
  );
}

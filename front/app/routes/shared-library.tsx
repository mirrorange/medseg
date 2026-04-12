import type { Route } from "./+types/shared-library";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Shared Library - MedSeg Cloud" }];
}

export default function SharedLibraryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Shared Library</h1>
      <p className="mt-2 text-muted-foreground">
        Browse publicly shared sample sets.
      </p>
    </div>
  );
}

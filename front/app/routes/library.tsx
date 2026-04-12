import type { Route } from "./+types/library";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Library - MedSeg Cloud" }];
}

export default function LibraryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Library</h1>
      <p className="mt-2 text-muted-foreground">
        Browse and manage your sample sets and folders.
      </p>
    </div>
  );
}

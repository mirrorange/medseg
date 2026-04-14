import { useSearchParams } from "react-router";
import type { Route } from "./+types/library";
import { LibraryBrowser } from "~/features/library/library-browser";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Library - MedSeg Cloud" }];
}

export default function LibraryPage() {
  const [searchParams] = useSearchParams();
  const initialFolder = searchParams.get("folder") ?? null;

  return (
    <div className="flex h-full flex-col">
      <LibraryBrowser initialFolderId={initialFolder} />
    </div>
  );
}

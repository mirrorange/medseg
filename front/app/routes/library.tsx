import type { Route } from "./+types/library";
import { LibraryBrowser } from "~/features/library/library-browser";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Library - MedSeg Cloud" }];
}

export default function LibraryPage() {
  return (
    <div className="flex h-full flex-col">
      <LibraryBrowser />
    </div>
  );
}

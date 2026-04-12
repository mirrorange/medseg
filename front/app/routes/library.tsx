import { useRevalidator } from "react-router";
import type { Route } from "./+types/library";
import { treeApiLibraryTreeGet } from "~/api";
import { FolderTree } from "~/features/library/folder-tree";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Library - MedSeg Cloud" }];
}

export async function clientLoader() {
  const { data } = await treeApiLibraryTreeGet();
  return { tree: data ?? { folders: [], root_sample_sets: [] } };
}

export default function LibraryPage({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();

  return (
    <div className="flex h-full flex-col">
      <FolderTree
        tree={loaderData.tree}
        onRefresh={() => revalidator.revalidate()}
      />
    </div>
  );
}

import { redirect } from "react-router";
import type { Route } from "./+types/library";
import { LibraryBrowser } from "~/features/library/library-browser";
import { parseLibrarySplatPath } from "~/features/library/library-path";
import { useAuthStore } from "~/stores/auth";

interface LibraryPathResolution {
  folder_id: string | null;
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Library - MedSeg Cloud" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const pathSegments = parseLibrarySplatPath(params["*"]);

  if (pathSegments.length === 0) {
    return { initialFolderId: null };
  }

  const url = new URL("/api/library/resolve", window.location.origin);
  for (const segment of pathSegments) {
    url.searchParams.append("path", segment);
  }

  const token = useAuthStore.getState().token;
  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 404) {
    throw redirect("/app/library");
  }

  if (!response.ok) {
    throw new Error("Failed to resolve library path");
  }

  const data = (await response.json()) as LibraryPathResolution;
  return { initialFolderId: data.folder_id };
}

export default function LibraryPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex h-full flex-col">
      <LibraryBrowser initialFolderId={loaderData.initialFolderId} />
    </div>
  );
}

import type { BreadcrumbItem } from "~/api/types.gen";

const LIBRARY_ROOT_LABEL = "Library";
const LIBRARY_ROUTE_BASE = "/app/library";

export function parseLibrarySplatPath(splat: string | undefined): string[] {
  if (!splat) return [];
  return splat
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function formatLibraryDisplayPath(names: string[]): string {
  if (names.length === 0) return LIBRARY_ROOT_LABEL;
  return `${LIBRARY_ROOT_LABEL}/${names.join("/")}`;
}

export function buildLibraryUrlFromSegments(segments: string[]): string {
  if (segments.length === 0) return LIBRARY_ROUTE_BASE;

  const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${LIBRARY_ROUTE_BASE}/${encodedPath}`;
}

export function buildLibraryUrlFromBreadcrumb(
  breadcrumb: Array<Pick<BreadcrumbItem, "name">>,
): string {
  return buildLibraryUrlFromSegments(breadcrumb.map((crumb) => crumb.name));
}

export function normalizeLibraryInput(input: string): string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let relative = trimmed.replace(/^\/+/, "");
  if (relative.toLowerCase() === LIBRARY_ROOT_LABEL.toLowerCase()) {
    return [];
  }

  const prefix = `${LIBRARY_ROOT_LABEL.toLowerCase()}/`;
  if (relative.toLowerCase().startsWith(prefix)) {
    relative = relative.slice(prefix.length);
  }

  return relative
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

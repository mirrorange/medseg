function encodeDownloadName(filename: string): string {
  return filename
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getImageDownloadUrl(
  sampleSetId: string,
  subsetId: string,
  imageId: string,
  filename?: string,
): string {
  const downloadPath = `/api/sample-sets/${sampleSetId}/subsets/${subsetId}/images/${imageId}/download`;
  const pathWithFilename =
    filename && filename.length > 0
      ? `${downloadPath}/${encodeDownloadName(filename)}`
      : downloadPath;

  if (typeof window === "undefined") {
    return pathWithFilename;
  }

  return new URL(pathWithFilename, window.location.origin).toString();
}

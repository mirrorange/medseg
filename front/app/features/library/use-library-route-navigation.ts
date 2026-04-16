import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useLibraryStore } from "~/stores/library";
import { buildLibraryUrlFromSegments } from "./library-path";

function readHistoryIndex() {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === "number" ? state.idx : 0;
}

export function useLibraryRouteNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumb = useLibraryStore((state) => state.breadcrumb);
  const segments = useMemo(
    () => breadcrumb.map((crumb) => crumb.name),
    [breadcrumb],
  );
  const [historyIndex, setHistoryIndex] = useState(() => readHistoryIndex());
  const [maxHistoryIndex, setMaxHistoryIndex] = useState(() => readHistoryIndex());

  useEffect(() => {
    const nextIndex = readHistoryIndex();
    setHistoryIndex(nextIndex);
    setMaxHistoryIndex((currentMax) => Math.max(currentMax, nextIndex));
  }, [location.key, location.pathname]);

  return {
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < maxHistoryIndex,
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
    goRoot: () => navigate("/app/library"),
    goUp: () => navigate(buildLibraryUrlFromSegments(segments.slice(0, -1))),
    goToBreadcrumb: (index: number) =>
      navigate(buildLibraryUrlFromSegments(segments.slice(0, index + 1))),
    goToChild: (name: string) =>
      navigate(buildLibraryUrlFromSegments([...segments, name])),
    goToSegments: (nextSegments: string[]) =>
      navigate(buildLibraryUrlFromSegments(nextSegments)),
  };
}

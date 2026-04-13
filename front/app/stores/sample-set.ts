import { create } from "zustand";
import {
  getDetailApiSampleSetsSampleSetIdGet,
  getDetailApiSampleSetsSampleSetIdSubsetsSubsetIdGet,
  getAwarenessApiPipelinesAwarenessSampleSetIdGet,
} from "~/api";
import type {
  SampleSetDetail,
  SubsetDetail,
  SubsetRead,
  ImageRead,
  AwarenessResponse,
} from "~/api/types.gen";

const EMPTY_ITEMS: Array<SubsetRead | ImageRead> = [];

// -- Types -------------------------------------------------------

export type BrowseLevel = "subsets" | "images";
export type ViewMode = "list" | "grid";

interface SampleSetBrowserState {
  // Data
  sampleSetId: string | null;
  sampleSet: SampleSetDetail | null;
  currentSubsetId: string | null;
  currentSubset: SubsetDetail | null;
  awareness: AwarenessResponse | null;

  // Navigation
  level: BrowseLevel;

  // Loading
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedIds: string[];

  // View
  viewMode: ViewMode;

  // -- Actions ---------------------------------------------------

  /** Load sample set detail and awareness (enters subsets level) */
  loadSampleSet: (id: string) => Promise<void>;

  /** Navigate into a subset to view images */
  openSubset: (subsetId: string) => Promise<void>;

  /** Return to subsets level */
  goBack: () => void;

  /** Reload current level data */
  refresh: () => Promise<void>;

  /** Select an item (click / ctrl-click) */
  select: (id: string, multi?: boolean) => void;

  /** Shift-click range select */
  selectRange: (id: string) => void;

  /** Select all visible items */
  selectAll: () => void;

  /** Clear selection */
  clearSelection: () => void;

  /** Directly set selection (for lasso) */
  setSelection: (ids: string[]) => void;

  /** Toggle view mode */
  setViewMode: (mode: ViewMode) => void;

  /** Reset entire store */
  reset: () => void;
}

// -- Helpers -----------------------------------------------------

function currentItems(state: SampleSetBrowserState): { id: string }[] {
  if (state.level === "images") return state.currentSubset?.images ?? EMPTY_ITEMS;
  return state.sampleSet?.subsets ?? EMPTY_ITEMS;
}

// -- Store -------------------------------------------------------

export const useSampleSetStore = create<SampleSetBrowserState>((set, get) => ({
  sampleSetId: null,
  sampleSet: null,
  currentSubsetId: null,
  currentSubset: null,
  awareness: null,

  level: "subsets",
  isLoading: false,
  error: null,
  selectedIds: [],
  viewMode: "list",

  // -- Navigation ------------------------------------------------

  loadSampleSet: async (id) => {
    set({ sampleSetId: id, isLoading: true, error: null, level: "subsets", selectedIds: [], currentSubsetId: null, currentSubset: null });

    try {
      const [detailRes, awarenessRes] = await Promise.all([
        getDetailApiSampleSetsSampleSetIdGet({ path: { sample_set_id: id } }),
        getAwarenessApiPipelinesAwarenessSampleSetIdGet({ path: { sample_set_id: id } }),
      ]);

      if (!detailRes.data) throw new Error("Failed to load sample set");

      set({
        sampleSet: detailRes.data,
        awareness: awarenessRes.data ?? null,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to load" });
    }
  },

  openSubset: async (subsetId) => {
    const { sampleSetId } = get();
    if (!sampleSetId) return;

    set({ isLoading: true, error: null, selectedIds: [] });

    try {
      const { data } = await getDetailApiSampleSetsSampleSetIdSubsetsSubsetIdGet({
        path: { sample_set_id: sampleSetId, subset_id: subsetId },
      });

      if (!data) throw new Error("Failed to load subset");

      set({
        level: "images",
        currentSubsetId: subsetId,
        currentSubset: data,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to load subset" });
    }
  },

  goBack: () => {
    set({ level: "subsets", currentSubsetId: null, currentSubset: null, selectedIds: [] });
  },

  refresh: async () => {
    const { sampleSetId, level, currentSubsetId } = get();
    if (!sampleSetId) return;

    set({ isLoading: true, error: null });

    try {
      if (level === "images" && currentSubsetId) {
        const { data } = await getDetailApiSampleSetsSampleSetIdSubsetsSubsetIdGet({
          path: { sample_set_id: sampleSetId, subset_id: currentSubsetId },
        });
        if (!data) throw new Error("Failed to refresh");
        set({ currentSubset: data, isLoading: false });
      } else {
        const [detailRes, awarenessRes] = await Promise.all([
          getDetailApiSampleSetsSampleSetIdGet({ path: { sample_set_id: sampleSetId } }),
          getAwarenessApiPipelinesAwarenessSampleSetIdGet({ path: { sample_set_id: sampleSetId } }),
        ]);
        if (!detailRes.data) throw new Error("Failed to refresh");
        set({ sampleSet: detailRes.data, awareness: awarenessRes.data ?? null, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to refresh" });
    }
  },

  // -- Selection -------------------------------------------------

  select: (id, multi) => {
    set((s) => {
      if (multi) {
        const has = s.selectedIds.includes(id);
        return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
      }
      return { selectedIds: s.selectedIds.length === 1 && s.selectedIds[0] === id ? [] : [id] };
    });
  },

  selectRange: (id) => {
    set((s) => {
      const items = currentItems(s);
      const ids = items.map((i) => i.id);
      if (s.selectedIds.length === 0) return { selectedIds: [id] };

      const targetIdx = ids.indexOf(id);
      if (targetIdx === -1) return s;

      let lastIdx = -1;
      for (let i = ids.length - 1; i >= 0; i--) {
        if (s.selectedIds.includes(ids[i])) { lastIdx = i; break; }
      }
      if (lastIdx === -1) return { selectedIds: [id] };

      const start = Math.min(lastIdx, targetIdx);
      const end = Math.max(lastIdx, targetIdx);
      const rangeIds = ids.slice(start, end + 1);
      const seen = new globalThis.Set(s.selectedIds);
      const merged = [...s.selectedIds];
      for (const rid of rangeIds) {
        if (!seen.has(rid)) { seen.add(rid); merged.push(rid); }
      }
      return { selectedIds: merged };
    });
  },

  selectAll: () => {
    set((s) => {
      const items = currentItems(s);
      return { selectedIds: items.map((i) => i.id) };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setSelection: (ids) => set({ selectedIds: ids }),

  setViewMode: (mode) => set({ viewMode: mode }),

  reset: () => set({
    sampleSetId: null, sampleSet: null, currentSubsetId: null, currentSubset: null,
    awareness: null, level: "subsets", isLoading: false, error: null, selectedIds: [], viewMode: "list",
  }),
}));

// -- Selectors ---------------------------------------------------

/** Get current items based on browse level */
export function useCurrentItems(): (SubsetRead | ImageRead)[] {
  return useSampleSetStore((s) => {
    if (s.level === "images") return s.currentSubset?.images ?? EMPTY_ITEMS;
    return s.sampleSet?.subsets ?? EMPTY_ITEMS;
  });
}

/** Get the subset name for breadcrumb display */
export function useCurrentSubsetName(): string | null {
  return useSampleSetStore((s) => {
    if (!s.currentSubsetId || !s.sampleSet?.subsets) return null;
    return s.sampleSet.subsets.find((sub) => sub.id === s.currentSubsetId)?.name ?? null;
  });
}

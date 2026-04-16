import { create } from "zustand";
import {
  batchMoveApiLibraryBatchMovePost,
  contentsApiLibraryContentsGet,
} from "~/api";
import type { BreadcrumbItem, LibraryItem } from "~/api/types.gen";

// -- Types -------------------------------------------------------

export type ViewMode = "list" | "grid";
export type SortField = "name" | "created_at" | "updated_at";
export type SortDirection = "asc" | "desc";

interface LibraryState {
  // Contents
  folderId: string | null;
  breadcrumb: BreadcrumbItem[];
  items: LibraryItem[];
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedIds: string[];

  // View
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;

  // Actions — Navigation
  navigateTo: (folderId: string | null) => Promise<void>;
  refresh: () => Promise<void>;

  // Actions — Selection
  select: (id: string, multi?: boolean) => void;
  selectRange: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;

  // Actions — View
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;

  // Actions — Batch move
  batchMove: (
    targetFolderId: string | null,
    items: { id: string; type: "folder" | "sample_set" }[],
  ) => Promise<void>;
}

// -- Store -------------------------------------------------------

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folderId: null,
  breadcrumb: [],
  items: [],
  isLoading: false,
  error: null,

  selectedIds: [],

  viewMode: "list",
  sortField: "name",
  sortDirection: "asc",

  // -- Navigation ------------------------------------------------

  navigateTo: async (folderId) => {
    set({ isLoading: true, error: null });

    try {
      const { sortField, sortDirection } = get();
      const { data } = await contentsApiLibraryContentsGet({
        query: {
          folder_id: folderId ?? undefined,
          sort_by: sortField,
          sort_order: sortDirection,
        },
      });

      if (!data) throw new Error("Failed to load contents");

      set({
        folderId: data.folder_id ?? null,
        breadcrumb: data.breadcrumb,
        items: data.items,
        isLoading: false,
        selectedIds: [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load contents";
      set({ isLoading: false, error: message });
    }
  },

  refresh: async () => {
    const { folderId } = get();
    set({ isLoading: true, error: null });
    await fetchContents(get, set, folderId);
  },

  // -- Selection -------------------------------------------------

  select: (id, multi) => {
    set((s) => {
      if (multi) {
        const has = s.selectedIds.includes(id);
        return {
          selectedIds: has
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        };
      }
      return { selectedIds: s.selectedIds.length === 1 && s.selectedIds[0] === id ? [] : [id] };
    });
  },

  selectRange: (id) => {
    set((s) => {
      if (s.selectedIds.length === 0) return { selectedIds: [id] };
      const ids = s.items.map((i) => i.id);
      const targetIdx = ids.indexOf(id);
      if (targetIdx === -1) return s;

      let lastIdx = -1;
      for (let i = ids.length - 1; i >= 0; i--) {
        if (s.selectedIds.includes(ids[i])) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx === -1) return { selectedIds: [id] };

      const start = Math.min(lastIdx, targetIdx);
      const end = Math.max(lastIdx, targetIdx);
      const rangeIds = ids.slice(start, end + 1);
      const seen = new globalThis.Set(s.selectedIds);
      const merged = [...s.selectedIds];
      for (const rid of rangeIds) {
        if (!seen.has(rid)) {
          seen.add(rid);
          merged.push(rid);
        }
      }
      return { selectedIds: merged };
    });
  },

  selectAll: () => {
    set((s) => ({
      selectedIds: s.items.map((i) => i.id),
    }));
  },

  clearSelection: () => set({ selectedIds: [] }),

  setSelection: (ids) => set({ selectedIds: ids }),

  // -- View ------------------------------------------------------

  setViewMode: (mode) => set({ viewMode: mode }),

  setSortField: (field) => {
    const { sortField, sortDirection, folderId } = get();
    const newDirection = field === sortField && sortDirection === "asc" ? "desc" : "asc";
    set({ sortField: field, sortDirection: newDirection });
    void fetchContents(get, set, folderId);
  },

  toggleSortDirection: () => {
    const { sortDirection, folderId } = get();
    set({ sortDirection: sortDirection === "asc" ? "desc" : "asc" });
    void fetchContents(get, set, folderId);
  },

  // -- Batch move ------------------------------------------------

  batchMove: async (targetFolderId, items) => {
    await batchMoveApiLibraryBatchMovePost({
      body: { target_folder_id: targetFolderId, items },
    });
    // Refresh current folder after move
    await get().refresh();
  },
}));

// -- Internal helpers --------------------------------------------

type Get = () => LibraryState;
type Set = (
  partial: Partial<LibraryState> | ((s: LibraryState) => Partial<LibraryState>),
) => void;

async function fetchContents(get: Get, set: Set, folderId: string | null) {
  set({ isLoading: true, error: null });

  try {
    const { sortField, sortDirection } = get();
    const { data } = await contentsApiLibraryContentsGet({
      query: {
        folder_id: folderId ?? undefined,
        sort_by: sortField,
        sort_order: sortDirection,
      },
    });

    if (!data) throw new Error("Failed to load contents");

    set({
      folderId: data.folder_id ?? null,
      breadcrumb: data.breadcrumb,
      items: data.items,
      isLoading: false,
      selectedIds: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load contents";
    set({ isLoading: false, error: message });
  }
}

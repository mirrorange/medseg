import { create } from "zustand";

export interface Task {
  id: string;
  status:
    | "queued"
    | "loading"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  module_name: string;
  sample_set_id: string;
  queue_position: number | null;
  estimated_wait_ms: number | null;
}

interface TaskState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
}));

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
  upsertTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  upsertTasks: (tasks) =>
    set((state) => {
      const taskMap = new Map(state.tasks.map((task) => [task.id, task]));
      for (const task of tasks) {
        const existing = taskMap.get(task.id);
        taskMap.set(task.id, existing ? { ...existing, ...task } : task);
      }
      return { tasks: Array.from(taskMap.values()) };
    }),
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

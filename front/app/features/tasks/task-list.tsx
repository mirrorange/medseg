import type { TaskRead } from "~/api/types.gen";
import { TaskCard } from "./task-card";

interface TaskListProps {
  tasks: TaskRead[];
  onCancel: (taskId: string) => void;
}

export function TaskList({ tasks, onCancel }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks yet. Run a pipeline on a sample set to create one.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onCancel={onCancel} />
      ))}
    </div>
  );
}

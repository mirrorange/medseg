import { useCallback } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/tasks";
import {
  listMyTasksApiTasksGet,
  cancelTaskEndpointApiTasksTaskIdDelete,
} from "~/api";
import { TaskList } from "~/features/tasks/task-list";
import { useTaskStore } from "~/stores/task";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tasks - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const { data } = await listMyTasksApiTasksGet();
  return { tasks: data ?? [] };
}

export default function TasksPage({ loaderData }: Route.ComponentProps) {
  const { tasks } = loaderData;
  const revalidator = useRevalidator();

  const handleCancel = useCallback(
    async (taskId: string) => {
      await cancelTaskEndpointApiTasksTaskIdDelete({
        path: { task_id: taskId },
      });
      revalidator.revalidate();
    },
    [revalidator]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor your pipeline tasks and their progress.
        </p>
      </div>
      <TaskList tasks={tasks} onCancel={handleCancel} />
    </div>
  );
}

import type { Route } from "./+types/tasks";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tasks - MedSeg Cloud" }];
}

export default function TasksPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      <p className="mt-2 text-muted-foreground">
        Monitor your pipeline tasks and their progress.
      </p>
    </div>
  );
}

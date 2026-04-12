import { Clock, Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { TaskRead } from "~/api/types.gen";

const statusConfig = {
  queued: { label: "Queued", icon: Clock, variant: "secondary" as const },
  loading: {
    label: "Loading",
    icon: Loader2,
    variant: "secondary" as const,
  },
  running: {
    label: "Running",
    icon: Loader2,
    variant: "default" as const,
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    variant: "default" as const,
  },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" as const },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    variant: "outline" as const,
  },
};

interface TaskCardProps {
  task: TaskRead;
  onCancel: (taskId: string) => void;
}

export function TaskCard({ task, onCancel }: TaskCardProps) {
  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const isActive = task.status === "queued" || task.status === "loading" || task.status === "running";
  const canCancel = task.status === "queued";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {task.module_name}
        </CardTitle>
        <Badge variant={config.variant}>
          <StatusIcon
            className={`mr-1 h-3 w-3 ${
              isActive && task.status !== "queued" ? "animate-spin" : ""
            }`}
          />
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>Output: {task.output_subset_name}</span>
          <span>
            Created: {new Date(task.created_at).toLocaleString()}
          </span>
          {task.started_at && (
            <span>
              Started: {new Date(task.started_at).toLocaleString()}
            </span>
          )}
          {task.completed_at && (
            <span>
              Finished: {new Date(task.completed_at).toLocaleString()}
            </span>
          )}
          {task.error_message && (
            <span className="text-destructive">{task.error_message}</span>
          )}
        </div>
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => onCancel(task.id)}
          >
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

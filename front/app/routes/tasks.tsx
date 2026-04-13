import { useState, useCallback, useMemo } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/tasks";
import {
  listMyTasksApiTasksGet,
  cancelTaskEndpointApiTasksTaskIdCancelPost,
  deleteTaskEndpointApiTasksTaskIdDelete,
  clearHistoryApiTasksHistoryDelete,
} from "~/api";
import type { TaskRead } from "~/api/types.gen";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  MoreHorizontal,
  Trash2,
  X,
  History,
} from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tasks - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const { data } = await listMyTasksApiTasksGet();
  return { tasks: data ?? [] };
}

const statusConfig = {
  queued: { label: "Queued", icon: Clock, variant: "secondary" as const, className: "" },
  loading: { label: "Loading", icon: Loader2, variant: "secondary" as const, className: "animate-spin" },
  running: { label: "Running", icon: Loader2, variant: "default" as const, className: "animate-spin" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "default" as const, className: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" as const, className: "" },
  cancelled: { label: "Cancelled", icon: Ban, variant: "outline" as const, className: "" },
};

type StatusFilter = "all" | TaskRead["status"];

function formatRelativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "\u2014";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((e - s) / 1000);
  if (diff < 60) return `${diff}s`;
  const min = Math.floor(diff / 60);
  const sec = diff % 60;
  return `${min}m ${sec}s`;
}

export default function TasksPage({ loaderData }: Route.ComponentProps) {
  const { tasks } = loaderData;
  const revalidator = useRevalidator();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredTasks = useMemo(
    () =>
      statusFilter === "all"
        ? tasks
        : tasks.filter((t) => t.status === statusFilter),
    [tasks, statusFilter]
  );

  const hasFinished = useMemo(
    () =>
      tasks.some(
        (t) =>
          t.status === "completed" ||
          t.status === "failed" ||
          t.status === "cancelled"
      ),
    [tasks]
  );

  const handleCancel = useCallback(
    async (taskId: string) => {
      try {
        await cancelTaskEndpointApiTasksTaskIdCancelPost({
          path: { task_id: taskId },
        });
        toast.success("Task cancelled");
        revalidator.revalidate();
      } catch {
        toast.error("Failed to cancel task");
      }
    },
    [revalidator]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        await deleteTaskEndpointApiTasksTaskIdDelete({
          path: { task_id: taskId },
        });
        toast.success("Task deleted");
        revalidator.revalidate();
      } catch {
        toast.error("Failed to delete task");
      }
    },
    [revalidator]
  );

  const handleClearHistory = useCallback(async () => {
    try {
      const { data } = await clearHistoryApiTasksHistoryDelete();
      const count = (data as { deleted?: number })?.deleted ?? 0;
      toast.success(`Cleared ${count} task(s)`);
      setShowClearConfirm(false);
      revalidator.revalidate();
    } catch {
      toast.error("Failed to clear history");
    }
  }, [revalidator]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor your pipeline tasks and their progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="loading">Loading</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {hasFinished && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
            >
              <History className="mr-2 h-4 w-4" />
              Clear History
            </Button>
          )}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "No tasks yet. Run a pipeline on a sample set to create one."
              : `No ${statusFilter} tasks.`}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Sample Set</TableHead>
                <TableHead>Output</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const config = statusConfig[task.status];
                const StatusIcon = config.icon;
                const canCancel = task.status === "queued";
                const isFinished =
                  task.status === "completed" ||
                  task.status === "failed" ||
                  task.status === "cancelled";

                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      {task.module_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{task.sample_set_name ?? task.sample_set_id.slice(0, 8)}</span>
                        {task.input_subset_name && (
                          <span className="text-xs text-muted-foreground/70">
                            {task.input_subset_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.output_subset_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className={`h-3 w-3 ${config.className}`} />
                        {config.label}
                      </Badge>
                      {task.error_message && (
                        <p className="mt-1 max-w-[200px] truncate text-xs text-destructive" title={task.error_message}>
                          {task.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" title={new Date(task.created_at).toLocaleString()}>
                      {formatRelativeTime(task.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(task.started_at ?? null, task.completed_at ?? null)}
                    </TableCell>
                    <TableCell>
                      {(canCancel || isFinished) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canCancel && (
                              <DropdownMenuItem
                                onClick={() => handleCancel(task.id)}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            {isFinished && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(task.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Clear History Confirmation */}
      <AlertDialog
        open={showClearConfirm}
        onOpenChange={(open) => !open && setShowClearConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Task History</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all completed, failed, and cancelled tasks. Active
              tasks will not be affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory}>
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

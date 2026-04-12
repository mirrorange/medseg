import { useCallback } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/admin.sample-sets";
import {
  listAllSampleSetsApiAdminSampleSetsGet,
  getStatsApiAdminStatsGet,
  adminRemoveSharedApiAdminSharedSampleSetIdDelete,
  deleteApiSampleSetsSampleSetIdDelete,
} from "~/api";
import type { SampleSetRead } from "~/api/types.gen";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Database, Share2, Trash2 } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin Sample Sets - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const [setsRes, statsRes] = await Promise.all([
    listAllSampleSetsApiAdminSampleSetsGet(),
    getStatsApiAdminStatsGet(),
  ]);
  const stats = (statsRes.data ?? {}) as {
    user_count: number;
    sample_set_count: number;
    shared_count: number;
  };
  return { sampleSets: setsRes.data ?? [], stats };
}

export default function AdminSampleSetsPage({
  loaderData,
}: Route.ComponentProps) {
  const { sampleSets, stats } = loaderData;
  const revalidator = useRevalidator();

  const handleDelete = useCallback(
    async (set: SampleSetRead) => {
      try {
        await deleteApiSampleSetsSampleSetIdDelete({
          path: { sample_set_id: set.id },
        });
        toast.success(`Deleted "${set.name}"`);
        revalidator.revalidate();
      } catch {
        toast.error("Failed to delete sample set");
      }
    },
    [revalidator]
  );

  const handleRemoveShared = useCallback(
    async (set: SampleSetRead) => {
      try {
        await adminRemoveSharedApiAdminSharedSampleSetIdDelete({
          path: { sample_set_id: set.id },
        });
        toast.success(`Removed sharing for "${set.name}"`);
        revalidator.revalidate();
      } catch {
        toast.error("Failed to remove sharing");
      }
    },
    [revalidator]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Sample Sets Overview
        </h1>
        <p className="mt-1 text-muted-foreground">
          System statistics and global sample set management.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sample Sets
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sample_set_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Sets</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shared_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sample Sets Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleSets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No sample sets found.
                </TableCell>
              </TableRow>
            ) : (
              sampleSets.map((set) => (
                <TableRow key={set.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{set.name}</div>
                      {set.description && (
                        <div className="text-xs text-muted-foreground">
                          {set.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {set.owner_id.slice(0, 8)}…
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(set.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveShared(set)}
                        title="Remove sharing"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Sample Set
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{set.name}"? This
                              will permanently delete all subsets and images.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(set)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

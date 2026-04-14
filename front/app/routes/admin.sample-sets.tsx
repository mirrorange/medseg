import { useState, useCallback, useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/admin.sample-sets";
import {
  listAllSampleSetsApiAdminSampleSetsGet,
  getStatsApiAdminStatsGet,
  adminRemoveSharedApiAdminSharedSampleSetIdDelete,
  deleteApiSampleSetsSampleSetIdDelete,
  getUsersApiUsersGet,
} from "~/api";
import type { AdminSampleSetRead, UserRead } from "~/api/types.gen";
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
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { Users, Database, Share2, Trash2, Search } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin Sample Sets - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const [setsRes, statsRes, usersRes] = await Promise.all([
    listAllSampleSetsApiAdminSampleSetsGet(),
    getStatsApiAdminStatsGet(),
    getUsersApiUsersGet(),
  ]);
  const stats = (statsRes.data ?? {}) as {
    user_count: number;
    sample_set_count: number;
    shared_count: number;
  };
  return {
    sampleSets: setsRes.data ?? [],
    stats,
    users: (usersRes.data ?? []) as UserRead[],
  };
}

export default function AdminSampleSetsPage({
  loaderData,
}: Route.ComponentProps) {
  const { sampleSets, stats, users } = loaderData;
  const revalidator = useRevalidator();
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState<string>("all");
  const [results, setResults] = useState<AdminSampleSetRead[]>(sampleSets);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync results on initial/revalidation load
  useEffect(() => {
    if (!search && ownerId === "all") setResults(sampleSets);
  }, [sampleSets, search, ownerId]);

  const doSearch = useCallback(
    async (query: string, owner: string) => {
      const { data } = await listAllSampleSetsApiAdminSampleSetsGet({
        query: {
          search: query || undefined,
          owner_id: owner === "all" ? undefined : owner,
        },
      });
      setResults(data ?? []);
    },
    []
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value, ownerId), 300);
    },
    [doSearch, ownerId]
  );

  const handleOwnerChange = useCallback(
    (value: string) => {
      setOwnerId(value);
      doSearch(search, value);
    },
    [doSearch, search]
  );

  const handleDelete = useCallback(
    async (set: AdminSampleSetRead) => {
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
    async (set: AdminSampleSetRead) => {
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

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sample sets..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ownerId} onValueChange={handleOwnerChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sample Sets Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {search || ownerId !== "all"
                    ? "No matching sample sets."
                    : "No sample sets found."}
                </TableCell>
              </TableRow>
            ) : (
              results.map((set) => (
                <TableRow key={set.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{set.name}</div>
                      {set.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {set.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {set.owner_username}
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

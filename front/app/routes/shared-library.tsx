import { useState, useCallback, useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/shared-library";
import { Copy, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  listSharedApiLibrarySharedGet,
  copySharedApiLibrarySharedSampleSetIdCopyPost,
} from "~/api";
import type { SharedSampleSetRead } from "~/api/types.gen";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Shared Library - MedSeg Cloud" }];
}

export async function clientLoader() {
  const { data } = await listSharedApiLibrarySharedGet();
  return { shared: data ?? [] };
}

export default function SharedLibraryPage({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SharedSampleSetRead[]>(loaderData.shared);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Update results when loaderData changes (initial load or revalidation)
  useEffect(() => {
    if (!search) setResults(loaderData.shared);
  }, [loaderData.shared, search]);

  const doSearch = useCallback(async (query: string) => {
    const { data } = await listSharedApiLibrarySharedGet({
      query: { search: query || undefined },
    });
    setResults(data ?? []);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  async function handleCopy(item: SharedSampleSetRead) {
    setCopyingId(item.sample_set_id);
    try {
      await copySharedApiLibrarySharedSampleSetIdCopyPost({
        path: { sample_set_id: item.sample_set_id },
      });
      toast.success(`Copied "${item.sample_set_name}" to your library`);
    } catch {
      toast.error("Failed to copy sample set");
    }
    setCopyingId(null);
    revalidator.revalidate();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shared Library</h1>
        <p className="mt-1 text-muted-foreground">
          Browse publicly shared sample sets and copy them to your library.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search shared sample sets..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {results.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search
            ? `No results for "${search}".`
            : "No shared sample sets available."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Shared by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.sample_set_name}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[300px]">
                  <span className="line-clamp-2">{item.sample_set_description ?? "—"}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.shared_by_username}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={copyingId === item.sample_set_id}
                    onClick={() => handleCopy(item)}
                    title="Copy to my library"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}

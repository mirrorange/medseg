import { useState } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/shared-library";
import { Copy } from "lucide-react";
import { Button } from "~/components/ui/button";
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

  async function handleCopy(item: SharedSampleSetRead) {
    setCopyingId(item.sample_set_id);
    await copySharedApiLibrarySharedSampleSetIdCopyPost({
      path: { sample_set_id: item.sample_set_id },
    });
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

      {loaderData.shared.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No shared sample sets available.
        </div>
      ) : (
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
            {loaderData.shared.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.sample_set_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.sample_set_description ?? "—"}
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
      )}
    </div>
  );
}

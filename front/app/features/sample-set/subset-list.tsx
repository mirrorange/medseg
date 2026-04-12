import { NavLink } from "react-router";
import { Trash2, Eye, FileImage } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { SubsetRead } from "~/api/types.gen";

interface SubsetListProps {
  subsets: SubsetRead[];
  sampleSetId: string;
  onDelete: (subsetId: string, name: string) => void;
}

export function SubsetList({ subsets, sampleSetId, onDelete }: SubsetListProps) {
  if (subsets.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No subsets yet. Upload images or run a pipeline to create subsets.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Source Module</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subsets.map((subset) => (
          <TableRow key={subset.id}>
            <TableCell className="font-medium">{subset.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{subset.type}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {subset.source_module ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(subset.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <NavLink to={`/app/viewer/${sampleSetId}/${subset.id}`}>
                    <Eye className="h-3.5 w-3.5" />
                  </NavLink>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onDelete(subset.id, subset.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

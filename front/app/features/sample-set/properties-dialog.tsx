import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import type { SubsetRead, ImageRead } from "~/api/types.gen";
import type { BrowseLevel } from "~/stores/sample-set";

interface PropertiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SubsetRead | ImageRead | null;
  level: BrowseLevel;
}

export function PropertiesDialog({ open, onOpenChange, item, level }: PropertiesDialogProps) {
  if (!item) return null;

  const isSubset = level === "subsets";
  const name = isSubset ? (item as SubsetRead).name : (item as ImageRead).filename;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Properties</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Row label="Name" value={name} />
          <Row label="ID" value={item.id} mono />
          <Row label="Created" value={new Date(item.created_at).toLocaleString()} />
          {isSubset && (
            <>
              <Row label="Type">
                <Badge variant="secondary">{(item as SubsetRead).type}</Badge>
              </Row>
              {(item as SubsetRead).source_module && (
                <Row label="Source Module" value={(item as SubsetRead).source_module!} />
              )}
            </>
          )}
          {!isSubset && (
            <>
              <Row label="Format" value={(item as ImageRead).format} />
              <Row label="Storage Path" value={(item as ImageRead).storage_path} mono />
              {(item as ImageRead).source_image_id && (
                <Row label="Source Image" value={(item as ImageRead).source_image_id!} mono />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label, value, mono, children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground w-28 shrink-0 text-sm">{label}</span>
      {children ?? (
        <span className={`text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      )}
    </div>
  );
}

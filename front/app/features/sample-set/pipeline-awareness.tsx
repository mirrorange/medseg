import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { getAwarenessApiPipelinesAwarenessSampleSetIdGet } from "~/api";
import type { AwarenessResponse, ModuleAwarenessItem } from "~/api/types.gen";

interface PipelineAwarenessProps {
  sampleSetId: string;
  onRunModule: (item: ModuleAwarenessItem) => void;
}

export function PipelineAwareness({
  sampleSetId,
  onRunModule,
}: PipelineAwarenessProps) {
  const [awareness, setAwareness] = useState<AwarenessResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAwarenessApiPipelinesAwarenessSampleSetIdGet({
      path: { sample_set_id: sampleSetId },
    }).then(({ data }) => {
      if (!cancelled) {
        setAwareness(data ?? null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sampleSetId]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Analyzing available pipelines...
      </div>
    );
  }

  if (!awareness) return null;

  const allModules = [
    ...(awareness.primary ? [awareness.primary] : []),
    ...awareness.suggested,
    ...awareness.available,
  ];

  if (allModules.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4" />
        Pipeline Suggestions
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {awareness.primary && (
          <ModuleCard
            item={awareness.primary}
            variant="primary"
            onRun={() => onRunModule(awareness.primary!)}
          />
        )}
        {awareness.suggested.map((item) => (
          <ModuleCard
            key={item.module_name}
            item={item}
            variant="suggested"
            onRun={() => onRunModule(item)}
          />
        ))}
        {awareness.available.map((item) => (
          <ModuleCard
            key={item.module_name}
            item={item}
            variant="available"
            onRun={() => onRunModule(item)}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  item,
  variant,
  onRun,
}: {
  item: ModuleAwarenessItem;
  variant: "primary" | "suggested" | "available";
  onRun: () => void;
}) {
  return (
    <Card
      className={
        variant === "primary"
          ? "border-primary/50"
          : variant === "suggested"
            ? "border-muted-foreground/30"
            : ""
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{item.module_name}</CardTitle>
          {variant === "primary" && (
            <Badge variant="default" className="text-xs">
              Recommended
            </Badge>
          )}
          {variant === "suggested" && (
            <Badge variant="secondary" className="text-xs">
              Suggested
            </Badge>
          )}
        </div>
        {item.reason && (
          <CardDescription className="text-xs">{item.reason}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Button size="sm" className="w-full" onClick={onRun}>
          Run
        </Button>
      </CardContent>
    </Card>
  );
}

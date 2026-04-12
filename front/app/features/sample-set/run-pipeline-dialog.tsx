import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DynamicForm } from "~/components/dynamic-form";
import {
  getModuleApiPipelinesModulesNameGet,
  runPipelineApiPipelinesRunPost,
} from "~/api";
import type { ModuleAwarenessItem, ModuleInfoRead, SubsetRead } from "~/api/types.gen";

interface RunPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleSetId: string;
  subsets: SubsetRead[];
  preselectedModule?: ModuleAwarenessItem | null;
  onSubmitted: () => void;
}

export function RunPipelineDialog({
  open,
  onOpenChange,
  sampleSetId,
  subsets,
  preselectedModule,
  onSubmitted,
}: RunPipelineDialogProps) {
  const [moduleName, setModuleName] = useState("");
  const [moduleInfo, setModuleInfo] = useState<ModuleInfoRead | null>(null);
  const [inputSubsetId, setInputSubsetId] = useState("");
  const [outputName, setOutputName] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from preselected module
  useEffect(() => {
    if (open && preselectedModule) {
      setModuleName(preselectedModule.module_name);
      // Auto-select first recommended subset
      if (preselectedModule.recommended_subset_ids.length > 0) {
        setInputSubsetId(preselectedModule.recommended_subset_ids[0]);
      } else if (preselectedModule.available_subset_ids.length > 0) {
        setInputSubsetId(preselectedModule.available_subset_ids[0]);
      }
      setOutputName(`${preselectedModule.module_name}_output`);
    }
  }, [open, preselectedModule]);

  // Fetch module info when module name changes
  useEffect(() => {
    if (!moduleName) {
      setModuleInfo(null);
      return;
    }
    let cancelled = false;
    getModuleApiPipelinesModulesNameGet({
      path: { name: moduleName },
    }).then(({ data }) => {
      if (!cancelled) {
        setModuleInfo(data ?? null);
        setParams({});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [moduleName]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setModuleName("");
      setModuleInfo(null);
      setInputSubsetId("");
      setOutputName("");
      setParams({});
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: apiError } = await runPipelineApiPipelinesRunPost({
      body: {
        module_name: moduleName,
        sample_set_id: sampleSetId,
        input_subset_id: inputSubsetId,
        output_subset_name: outputName,
        params: Object.keys(params).length > 0 ? params : null,
      },
    });

    setLoading(false);
    if (apiError) {
      setError(
        (apiError as { detail?: { message?: string } })?.detail?.message ??
          "Failed to submit task"
      );
      return;
    }

    onOpenChange(false);
    onSubmitted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Run Pipeline</DialogTitle>
          <DialogDescription>
            Configure and run a processing module on this sample set.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Module name (read-only if preselected) */}
            <div className="flex flex-col gap-2">
              <Label>Module</Label>
              <Input
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                readOnly={!!preselectedModule}
                required
              />
            </div>

            {/* Input subset */}
            <div className="flex flex-col gap-2">
              <Label>Input Subset</Label>
              <Select value={inputSubsetId} onValueChange={setInputSubsetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select input subset..." />
                </SelectTrigger>
                <SelectContent>
                  {subsets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Output name */}
            <div className="flex flex-col gap-2">
              <Label>Output Subset Name</Label>
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                required
              />
            </div>

            {/* Dynamic parameters */}
            {moduleInfo?.params_schema && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold">Parameters</Label>
                <DynamicForm
                  schema={moduleInfo.params_schema as Record<string, unknown>}
                  values={params}
                  onChange={setParams}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !moduleName || !inputSubsetId || !outputName}
            >
              {loading ? "Submitting..." : "Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

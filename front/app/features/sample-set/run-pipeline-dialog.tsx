import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
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
  batchRunPipelineApiPipelinesBatchRunPost,
  runPipelineApiPipelinesRunPost,
  getModuleApiPipelinesModulesNameGet,
} from "~/api";
import type { ModuleAwarenessItem, ModuleInfoRead, SubsetRead } from "~/api/types.gen";

// --------------- Types ---------------

interface RunPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleSetId: string;
  module: ModuleAwarenessItem;
  inputSubsetIds: string[];
  /** All subsets in the sample set — used for conflict detection and name lookup */
  subsets: SubsetRead[];
  onSubmitted: () => void;
}

type Step = "configure" | "confirm-overwrite";

// --------------- Component ---------------

export function RunPipelineDialog({
  open,
  onOpenChange,
  sampleSetId,
  module,
  inputSubsetIds,
  subsets,
  onSubmitted,
}: RunPipelineDialogProps) {
  const isBatch = inputSubsetIds.length > 1;
  const isSingle = inputSubsetIds.length === 1;

  // Module info (for params_schema)
  const [moduleInfo, setModuleInfo] = useState<ModuleInfoRead | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Form state
  const [outputName, setOutputName] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState<Step>("configure");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default name generation
  const defaultName = useMemo(() => {
    if (isSingle) {
      const subset = subsets.find((s) => s.id === inputSubsetIds[0]);
      return `${subset?.name ?? "input"}_${module.module_name}`;
    }
    return `{input_name}_${module.module_name}`;
  }, [isSingle, inputSubsetIds, subsets, module.module_name]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setOutputName(defaultName);
      setParams({});
      setStep("configure");
      setError(null);
      setSubmitting(false);
      setLoadingInfo(true);

      getModuleApiPipelinesModulesNameGet({
        path: { name: module.module_name },
      }).then(({ data }) => {
        setModuleInfo(data ?? null);
        setLoadingInfo(false);
      });
    }
  }, [open, defaultName, module.module_name]);

  // Conflict detection
  const existingNames = useMemo(
    () => new Set(subsets.map((s) => s.name)),
    [subsets],
  );

  const conflictingNames = useMemo(() => {
    if (isSingle) {
      return existingNames.has(outputName) ? [outputName] : [];
    }
    // Batch: expand template for each input subset
    const conflicts: string[] = [];
    for (const subId of inputSubsetIds) {
      const subset = subsets.find((s) => s.id === subId);
      if (!subset) continue;
      const expanded = outputName
        .replace("{input_name}", subset.name)
        .replace("{module}", module.module_name);
      if (existingNames.has(expanded)) {
        conflicts.push(expanded);
      }
    }
    return conflicts;
  }, [outputName, existingNames, inputSubsetIds, subsets, isSingle, module.module_name]);

  const hasConflict = conflictingNames.length > 0;

  // Batch preview
  const batchPreview = useMemo(() => {
    if (!isBatch) return [];
    return inputSubsetIds.slice(0, 5).map((subId) => {
      const subset = subsets.find((s) => s.id === subId);
      return outputName
        .replace("{input_name}", subset?.name ?? "?")
        .replace("{module}", module.module_name);
    });
  }, [isBatch, inputSubsetIds, outputName, subsets, module.module_name]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      // If there are conflicts and we haven't confirmed overwrite yet
      if (hasConflict && step === "configure") {
        setStep("confirm-overwrite");
        return;
      }

      const overwrite = step === "confirm-overwrite";
      setSubmitting(true);
      setError(null);

      const paramsToSend = Object.keys(params).length > 0 ? params : undefined;

      if (isSingle) {
        runPipelineApiPipelinesRunPost({
          body: {
            module_name: module.module_name,
            sample_set_id: sampleSetId,
            input_subset_id: inputSubsetIds[0],
            output_subset_name: outputName,
            params: paramsToSend,
            overwrite,
          },
        }).then(({ error: apiError }) => {
          setSubmitting(false);
          if (apiError) {
            setError(
              (apiError as { detail?: { message?: string } })?.detail?.message ??
                "Failed to submit task",
            );
            setStep("configure");
            return;
          }
          onOpenChange(false);
          onSubmitted();
        });
      } else {
        batchRunPipelineApiPipelinesBatchRunPost({
          body: {
            module_name: module.module_name,
            sample_set_id: sampleSetId,
            input_subset_ids: inputSubsetIds,
            output_subset_name_template: outputName,
            params: paramsToSend,
            overwrite,
          },
        }).then(({ error: apiError }) => {
          setSubmitting(false);
          if (apiError) {
            setError(
              (apiError as { detail?: { message?: string } })?.detail?.message ??
                "Failed to submit tasks",
            );
            setStep("configure");
            return;
          }
          onOpenChange(false);
          onSubmitted();
        });
      }
    },
    [
      hasConflict,
      step,
      params,
      isSingle,
      module.module_name,
      sampleSetId,
      inputSubsetIds,
      outputName,
      onOpenChange,
      onSubmitted,
    ],
  );

  // Params schema fields
  const paramsSchema = moduleInfo?.params_schema as
    | { properties?: Record<string, ParamField>; required?: string[] }
    | null
    | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Run {module.module_name}
          </DialogTitle>
          <DialogDescription>
            {isSingle
              ? "Configure output name and parameters for this pipeline run."
              : `Run on ${inputSubsetIds.length} subsets. Use {input_name} and {module} as template variables.`}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 py-2">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Output name / template */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="output-name">
                  {isSingle ? "Output Subset Name" : "Output Name Template"}
                </Label>
                <Input
                  id="output-name"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  required
                  autoFocus
                />
                {hasConflict && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    <span>
                      {conflictingNames.length === 1
                        ? `"${conflictingNames[0]}" already exists and will be overwritten.`
                        : `${conflictingNames.length} subset(s) will be overwritten.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Batch preview */}
              {isBatch && batchPreview.length > 0 && (
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-xs">Preview</Label>
                  <div className="bg-muted rounded-md px-3 py-2 text-xs">
                    {batchPreview.map((name, i) => (
                      <div key={i} className="truncate">
                        {name}
                      </div>
                    ))}
                    {inputSubsetIds.length > 5 && (
                      <div className="text-muted-foreground">
                        …and {inputSubsetIds.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic params form */}
              {loadingInfo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading parameters…
                </div>
              )}
              {paramsSchema?.properties && (
                <DynamicParamsForm
                  schema={paramsSchema}
                  values={params}
                  onChange={setParams}
                />
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
              <Button type="submit" disabled={submitting || !outputName.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : hasConflict ? (
                  "Run (Overwrite)"
                ) : (
                  "Run"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "confirm-overwrite" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Overwrite existing subsets?</p>
                <p className="mt-1 text-xs">
                  The following subset(s) will be deleted and recreated:
                </p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {conflictingNames.slice(0, 5).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                  {conflictingNames.length > 5 && (
                    <li>…and {conflictingNames.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("configure")}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={submitting}
                onClick={() => handleSubmit()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Overwriting…
                  </>
                ) : (
                  "Overwrite & Run"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --------------- Dynamic Params Form ---------------

interface ParamField {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

interface DynamicParamsFormProps {
  schema: { properties?: Record<string, ParamField>; required?: string[] };
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

function DynamicParamsForm({ schema, values, onChange }: DynamicParamsFormProps) {
  const properties = schema.properties ?? {};
  const requiredFields = new Set(schema.required ?? []);

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange],
  );

  const entries = Object.entries(properties);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        Parameters
      </Label>
      {entries.map(([key, field]) => (
        <ParamFieldInput
          key={key}
          name={key}
          field={field}
          value={values[key] ?? field.default ?? ""}
          required={requiredFields.has(key)}
          onChange={(val) => handleChange(key, val)}
        />
      ))}
    </div>
  );
}

function ParamFieldInput({
  name,
  field,
  value,
  required,
  onChange,
}: {
  name: string;
  field: ParamField;
  value: unknown;
  required: boolean;
  onChange: (value: unknown) => void;
}) {
  const label = field.title ?? name;
  const id = `param-${name}`;

  // Enum → select
  if (field.enum && field.enum.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <select
          id={id}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          {field.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        {field.description && (
          <span className="text-muted-foreground text-xs">{field.description}</span>
        )}
      </div>
    );
  }

  // Boolean → checkbox
  if (field.type === "boolean") {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded"
        />
        {label}
        {field.description && (
          <span className="text-muted-foreground text-xs">— {field.description}</span>
        )}
      </label>
    );
  }

  // Number
  if (field.type === "number" || field.type === "integer") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <Input
          id={id}
          type="number"
          value={String(value)}
          min={field.minimum}
          max={field.maximum}
          step={field.type === "integer" ? 1 : "any"}
          onChange={(e) =>
            onChange(
              field.type === "integer"
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value),
            )
          }
          required={required}
        />
        {field.description && (
          <span className="text-muted-foreground text-xs">{field.description}</span>
        )}
      </div>
    );
  }

  // Default: string input
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {field.description && (
        <span className="text-muted-foreground text-xs">{field.description}</span>
      )}
    </div>
  );
}

import { useCallback, useState } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/admin.modules";
import {
  listModulesApiPipelinesModulesGet,
  getResourcesApiPipelinesResourcesGet,
  enableModuleApiPipelinesModulesNameEnablePut,
  disableModuleApiPipelinesModulesNameDisablePut,
  loadModuleApiPipelinesModulesNameLoadPost,
  unloadModuleApiPipelinesModulesNameUnloadPost,
} from "~/api";
import type { ModuleInfoRead } from "~/api/types.gen";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { toast } from "sonner";
import {
  Cpu,
  HardDrive,
  Activity,
  Loader2,
} from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Module Management - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const [modulesRes, resourcesRes] = await Promise.all([
    listModulesApiPipelinesModulesGet(),
    getResourcesApiPipelinesResourcesGet(),
  ]);
  return {
    modules: modulesRes.data ?? [],
    resources: (resourcesRes.data ?? {}) as {
      total_ram_mb: number;
      total_vram_mb: number;
      used_ram_mb: number;
      used_vram_mb: number;
      available_ram_mb: number;
      available_vram_mb: number;
      threshold_ratio: number;
      loaded_modules: string[];
    },
  };
}

export default function AdminModulesPage({ loaderData }: Route.ComponentProps) {
  const { modules, resources } = loaderData;
  const revalidator = useRevalidator();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const withLoading = useCallback(
    async (name: string, fn: () => Promise<unknown>) => {
      setLoading((prev) => ({ ...prev, [name]: true }));
      try {
        await fn();
        revalidator.revalidate();
      } catch {
        toast.error(`Operation failed for ${name}`);
      } finally {
        setLoading((prev) => ({ ...prev, [name]: false }));
      }
    },
    [revalidator]
  );

  const toggleEnabled = useCallback(
    (mod: ModuleInfoRead) =>
      withLoading(mod.name, async () => {
        if (mod.enabled) {
          await disableModuleApiPipelinesModulesNameDisablePut({
            path: { name: mod.name },
          });
          toast.success(`${mod.name} disabled`);
        } else {
          await enableModuleApiPipelinesModulesNameEnablePut({
            path: { name: mod.name },
          });
          toast.success(`${mod.name} enabled`);
        }
      }),
    [withLoading]
  );

  const toggleLoaded = useCallback(
    (mod: ModuleInfoRead) =>
      withLoading(mod.name, async () => {
        if (mod.loaded) {
          await unloadModuleApiPipelinesModulesNameUnloadPost({
            path: { name: mod.name },
          });
          toast.success(`${mod.name} unloaded`);
        } else {
          await loadModuleApiPipelinesModulesNameLoadPost({
            path: { name: mod.name },
          });
          toast.success(`${mod.name} loaded`);
        }
      }),
    [withLoading]
  );

  const ramPct = resources.total_ram_mb
    ? Math.round((resources.used_ram_mb / resources.total_ram_mb) * 100)
    : 0;
  const vramPct = resources.total_vram_mb
    ? Math.round((resources.used_vram_mb / resources.total_vram_mb) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Module Management
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage pipeline modules and system resources.
        </p>
      </div>

      {/* Resource Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RAM Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ramPct}%</div>
            <p className="text-xs text-muted-foreground">
              {resources.used_ram_mb} / {resources.total_ram_mb} MB
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(ramPct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VRAM Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vramPct}%</div>
            <p className="text-xs text-muted-foreground">
              {resources.used_vram_mb} / {resources.total_vram_mb} MB
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(vramPct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loaded Modules</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resources.loaded_modules?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Threshold: {Math.round(resources.threshold_ratio * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module List */}
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((mod) => (
          <Card key={mod.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{mod.name}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={mod.enabled ? "default" : "secondary"}>
                    {mod.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant={mod.loaded ? "default" : "outline"}>
                    {mod.loaded ? "Loaded" : "Unloaded"}
                  </Badge>
                </div>
              </div>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Version: {mod.version}</div>
                <div>Priority: {mod.suggestion_priority}</div>
                <div>Max RAM: {mod.max_ram_mb} MB</div>
                <div>Max VRAM: {mod.max_vram_mb} MB</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={mod.enabled}
                    disabled={!!loading[mod.name]}
                    onCheckedChange={() => toggleEnabled(mod)}
                  />
                  <span className="text-sm">Enabled</span>
                </div>
                <Button
                  variant={mod.loaded ? "destructive" : "default"}
                  size="sm"
                  disabled={!!loading[mod.name] || !mod.enabled}
                  onClick={() => toggleLoaded(mod)}
                >
                  {loading[mod.name] && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {mod.loaded ? "Unload" : "Load"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

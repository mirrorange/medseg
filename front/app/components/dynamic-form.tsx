import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  format?: string;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface DynamicFormProps {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function DynamicForm({ schema, values, onChange }: DynamicFormProps) {
  if (!schema.properties) return null;

  function setValue(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(schema.properties).map(([key, prop]) => (
        <div key={key} className="flex flex-col gap-2">
          <Label htmlFor={`param-${key}`}>
            {key}
            {schema.required?.includes(key) && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </Label>
          {prop.description && (
            <p className="text-xs text-muted-foreground">{prop.description}</p>
          )}
          {renderField(key, prop, values[key], (v) => setValue(key, v))}
        </div>
      ))}
    </div>
  );
}

function renderField(
  key: string,
  prop: JsonSchemaProperty,
  value: unknown,
  onChange: (v: unknown) => void
) {
  const id = `param-${key}`;

  // Enum → Select
  if (prop.enum && prop.enum.length > 0) {
    return (
      <Select
        value={(value as string) ?? (prop.default as string) ?? ""}
        onValueChange={onChange}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {prop.enum.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean → Switch
  if (prop.type === "boolean") {
    return (
      <Switch
        id={id}
        checked={(value as boolean) ?? (prop.default as boolean) ?? false}
        onCheckedChange={onChange}
      />
    );
  }

  // Textarea
  if (prop.format === "textarea") {
    return (
      <Textarea
        id={id}
        value={(value as string) ?? (prop.default as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Number
  if (prop.type === "number" || prop.type === "integer") {
    return (
      <Input
        id={id}
        type="number"
        value={(value as number) ?? (prop.default as number) ?? ""}
        min={prop.minimum}
        max={prop.maximum}
        step={prop.type === "integer" ? 1 : "any"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
      />
    );
  }

  // Default: string input
  return (
    <Input
      id={id}
      type="text"
      value={(value as string) ?? (prop.default as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

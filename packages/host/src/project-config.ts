import type { TargetSelection, TsonicProjectConfig } from "@tsonic/target-api";

export function parseTsonicProjectConfig(value: unknown): TsonicProjectConfig {
  if (!isRecord(value)) {
    throw new Error("Project config must be an object.");
  }
  return {
    entryPoint: readString(value, "entryPoint"),
    ...(readOptionalString(value, "rootDir") !== undefined ? { rootDir: readOptionalString(value, "rootDir") } : {}),
    ...(readOptionalString(value, "outDir") !== undefined ? { outDir: readOptionalString(value, "outDir") } : {}),
    targets: readTargets(value.targets),
  };
}

function readTargets(value: unknown): readonly TargetSelection[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Project config requires a non-empty targets array.");
  }
  const seen = new Set<string>();
  return value.map((target, index) => {
    if (!isRecord(target)) {
      throw new Error(`Target at index ${index} must be an object.`);
    }
    const id = readString(target, "id");
    if (seen.has(id)) {
      throw new Error(`Project config target '${id}' is declared more than once. Use one target entry per target id.`);
    }
    seen.add(id);
    const options = target.options;
    if (options !== undefined && !isRecord(options)) {
      throw new Error(`Target '${id}' options must be an object.`);
    }
    return {
      id,
      ...(options !== undefined ? { options } : {}),
    };
  });
}

function readString(value: Readonly<Record<string, unknown>>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`Project config requires non-empty string '${key}'.`);
  }
  return field;
}

function readOptionalString(value: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) {
    return undefined;
  }
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`Project config field '${key}' must be a non-empty string.`);
  }
  return field;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import {
  getTargetIdValidationMessage,
  isValidTargetId,
  isValidTargetSurfaceId,
} from "@tsonic/target-api";
import type {
  TargetSelection,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export function parseTsonicProjectConfig(value: unknown): TsonicProjectConfig {
  if (!isRecord(value)) {
    throw new Error("Project config must be an object.");
  }
  rejectUnknownProjectConfigKeys(value);
  const entryPoint = readString(value, "entryPoint");
  if (!isSupportedEntryPoint(entryPoint)) {
    throw new Error("Project config entryPoint must use a final ESM TypeScript source extension: .ts or .mts.");
  }
  const rootFiles = readOptionalRootFiles(value);
  return {
    entryPoint,
    ...(rootFiles !== undefined ? { rootFiles } : {}),
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
    rejectUnknownTargetKeys(target, index);
    const id = readString(target, "id");
    if (!isValidTargetId(id)) {
      throw new Error(getTargetIdValidationMessage(`Target at index ${index} id '${id}'`));
    }
    if (seen.has(id)) {
      throw new Error(`Project config target '${id}' is declared more than once. Use one target entry per target id.`);
    }
    seen.add(id);
    const options = target.options;
    if (options !== undefined && !isRecord(options)) {
      throw new Error(`Target '${id}' options must be an object.`);
    }
    const surfaces = readOptionalSurfaces(target, id);
    return {
      id,
      ...(surfaces !== undefined ? { surfaces } : {}),
      ...(options !== undefined ? { options } : {}),
    };
  });
}

function rejectUnknownProjectConfigKeys(value: Readonly<Record<string, unknown>>): void {
  rejectUnsupportedCompilerConfigKeys(value);
  rejectUnknownKeys(value, new Set(["$schema", "entryPoint", "rootFiles", "rootDir", "outDir", "targets"]), "Project config");
}

function rejectUnsupportedCompilerConfigKeys(value: Readonly<Record<string, unknown>>): void {
  for (const key of ["compilerOptions", "baseUrl", "paths", "tsconfig", "extends", "references"]) {
    if (value[key] !== undefined) {
      throw new Error(`Project config field '${key}' is not supported. Tsonic project config must not silently carry TypeScript compiler path-mapping or tsconfig fields.`);
    }
  }
}

function rejectUnknownTargetKeys(value: Readonly<Record<string, unknown>>, index: number): void {
  if (value.packages !== undefined) {
    throw new Error(`Target at index ${index} has unsupported field 'packages'. Install a Tsonic target capability package instead.`);
  }
  rejectUnknownKeys(value, new Set(["id", "surfaces", "options"]), `Target at index ${index}`);
}

function rejectUnknownKeys(value: Readonly<Record<string, unknown>>, allowedKeys: ReadonlySet<string>, subject: string): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${subject} has unsupported field '${unknownKeys[0]}'.`);
  }
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

function readOptionalRootFiles(
  value: Readonly<Record<string, unknown>>,
): readonly string[] | undefined {
  const field = value.rootFiles;
  if (field === undefined) {
    return undefined;
  }
  if (!Array.isArray(field) || field.length === 0) {
    throw new Error("Project config rootFiles must be a non-empty array of final ESM TypeScript source paths.");
  }
  const seen = new Set<string>();
  const rootFiles = field.map((rootFile, index) => {
    if (typeof rootFile !== "string" || !isSupportedEntryPoint(rootFile)) {
      throw new Error(`Project config rootFiles[${index}] must use a final ESM TypeScript source extension: .ts or .mts.`);
    }
    if (seen.has(rootFile)) {
      throw new Error(`Project config root file '${rootFile}' is declared more than once.`);
    }
    seen.add(rootFile);
    return rootFile;
  });
  return Object.freeze(rootFiles);
}

function readOptionalSurfaces(value: Readonly<Record<string, unknown>>, targetId: string): readonly string[] | undefined {
  const field = value.surfaces;
  if (field === undefined) {
    return undefined;
  }
  if (!Array.isArray(field)) {
    throw new Error(`Target '${targetId}' surfaces must be an array of non-empty strings.`);
  }
  const seen = new Set<string>();
  return field.map((surface, index) => {
    if (typeof surface !== "string" || surface.length === 0) {
      throw new Error(`Target '${targetId}' surface at index ${index} must be a non-empty string.`);
    }
    if (!isValidTargetSurfaceId(surface)) {
      throw new Error(getTargetIdValidationMessage(`Target '${targetId}' surface '${surface}'`));
    }
    if (seen.has(surface)) {
      throw new Error(`Target '${targetId}' surface '${surface}' is declared more than once.`);
    }
    seen.add(surface);
    return surface;
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedEntryPoint(value: string): boolean {
  return /\.(?:mts|ts)$/.test(value) && !/\.d\.(?:mts|ts)$/.test(value);
}

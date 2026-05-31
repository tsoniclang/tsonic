/**
 * External semantic registry loading.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  ExternalMetadataRegistry,
  ExternalBindingsFile,
  ExternalBindingsMethod,
  ExternalBindingsProperty,
  ExternalBindingsType,
} from "../external-metadata.js";
import type { BindingSemanticSignature } from "./binding-types.js";
import { extractRawExternalBindingsPayload } from "./external-binding-payload.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";

type RawExternalBindingsFile = {
  readonly namespace?: unknown;
  readonly types?: readonly RawExternalBindingsType[];
};

type RawExternalBindingsType = {
  readonly targetName?: unknown;
  readonly kind?: unknown;
  readonly baseType?: { readonly targetName?: unknown };
  readonly interfaces?: readonly { readonly targetName?: unknown }[];
  readonly methods?: readonly RawExternalBindingsMethod[];
  readonly properties?: readonly RawExternalBindingsProperty[];
};

type RawExternalBindingsMethod = {
  readonly targetName?: unknown;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly parameterCount?: number;
  readonly visibility?: string;
  readonly canonicalSignature?: string;
  readonly semanticSignature?: BindingSemanticSignature;
  readonly parameterModifiers?: readonly { index: number; modifier: string }[];
};

type RawExternalBindingsProperty = {
  readonly targetName?: unknown;
  readonly isStatic?: boolean;
  readonly isVirtual?: boolean;
  readonly isSealed?: boolean;
  readonly isAbstract?: boolean;
  readonly visibility?: string;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const toExternalBindingsFile = (
  payload: RawExternalBindingsFile
): ExternalBindingsFile => {
  const types: ExternalBindingsType[] = [];

  for (const type of payload.types ?? []) {
    const targetName = asString(type.targetName);
    if (!targetName) continue;

    const methods: ExternalBindingsMethod[] = [];
    for (const method of type.methods ?? []) {
      const targetMethodName = asString(method.targetName);
      if (!targetMethodName) continue;
      methods.push({
        targetName: targetMethodName,
        isStatic: method.isStatic,
        isVirtual: method.isVirtual,
        isSealed: method.isSealed,
        isAbstract: method.isAbstract,
        parameterCount: method.parameterCount,
        visibility: method.visibility,
        canonicalSignature: method.canonicalSignature,
        semanticSignature: method.semanticSignature,
        parameterModifiers: method.parameterModifiers,
      });
    }

    const properties: ExternalBindingsProperty[] = [];
    for (const property of type.properties ?? []) {
      const targetPropertyName = asString(property.targetName);
      if (!targetPropertyName) continue;
      properties.push({
        targetName: targetPropertyName,
        isStatic: property.isStatic,
        isVirtual: property.isVirtual,
        isSealed: property.isSealed,
        isAbstract: property.isAbstract,
        visibility: property.visibility,
      });
    }

    const baseTypeName = asString(type.baseType?.targetName);
    types.push({
      targetName,
      kind: asString(type.kind),
      baseType: baseTypeName ? { targetName: baseTypeName } : undefined,
      interfaces: (type.interfaces ?? [])
        .map((candidate) => {
          const interfaceTargetName = asString(candidate.targetName);
          return interfaceTargetName
            ? { targetName: interfaceTargetName }
            : undefined;
        })
        .filter(
          (candidate): candidate is { readonly targetName: string } =>
            candidate !== undefined
        ),
      methods,
      properties,
    });
  }

  return {
    schema: "tsonic.bindings",
    provider: {
      namespace: asString(payload.namespace) ?? "",
    },
    targetSurface: {
      types,
    },
  };
};

/**
 * Recursively scan a directory for target binding manifest files.
 */
const scanForBindingsFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      results.push(...scanForBindingsFiles(fullPath));
    } else if (entry.name === "bindings.json") {
      results.push(fullPath);
    }
  }

  return results;
};

const isSourcePackageRoot = (packageRoot: string): boolean => {
  const manifestPath = path.join(packageRoot, "tsonic.package.json");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      readonly kind?: unknown;
    };
    return parsed.kind === "tsonic-source-package";
  } catch {
    return false;
  }
};

const loadMetadataFromPackage = (
  registry: ExternalMetadataRegistry,
  packageRoot: string,
  visited: Set<string>,
  forceDependencyTraversal = false
): void => {
  const absoluteRoot = path.resolve(packageRoot);
  if (visited.has(absoluteRoot)) {
    return;
  }
  visited.add(absoluteRoot);

  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const sourcePackageRoot = isSourcePackageRoot(absoluteRoot);
  const bindingsFiles = sourcePackageRoot
    ? []
    : scanForBindingsFiles(absoluteRoot);
  let discoveredExternalBindingsInPackage = false;

  for (const bindingsPath of bindingsFiles) {
    try {
      const content = fs.readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      const externalPayload = extractRawExternalBindingsPayload(parsed);
      if (externalPayload) {
        discoveredExternalBindingsInPackage = true;
        registry.loadBindingsFile(
          bindingsPath,
          toExternalBindingsFile(externalPayload as RawExternalBindingsFile)
        );
      }
    } catch (err) {
      console.warn(`Failed to load bindings from ${bindingsPath}:`, err);
    }
  }

  const hasBindingsManifest =
    !sourcePackageRoot &&
    fs.existsSync(path.join(absoluteRoot, "tsonic.bindings.json"));
  const hasSurfaceManifest = fs.existsSync(
    path.join(absoluteRoot, "tsonic.surface.json")
  );
  const shouldTraverseDependencies =
    forceDependencyTraversal ||
    sourcePackageRoot ||
    discoveredExternalBindingsInPackage ||
    hasBindingsManifest ||
    hasSurfaceManifest;

  const packageJsonPath = path.join(absoluteRoot, "package.json");
  if (!shouldTraverseDependencies || !fs.existsSync(packageJsonPath)) {
    return;
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8")
    ) as {
      readonly dependencies?: Record<string, unknown>;
      readonly optionalDependencies?: Record<string, unknown>;
      readonly peerDependencies?: Record<string, unknown>;
    };
    const dependencyNames = new Set<string>();
    const dependencyBuckets = [
      packageJson.dependencies,
      packageJson.optionalDependencies,
      packageJson.peerDependencies,
    ];

    for (const bucket of dependencyBuckets) {
      if (
        bucket !== null &&
        typeof bucket === "object" &&
        !Array.isArray(bucket)
      ) {
        for (const depName of Object.keys(bucket)) {
          dependencyNames.add(depName);
        }
      }
    }

    for (const depName of dependencyNames) {
      const dependencyRoot = resolveDependencyPackageRoot(
        absoluteRoot,
        depName
      );
      if (dependencyRoot) {
        loadMetadataFromPackage(registry, dependencyRoot, visited, false);
      }
    }
  } catch {
    // Ignore unreadable or invalid package manifests.
  }
};

/**
 * Load external semantic info from configured type roots.
 *
 * tsbindgen emits a single manifest per namespace: `<Namespace>/bindings.json`.
 * This loader scans the configured type roots and loads all discovered manifests.
 */
export const loadExternalMetadata = (
  typeRoots: readonly string[]
): ExternalMetadataRegistry => {
  const registry = new ExternalMetadataRegistry();
  const visited = new Set<string>();

  for (const typeRoot of typeRoots) {
    loadMetadataFromPackage(registry, typeRoot, visited, true);
  }

  return registry;
};

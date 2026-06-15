import { existsSync } from "node:fs";
import * as path from "node:path";
import { readSourcePackageMetadata } from "./source-package-metadata.js";

export type ExternalBindingSourceIdentity = {
  readonly bindingFile: string;
  readonly sourceName: string;
};

const sourceFileBindingPathCache = new Map<string, string | undefined>();

const findBindingPathForSourceFile = (
  fileName: string
): string | undefined => {
  const normalized = path.resolve(fileName);
  const cached = sourceFileBindingPathCache.get(normalized);
  if (sourceFileBindingPathCache.has(normalized)) return cached;

  let current = path.dirname(normalized);
  for (;;) {
    if (readSourcePackageMetadata(current)) {
      sourceFileBindingPathCache.set(normalized, undefined);
      return undefined;
    }
    const bindingsPath = path.join(current, "bindings.json");
    if (existsSync(bindingsPath)) {
      sourceFileBindingPathCache.set(normalized, bindingsPath);
      return bindingsPath;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      sourceFileBindingPathCache.set(normalized, undefined);
      return undefined;
    }
    current = parent;
  }
};

export const externalBindingSourceIdentityForDeclaration = (
  fileName: string,
  sourceName: string
): ExternalBindingSourceIdentity | undefined => {
  const bindingsPath = findBindingPathForSourceFile(fileName);
  if (!bindingsPath) return undefined;
  return { bindingFile: bindingsPath, sourceName };
};

export const hasExternalBindingDeclaration = (
  fileName: string,
  sourceName: string
): boolean =>
  externalBindingSourceIdentityForDeclaration(fileName, sourceName) !==
  undefined;

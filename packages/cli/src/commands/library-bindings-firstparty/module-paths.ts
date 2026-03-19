import { posix } from "node:path";
import type { IrModule } from "@tsonic/frontend";

export const moduleNamespacePath = (namespace: string): string => {
  return namespace.length > 0 ? namespace : "index";
};

export const normalizeModuleFileKey = (filePath: string): string => {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
};

export const resolveLocalModuleFile = (
  fromModule: string,
  fromFile: string,
  modulesByFile: ReadonlyMap<string, IrModule>
): IrModule | undefined => {
  const dir = posix.dirname(fromFile);

  const candidates: string[] = [];
  const raw = fromModule.startsWith("/")
    ? posix.normalize(fromModule.slice(1))
    : posix.normalize(posix.join(dir, fromModule));
  candidates.push(raw);

  if (raw.endsWith(".js")) {
    candidates.push(raw.replace(/\.js$/, ".ts"));
  }

  if (!raw.endsWith(".ts") && !raw.endsWith(".js")) {
    candidates.push(raw + ".ts");
    candidates.push(raw + ".js");
    candidates.push(posix.join(raw, "index.ts"));
    candidates.push(posix.join(raw, "index.js"));
  }

  for (const cand of candidates) {
    const normalized = normalizeModuleFileKey(cand);
    const found = modulesByFile.get(normalized);
    if (found) return found;
  }

  return undefined;
};

export const resolveReexportModuleKey = (
  fromFilePath: string,
  fromModule: string
): string => {
  const fromDir = posix.dirname(normalizeModuleFileKey(fromFilePath));
  return normalizeModuleFileKey(
    posix.normalize(posix.join(fromDir, fromModule))
  );
};

export const isRelativeModuleSpecifier = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

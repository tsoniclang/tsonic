import { dirname, join, posix, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { IrModule, IrStatement } from "@tsonic/frontend";
import { normalizeModuleFileKey } from "../shared.js";
import type { SourceModuleInfo } from "../types.js";

export const classifyExportKind = (
  module: IrModule,
  name: string
): "type" | "value" | "unknown" => {
  const isNamed = (
    stmt: IrStatement & { readonly name?: unknown }
  ): stmt is IrStatement & { readonly name: string } =>
    typeof stmt.name === "string";

  const findDecl = (): IrStatement | undefined => {
    for (const stmt of module.body) {
      if (
        !("isExported" in stmt) ||
        (stmt as { isExported?: unknown }).isExported !== true
      ) {
        continue;
      }

      if (isNamed(stmt) && stmt.name === name) return stmt;

      if (stmt.kind === "variableDeclaration") {
        for (const decl of stmt.declarations) {
          if (
            decl.name.kind === "identifierPattern" &&
            decl.name.name === name
          ) {
            return stmt;
          }
        }
      }
    }
    return undefined;
  };

  const decl = findDecl();
  if (!decl) return "unknown";

  switch (decl.kind) {
    case "typeAliasDeclaration":
    case "interfaceDeclaration":
      return "type";
    case "classDeclaration":
    case "enumDeclaration":
    case "functionDeclaration":
    case "variableDeclaration":
      return "value";
    default:
      return "unknown";
  }
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

export const resolveLocalSourceModuleKey = (
  fromModule: string,
  fromFileKey: string,
  sourceModulesByFileKey: ReadonlyMap<string, SourceModuleInfo>
): string | undefined => {
  const dir = posix.dirname(fromFileKey);

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
    if (sourceModulesByFileKey.has(normalized)) {
      return normalized;
    }
  }

  return undefined;
};

export const resolveRelativeSourceModulePath = (
  absoluteFromFile: string,
  specifier: string,
  absoluteSourceRoot: string
): string | undefined => {
  if (!(specifier.startsWith(".") || specifier.startsWith("/"))) {
    return undefined;
  }

  const base = specifier.startsWith("/")
    ? resolve(absoluteSourceRoot, "." + specifier)
    : resolve(dirname(absoluteFromFile), specifier);
  const candidates = [
    base,
    base.endsWith(".js") ? base.replace(/\.js$/, ".ts") : undefined,
    !base.endsWith(".ts") && !base.endsWith(".js") ? `${base}.ts` : undefined,
    !base.endsWith(".ts") && !base.endsWith(".js") ? `${base}.js` : undefined,
    !base.endsWith(".ts") && !base.endsWith(".js")
      ? join(base, "index.ts")
      : undefined,
    !base.endsWith(".ts") && !base.endsWith(".js")
      ? join(base, "index.js")
      : undefined,
  ].filter((value): value is string => !!value);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const relative = posix.normalize(
      posix.relative(
        absoluteSourceRoot.replace(/\\/g, "/"),
        candidate.replace(/\\/g, "/")
      )
    );
    if (relative.startsWith("..")) continue;
    return candidate;
  }

  return undefined;
};

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { basename, join, resolve, posix } from "node:path";
import type { IrModule, IrStatement, IrType, IrTypeParameter } from "@tsonic/frontend";
import { buildModuleDependencyGraph, type CompilerOptions, type Diagnostic } from "@tsonic/frontend";
import type { ResolvedConfig, Result } from "../types.js";

type FacadeInfo = {
  readonly namespace: string;
  readonly facadeDtsPath: string;
  readonly facadeJsPath: string;
  readonly moduleSpecifier: string; // "./Namespace.js"
  readonly internalIndexDtsPath: string;
};

const renderDiagnostics = (diags: readonly Diagnostic[]): string => {
  return diags
    .map((d) => {
      if (d.location) {
        return `${d.location.file}:${d.location.line}:${d.location.column} ${d.message}`;
      }
      return d.message;
    })
    .join("\n");
};

const escapeRegExp = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const stripExistingSection = (
  text: string,
  startMarker: string,
  endMarker: string
): string => {
  const start = text.indexOf(startMarker);
  if (start < 0) return text;
  const end = text.indexOf(endMarker, start);
  if (end < 0) return text;
  return text.slice(0, start) + text.slice(end + endMarker.length);
};

const upsertSection = (
  text: string,
  startMarker: string,
  endMarker: string,
  body: string
): string => {
  const stripped = stripExistingSection(text, startMarker, endMarker).trimEnd();
  const section = `\n\n${startMarker}\n${body.trimEnd()}\n${endMarker}\n`;
  return stripped + section;
};

const indexFacadeFiles = (outDir: string): ReadonlyMap<string, FacadeInfo> => {
  const result = new Map<string, FacadeInfo>();
  const entries = readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".d.ts"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of entries) {
    const facadeDtsPath = join(outDir, fileName);
    const content = readFileSync(facadeDtsPath, "utf-8");

    const namespaceMatch = content.match(/^\/\/ Namespace:\s*(.+)\s*$/m);
    if (!namespaceMatch) continue;
    const namespace = namespaceMatch[1]?.trim();
    if (!namespace) continue;

    const internalImportMatch = content.match(
      /^import\s+\*\s+as\s+Internal\s+from\s+['"](.+)['"];\s*$/m
    );
    if (!internalImportMatch) continue;

    const internalRelJs = internalImportMatch[1];
    if (!internalRelJs) continue;
    let internalRel = internalRelJs;
    if (internalRel.startsWith("./")) internalRel = internalRel.slice(2);
    const internalIndexDtsPath = join(outDir, internalRel.replace(/\.js$/, ".d.ts"));

    const moduleSpecifier = `./${basename(fileName, ".d.ts")}.js`;
    const facadeJsPath = join(outDir, `${basename(fileName, ".d.ts")}.js`);

    result.set(namespace, {
      namespace,
      facadeDtsPath,
      facadeJsPath,
      moduleSpecifier,
      internalIndexDtsPath,
    });
  }

  return result;
};

const classifyExportKind = (
  module: IrModule,
  name: string
): "type" | "value" | "unknown" => {
  const isNamed = (stmt: IrStatement & { readonly name?: unknown }): stmt is IrStatement & { readonly name: string } =>
    typeof stmt.name === "string";

  const findDecl = (): IrStatement | undefined => {
    for (const stmt of module.body) {
      if (!("isExported" in stmt) || (stmt as { isExported?: unknown }).isExported !== true) continue;
      if (isNamed(stmt) && stmt.name === name) return stmt;
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

const resolveLocalModuleFile = (
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
    const normalized = posix
      .normalize(cand)
      .replace(/^(\.\/)+/, "")
      .replace(/^\/+/, "");

    const found = modulesByFile.get(normalized);
    if (found) return found;
  }

  return undefined;
};

type TypePrinterContext = {
  readonly parentPrecedence: number;
};

const printTypeParameters = (tps: readonly IrTypeParameter[] | undefined): string => {
  if (!tps || tps.length === 0) return "";

  const parts = tps.map((tp) => {
    const chunk: string[] = [];
    chunk.push(tp.name);
    if (tp.constraint) chunk.push(`extends ${printIrType(tp.constraint, { parentPrecedence: 0 })}`);
    if (tp.default) chunk.push(`= ${printIrType(tp.default, { parentPrecedence: 0 })}`);
    return chunk.join(" ");
  });

  return `<${parts.join(", ")}>`;
};

const printIrType = (type: IrType, ctx: TypePrinterContext): string => {
  const wrap = (s: string, prec: number): string =>
    prec < ctx.parentPrecedence ? `(${s})` : s;

  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return typeof type.value === "string" ? JSON.stringify(type.value) : String(type.value);
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "typeParameterType":
      return type.name;
    case "referenceType": {
      const base = type.name;
      const args = type.typeArguments ?? [];
      if (args.length === 0) return base;
      const rendered = args.map((a) => printIrType(a, { parentPrecedence: 0 })).join(", ");
      return `${base}<${rendered}>`;
    }
    case "arrayType":
      return `${printIrType(type.elementType, { parentPrecedence: 2 })}[]`;
    case "tupleType":
      return `[${type.elementTypes.map((t) => printIrType(t, { parentPrecedence: 0 })).join(", ")}]`;
    case "functionType": {
      const ps = type.parameters
        .map((p, i) => {
          const name = (() => {
            if (p.pattern.kind === "identifierPattern") return p.pattern.name;
            return `p${i + 1}`;
          })();
          const t = p.type ? printIrType(p.type, { parentPrecedence: 0 }) : "unknown";
          return `${name}: ${t}`;
        })
        .join(", ");
      const ret = printIrType(type.returnType, { parentPrecedence: 0 });
      return wrap(`(${ps}) => ${ret}`, 2);
    }
    case "unionType": {
      const rendered = type.types.map((t) => printIrType(t, { parentPrecedence: 0 })).join(" | ");
      return wrap(rendered, 0);
    }
    case "intersectionType": {
      const rendered = type.types.map((t) => printIrType(t, { parentPrecedence: 1 })).join(" & ");
      return wrap(rendered, 1);
    }
    case "dictionaryType": {
      const k = printIrType(type.keyType, { parentPrecedence: 0 });
      const v = printIrType(type.valueType, { parentPrecedence: 0 });
      return `Record<${k}, ${v}>`;
    }
    case "objectType":
      // Object type aliases are materialized as __Alias CLR types in source builds.
      // If we reach here, the alias printer should have handled it separately.
      return "{ /* object */ }";
    default:
      // Exhaustiveness safety
      return "unknown";
  }
};

const renderExportedTypeAlias = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  internalIndexDts: string
): Result<string, string> => {
  const typeParams = printTypeParameters(stmt.typeParameters);

  if (stmt.type.kind === "objectType") {
    const arity = stmt.typeParameters?.length ?? 0;
    const internalName = `${stmt.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
    const exportedInternal = new RegExp(
      String.raw`^export\s+(?:declare\s+)?(?:class|interface|type)\s+${escapeRegExp(internalName)}\b`,
      "m"
    ).test(internalIndexDts);
    if (!exportedInternal) {
      return {
        ok: false,
        error:
          `Failed to bind exported structural alias '${stmt.name}' to internal type '${internalName}'.\n` +
          `Expected '${internalName}' to exist in internal/index.d.ts for this namespace.`,
      };
    }

    const typeArgs =
      stmt.typeParameters && stmt.typeParameters.length > 0
        ? `<${stmt.typeParameters.map((tp) => tp.name).join(", ")}>`
        : "";

    return { ok: true, value: `export type ${stmt.name}${typeParams} = Internal.${internalName}${typeArgs};` };
  }

  const rhs = printIrType(stmt.type, { parentPrecedence: 0 });
  return { ok: true, value: `export type ${stmt.name}${typeParams} = ${rhs};` };
};

export const augmentLibraryBindingsFromSource = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  const entryPoint = config.entryPoint;
  if (!entryPoint) {
    return { ok: true, value: undefined };
  }

  const absoluteEntryPoint = resolve(config.projectRoot, entryPoint);
  const absoluteSourceRoot = resolve(config.projectRoot, config.sourceRoot);

  const typeLibraries = config.libraries.filter((lib) => !lib.endsWith(".dll"));
  const allTypeRoots = [...config.typeRoots, ...typeLibraries].map((p) =>
    resolve(config.workspaceRoot, p)
  );

  const compilerOptions: CompilerOptions = {
    projectRoot: config.projectRoot,
    sourceRoot: absoluteSourceRoot,
    rootNamespace: config.rootNamespace,
    typeRoots: allTypeRoots,
    verbose: false,
  };

  const graphResult = buildModuleDependencyGraph(absoluteEntryPoint, compilerOptions);
  if (!graphResult.ok) {
    return { ok: false, error: `Failed to analyze library sources:\n${renderDiagnostics(graphResult.error)}` };
  }

  const { modules, entryModule } = graphResult.value;

  const facadesByNamespace = new Map(indexFacadeFiles(bindingsOutDir));
  const modulesByFile = new Map<string, IrModule>();
  for (const m of modules) {
    const key = posix
      .normalize(m.filePath)
      .replace(/^(\.\/)+/, "")
      .replace(/^\/+/, "");
    modulesByFile.set(key, m);
  }

  const ensureFacade = (namespace: string): FacadeInfo => {
    const existing = facadesByNamespace.get(namespace);
    if (existing) return existing;

    const baseName = namespace;
    const facadeDtsPath = join(bindingsOutDir, `${baseName}.d.ts`);
    const facadeJsPath = join(bindingsOutDir, `${baseName}.js`);
    const moduleSpecifier = `./${baseName}.js`;
    const internalIndexDtsPath = join(bindingsOutDir, "internal", "index.d.ts");

    const internalImport = existsSync(internalIndexDtsPath)
      ? `import * as Internal from './internal/index.js';\n\n`
      : "";

    if (!existsSync(facadeDtsPath)) {
      let content = `// Namespace: ${namespace}\n// Generated by Tsonic (source bindings augmentation)\n\n`;
      if (internalImport) content += internalImport;
      content += "export {};\n";
      writeFileSync(
        facadeDtsPath,
        content,
        "utf-8"
      );
    }

    if (!existsSync(facadeJsPath)) {
      writeFileSync(
        facadeJsPath,
        [
          `// Namespace: ${namespace}`,
          `// Generated by Tsonic (source bindings augmentation)`,
          ``,
          `export {};`,
          ``,
        ].join("\n"),
        "utf-8"
      );
    }

    const created: FacadeInfo = {
      namespace,
      facadeDtsPath,
      facadeJsPath,
      moduleSpecifier,
      internalIndexDtsPath,
    };
    facadesByNamespace.set(namespace, created);
    return created;
  };

  // 1) Per-namespace exported type aliases (including non-structural aliases).
  const exportedAliasesByNamespace = new Map<string, string[]>();
  for (const m of modules) {
    const isExportedTypeAlias = (
      stmt: IrStatement
    ): stmt is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
      stmt.kind === "typeAliasDeclaration" && stmt.isExported;

    const exportedAliases = m.body.filter(isExportedTypeAlias);
    if (exportedAliases.length === 0) continue;

    const info = ensureFacade(m.namespace);

    const internalIndexDts = existsSync(info.internalIndexDtsPath)
      ? readFileSync(info.internalIndexDtsPath, "utf-8")
      : "";

    for (const stmt of exportedAliases) {
      const rendered = renderExportedTypeAlias(stmt, internalIndexDts);
      if (!rendered.ok) return rendered;

      const list = exportedAliasesByNamespace.get(m.namespace) ?? [];
      list.push(rendered.value);
      exportedAliasesByNamespace.set(m.namespace, list);
    }
  }

  const aliasStart = "// Tsonic source type aliases (generated)";
  const aliasEnd = "// End Tsonic source type aliases";
  for (const [ns, lines] of exportedAliasesByNamespace) {
    const info = facadesByNamespace.get(ns);
    if (!info) continue;
    if (lines.length === 0) continue;

    const unique = Array.from(new Set(lines)).sort((a, b) => a.localeCompare(b));
    const body = unique.join("\n");

    const current = readFileSync(info.facadeDtsPath, "utf-8");
    const next = upsertSection(current, aliasStart, aliasEnd, body);
    writeFileSync(info.facadeDtsPath, next, "utf-8");
  }

  // 2) Entry-module re-export surface (matches TS semantics for library entrypoints).
  // This makes cross-package consumption work when consumers import from the root namespace module.
  const entryFacade = ensureFacade(entryModule.namespace);

  const reexports = entryModule.exports.filter((e) => e.kind === "reexport");
  if (reexports.length > 0) {
    type GroupKey = `${string}|${"type" | "value"}`;
    const grouped = new Map<GroupKey, string[]>();

    for (const exp of reexports) {
      const targetModule = resolveLocalModuleFile(exp.fromModule, entryModule.filePath, modulesByFile);
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Failed to resolve re-export '${exp.name}' from '${exp.fromModule}' in ${entryModule.filePath}.\n` +
            `Ensure the target module is within sourceRoot and is part of the build graph.`,
        };
      }

      if (targetModule.namespace === entryModule.namespace) {
        // Re-export from same namespace is redundant; the facade already exports public members for that namespace.
        continue;
      }

      const targetFacade = ensureFacade(targetModule.namespace);

      const kind = classifyExportKind(targetModule, exp.originalName);
      if (kind === "unknown") {
        return {
          ok: false,
          error:
            `Failed to classify re-export '${exp.name}' from '${exp.fromModule}'.\n` +
            `Could not find an exported declaration named '${exp.originalName}' in ${targetModule.filePath}.`,
        };
      }
      const isTypeOnly = kind === "type";

      const spec = exp.name === exp.originalName ? exp.name : `${exp.originalName} as ${exp.name}`;
      const key: GroupKey = `${targetFacade.moduleSpecifier}|${isTypeOnly ? "type" : "value"}`;
      const list = grouped.get(key) ?? [];
      list.push(spec);
      grouped.set(key, list);
    }

    const start = "// Tsonic entrypoint re-exports (generated)";
    const end = "// End Tsonic entrypoint re-exports";

    const statements: string[] = [];
    for (const [key, specs] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const [moduleSpecifier, kind] = key.split("|") as [string, "type" | "value"];
      const unique = Array.from(new Set(specs)).sort((a, b) => a.localeCompare(b));
      if (kind === "type") {
        statements.push(`export type { ${unique.join(", ")} } from '${moduleSpecifier}';`);
      } else {
        statements.push(`export { ${unique.join(", ")} } from '${moduleSpecifier}';`);
      }
    }

    if (statements.length > 0) {
      const current = readFileSync(entryFacade.facadeDtsPath, "utf-8");
      const next = upsertSection(current, start, end, statements.join("\n"));
      writeFileSync(entryFacade.facadeDtsPath, next, "utf-8");
    }

    const valueStatements = statements.filter((s) => !s.startsWith("export type "));
    if (valueStatements.length > 0) {
      const jsStart = "// Tsonic entrypoint value re-exports (generated)";
      const jsEnd = "// End Tsonic entrypoint value re-exports";
      const current = existsSync(entryFacade.facadeJsPath)
        ? readFileSync(entryFacade.facadeJsPath, "utf-8")
        : "";
      const next = upsertSection(current, jsStart, jsEnd, valueStatements.join("\n"));
      writeFileSync(entryFacade.facadeJsPath, next, "utf-8");
    }
  }

  return { ok: true, value: undefined };
};

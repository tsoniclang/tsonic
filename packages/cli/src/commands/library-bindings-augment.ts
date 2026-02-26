import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, posix } from "node:path";
import type {
  IrModule,
  IrStatement,
  IrType,
  IrTypeParameter,
} from "@tsonic/frontend";
import {
  buildModuleDependencyGraph,
  type CompilerOptions,
  type Diagnostic,
} from "@tsonic/frontend";
import type { ResolvedConfig, Result } from "../types.js";
import * as ts from "typescript";

type FacadeInfo = {
  readonly namespace: string;
  readonly facadeDtsPath: string;
  readonly facadeJsPath: string;
  readonly moduleSpecifier: string; // "./Namespace.js"
  readonly internalIndexDtsPath: string;
};

type WrapperImport = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
  readonly aliasName: string;
};

type MemberOverride = {
  readonly namespace: string;
  readonly className: string;
  readonly memberName: string;
  readonly sourceTypeText?: string;
  readonly replaceWithSourceType?: boolean;
  readonly isOptional?: boolean;
  readonly wrappers: readonly WrapperImport[];
};

type SourceTypeAliasDef = {
  readonly typeParameters: readonly string[];
  readonly type: ts.TypeNode;
};

type SourceMemberTypeDef = {
  readonly typeNode: ts.TypeNode;
  readonly typeText: string;
  readonly isOptional: boolean;
};

type SourceFunctionSignatureDef = {
  readonly typeParametersText: string;
  readonly parametersText: string;
  readonly returnTypeText: string;
};

type SourceTypeImport = {
  readonly source: string;
  readonly importedName: string;
};

type ModuleSourceIndex = {
  readonly fileKey: string;
  readonly wrapperImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeAliasesByName: ReadonlyMap<string, SourceTypeAliasDef>;
  readonly exportedFunctionSignaturesByName: ReadonlyMap<
    string,
    readonly SourceFunctionSignatureDef[]
  >;
  readonly memberTypesByClassAndMember: ReadonlyMap<
    string,
    ReadonlyMap<string, SourceMemberTypeDef>
  >;
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

const typePrinter = ts.createPrinter({ removeComments: true });

const printTypeNodeText = (
  node: ts.TypeNode,
  sourceFile: ts.SourceFile
): string => {
  return typePrinter
    .printNode(ts.EmitHint.Unspecified, node, sourceFile)
    .trim();
};

const ensureUndefinedInType = (typeText: string): string => {
  const trimmed = typeText.trim();
  if (/\bundefined\b/.test(trimmed)) return trimmed;
  return `${trimmed} | undefined`;
};

const normalizeModuleFileKey = (filePath: string): string => {
  return posix
    .normalize(filePath)
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
};

const getPropertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
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

const upsertSectionAfterImports = (
  text: string,
  startMarker: string,
  endMarker: string,
  body: string
): string => {
  const stripped = stripExistingSection(text, startMarker, endMarker);
  const lines = stripped.split("\n");

  // Find insertion point before the first non-comment, non-import top-level statement.
  let insertAt = 0;
  while (insertAt < lines.length) {
    const line = lines[insertAt] ?? "";
    const trimmed = line.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("import ")
    ) {
      insertAt += 1;
      continue;
    }
    break;
  }

  const head = lines.slice(0, insertAt).join("\n").trimEnd();
  const tail = lines.slice(insertAt).join("\n").trimStart();
  const section = `${startMarker}\n${body.trimEnd()}\n${endMarker}`;

  const parts: string[] = [];
  if (head) parts.push(head);
  parts.push(section);
  if (tail) parts.push(tail);
  return parts.join("\n\n") + "\n";
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
    const internalIndexDtsPath = join(
      outDir,
      internalRel.replace(/\.js$/, ".d.ts")
    );

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

const applyWrappersToBaseType = (
  baseType: string,
  wrappers: readonly WrapperImport[]
): string => {
  let expr = baseType.trim();
  for (const w of wrappers.slice().reverse()) {
    expr = `${w.aliasName}<${expr}>`;
  }
  return expr;
};

const patchInternalIndexWithMemberOverrides = (
  internalIndexDtsPath: string,
  overrides: readonly MemberOverride[]
): Result<void, string> => {
  if (!existsSync(internalIndexDtsPath)) {
    return {
      ok: false,
      error: `Internal index not found at ${internalIndexDtsPath}`,
    };
  }

  const original = readFileSync(internalIndexDtsPath, "utf-8");

  // Collect wrapper imports (dedupe + validate no alias conflicts).
  const wrapperByAlias = new Map<string, WrapperImport>();
  for (const o of overrides) {
    for (const w of o.wrappers) {
      const existing = wrapperByAlias.get(w.aliasName);
      if (existing) {
        if (
          existing.source !== w.source ||
          existing.importedName !== w.importedName
        ) {
          return {
            ok: false,
            error:
              `Conflicting wrapper import alias '${w.aliasName}' while augmenting ${internalIndexDtsPath}.\n` +
              `- ${existing.importedName} from '${existing.source}'\n` +
              `- ${w.importedName} from '${w.source}'\n` +
              `Fix: rename one of the imported ExtensionMethods aliases in source code.`,
          };
        }
        continue;
      }
      wrapperByAlias.set(w.aliasName, w);
    }
  }

  const wrapperImports = Array.from(wrapperByAlias.values()).sort((a, b) =>
    a.aliasName.localeCompare(b.aliasName)
  );

  const importLines = wrapperImports.map((w) => {
    if (w.importedName === w.aliasName) {
      return `import type { ${w.importedName} } from '${w.source}';`;
    }
    return `import type { ${w.importedName} as ${w.aliasName} } from '${w.source}';`;
  });

  const importStart = "// Tsonic source member type imports (generated)";
  const importEnd = "// End Tsonic source member type imports";
  const withImports =
    importLines.length > 0
      ? upsertSectionAfterImports(
          original,
          importStart,
          importEnd,
          importLines.join("\n")
        )
      : stripExistingSection(original, importStart, importEnd);

  // Patch interface member types within their $instance interface blocks.
  let next = withImports;

  const byClass = new Map<string, MemberOverride[]>();
  for (const o of overrides) {
    const list = byClass.get(o.className) ?? [];
    list.push(o);
    byClass.set(o.className, list);
  }

  for (const [className, list] of byClass) {
    const ifaceName = `${className}$instance`;
    const ifaceRe = new RegExp(
      String.raw`export\s+interface\s+${escapeRegExp(ifaceName)}\b[^{]*\{[\s\S]*?^\}`,
      "m"
    );
    const match = ifaceRe.exec(next);
    if (!match || match.index === undefined) {
      return {
        ok: false,
        error:
          `Failed to locate interface '${ifaceName}' in ${internalIndexDtsPath}.\n` +
          `Cannot apply TS source member type augmentation.`,
      };
    }

    const block = match[0];
    const open = block.indexOf("{");
    const close = block.lastIndexOf("}");
    if (open < 0 || close < 0 || close <= open) {
      return {
        ok: false,
        error:
          `Malformed interface '${ifaceName}' block in ${internalIndexDtsPath}.\n` +
          `Cannot apply TS source member type augmentation.`,
      };
    }

    const head = block.slice(0, open + 1);
    let body = block.slice(open + 1, close);
    const tail = block.slice(close);

    for (const o of list.sort((a, b) =>
      a.memberName.localeCompare(b.memberName)
    )) {
      const propRe = new RegExp(
        String.raw`(^\s*(?:readonly\s+)?${escapeRegExp(o.memberName)}\s*:\s*)([^;]+)(;)`,
        "m"
      );
      const propMatch = propRe.exec(body);
      if (propMatch) {
        const baseType =
          (o.replaceWithSourceType ? o.sourceTypeText : undefined) ??
          propMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, o.wrappers);
        if (o.isOptional) nextType = ensureUndefinedInType(nextType);
        body = body.replace(propRe, `$1${nextType}$3`);
        continue;
      }

      const getterRe = new RegExp(
        String.raw`(^\s*get\s+${escapeRegExp(o.memberName)}\s*\(\)\s*:\s*)([^;]+)(;)`,
        "m"
      );
      const setterRe = new RegExp(
        String.raw`(^\s*set\s+${escapeRegExp(o.memberName)}\s*\(\s*value\s*:\s*)([^)]+)(\)\s*;)`,
        "m"
      );

      const getterMatch = getterRe.exec(body);
      const setterMatch = setterRe.exec(body);
      if (!getterMatch && !setterMatch) {
        return {
          ok: false,
          error:
            `Failed to locate property '${o.memberName}' on '${ifaceName}' in ${internalIndexDtsPath}.\n` +
            `This property was declared in TS source and should exist in CLR metadata.`,
        };
      }

      if (getterMatch) {
        const baseType =
          (o.replaceWithSourceType ? o.sourceTypeText : undefined) ??
          getterMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, o.wrappers);
        if (o.isOptional) nextType = ensureUndefinedInType(nextType);
        body = body.replace(getterRe, `$1${nextType}$3`);
      }

      if (setterMatch) {
        const baseType =
          (o.replaceWithSourceType ? o.sourceTypeText : undefined) ??
          setterMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, o.wrappers);
        if (o.isOptional) nextType = ensureUndefinedInType(nextType);
        body = body.replace(setterRe, `$1${nextType}$3`);
      }
    }

    const patchedBlock = head + body + tail;
    next =
      next.slice(0, match.index) +
      patchedBlock +
      next.slice(match.index + block.length);
  }

  if (next !== original) {
    writeFileSync(internalIndexDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

export const patchInternalIndexBrandMarkersOptional = (
  internalIndexDtsPath: string,
  typeNames: readonly string[]
): Result<void, string> => {
  if (!existsSync(internalIndexDtsPath)) {
    return {
      ok: false,
      error: `Internal index not found at ${internalIndexDtsPath}`,
    };
  }

  const original = readFileSync(internalIndexDtsPath, "utf-8");
  let next = original;

  for (const typeName of Array.from(new Set(typeNames)).sort((a, b) =>
    a.localeCompare(b)
  )) {
    const ifaceName = `${typeName}$instance`;
    const ifaceRe = new RegExp(
      String.raw`export\s+interface\s+${escapeRegExp(ifaceName)}\b[^{]*\{[\s\S]*?^\}`,
      "m"
    );
    const match = ifaceRe.exec(next);
    if (!match || match.index === undefined) continue;

    const block = match[0];
    const open = block.indexOf("{");
    const close = block.lastIndexOf("}");
    if (open < 0 || close < 0 || close <= open) continue;

    const head = block.slice(0, open + 1);
    let body = block.slice(open + 1, close);
    const tail = block.slice(close);

    const brandRe =
      /(^\s*readonly\s+__tsonic_type_[A-Za-z0-9_]+)\s*:\s*never\s*;/gm;
    if (!brandRe.test(body)) continue;
    body = body.replace(brandRe, "$1?: never;");

    const patchedBlock = head + body + tail;
    next =
      next.slice(0, match.index) +
      patchedBlock +
      next.slice(match.index + block.length);
  }

  if (next !== original) {
    writeFileSync(internalIndexDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

const splitTopLevelTypeArgs = (text: string): string[] => {
  const parts: string[] = [];
  let depthAngle = 0;
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "<") depthAngle += 1;
    else if (ch === ">") depthAngle = Math.max(0, depthAngle - 1);
    else if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (
      ch === "," &&
      depthAngle === 0 &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter((p) => p.length > 0);
};

const expandUnionsDeep = (typeText: string): string => {
  const unionPrefixRe = /Union_\d+</g;
  let result = typeText;

  // Iterate until no more Union_N< patterns remain
  while (true) {
    unionPrefixRe.lastIndex = 0;
    const prefixMatch = unionPrefixRe.exec(result);
    if (!prefixMatch) break;

    // Find the matching > for the < at the end of the prefix
    const openAngle = prefixMatch.index + prefixMatch[0].length - 1;
    let depth = 1;
    let closeAngle = -1;
    for (let i = openAngle + 1; i < result.length; i += 1) {
      const ch = result[i];
      if (ch === "<") depth += 1;
      else if (ch === ">") {
        depth -= 1;
        if (depth === 0) {
          closeAngle = i;
          break;
        }
      }
    }
    if (closeAngle < 0) break;

    const inner = result.slice(openAngle + 1, closeAngle);
    const args = splitTopLevelTypeArgs(inner);
    if (args.length < 2) break;

    const expanded = `(${args.join(" | ")})`;
    result =
      result.slice(0, prefixMatch.index) +
      expanded +
      result.slice(closeAngle + 1);
  }

  return result;
};

const patchFacadeWithSourceFunctionSignatures = (
  facadeDtsPath: string,
  signaturesByName: ReadonlyMap<string, readonly SourceFunctionSignatureDef[]>
): Result<void, string> => {
  if (!existsSync(facadeDtsPath)) {
    return {
      ok: false,
      error: `Facade declaration file not found at ${facadeDtsPath}`,
    };
  }

  const original = readFileSync(facadeDtsPath, "utf-8");
  let next = original;

  for (const [name, signatures] of Array.from(signaturesByName.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  )) {
    if (signatures.length === 0) continue;

    const fnRe = new RegExp(
      String.raw`^(export\s+declare\s+function\s+${escapeRegExp(name)}(?:<[\s\S]*?>)?\s*\([\s\S]*?\)\s*:\s*)([^;]+)(;)`,
      "m"
    );
    const currentMatch = fnRe.exec(next);

    if (currentMatch) {
      const existingReturnType = currentMatch[2]?.trim() ?? "";

      const replacement = Array.from(
        new Set(
          signatures.map((sig) => {
            const returnType = sig.returnTypeText.includes("{")
              ? expandUnionsDeep(existingReturnType)
              : sig.returnTypeText;
            return `export declare function ${name}${sig.typeParametersText}(${sig.parametersText}): ${returnType};`;
          })
        )
      ).join("\n");

      next = next.replace(fnRe, replacement);
      continue;
    }

    // If no function declaration match, try const Func<...> pattern
    const constFuncRe = new RegExp(
      String.raw`^export\s+declare\s+const\s+${escapeRegExp(name)}\s*:\s*Func<([\s\S]+?)>\s*;`,
      "m"
    );
    const constMatch = constFuncRe.exec(next);
    if (!constMatch || !constMatch[1]) continue;

    const funcTypeArgs = splitTopLevelTypeArgs(constMatch[1]);
    if (funcTypeArgs.length < 2) continue;

    // Last arg = return type, remaining args = parameter types
    const facadeParamTypes = funcTypeArgs.slice(0, -1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const facadeReturnType = funcTypeArgs[funcTypeArgs.length - 1]!;

    // Use the first source signature for parameter names
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sourceSig = signatures[0]!;
    const sourceParams = sourceSig.parametersText
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // If count mismatch, skip patching for this declaration
    if (sourceParams.length !== facadeParamTypes.length) continue;

    // Pair source parameter NAMES with facade parameter TYPES
    const pairedParams = sourceParams.map((param, idx) => {
      const colonIdx = param.indexOf(":");
      const paramName =
        colonIdx >= 0 ? param.slice(0, colonIdx).trim() : param.trim();
      return `${paramName}: ${facadeParamTypes[idx]}`;
    });

    const expandedReturnType = expandUnionsDeep(facadeReturnType);
    const typeParamsText = sourceSig.typeParametersText;
    const replacement = `export declare function ${name}${typeParamsText}(${pairedParams.join(", ")}): ${expandedReturnType};`;

    next = next.replace(constFuncRe, replacement);
  }

  if (next !== original) {
    writeFileSync(facadeDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

const classifyExportKind = (
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
      )
        continue;

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

const buildModuleSourceIndex = (
  absoluteFilePath: string,
  fileKey: string
): Result<ModuleSourceIndex, string> => {
  if (!existsSync(absoluteFilePath)) {
    return {
      ok: false,
      error: `Failed to read source file for bindings augmentation: ${absoluteFilePath}`,
    };
  }

  const content = readFileSync(absoluteFilePath, "utf-8");
  const scriptKind = absoluteFilePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : absoluteFilePath.endsWith(".js")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    absoluteFilePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const wrapperImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeAliasesByName = new Map<string, SourceTypeAliasDef>();
  const exportedFunctionSignaturesByName = new Map<
    string,
    SourceFunctionSignatureDef[]
  >();
  const memberTypesByClassAndMember = new Map<
    string,
    Map<string, SourceMemberTypeDef>
  >();

  const printTypeParametersText = (
    typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
  ): string => {
    if (!typeParameters || typeParameters.length === 0) return "";
    return `<${typeParameters.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const printParameterText = (param: ts.ParameterDeclaration): string => {
    const rest = param.dotDotDotToken ? "..." : "";
    const name = param.name.getText(sourceFile);
    const optional = param.questionToken ? "?" : "";
    const type = param.type
      ? printTypeNodeText(param.type, sourceFile)
      : "unknown";
    return `${rest}${name}${optional}: ${type}`;
  };

  const addExportedFunctionSignature = (
    name: string,
    sig: SourceFunctionSignatureDef
  ): void => {
    const list = exportedFunctionSignaturesByName.get(name) ?? [];
    list.push(sig);
    exportedFunctionSignaturesByName.set(name, list);
  };

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined;
      if (!moduleSpecifier) continue;

      const clause = stmt.importClause;
      if (!clause) continue;

      const namedBindings = clause.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      for (const spec of namedBindings.elements) {
        const localName = spec.name.text;
        const importedName = (spec.propertyName ?? spec.name).text;
        const isTypeOnly = clause.isTypeOnly || spec.isTypeOnly;
        if (!isTypeOnly) continue;

        typeImportsByLocalName.set(localName, {
          source: moduleSpecifier,
          importedName,
        });
        if (importedName === "ExtensionMethods") {
          wrapperImportsByLocalName.set(localName, {
            source: moduleSpecifier,
            importedName,
          });
        }
      }

      continue;
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      const aliasName = stmt.name.text;
      const typeParameters = (stmt.typeParameters ?? []).map(
        (tp) => tp.name.text
      );
      typeAliasesByName.set(aliasName, { typeParameters, type: stmt.type });
      continue;
    }

    if (ts.isFunctionDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport || !stmt.name || !stmt.type) continue;

      const parametersText = stmt.parameters.map(printParameterText).join(", ");
      addExportedFunctionSignature(stmt.name.text, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        parametersText,
        returnTypeText: printTypeNodeText(stmt.type, sourceFile),
      });
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport) continue;

      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const exportName = decl.name.text;
        const init = decl.initializer;
        if (!init) continue;

        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          const returnType = init.type;
          if (!returnType) continue;
          const parametersText = init.parameters
            .map(printParameterText)
            .join(", ");
          addExportedFunctionSignature(exportName, {
            typeParametersText: printTypeParametersText(init.typeParameters),
            parametersText,
            returnTypeText: printTypeNodeText(returnType, sourceFile),
          });
        }
      }
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      const members =
        memberTypesByClassAndMember.get(className) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (ts.isGetAccessorDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: false,
          });
          continue;
        }

        if (ts.isPropertyDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: member.questionToken !== undefined,
          });
        }
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(className, members);
      }

      continue;
    }

    if (ts.isInterfaceDeclaration(stmt)) {
      const interfaceName = stmt.name.text;
      const members =
        memberTypesByClassAndMember.get(interfaceName) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const name = getPropertyNameText(member.name);
        if (!name) continue;

        members.set(name, {
          typeNode: member.type,
          typeText: printTypeNodeText(member.type, sourceFile),
          isOptional: member.questionToken !== undefined,
        });
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(interfaceName, members);
      }
    }
  }

  return {
    ok: true,
    value: {
      fileKey,
      wrapperImportsByLocalName,
      typeImportsByLocalName,
      typeAliasesByName,
      exportedFunctionSignaturesByName,
      memberTypesByClassAndMember,
    },
  };
};

const typeNodeUsesImportedTypeNames = (
  node: ts.TypeNode,
  typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>
): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isTypeReferenceNode(current) && ts.isIdentifier(current.typeName)) {
      if (typeImportsByLocalName.has(current.typeName.text)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

const collectExtensionWrapperImportsFromSourceType = (opts: {
  readonly startModuleKey: string;
  readonly typeNode: ts.TypeNode;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
}): Result<readonly WrapperImport[], string> => {
  const wrappers: WrapperImport[] = [];

  let currentModuleKey = opts.startModuleKey;
  let currentNode: ts.TypeNode = opts.typeNode;
  let subst = new Map<string, ts.TypeNode>();
  const aliasStack: string[] = [];

  while (true) {
    currentNode = unwrapParens(currentNode);

    if (!ts.isTypeReferenceNode(currentNode)) break;
    if (!ts.isIdentifier(currentNode.typeName)) break;

    const ident = currentNode.typeName.text;
    const info = opts.sourceIndexByFileKey.get(currentModuleKey);
    if (!info) break;

    const substituted = subst.get(ident);
    if (substituted) {
      currentNode = substituted;
      continue;
    }

    // Expand local or imported type aliases to reach wrapper chains.
    const expandAlias = (
      aliasKey: string,
      alias: SourceTypeAliasDef,
      typeArgs: readonly ts.TypeNode[]
    ): void => {
      const key = aliasKey;
      if (aliasStack.includes(key)) return;
      aliasStack.push(key);

      if (alias.typeParameters.length === typeArgs.length) {
        const next = new Map(subst);
        for (let i = 0; i < alias.typeParameters.length; i += 1) {
          const paramName = alias.typeParameters[i];
          const arg = typeArgs[i];
          if (!paramName || !arg) continue;
          next.set(paramName, arg);
        }
        subst = next;
      }

      currentNode = alias.type;
    };

    const localAlias = info.typeAliasesByName.get(ident);
    if (localAlias) {
      expandAlias(
        `${currentModuleKey}:${ident}`,
        localAlias,
        currentNode.typeArguments ?? []
      );
      continue;
    }

    const imported = info.typeImportsByLocalName.get(ident);
    if (
      imported &&
      (imported.source.startsWith(".") || imported.source.startsWith("/"))
    ) {
      const targetModule = resolveLocalModuleFile(
        imported.source,
        currentModuleKey,
        opts.modulesByFileKey
      );
      if (targetModule) {
        const targetKey = normalizeModuleFileKey(targetModule.filePath);
        const targetInfo = opts.sourceIndexByFileKey.get(targetKey);
        const targetAlias = targetInfo?.typeAliasesByName.get(
          imported.importedName
        );
        if (targetAlias) {
          currentModuleKey = targetKey;
          expandAlias(
            `${targetKey}:${imported.importedName}`,
            targetAlias,
            currentNode.typeArguments ?? []
          );
          continue;
        }
      }
    }

    const wrapperImport = info.wrapperImportsByLocalName.get(ident);
    if (!wrapperImport) break;

    const args = currentNode.typeArguments ?? [];
    if (args.length !== 1) {
      return {
        ok: false,
        error:
          `ExtensionMethods wrapper '${ident}' must have exactly 1 type argument.\n` +
          `Found: ${args.length} in ${currentModuleKey}.`,
      };
    }

    wrappers.push({
      source: wrapperImport.source,
      importedName: wrapperImport.importedName,
      localName: ident,
      aliasName: `__TsonicExt_${ident}`,
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    currentNode = args[0]!;
  }

  return { ok: true, value: wrappers };
};

type TypePrinterContext = {
  readonly parentPrecedence: number;
};

const printTypeParameters = (
  tps: readonly IrTypeParameter[] | undefined
): string => {
  if (!tps || tps.length === 0) return "";

  const parts = tps.map((tp) => {
    const chunk: string[] = [];
    chunk.push(tp.name);
    if (tp.constraint)
      chunk.push(
        `extends ${printIrType(tp.constraint, { parentPrecedence: 0 })}`
      );
    if (tp.default)
      chunk.push(`= ${printIrType(tp.default, { parentPrecedence: 0 })}`);
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
      return typeof type.value === "string"
        ? JSON.stringify(type.value)
        : String(type.value);
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
      const rendered = args
        .map((a) => printIrType(a, { parentPrecedence: 0 }))
        .join(", ");
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
          const t = p.type
            ? printIrType(p.type, { parentPrecedence: 0 })
            : "unknown";
          return `${name}: ${t}`;
        })
        .join(", ");
      const ret = printIrType(type.returnType, { parentPrecedence: 0 });
      return wrap(`(${ps}) => ${ret}`, 2);
    }
    case "unionType": {
      const rendered = type.types
        .map((t) => printIrType(t, { parentPrecedence: 0 }))
        .join(" | ");
      return wrap(rendered, 0);
    }
    case "intersectionType": {
      const rendered = type.types
        .map((t) => printIrType(t, { parentPrecedence: 1 }))
        .join(" & ");
      return wrap(rendered, 1);
    }
    case "dictionaryType": {
      const k = printIrType(type.keyType, { parentPrecedence: 0 });
      const v = printIrType(type.valueType, { parentPrecedence: 0 });
      return `Record<${k}, ${v}>`;
    }
    case "objectType": {
      if (type.members.length === 0) return "{}";
      const members = type.members
        .map((member) => {
          if (member.kind === "propertySignature") {
            const readonly = member.isReadonly ? "readonly " : "";
            const optional = member.isOptional ? "?" : "";
            const memberType = printIrType(member.type, {
              parentPrecedence: 0,
            });
            return `${readonly}${member.name}${optional}: ${memberType}`;
          }

          const typeParams = printTypeParameters(member.typeParameters);
          const args = member.parameters
            .map((p, i) => {
              const name =
                p.pattern.kind === "identifierPattern"
                  ? p.pattern.name
                  : `p${i + 1}`;
              const optional = p.isOptional ? "?" : "";
              const paramType = p.type
                ? printIrType(p.type, { parentPrecedence: 0 })
                : "unknown";
              return `${name}${optional}: ${paramType}`;
            })
            .join(", ");
          const returnType = member.returnType
            ? printIrType(member.returnType, { parentPrecedence: 0 })
            : "void";
          return `${member.name}${typeParams}(${args}): ${returnType}`;
        })
        .join("; ");
      return `{ ${members} }`;
    }
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

    return {
      ok: true,
      value: `export type ${stmt.name}${typeParams} = Internal.${internalName}${typeArgs};`,
    };
  }

  const rhs = printIrType(stmt.type, { parentPrecedence: 0 });
  return { ok: true, value: `export type ${stmt.name}${typeParams} = ${rhs};` };
};

/**
 * Overlay already-augmented bindings from dependency assemblies.
 *
 * When a library references sibling Tsonic-built libraries (via references.libraries),
 * tsbindgen regenerates types from CLR metadata, losing source-level augmentation
 * (literal types, optional markers, brand optionality, etc.). The dependency's published
 * bindings already have this augmentation applied, so we overlay them onto the
 * freshly-generated copies.
 */
export const overlayDependencyBindings = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  const depBindingsDirByAssembly = new Map<string, string>();
  for (const lib of config.libraries) {
    if (!lib.toLowerCase().endsWith(".dll")) continue;
    const assemblyName = basename(lib, ".dll");
    // Skip the current package's own assembly.
    if (assemblyName === config.outputName) continue;
    const depBindingsDir = resolveDependencyBindingsDirForDll(lib);
    if (existsSync(depBindingsDir)) {
      depBindingsDirByAssembly.set(assemblyName, depBindingsDir);
    }
  }

  if (depBindingsDirByAssembly.size === 0) {
    return { ok: true, value: undefined };
  }

  // Scan generated bindings for namespace directories with internal/index.d.ts.
  const generatedNamespaces = readdirSync(bindingsOutDir, {
    withFileTypes: true,
  })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const ns of generatedNamespaces) {
    const internalIndexPath = join(
      bindingsOutDir,
      ns,
      "internal",
      "index.d.ts"
    );
    if (!existsSync(internalIndexPath)) continue;

    const content = readFileSync(internalIndexPath, "utf-8");
    const assemblyMatch = content.match(/^\/\/ Assembly:\s*(.+)\s*$/m);
    if (!assemblyMatch || !assemblyMatch[1]) continue;
    const assembly = assemblyMatch[1].trim();

    const depDir = depBindingsDirByAssembly.get(assembly);
    if (!depDir) continue;

    // Overlay the dependency's already-augmented internal/index.d.ts.
    const depInternalIndex = join(depDir, ns, "internal", "index.d.ts");
    if (existsSync(depInternalIndex)) {
      copyFileSync(depInternalIndex, internalIndexPath);
    }

    // Overlay the dependency's facade .d.ts (may have type aliases, re-exports).
    const facadeDts = join(bindingsOutDir, `${ns}.d.ts`);
    const depFacadeDts = join(depDir, `${ns}.d.ts`);
    if (existsSync(facadeDts) && existsSync(depFacadeDts)) {
      copyFileSync(depFacadeDts, facadeDts);
    }
  }

  return { ok: true, value: undefined };
};

export const resolveDependencyBindingsDirForDll = (dllPath: string): string => {
  // Try nearest project-style locations first while walking up from the DLL.
  // Supports both:
  // - <project>/generated/bin/Release/<tfm>/<Assembly>.dll
  // - <project>/dist/<tfm>/<Assembly>.dll
  // and still accepts the legacy sibling location:
  // - <project>/dist/<tfm>/<Assembly>.dll -> <project>/dist/tsonic/bindings
  let cursor = resolve(dirname(dllPath));
  for (let i = 0; i < 24; i++) {
    const projectStyle = join(cursor, "dist", "tsonic", "bindings");
    if (existsSync(projectStyle)) return projectStyle;

    const legacySibling = join(cursor, "tsonic", "bindings");
    if (existsSync(legacySibling)) return legacySibling;

    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  // Preserve previous behavior (silent no-op in overlay if dir does not exist).
  return join(dirname(dirname(dllPath)), "tsonic", "bindings");
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

  const graphResult = buildModuleDependencyGraph(
    absoluteEntryPoint,
    compilerOptions
  );
  if (!graphResult.ok) {
    return {
      ok: false,
      error: `Failed to analyze library sources:\n${renderDiagnostics(graphResult.error)}`,
    };
  }

  const { modules, entryModule } = graphResult.value;

  const facadesByNamespace = new Map(indexFacadeFiles(bindingsOutDir));
  const modulesByFile = new Map<string, IrModule>();
  for (const m of modules) {
    const key = normalizeModuleFileKey(m.filePath);
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
      writeFileSync(facadeDtsPath, content, "utf-8");
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

    const unique = Array.from(new Set(lines)).sort((a, b) =>
      a.localeCompare(b)
    );
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
      const targetModule = resolveLocalModuleFile(
        exp.fromModule,
        entryModule.filePath,
        modulesByFile
      );
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
      const spec =
        exp.name === exp.originalName
          ? exp.name
          : `${exp.originalName} as ${exp.name}`;
      const isTypeOnly = kind === "type";
      const key: GroupKey = `${targetFacade.moduleSpecifier}|${isTypeOnly ? "type" : "value"}`;
      const list = grouped.get(key) ?? [];
      list.push(spec);
      grouped.set(key, list);
    }

    const start = "// Tsonic entrypoint re-exports (generated)";
    const end = "// End Tsonic entrypoint re-exports";

    const statements: string[] = [];
    for (const [key, specs] of Array.from(grouped.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      const [moduleSpecifier, kind] = key.split("|") as [
        string,
        "type" | "value",
      ];
      const unique = Array.from(new Set(specs)).sort((a, b) =>
        a.localeCompare(b)
      );
      if (kind === "type") {
        statements.push(
          `export type { ${unique.join(", ")} } from '${moduleSpecifier}';`
        );
      } else {
        statements.push(
          `export { ${unique.join(", ")} } from '${moduleSpecifier}';`
        );
      }
    }

    if (statements.length > 0) {
      const current = readFileSync(entryFacade.facadeDtsPath, "utf-8");
      const next = upsertSection(current, start, end, statements.join("\n"));
      writeFileSync(entryFacade.facadeDtsPath, next, "utf-8");
    }

    const valueStatements = statements.filter(
      (s) => !s.startsWith("export type ")
    );
    if (valueStatements.length > 0) {
      const jsStart = "// Tsonic entrypoint value re-exports (generated)";
      const jsEnd = "// End Tsonic entrypoint value re-exports";
      const current = existsSync(entryFacade.facadeJsPath)
        ? readFileSync(entryFacade.facadeJsPath, "utf-8")
        : "";
      const next = upsertSection(
        current,
        jsStart,
        jsEnd,
        valueStatements.join("\n")
      );
      writeFileSync(entryFacade.facadeJsPath, next, "utf-8");
    }
  }

  // 3) Preserve TS-authored member typing semantics on exported class/interface members.
  // These wrapper types (ExtensionMethods<...>) do not exist in CLR metadata and therefore
  // cannot be discovered by tsbindgen when generating bindings from the DLL. We can,
  // however, safely re-apply them for Tsonic-authored libraries by reading the TS source
  // graph and patching the published internal/index.d.ts:
  // - Re-apply ExtensionMethods wrappers (class + interface members)
  // - Preserve optional (`?`) semantics by allowing `undefined` on patched members
  // - For exported interfaces, preserve source structural member types when safe
  const sourceIndexByFileKey = new Map<string, ModuleSourceIndex>();
  for (const m of modules) {
    // Synthetic IR modules (e.g., program-wide anonymous type declarations) do not
    // correspond to real source files and must be ignored by source-based augmentation.
    if (m.filePath.startsWith("__tsonic/")) continue;
    const key = normalizeModuleFileKey(m.filePath);
    const absolutePath = resolve(absoluteSourceRoot, key);
    const indexed = buildModuleSourceIndex(absolutePath, key);
    if (!indexed.ok) return indexed;
    sourceIndexByFileKey.set(key, indexed.value);
  }

  const overridesByInternalIndex = new Map<string, MemberOverride[]>();
  const brandOptionalTypesByInternalIndex = new Map<string, Set<string>>();
  const functionSignaturesByFacade = new Map<
    string,
    Map<string, SourceFunctionSignatureDef[]>
  >();
  for (const m of modules) {
    if (m.filePath.startsWith("__tsonic/")) continue;
    const exportedClasses = m.body.filter(
      (s): s is Extract<IrStatement, { kind: "classDeclaration" }> =>
        s.kind === "classDeclaration" && s.isExported
    );
    const exportedInterfaces = m.body.filter(
      (s): s is Extract<IrStatement, { kind: "interfaceDeclaration" }> =>
        s.kind === "interfaceDeclaration" && s.isExported
    );
    const exportedAliases = m.body.filter(
      (s): s is Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
        s.kind === "typeAliasDeclaration" && s.isExported
    );
    const moduleKey = normalizeModuleFileKey(m.filePath);
    const sourceIndex = sourceIndexByFileKey.get(moduleKey);
    if (!sourceIndex) continue;

    const hasExportedSourceFunctions =
      sourceIndex.exportedFunctionSignaturesByName.size > 0;
    if (
      exportedClasses.length === 0 &&
      exportedInterfaces.length === 0 &&
      exportedAliases.length === 0 &&
      !hasExportedSourceFunctions
    )
      continue;

    const info =
      facadesByNamespace.get(m.namespace) ?? ensureFacade(m.namespace);

    for (const [
      name,
      signatures,
    ] of sourceIndex.exportedFunctionSignaturesByName) {
      if (signatures.length === 0) continue;
      const byName =
        functionSignaturesByFacade.get(info.facadeDtsPath) ??
        new Map<string, SourceFunctionSignatureDef[]>();
      const list = byName.get(name) ?? [];
      list.push(...signatures);
      byName.set(name, list);
      functionSignaturesByFacade.set(info.facadeDtsPath, byName);
    }

    for (const cls of exportedClasses) {
      const memberTypes = sourceIndex.memberTypesByClassAndMember.get(cls.name);
      if (!memberTypes) continue;

      for (const member of cls.members) {
        if (member.kind !== "propertyDeclaration") continue;
        if (member.isStatic) continue;
        if (member.accessibility === "private") continue;
        const sourceMember = memberTypes.get(member.name);
        if (!sourceMember) continue;

        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: moduleKey,
          typeNode: sourceMember.typeNode,
          sourceIndexByFileKey,
          modulesByFileKey: modulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;
        if (wrappers.length === 0 && !sourceMember.isOptional) continue;

        const list =
          overridesByInternalIndex.get(info.internalIndexDtsPath) ?? [];
        list.push({
          namespace: m.namespace,
          className: cls.name,
          memberName: member.name,
          isOptional: sourceMember.isOptional,
          wrappers,
        });
        overridesByInternalIndex.set(info.internalIndexDtsPath, list);
      }
    }

    for (const iface of exportedInterfaces) {
      const memberTypes = sourceIndex.memberTypesByClassAndMember.get(
        iface.name
      );
      if (!memberTypes) continue;

      for (const member of iface.members) {
        if (member.kind !== "propertySignature") continue;
        const sourceMember = memberTypes.get(member.name);
        if (!sourceMember) continue;

        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: moduleKey,
          typeNode: sourceMember.typeNode,
          sourceIndexByFileKey,
          modulesByFileKey: modulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;

        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          sourceMember.typeNode,
          sourceIndex.typeImportsByLocalName
        );

        if (!canUseSourceTypeText && wrappers.length === 0) continue;

        const list =
          overridesByInternalIndex.get(info.internalIndexDtsPath) ?? [];
        list.push({
          namespace: m.namespace,
          className: iface.name,
          memberName: member.name,
          sourceTypeText: canUseSourceTypeText
            ? sourceMember.typeText
            : undefined,
          replaceWithSourceType: canUseSourceTypeText,
          isOptional: sourceMember.isOptional,
          wrappers,
        });
        overridesByInternalIndex.set(info.internalIndexDtsPath, list);
      }

      const brandTargets =
        brandOptionalTypesByInternalIndex.get(info.internalIndexDtsPath) ??
        new Set<string>();
      brandTargets.add(iface.name);
      brandOptionalTypesByInternalIndex.set(
        info.internalIndexDtsPath,
        brandTargets
      );
    }

    for (const alias of exportedAliases) {
      const sourceAlias = sourceIndex.typeAliasesByName.get(alias.name);
      if (!sourceAlias) continue;
      const aliasType = unwrapParens(sourceAlias.type);
      if (!ts.isTypeLiteralNode(aliasType)) continue;

      const arity = sourceAlias.typeParameters.length;
      const internalAliasName = `${alias.name}__Alias${arity > 0 ? `_${arity}` : ""}`;

      const brandTargets =
        brandOptionalTypesByInternalIndex.get(info.internalIndexDtsPath) ??
        new Set<string>();
      brandTargets.add(internalAliasName);
      brandOptionalTypesByInternalIndex.set(
        info.internalIndexDtsPath,
        brandTargets
      );

      for (const member of aliasType.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const memberName = getPropertyNameText(member.name);
        if (!memberName) continue;

        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: moduleKey,
          typeNode: member.type,
          sourceIndexByFileKey,
          modulesByFileKey: modulesByFile,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;

        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          member.type,
          sourceIndex.typeImportsByLocalName
        );
        if (!canUseSourceTypeText && wrappers.length === 0) continue;

        const list =
          overridesByInternalIndex.get(info.internalIndexDtsPath) ?? [];
        list.push({
          namespace: m.namespace,
          className: internalAliasName,
          memberName,
          sourceTypeText: canUseSourceTypeText
            ? printTypeNodeText(member.type, member.getSourceFile())
            : undefined,
          replaceWithSourceType: canUseSourceTypeText,
          isOptional: member.questionToken !== undefined,
          wrappers,
        });
        overridesByInternalIndex.set(info.internalIndexDtsPath, list);
      }
    }
  }

  for (const [internalIndex, overrides] of overridesByInternalIndex) {
    const result = patchInternalIndexWithMemberOverrides(
      internalIndex,
      overrides
    );
    if (!result.ok) return result;
  }

  for (const [internalIndex, typeNames] of brandOptionalTypesByInternalIndex) {
    const result = patchInternalIndexBrandMarkersOptional(
      internalIndex,
      Array.from(typeNames.values())
    );
    if (!result.ok) return result;
  }

  for (const [facadePath, signaturesByName] of functionSignaturesByFacade) {
    const result = patchFacadeWithSourceFunctionSignatures(
      facadePath,
      signaturesByName
    );
    if (!result.ok) return result;
  }

  return { ok: true, value: undefined };
};

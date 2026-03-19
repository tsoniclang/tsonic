import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Result } from "../../types.js";
import {
  renderSourceFunctionParametersText,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../aikya/source-function-surfaces.js";
import {
  ensureUndefinedInType,
  escapeRegExp,
  expandUnionsDeep,
  splitTopLevelCommaSeparated,
  splitTopLevelTypeArgs,
  stripExistingSection,
  textContainsIdentifier,
  upsertSectionAfterImports,
} from "./shared.js";
import type {
  FacadeInfo,
  MemberOverride,
  SourceTypeImport,
  SourceTypeImportBinding,
  WrapperImport,
} from "./types.js";

export const indexFacadeFiles = (outDir: string): ReadonlyMap<string, FacadeInfo> => {
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

export const patchInternalIndexWithMemberOverrides = (
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
              "Fix: rename one of the imported ExtensionMethods aliases in source code.",
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

      if (
        o.isOptional &&
        o.emitOptionalPropertySyntax &&
        !o.memberName.startsWith("__tsonic_type_")
      ) {
        const baseType =
          (o.replaceWithSourceType ? o.sourceTypeText : undefined) ??
          getterMatch?.[2] ??
          setterMatch?.[2] ??
          "";
        const nextType = applyWrappersToBaseType(baseType, o.wrappers);
        const matchForIndent = getterMatch ?? setterMatch;
        const indent = matchForIndent?.[0].match(/^\s*/)?.[0] ?? "    ";
        const optionalPropertyLine = `${indent}${o.memberName}?: ${nextType};`;

        if (getterMatch && setterMatch) {
          const getterStart = getterMatch.index ?? 0;
          const setterStart = setterMatch.index ?? 0;
          const start = Math.min(getterStart, setterStart);
          const getterEnd = getterStart + getterMatch[0].length;
          const setterEnd = setterStart + setterMatch[0].length;
          const end = Math.max(getterEnd, setterEnd);
          body = body.slice(0, start) + optionalPropertyLine + body.slice(end);
          continue;
        }

        if (getterMatch) {
          body = body.replace(getterRe, optionalPropertyLine);
          continue;
        }
        if (setterMatch) {
          body = body.replace(setterRe, optionalPropertyLine);
          continue;
        }
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

export const collectSourceTypeImportsForSignature = (
  signature: SourceFunctionSignatureDef,
  typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>
): readonly SourceTypeImportBinding[] => {
  const required: SourceTypeImportBinding[] = [];
  const parametersText = renderSourceFunctionParametersText(signature);

  for (const [localName, imported] of typeImportsByLocalName) {
    const source = imported.source.trim();
    if (source.startsWith(".") || source.startsWith("/")) continue;
    const appearsInSignature =
      textContainsIdentifier(signature.typeParametersText, localName) ||
      textContainsIdentifier(parametersText, localName) ||
      textContainsIdentifier(signature.returnTypeText, localName);
    if (!appearsInSignature) continue;
    required.push({
      source,
      importedName: imported.importedName,
      localName,
    });
  }

  return required.sort((a, b) => a.localName.localeCompare(b.localName));
};

export const patchFacadeWithSourceFunctionSignatures = (
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
            const existingIsUnknown = existingReturnType === "unknown";
            const existingHasAnon = /__Anon_/.test(existingReturnType);
            const existingHasGenericAritySuffix =
              /\b[A-Za-z_$][\w$]*_\d+\s*</.test(existingReturnType);
            const returnType = (() => {
              if (!sig.returnTypeText.includes("{")) {
                return sig.returnTypeText;
              }
              if (existingIsUnknown) {
                return sig.returnTypeText;
              }
              if (existingHasAnon) {
                return expandUnionsDeep(existingReturnType);
              }
              if (existingHasGenericAritySuffix) {
                return sig.returnTypeText;
              }
              return expandUnionsDeep(existingReturnType);
            })();
            return `export declare function ${name}${sig.typeParametersText}(${renderSourceFunctionParametersText(sig)}): ${returnType};`;
          })
        )
      ).join("\n");

      next = next.replace(fnRe, replacement);
      continue;
    }

    const constDeclRe = new RegExp(
      String.raw`^export\s+declare\s+const\s+${escapeRegExp(name)}\s*:\s*([^;]+);`,
      "m"
    );
    const constMatch = constDeclRe.exec(next);
    if (!constMatch || !constMatch[1]) continue;

    const constTypeText = constMatch[1].trim();
    let expectedParamCount: number | undefined;
    let forcedReturnType: string | undefined;

    const funcTypeMatch = /^Func<([\s\S]+)>$/.exec(constTypeText);
    if (funcTypeMatch?.[1]) {
      const funcTypeArgs = splitTopLevelTypeArgs(funcTypeMatch[1]);
      if (funcTypeArgs.length < 2) continue;

      expectedParamCount = funcTypeArgs.length - 1;
      const lastTypeArg = funcTypeArgs.at(-1);
      if (!lastTypeArg) continue;
      forcedReturnType = expandUnionsDeep(lastTypeArg);
    }

    const replacement = Array.from(
      new Set(
        signatures
          .filter((sig) => {
            if (expectedParamCount === undefined) return true;
            const paramCount = splitTopLevelCommaSeparated(
              renderSourceFunctionParametersText(sig)
            ).length;
            return paramCount === expectedParamCount;
          })
          .map((sig) => {
            const returnType = forcedReturnType ?? sig.returnTypeText;
            return `export declare function ${name}${sig.typeParametersText}(${renderSourceFunctionParametersText(sig)}): ${returnType};`;
          })
      )
    ).join("\n");

    if (replacement.length === 0) continue;
    next = next.replace(constDeclRe, replacement);
  }

  if (next !== original) {
    writeFileSync(facadeDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

type NamedImportSpecifier = {
  readonly imported: string;
  readonly local: string;
};

const parseNamedImports = (
  namedImportsText: string
): readonly NamedImportSpecifier[] => {
  return namedImportsText
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const source = part.replace(/^\s*type\s+/, "");
      const asMatch =
        /^\s*([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(source);
      if (asMatch && asMatch[1] && asMatch[2]) {
        return { imported: asMatch[1], local: asMatch[2] };
      }
      const identMatch = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(source);
      if (identMatch && identMatch[1]) {
        return { imported: identMatch[1], local: identMatch[1] };
      }
      return undefined;
    })
    .filter(
      (specifier): specifier is NamedImportSpecifier => specifier !== undefined
    );
};

const formatNamedImportSpecifier = (
  specifier: NamedImportSpecifier
): string => {
  if (specifier.imported === specifier.local) {
    return specifier.local;
  }
  return `${specifier.imported} as ${specifier.local}`;
};

export const ensureInternalTypeImportsForFacade = (
  facadeDtsPath: string
): Result<void, string> => {
  if (!existsSync(facadeDtsPath)) {
    return {
      ok: false,
      error: `Facade declaration file not found at ${facadeDtsPath}`,
    };
  }

  const original = readFileSync(facadeDtsPath, "utf-8");
  const internalImportRe =
    /^import\s+\*\s+as\s+Internal\s+from\s+['"]([^'"]+)['"];\s*$/m;
  const internalImportMatch = internalImportRe.exec(original);
  if (!internalImportMatch || !internalImportMatch[1]) {
    return { ok: true, value: undefined };
  }
  const internalSpecifier = internalImportMatch[1];

  const exportFromInternalRe = new RegExp(
    String.raw`^export\s+\{([^}]*)\}\s+from\s+['"]${escapeRegExp(internalSpecifier)}['"];\s*$`,
    "gm"
  );
  const neededTypeSpecifiers = new Map<string, NamedImportSpecifier>();
  for (const match of original.matchAll(exportFromInternalRe)) {
    const named = match[1];
    if (!named) continue;
    for (const specifier of parseNamedImports(named)) {
      neededTypeSpecifiers.set(specifier.local, specifier);
    }
  }

  if (neededTypeSpecifiers.size === 0) {
    return { ok: true, value: undefined };
  }

  const existingTypeImportRe = new RegExp(
    String.raw`^import\s+type\s+\{([^}]*)\}\s+from\s+['"]${escapeRegExp(internalSpecifier)}['"];\s*$`,
    "m"
  );
  const existingTypeImportMatch = existingTypeImportRe.exec(original);
  if (existingTypeImportMatch && existingTypeImportMatch[1]) {
    for (const specifier of parseNamedImports(existingTypeImportMatch[1])) {
      neededTypeSpecifiers.set(specifier.local, specifier);
    }
  }

  const sortedSpecifiers = Array.from(neededTypeSpecifiers.values()).sort(
    (a, b) => a.local.localeCompare(b.local)
  );
  const importLine = `import type { ${sortedSpecifiers
    .map((specifier) => formatNamedImportSpecifier(specifier))
    .join(", ")} } from '${internalSpecifier}';`;

  let next = original;
  if (existingTypeImportMatch && existingTypeImportMatch[0]) {
    next = next.replace(existingTypeImportRe, importLine);
  } else if (internalImportMatch[0]) {
    const anchor = internalImportMatch[0];
    next = next.replace(anchor, `${anchor}\n${importLine}`);
  }

  if (next !== original) {
    writeFileSync(facadeDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

export const ensureSourceTypeImportsForFacade = (
  facadeDtsPath: string,
  importsByLocalName: ReadonlyMap<string, SourceTypeImportBinding>
): Result<void, string> => {
  if (!existsSync(facadeDtsPath)) {
    return {
      ok: false,
      error: `Facade declaration file not found at ${facadeDtsPath}`,
    };
  }

  const original = readFileSync(facadeDtsPath, "utf-8");
  if (importsByLocalName.size === 0) {
    return { ok: true, value: undefined };
  }

  const existingLocals = new Set<string>();
  const importRe = /^import\s+(.*)\s+from\s+['"][^'"]+['"];\s*$/gm;
  for (const match of original.matchAll(importRe)) {
    const clause = match[1]?.trim();
    if (!clause) continue;

    const nsMatch = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(clause);
    if (nsMatch?.[1]) {
      existingLocals.add(nsMatch[1]);
      continue;
    }

    const defaultMatch = /^([A-Za-z_$][\w$]*)$/.exec(clause);
    if (defaultMatch?.[1]) {
      existingLocals.add(defaultMatch[1]);
      continue;
    }

    const namedMatch = /^(?:type\s+)?\{([^}]*)\}$/.exec(clause);
    if (namedMatch?.[1]) {
      for (const specifier of parseNamedImports(namedMatch[1])) {
        existingLocals.add(specifier.local);
      }
    }
  }

  const grouped = new Map<string, NamedImportSpecifier[]>();
  for (const binding of Array.from(importsByLocalName.values()).sort((a, b) =>
    a.localName.localeCompare(b.localName)
  )) {
    if (existingLocals.has(binding.localName)) continue;

    const list = grouped.get(binding.source) ?? [];
    list.push({
      imported: binding.importedName,
      local: binding.localName,
    });
    grouped.set(binding.source, list);
  }

  if (grouped.size === 0) {
    const startMarker = "// Tsonic source function type imports (generated)";
    const endMarker = "// End Tsonic source function type imports";
    const next = stripExistingSection(original, startMarker, endMarker);
    if (next !== original) {
      writeFileSync(facadeDtsPath, next, "utf-8");
    }
    return { ok: true, value: undefined };
  }

  const lines: string[] = [];
  for (const [source, specifiers] of Array.from(grouped.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  )) {
    const unique = Array.from(
      new Map(
        specifiers.map((specifier) => [
          `${specifier.imported}|${specifier.local}`,
          specifier,
        ])
      ).values()
    ).sort((a, b) => a.local.localeCompare(b.local));
    lines.push(
      `import type { ${unique.map((s) => formatNamedImportSpecifier(s)).join(", ")} } from '${source}';`
    );
  }

  const startMarker = "// Tsonic source function type imports (generated)";
  const endMarker = "// End Tsonic source function type imports";
  const next = upsertSectionAfterImports(
    original,
    startMarker,
    endMarker,
    lines.join("\n")
  );

  if (next !== original) {
    writeFileSync(facadeDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

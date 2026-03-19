import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Result } from "../../../types.js";
import {
  ensureUndefinedInType,
  escapeRegExp,
  stripExistingSection,
  upsertSectionAfterImports,
} from "../shared.js";
import type { MemberOverride, WrapperImport } from "../types.js";

const applyWrappersToBaseType = (
  baseType: string,
  wrappers: readonly WrapperImport[]
): string => {
  let expr = baseType.trim();
  for (const wrapper of wrappers.slice().reverse()) {
    expr = `${wrapper.aliasName}<${expr}>`;
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
  for (const override of overrides) {
    for (const wrapper of override.wrappers) {
      const existing = wrapperByAlias.get(wrapper.aliasName);
      if (existing) {
        if (
          existing.source !== wrapper.source ||
          existing.importedName !== wrapper.importedName
        ) {
          return {
            ok: false,
            error:
              `Conflicting wrapper import alias '${wrapper.aliasName}' while augmenting ${internalIndexDtsPath}.\n` +
              `- ${existing.importedName} from '${existing.source}'\n` +
              `- ${wrapper.importedName} from '${wrapper.source}'\n` +
              "Fix: rename one of the imported ExtensionMethods aliases in source code.",
          };
        }
        continue;
      }
      wrapperByAlias.set(wrapper.aliasName, wrapper);
    }
  }

  const wrapperImports = Array.from(wrapperByAlias.values()).sort((left, right) =>
    left.aliasName.localeCompare(right.aliasName)
  );

  const importLines = wrapperImports.map((wrapper) => {
    if (wrapper.importedName === wrapper.aliasName) {
      return `import type { ${wrapper.importedName} } from '${wrapper.source}';`;
    }
    return `import type { ${wrapper.importedName} as ${wrapper.aliasName} } from '${wrapper.source}';`;
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
  for (const override of overrides) {
    const list = byClass.get(override.className) ?? [];
    list.push(override);
    byClass.set(override.className, list);
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
          "Cannot apply TS source member type augmentation.",
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
          "Cannot apply TS source member type augmentation.",
      };
    }

    const head = block.slice(0, open + 1);
    let body = block.slice(open + 1, close);
    const tail = block.slice(close);

    for (const override of list.sort((left, right) =>
      left.memberName.localeCompare(right.memberName)
    )) {
      const propRe = new RegExp(
        String.raw`(^\s*(?:readonly\s+)?${escapeRegExp(override.memberName)}\s*:\s*)([^;]+)(;)`,
        "m"
      );
      const propMatch = propRe.exec(body);
      if (propMatch) {
        const baseType =
          (override.replaceWithSourceType ? override.sourceTypeText : undefined) ??
          propMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, override.wrappers);
        if (override.isOptional) nextType = ensureUndefinedInType(nextType);
        body = body.replace(propRe, `$1${nextType}$3`);
        continue;
      }

      const getterRe = new RegExp(
        String.raw`(^\s*get\s+${escapeRegExp(override.memberName)}\s*\(\)\s*:\s*)([^;]+)(;)`,
        "m"
      );
      const setterRe = new RegExp(
        String.raw`(^\s*set\s+${escapeRegExp(override.memberName)}\s*\(\s*value\s*:\s*)([^)]+)(\)\s*;)`,
        "m"
      );

      const getterMatch = getterRe.exec(body);
      const setterMatch = setterRe.exec(body);
      if (!getterMatch && !setterMatch) {
        return {
          ok: false,
          error:
            `Failed to locate property '${override.memberName}' on '${ifaceName}' in ${internalIndexDtsPath}.\n` +
            "This property was declared in TS source and should exist in CLR metadata.",
        };
      }

      if (
        override.isOptional &&
        override.emitOptionalPropertySyntax &&
        !override.memberName.startsWith("__tsonic_type_")
      ) {
        const baseType =
          (override.replaceWithSourceType ? override.sourceTypeText : undefined) ??
          getterMatch?.[2] ??
          setterMatch?.[2] ??
          "";
        const nextType = applyWrappersToBaseType(baseType, override.wrappers);
        const matchForIndent = getterMatch ?? setterMatch;
        const indent = matchForIndent?.[0].match(/^\s*/)?.[0] ?? "    ";
        const optionalPropertyLine = `${indent}${override.memberName}?: ${nextType};`;

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
          (override.replaceWithSourceType ? override.sourceTypeText : undefined) ??
          getterMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, override.wrappers);
        if (override.isOptional) nextType = ensureUndefinedInType(nextType);
        body = body.replace(getterRe, `$1${nextType}$3`);
      }

      if (setterMatch) {
        const baseType =
          (override.replaceWithSourceType ? override.sourceTypeText : undefined) ??
          setterMatch[2] ??
          "";
        let nextType = applyWrappersToBaseType(baseType, override.wrappers);
        if (override.isOptional) nextType = ensureUndefinedInType(nextType);
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

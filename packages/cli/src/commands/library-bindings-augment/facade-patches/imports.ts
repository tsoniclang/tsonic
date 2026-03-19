import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Result } from "../../../types.js";
import { escapeRegExp } from "../shared.js";
import type { SourceTypeImportBinding } from "../types.js";

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
    (left, right) => left.local.localeCompare(right.local)
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

    const namedMatch = /^\{([\s\S]*)\}$/.exec(clause.replace(/^type\s+/, ""));
    if (namedMatch?.[1]) {
      for (const specifier of parseNamedImports(namedMatch[1])) {
        existingLocals.add(specifier.local);
      }
    }
  }

  const newImports = Array.from(importsByLocalName.values())
    .filter((binding) => !existingLocals.has(binding.localName))
    .sort((left, right) => left.localName.localeCompare(right.localName));

  if (newImports.length === 0) {
    return { ok: true, value: undefined };
  }

  const importLines = newImports.map((binding) =>
    binding.importedName === binding.localName
      ? `import type { ${binding.importedName} } from '${binding.source}';`
      : `import type { ${binding.importedName} as ${binding.localName} } from '${binding.source}';`
  );
  const insertAfter = /^\/\/ Namespace:.*$/m.exec(original)?.[0];
  const next = insertAfter
    ? original.replace(insertAfter, `${insertAfter}\n${importLines.join("\n")}`)
    : `${importLines.join("\n")}\n${original}`;

  if (next !== original) {
    writeFileSync(facadeDtsPath, next, "utf-8");
  }

  return { ok: true, value: undefined };
};

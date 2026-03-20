import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Result } from "../../../types.js";
import {
  renderSourceFunctionParametersText,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../../package-manifests/source-function-surfaces.js";
import {
  escapeRegExp,
  expandUnionsDeep,
  splitTopLevelCommaSeparated,
  splitTopLevelTypeArgs,
  textContainsIdentifier,
} from "../shared.js";
import type { SourceTypeImport, SourceTypeImportBinding } from "../types.js";

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

  return required.sort((left, right) =>
    left.localName.localeCompare(right.localName)
  );
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
    (left, right) => left[0].localeCompare(right[0])
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
          signatures.map((signature) => {
            const existingIsUnknown = existingReturnType === "unknown";
            const existingHasAnon = /__Anon_/.test(existingReturnType);
            const existingHasGenericAritySuffix =
              /\b[A-Za-z_$][\w$]*_\d+\s*</.test(existingReturnType);
            const returnType = (() => {
              if (!signature.returnTypeText.includes("{")) {
                return signature.returnTypeText;
              }
              if (existingIsUnknown) {
                return signature.returnTypeText;
              }
              if (existingHasAnon) {
                return expandUnionsDeep(existingReturnType);
              }
              if (existingHasGenericAritySuffix) {
                return signature.returnTypeText;
              }
              return expandUnionsDeep(existingReturnType);
            })();
            return `export declare function ${name}${signature.typeParametersText}(${renderSourceFunctionParametersText(signature)}): ${returnType};`;
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
          .filter((signature) => {
            if (expectedParamCount === undefined) return true;
            const paramCount = splitTopLevelCommaSeparated(
              renderSourceFunctionParametersText(signature)
            ).length;
            return paramCount === expectedParamCount;
          })
          .map((signature) => {
            const returnType = forcedReturnType ?? signature.returnTypeText;
            return `export declare function ${name}${signature.typeParametersText}(${renderSourceFunctionParametersText(signature)}): ${returnType};`;
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

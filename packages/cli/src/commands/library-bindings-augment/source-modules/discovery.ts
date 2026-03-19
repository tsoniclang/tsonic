import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import {
  appendSourceFunctionSignature,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../../aikya/source-function-surfaces.js";
import { getNamespaceFromPath } from "@tsonic/frontend";
import * as ts from "typescript";
import type { Result } from "../../../types.js";
import {
  getPropertyNameText,
  normalizeModuleFileKey,
  printTypeNodeText,
} from "../shared.js";
import type {
  SourceMemberTypeDef,
  SourceModuleInfo,
  SourceTypeAliasDef,
  SourceTypeImport,
} from "../types.js";
import { resolveRelativeSourceModulePath } from "./module-resolution.js";

export const discoverSourceModuleInfos = (opts: {
  readonly absoluteEntryPoint: string;
  readonly absoluteSourceRoot: string;
  readonly rootNamespace: string;
}): Result<
  {
    readonly entryFileKey: string;
    readonly modulesByFileKey: ReadonlyMap<string, SourceModuleInfo>;
    readonly requiresFullGraph: boolean;
  },
  string
> => {
  const modulesByFileKey = new Map<string, SourceModuleInfo>();
  const pending = [opts.absoluteEntryPoint];
  let entryFileKey: string | undefined;
  let requiresFullGraph = false;

  while (pending.length > 0) {
    const absolutePath = pending.pop();
    if (!absolutePath) continue;

    const relativePath = posix
      .normalize(
        posix.relative(
          opts.absoluteSourceRoot.replace(/\\/g, "/"),
          absolutePath.replace(/\\/g, "/")
        )
      )
      .replace(/^\/+/, "");
    if (relativePath.startsWith("..")) {
      return {
        ok: false,
        error:
          `Bindings augmentation discovered source outside sourceRoot: ${absolutePath}\n` +
          `sourceRoot: ${opts.absoluteSourceRoot}`,
      };
    }

    const fileKey = normalizeModuleFileKey(relativePath);
    if (modulesByFileKey.has(fileKey)) continue;

    const info = buildSourceModuleInfo(
      absolutePath,
      fileKey,
      opts.absoluteSourceRoot,
      opts.rootNamespace
    );
    if (!info.ok) return info;
    modulesByFileKey.set(fileKey, info.value);

    if (!entryFileKey) {
      entryFileKey = fileKey;
    }

    if (
      info.value.exportedTypeAliasNames.length > 0 ||
      info.value.hasLocalReexports
    ) {
      requiresFullGraph = true;
    }

    for (const specifier of info.value.localRelativeImports) {
      const resolved = resolveRelativeSourceModulePath(
        absolutePath,
        specifier,
        opts.absoluteSourceRoot
      );
      if (!resolved) continue;
      pending.push(resolved);
    }
  }

  if (!entryFileKey) {
    return {
      ok: false,
      error: `Failed to discover source modules from entrypoint ${opts.absoluteEntryPoint}`,
    };
  }

  return {
    ok: true,
    value: {
      entryFileKey,
      modulesByFileKey,
      requiresFullGraph,
    },
  };
};

const buildSourceModuleInfo = (
  absoluteFilePath: string,
  fileKey: string,
  absoluteSourceRoot: string,
  rootNamespace: string
): Result<SourceModuleInfo, string> => {
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
  const exportedClassNames = new Set<string>();
  const exportedInterfaceNames = new Set<string>();
  const exportedTypeAliasNames = new Set<string>();
  const allInterfaceNames = new Set<string>();
  const allTypeAliasNames = new Set<string>();
  const localRelativeImports = new Set<string>();
  let hasLocalReexports = false;

  const printTypeParametersText = (
    typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
  ): string => {
    if (!typeParameters || typeParameters.length === 0) return "";
    return `<${typeParameters.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const printParameterText = (
    param: ts.ParameterDeclaration
  ): SourceFunctionSignatureDef["parameters"][number] => {
    const rest = param.dotDotDotToken ? "..." : "";
    const name = param.name.getText(sourceFile);
    const optional = param.questionToken ? "?" : "";
    return {
      prefixText: `${rest}${name}${optional}: `,
      typeText: param.type
        ? printTypeNodeText(param.type, sourceFile)
        : "unknown",
    };
  };

  const addExportedFunctionSignature = (
    name: string,
    sig: SourceFunctionSignatureDef
  ): void => {
    appendSourceFunctionSignature(exportedFunctionSignaturesByName, name, sig);
  };

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined;
      if (!moduleSpecifier) continue;
      if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
        localRelativeImports.add(moduleSpecifier);
      }

      const clause = stmt.importClause;
      if (!clause) continue;

      const namedBindings = clause.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      for (const spec of namedBindings.elements) {
        const localName = spec.name.text;
        const importedName = (spec.propertyName ?? spec.name).text;
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
      allTypeAliasNames.add(aliasName);
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeAliasNames.add(aliasName);
      }
      const typeParameters = (stmt.typeParameters ?? []).map(
        (tp) => tp.name.text
      );
      typeAliasesByName.set(aliasName, {
        typeParameters,
        type: stmt.type,
        typeText: printTypeNodeText(stmt.type, sourceFile),
      });
      continue;
    }

    if (ts.isFunctionDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport || !stmt.name || !stmt.type) continue;

      addExportedFunctionSignature(stmt.name.text, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterCount: stmt.typeParameters?.length ?? 0,
        parameters: stmt.parameters.map(printParameterText),
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
          addExportedFunctionSignature(exportName, {
            typeParametersText: printTypeParametersText(init.typeParameters),
            typeParameterCount: init.typeParameters?.length ?? 0,
            parameters: init.parameters.map(printParameterText),
            returnTypeText: printTypeNodeText(returnType, sourceFile),
          });
        }
      }
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedClassNames.add(className);
      }
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
      allInterfaceNames.add(interfaceName);
      const hasExport = stmt.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedInterfaceNames.add(interfaceName);
      }
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
      continue;
    }

    if (ts.isExportDeclaration(stmt)) {
      const moduleSpecifier =
        stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : undefined;
      if (
        moduleSpecifier &&
        (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/"))
      ) {
        hasLocalReexports = true;
        localRelativeImports.add(moduleSpecifier);
      }
    }
  }

  return {
    ok: true,
    value: {
      absoluteFilePath,
      fileKey,
      namespace: getNamespaceFromPath(
        absoluteFilePath,
        absoluteSourceRoot,
        rootNamespace
      ),
      sourceIndex: {
        fileKey,
        wrapperImportsByLocalName,
        typeImportsByLocalName,
        typeAliasesByName,
        exportedFunctionSignaturesByName,
        memberTypesByClassAndMember,
      },
      exportedClassNames: Array.from(exportedClassNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      exportedInterfaceNames: Array.from(exportedInterfaceNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      exportedTypeAliasNames: Array.from(exportedTypeAliasNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      allInterfaceNames: Array.from(allInterfaceNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      allTypeAliasNames: Array.from(allTypeAliasNames).sort((a, b) =>
        a.localeCompare(b)
      ),
      localRelativeImports: Array.from(localRelativeImports).sort((a, b) =>
        a.localeCompare(b)
      ),
      hasLocalReexports,
    },
  };
};

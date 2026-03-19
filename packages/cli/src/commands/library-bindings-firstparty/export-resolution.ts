import { existsSync, readFileSync } from "node:fs";
import type { IrModule, IrStatement } from "@tsonic/frontend";
import { appendSourceFunctionSignature } from "../../aikya/source-function-surfaces.js";
import type { Result } from "../../types.js";
import {
  isRelativeModuleSpecifier,
  normalizeModuleFileKey,
  resolveLocalModuleFile,
  resolveReexportModuleKey,
} from "./module-paths.js";
import {
  getPropertyNameText,
  printTypeNodeText,
} from "./portable-types.js";
import { renderSourceTypeNodeForAliasLookup } from "./source-type-text.js";
import type {
  ExportedSymbol,
  ExportedSymbolKind,
  InternalHelperTypeKind,
  ModuleSourceIndex,
  ResolvedExportDeclaration,
  SourceAnonymousTypeLiteralDef,
  SourceMemberTypeDef,
  SourceTypeAliasDef,
  SourceTypeImport,
  SourceValueTypeDef,
  WrapperImport,
} from "./types.js";
import * as ts from "typescript";

export const classifyLocalTypeDeclarationKind = (
  statement: IrStatement
): InternalHelperTypeKind | undefined => {
  switch (statement.kind) {
    case "classDeclaration":
      return "class";
    case "interfaceDeclaration":
      return "interface";
    case "enumDeclaration":
      return "enum";
    case "typeAliasDeclaration":
      return "typeAlias";
    default:
      return undefined;
  }
};

export const declarationNameOf = (
  statement: IrStatement
): string | undefined => {
  switch (statement.kind) {
    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return statement.name;
    default:
      return undefined;
  }
};

export const resolveModuleLocalDeclaration = (
  module: IrModule,
  localName: string
): IrStatement | undefined => {
  for (const statement of module.body) {
    const statementName = declarationNameOf(statement);
    if (statementName === localName) return statement;

    if (statement.kind === "variableDeclaration") {
      for (const declarator of statement.declarations) {
        if (
          declarator.name.kind === "identifierPattern" &&
          declarator.name.name === localName
        ) {
          return statement;
        }
      }
    }
  }
  return undefined;
};

export const classifyDeclarationKind = (
  statement: IrStatement,
  filePath: string,
  exportName: string
): Result<ExportedSymbolKind, string> => {
  switch (statement.kind) {
    case "functionDeclaration":
      return { ok: true, value: "function" };
    case "variableDeclaration":
      return { ok: true, value: "variable" };
    case "classDeclaration":
      return { ok: true, value: "class" };
    case "interfaceDeclaration":
      return { ok: true, value: "interface" };
    case "enumDeclaration":
      return { ok: true, value: "enum" };
    case "typeAliasDeclaration":
      return { ok: true, value: "typeAlias" };
    default:
      return {
        ok: false,
        error:
          `Unsupported export '${exportName}' in ${filePath}: ${statement.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
  }
};

export const resolveImportedLocalDeclaration = (
  module: IrModule,
  localName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string>
): Result<ResolvedExportDeclaration, string> => {
  for (const importEntry of module.imports) {
    for (const specifier of importEntry.specifiers) {
      if (specifier.localName !== localName) continue;
      if (specifier.kind === "namespace") {
        return {
          ok: false,
          error: `Unable to re-export '${localName}' from ${module.filePath}: namespace imports are not supported for first-party bindings generation.`,
        };
      }
      if (!importEntry.isLocal) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${localName}' resolves to non-local module '${importEntry.source}'.\n` +
            "First-party bindings generation currently supports only local source-module exports.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, importEntry.source)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local import target for '${localName}' in ${module.filePath}: '${importEntry.source}'.\n` +
            "First-party bindings generation requires local import targets to resolve deterministically.",
        };
      }
      const importedName =
        specifier.kind === "named" ? specifier.name : "default";
      return resolveExportedDeclaration(
        targetModule,
        importedName,
        modulesByFileKey,
        visited
      );
    }
  }
  return {
    ok: false,
    error:
      `Unable to resolve local symbol '${localName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires resolvable local exports and aliases.",
  };
};

export const resolveExportedDeclaration = (
  module: IrModule,
  exportName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string> = new Set()
): Result<ResolvedExportDeclaration, string> => {
  const cycleKey = `${normalizeModuleFileKey(module.filePath)}::${exportName}`;
  if (visited.has(cycleKey)) {
    return {
      ok: false,
      error:
        `Cyclic re-export detected while resolving '${exportName}' in ${module.filePath}.\n` +
        "First-party bindings generation requires acyclic local re-export graphs.",
    };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(cycleKey);

  for (const item of module.exports) {
    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") continue;
          if (declarator.name.name !== exportName) continue;
          return {
            ok: true,
            value: {
              declaration,
              module,
              clrName: declarator.name.name,
            },
          };
        }
        continue;
      }
      const declarationName = declarationNameOf(declaration);
      if (declarationName !== exportName) continue;
      return {
        ok: true,
        value: {
          declaration,
          module,
          clrName: declarationName,
        },
      };
    }

    if (item.kind === "named") {
      if (item.name !== exportName) continue;
      const declaration = resolveModuleLocalDeclaration(module, item.localName);
      if (declaration) {
        return {
          ok: true,
          value: {
            declaration,
            module,
            clrName: item.localName,
          },
        };
      }
      return resolveImportedLocalDeclaration(
        module,
        item.localName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "reexport") {
      if (item.name !== exportName) continue;
      if (!isRelativeModuleSpecifier(item.fromModule)) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${item.name}' from '${item.fromModule}'.\n` +
            "First-party bindings generation currently supports only relative re-exports from local source modules.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, item.fromModule)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local re-export target for '${item.name}' in ${module.filePath}: '${item.fromModule}'.\n` +
            "First-party bindings generation requires local re-export targets to resolve deterministically.",
        };
      }
      return resolveExportedDeclaration(
        targetModule,
        item.originalName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "default" && exportName === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }
  }

  return {
    ok: false,
    error:
      `Unable to resolve exported symbol '${exportName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires explicit resolvable exports.",
  };
};

export const collectModuleExports = (
  module: IrModule,
  modulesByFileKey: ReadonlyMap<string, IrModule>
): Result<readonly ExportedSymbol[], string> => {
  const exportedSymbols: ExportedSymbol[] = [];
  const seen = new Set<string>();

  const pushExport = (symbol: ExportedSymbol): void => {
    const key = `${symbol.exportName}|${symbol.localName}|${symbol.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    exportedSymbols.push(symbol);
  };

  for (const item of module.exports) {
    if (item.kind === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }

    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") {
            return {
              ok: false,
              error:
                `Unsupported exported variable declarator in ${module.filePath}: ${declarator.name.kind}.\n` +
                "First-party bindings generation requires identifier-based exported variables.",
            };
          }
          const localName = declarator.name.name;
          pushExport({
            exportName: localName,
            localName,
            kind: "variable",
            declaration,
            declaringNamespace: module.namespace,
            declaringClassName: module.className,
            declaringFilePath: module.filePath,
          });
        }
        continue;
      }

      const declarationName = declarationNameOf(declaration);
      if (!declarationName) {
        return {
          ok: false,
          error:
            `Unsupported exported declaration in ${module.filePath}: ${declaration.kind}.\n` +
            "First-party bindings generation requires explicit support for each exported declaration kind.",
        };
      }
      const declarationKind = classifyDeclarationKind(
        declaration,
        module.filePath,
        declarationName
      );
      if (!declarationKind.ok) return declarationKind;
      pushExport({
        exportName: declarationName,
        localName: declarationName,
        kind: declarationKind.value,
        declaration,
        declaringNamespace: module.namespace,
        declaringClassName: module.className,
        declaringFilePath: module.filePath,
      });
      continue;
    }

    if (item.kind === "reexport") continue;

    const resolved = resolveExportedDeclaration(
      module,
      item.name,
      modulesByFileKey
    );
    if (!resolved.ok) return resolved;
    const declaration = resolved.value.declaration;
    const declarationName = declarationNameOf(declaration);
    if (!declarationName && declaration.kind !== "variableDeclaration") {
      return {
        ok: false,
        error:
          `Unsupported named export '${item.name}' in ${module.filePath}: ${declaration.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
    }
    const declarationKind = classifyDeclarationKind(
      declaration,
      module.filePath,
      item.name
    );
    if (!declarationKind.ok) return declarationKind;
    pushExport({
      exportName: item.name,
      localName: resolved.value.clrName,
      kind: declarationKind.value,
      declaration,
      declaringNamespace: resolved.value.module.namespace,
      declaringClassName: resolved.value.module.className,
      declaringFilePath: resolved.value.module.filePath,
    });
  }

  return {
    ok: true,
    value: exportedSymbols.sort((left, right) =>
      left.exportName.localeCompare(right.exportName)
    ),
  };
};

export const finalizeCrossNamespaceReexports = (
  grouped: ReadonlyMap<string, readonly string[]>
): {
  readonly dtsStatements: readonly string[];
  readonly jsValueStatements: readonly string[];
  readonly valueExportNames: ReadonlySet<string>;
} => {
  const dtsStatements: string[] = [];
  const jsValueStatements: string[] = [];
  const valueExportNames = new Set<string>();

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
      dtsStatements.push(
        `export type { ${unique.join(", ")} } from '${moduleSpecifier}';`
      );
      continue;
    }
    const statement = `export { ${unique.join(", ")} } from '${moduleSpecifier}';`;
    dtsStatements.push(statement);
    jsValueStatements.push(statement);
    for (const spec of unique) {
      const aliasParts = spec.split(/\s+as\s+/);
      const aliasName = aliasParts[1];
      valueExportNames.add(
        aliasParts.length === 2 && aliasName ? aliasName : spec
      );
    }
  }

  return { dtsStatements, jsValueStatements, valueExportNames };
};

export const buildModuleSourceIndex = (
  absoluteFilePath: string,
  fileKey: string
): Result<ModuleSourceIndex, string> => {
  if (!existsSync(absoluteFilePath)) {
    return {
      ok: false,
      error: `Failed to read source file for bindings generation: ${absoluteFilePath}`,
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
  const exportedTypeDeclarationNames = new Set<string>();
  const exportedFunctionSignaturesByName = new Map<
    string,
    import("../../aikya/source-function-surfaces.js").SourceFunctionSignatureSurface[]
  >();
  const exportedValueTypesByName = new Map<string, SourceValueTypeDef>();
  const memberTypesByClassAndMember = new Map<
    string,
    Map<string, SourceMemberTypeDef>
  >();
  const anonymousTypeLiteralsByShape = new Map<
    string,
    SourceAnonymousTypeLiteralDef
  >();

  const printTypeParametersText = (
    typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
  ): string => {
    if (!typeParameters || typeParameters.length === 0) return "";
    return `<${typeParameters.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const printParameterSignature = (
    param: ts.ParameterDeclaration
  ): { readonly prefixText: string; readonly typeText: string } => {
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
    signature: {
      readonly typeParametersText: string;
      readonly typeParameterCount: number;
      readonly parameters: readonly {
        readonly prefixText: string;
        readonly typeText: string;
      }[];
      readonly returnTypeText: string;
    }
  ): void => {
    appendSourceFunctionSignature(
      exportedFunctionSignaturesByName,
      name,
      signature
    );
  };

  const registerAnonymousTypeLiteralsInTypeNode = (
    typeNode: ts.TypeNode | undefined
  ): void => {
    if (!typeNode) return;

    const visit = (current: ts.Node): void => {
      if (ts.isTypeLiteralNode(current)) {
        const shape = renderSourceTypeNodeForAliasLookup(current, new Map());
        if (!anonymousTypeLiteralsByShape.has(shape)) {
          const members = new Map<string, SourceMemberTypeDef>();
          for (const member of current.members) {
            if (!ts.isPropertySignature(member)) continue;
            if (!member.name || !member.type) continue;
            const memberName = getPropertyNameText(member.name);
            if (!memberName) continue;
            members.set(memberName, {
              typeNode: member.type,
              typeText: printTypeNodeText(member.type, sourceFile),
              isOptional: member.questionToken !== undefined,
            });
          }
          anonymousTypeLiteralsByShape.set(shape, {
            typeText: printTypeNodeText(current, sourceFile),
            members,
          });
        }
      }
      ts.forEachChild(current, visit);
    };

    visit(typeNode);
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
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      const typeParameterNames = (stmt.typeParameters ?? []).map(
        (tp) => tp.name.text
      );
      typeAliasesByName.set(aliasName, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterNames,
        type: stmt.type,
        typeText: printTypeNodeText(stmt.type, sourceFile),
      });
      registerAnonymousTypeLiteralsInTypeNode(stmt.type);
      if (hasExport) {
        exportedTypeDeclarationNames.add(aliasName);
      }
      continue;
    }

    if (ts.isFunctionDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport || !stmt.name || !stmt.type) continue;
      for (const parameter of stmt.parameters) {
        registerAnonymousTypeLiteralsInTypeNode(parameter.type);
      }
      registerAnonymousTypeLiteralsInTypeNode(stmt.type);
      const parameters = stmt.parameters.map(printParameterSignature);
      addExportedFunctionSignature(stmt.name.text, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterCount: stmt.typeParameters?.length ?? 0,
        parameters,
        returnTypeText: printTypeNodeText(stmt.type, sourceFile),
      });
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport) continue;
      for (const declaration of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const exportName = declaration.name.text;
        const initializer = declaration.initializer;
        if (!initializer) continue;
        if (
          !ts.isArrowFunction(initializer) &&
          !ts.isFunctionExpression(initializer)
        ) {
          if (declaration.type) {
            registerAnonymousTypeLiteralsInTypeNode(declaration.type);
            exportedValueTypesByName.set(exportName, {
              typeText: printTypeNodeText(declaration.type, sourceFile),
            });
          }
          continue;
        }
        if (!initializer.type) continue;
        for (const parameter of initializer.parameters) {
          registerAnonymousTypeLiteralsInTypeNode(parameter.type);
        }
        registerAnonymousTypeLiteralsInTypeNode(initializer.type);
        const parameters = initializer.parameters.map(printParameterSignature);
        addExportedFunctionSignature(exportName, {
          typeParametersText: printTypeParametersText(
            initializer.typeParameters
          ),
          typeParameterCount: initializer.typeParameters?.length ?? 0,
          parameters,
          returnTypeText: printTypeNodeText(initializer.type, sourceFile),
        });
      }
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(className);
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
          registerAnonymousTypeLiteralsInTypeNode(member.type);
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
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(interfaceName);
      }
      const members =
        memberTypesByClassAndMember.get(interfaceName) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const name = getPropertyNameText(member.name);
        if (!name) continue;
        registerAnonymousTypeLiteralsInTypeNode(member.type);

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

    if (ts.isEnumDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(stmt.name.text);
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
      exportedTypeDeclarationNames,
      exportedFunctionSignaturesByName,
      exportedValueTypesByName,
      memberTypesByClassAndMember,
      anonymousTypeLiteralsByShape,
    },
  };
};

export const typeNodeUsesImportedTypeNames = (
  node: ts.TypeNode,
  typeImportsByLocalName: ReadonlyMap<
    string,
    { readonly source: string; readonly importedName: string }
  >
): boolean => {
  const allowlistedImportSources = new Set<string>(["@tsonic/core/types.js"]);

  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isTypeReferenceNode(current) && ts.isIdentifier(current.typeName)) {
      const imported = typeImportsByLocalName.get(current.typeName.text);
      if (imported && !allowlistedImportSources.has(imported.source.trim())) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

export const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

export const collectExtensionWrapperImportsFromSourceType = (opts: {
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

    const expandAlias = (
      aliasKey: string,
      alias: { readonly typeParameterNames: readonly string[]; readonly type: ts.TypeNode },
      typeArgs: readonly ts.TypeNode[]
    ): void => {
      if (aliasStack.includes(aliasKey)) return;
      aliasStack.push(aliasKey);

      if (alias.typeParameterNames.length === typeArgs.length) {
        const next = new Map(subst);
        for (let i = 0; i < alias.typeParameterNames.length; i += 1) {
          const paramName = alias.typeParameterNames[i];
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

    const nextNode = args[0];
    if (!nextNode) {
      return {
        ok: false,
        error: `ExtensionMethods wrapper '${ident}' is missing its type argument in ${currentModuleKey}.`,
      };
    }
    currentNode = nextNode;
  }

  return { ok: true, value: wrappers };
};

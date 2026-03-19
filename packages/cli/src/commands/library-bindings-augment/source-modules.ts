import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import {
  appendSourceFunctionSignature,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../aikya/source-function-surfaces.js";
import {
  getNamespaceFromPath,
  type IrModule,
  type IrStatement,
} from "@tsonic/frontend";
import * as ts from "typescript";
import type { Result } from "../../types.js";
import {
  getPropertyNameText,
  normalizeModuleFileKey,
  printIrType,
  printTypeNodeText,
  printTypeParameters,
  unwrapParens,
} from "./shared.js";
import type {
  ModuleSourceIndex,
  SourceMemberTypeDef,
  SourceModuleInfo,
  SourceTypeAliasDef,
  SourceTypeImport,
  WrapperImport,
} from "./types.js";

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

const resolveLocalSourceModuleKey = (
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

const resolveRelativeSourceModulePath = (
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

export const collectExtensionWrapperImportsFromSourceType = (opts: {
  readonly startModuleKey: string;
  readonly typeNode: ts.TypeNode;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly sourceModulesByFileKey: ReadonlyMap<string, SourceModuleInfo>;
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
      const targetKey = resolveLocalSourceModuleKey(
        imported.source,
        currentModuleKey,
        opts.sourceModulesByFileKey
      );
      if (targetKey) {
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

export const renderExportedTypeAlias = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  internalIndexDts: string,
  sourceAlias: SourceTypeAliasDef | undefined
): Result<
  {
    readonly line: string;
    readonly internalAliasImport?: string;
  },
  string
> => {
  const typeParams = printTypeParameters(stmt.typeParameters);
  if (stmt.type.kind === "objectType") {
    const arity = stmt.typeParameters?.length ?? 0;
    const internalName = `${stmt.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
    const exportedInternal = new RegExp(
      String.raw`^export\s+(?:declare\s+)?(?:class|interface|type)\s+${internalName}\b`,
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
      value: {
        line: `export type ${stmt.name}${typeParams} = ${internalName}${typeArgs};`,
        internalAliasImport: internalName,
      },
    };
  }

  const rhs =
    sourceAlias?.typeText ?? printIrType(stmt.type, { parentPrecedence: 0 });
  return {
    ok: true,
    value: { line: `export type ${stmt.name}${typeParams} = ${rhs};` },
  };
};

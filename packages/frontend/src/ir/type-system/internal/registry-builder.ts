/**
 * TypeRegistry builder — constructs a TypeRegistry from TSTS source files.
 */

import * as path from "node:path";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsHeritageClauseDetails,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsTypeParameterNodes,
  hasTstsExportModifier,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../../../source-frontend/index.js";
import type {
  TypeRegistry,
  TypeRegistryEntry,
  MemberInfo,
  ConvertTypeFn,
  BuildTypeRegistryOptions,
} from "./type-registry.js";
import {
  isWellKnownLibrary,
  getCanonicalTargetName,
  extractTypeParameters,
  extractMembers,
  extractMembersFromAliasedObjectType,
  convertCallableInterfaceOnlyType,
  extractHeritage,
} from "./registry-helpers.js";
import {
  type IrType,
  type IrTypeAliasDeclaration,
  stampRuntimeUnionAliasCarrier,
} from "../../types/index.js";
import { processTypeAliasForSynthetics } from "../../converters/synthetic-types.js";
import {
  resolveContainingSourcePackageNamespace,
  resolveSourceFileNamespace,
  resolveSourceFileOwnerIdentity,
} from "../../../program/source-file-identity.js";
import { getSourceBindingAliasFromDeclaration } from "./source-binding-markers.js";

const unknownType = (): IrType => ({ kind: "unknownType" });

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const getSourceFileName = (sourceFile: TstsSourceFile): string =>
  sourceFile.FileName();

const isDeclarationSourceFile = (sourceFile: TstsSourceFile): boolean =>
  sourceFile.IsDeclarationFile === true;

const getTopLevelStatements = (sourceFile: TstsSourceFile): readonly TstsNode[] => {
  const statements: TstsNode[] = [];
  TstsSyntax.SourceFile_ForEachChild(sourceFile, (node) => {
    if (node) {
      statements.push(node);
    }
    return false;
  });
  return statements;
};

export const buildTypeRegistry = (
  sourceFiles: readonly TstsSourceFile[],
  sourceSemantics: TstsFrontendSourceSemanticView,
  sourceRoot: string,
  rootNamespace: string,
  options: BuildTypeRegistryOptions = {}
): TypeRegistry => {
  const entries = new Map<string, TypeRegistryEntry>();
  const simpleNameToFQ = new Map<string, string>();
  const simpleNameToFQs = new Map<string, Set<string>>();
  const ambiguousSimpleNames = new Set<string>();
  const convert: ConvertTypeFn = options.convertType ?? (() => unknownType());

  const namespaceFromFQName = (
    fqName: string,
    simpleName: string
  ): string | undefined => {
    const suffix = `.${simpleName}`;
    return fqName.endsWith(suffix)
      ? fqName.slice(0, -suffix.length)
      : undefined;
  };

  const recordSimpleName = (simpleName: string, fqName: string): void => {
    const fqSet = simpleNameToFQs.get(simpleName) ?? new Set<string>();
    fqSet.add(fqName);
    simpleNameToFQs.set(simpleName, fqSet);

    if (ambiguousSimpleNames.has(simpleName)) {
      return;
    }

    const existing = simpleNameToFQ.get(simpleName);
    if (!existing) {
      simpleNameToFQ.set(simpleName, fqName);
      return;
    }

    if (existing === fqName) {
      return;
    }

    simpleNameToFQ.delete(simpleName);
    ambiguousSimpleNames.add(simpleName);
  };

  const processDeclaration = (
    node: TstsNode,
    sourceFile: TstsSourceFile,
    namespace: string | undefined,
    ownerIdentity: string
  ): void => {
    const fileName = getSourceFileName(sourceFile);
    const isFromWellKnownLib = isWellKnownLibrary(fileName);
    const isDeclarationFile = isDeclarationSourceFile(sourceFile);

    const canonicalize = (simpleName: string): string =>
      getCanonicalTargetName(simpleName, true) ?? simpleName;

    const makeFQName = (simpleName: string, declaration?: TstsNode): string =>
      (declaration
        ? getSourceBindingAliasFromDeclaration(declaration)
        : undefined) ??
      getCanonicalTargetName(simpleName, isFromWellKnownLib) ??
      (namespace ? `${namespace}.${simpleName}` : simpleName);

    if (TstsSyntax.IsClassDeclaration(node)) {
      const simpleName = getTstsNodeNameText(node);
      if (!simpleName) return;
      const fqName = makeFQName(simpleName, node);
      entries.set(fqName, {
        kind: "class",
        name: simpleName,
        fullyQualifiedName: fqName,
        ownerIdentity,
        isDeclarationFile,
        preservesProviderIdentity: preservesProviderIdentity(fileName),
        typeParameters: extractTypeParameters(
          concreteTstsNodes(getTstsTypeParameterNodes(node)),
          convert
        ),
        members: extractMembers(concreteTstsNodes(getTstsMemberNodes(node)), convert),
        heritage: extractHeritage(
          getTstsHeritageClauseDetails(node),
          sourceSemantics,
          sourceRoot,
          rootNamespace,
          convert,
          canonicalize
        ),
      });
      recordSimpleName(simpleName, fqName);
      return;
    }

    if (TstsSyntax.IsInterfaceDeclaration(node)) {
      const simpleName = getTstsNodeNameText(node);
      if (!simpleName) return;
      const fqName = makeFQName(simpleName, node);
      const callableAlias = convertCallableInterfaceOnlyType(node, convert);

      if (callableAlias) {
        entries.set(fqName, {
          kind: "typeAlias",
          name: simpleName,
          fullyQualifiedName: fqName,
          ownerIdentity,
          isDeclarationFile,
          preservesProviderIdentity: preservesProviderIdentity(fileName),
          typeParameters: [],
          members: extractMembersFromAliasedObjectType(callableAlias),
          heritage: [],
          aliasedType: callableAlias,
        });
        recordSimpleName(simpleName, fqName);
        return;
      }

      const members = extractMembers(concreteTstsNodes(getTstsMemberNodes(node)), convert);
      const heritage = extractHeritage(
        getTstsHeritageClauseDetails(node),
        sourceSemantics,
        sourceRoot,
        rootNamespace,
        convert,
        canonicalize
      );
      const existing = entries.get(fqName);

      if (existing?.kind === "interface") {
        const mergedMembers = new Map(existing.members);
        for (const [memberName, memberInfo] of members) {
          const existingMember = mergedMembers.get(memberName);
          const preserveExistingAuthoritativeMember =
            existingMember !== undefined &&
            existing.isDeclarationFile === false &&
            isDeclarationFile;
          if (!preserveExistingAuthoritativeMember) {
            mergedMembers.set(memberName, memberInfo);
          }
        }
        entries.set(fqName, {
          ...existing,
          members: mergedMembers,
          heritage: [...existing.heritage, ...heritage],
        });
        return;
      }

      entries.set(fqName, {
        kind: "interface",
        name: simpleName,
        fullyQualifiedName: fqName,
        ownerIdentity,
        isDeclarationFile,
        preservesProviderIdentity: preservesProviderIdentity(fileName),
        typeParameters: extractTypeParameters(
          concreteTstsNodes(getTstsTypeParameterNodes(node)),
          convert
        ),
        members,
        heritage,
      });
      recordSimpleName(simpleName, fqName);
      return;
    }

    if (TstsSyntax.IsEnumDeclaration(node)) {
      const simpleName = getTstsNodeNameText(node);
      if (!simpleName) return;
      const fqName = makeFQName(simpleName, node);
      const enumType: IrType = { kind: "referenceType", name: fqName };
      const members = new Map<string, MemberInfo>();
      for (const member of TstsSyntax.Node_Members(node) ?? []) {
        if (!member) continue;
        const name = getTstsNodeNameText(member);
        if (!name) continue;
        members.set(name, {
          kind: "property",
          name,
          type: enumType,
          isOptional: false,
          isReadonly: true,
        });
      }

      entries.set(fqName, {
        kind: "enum",
        name: simpleName,
        fullyQualifiedName: fqName,
        ownerIdentity,
        isDeclarationFile,
        preservesProviderIdentity: preservesProviderIdentity(fileName),
        typeParameters: [],
        members,
        heritage: [],
      });
      recordSimpleName(simpleName, fqName);
      return;
    }

    if (TstsSyntax.IsTypeAliasDeclaration(node)) {
      const simpleName = getTstsNodeNameText(node);
      const typeNode = getTstsDeclaredTypeNode(node);
      if (!simpleName || !typeNode) return;
      const fqName = makeFQName(simpleName, node);

      const convertedAliasedType = convert(typeNode);
      const typeParameterNodes = concreteTstsNodes(getTstsTypeParameterNodes(node));
      const stampedAliasedType = isDeclarationFile
        ? convertedAliasedType
        : stampRuntimeUnionAliasCarrier(convertedAliasedType, {
            aliasName: simpleName,
            fullyQualifiedName: fqName,
            namespaceName: namespaceFromFQName(fqName, simpleName),
            typeParameters: typeParameterNodes
              .map(getTstsNodeNameText)
              .filter((name): name is string => name !== undefined),
          });
      const baseAlias: IrTypeAliasDeclaration = {
        kind: "typeAliasDeclaration",
        name: simpleName,
        typeParameters: typeParameterNodes.map((typeParameter) => ({
          kind: "typeParameter",
          name: getTstsNodeNameText(typeParameter) ?? "T",
        })),
        type: stampedAliasedType,
        isExported: hasTstsExportModifier(node),
        isStruct: false,
      };
      const processedAlias = processTypeAliasForSynthetics(baseAlias);
      const aliasedType = processedAlias.typeAlias.type;

      for (const synthetic of processedAlias.syntheticInterfaces) {
        const syntheticFqName = makeFQName(synthetic.name);
        entries.set(syntheticFqName, {
          kind: "interface",
          name: synthetic.name,
          fullyQualifiedName: syntheticFqName,
          ownerIdentity,
          isDeclarationFile,
          preservesProviderIdentity: preservesProviderIdentity(fileName),
          typeParameters:
            synthetic.typeParameters?.map((typeParameter) => ({
              name: typeParameter.name,
              constraint: typeParameter.constraint,
              defaultType: typeParameter.default,
            })) ?? [],
          members: extractMembersFromAliasedObjectType({
            kind: "objectType",
            members: synthetic.members,
          }),
          heritage: [],
        });
        recordSimpleName(synthetic.name, syntheticFqName);
      }

      entries.set(fqName, {
        kind: "typeAlias",
        name: simpleName,
        fullyQualifiedName: fqName,
        ownerIdentity,
        isDeclarationFile,
        preservesProviderIdentity: preservesProviderIdentity(fileName),
        typeParameters: extractTypeParameters(typeParameterNodes, convert),
        members: extractMembersFromAliasedObjectType(aliasedType),
        heritage: [],
        aliasedType,
      });
      recordSimpleName(simpleName, fqName);
      return;
    }

    if (
      TstsSyntax.IsModuleDeclaration(node) &&
      getTstsNodeNameText(node) === "global"
    ) {
      const body = TstsSyntax.Node_Body(node);
      for (const statement of TstsSyntax.Node_Statements(body) ?? []) {
        if (statement) {
          processDeclaration(statement, sourceFile, undefined, ownerIdentity);
        }
      }
    }
  };

  for (const sourceFile of sourceFiles) {
    const fileName = getSourceFileName(sourceFile);
    const ownerIdentity = resolveSourceFileOwnerIdentity(
      fileName,
      sourceRoot,
      rootNamespace
    );
    const namespace = isDeclarationSourceFile(sourceFile)
      ? undefined
      : resolveSourceFileNamespace(fileName, sourceRoot, rootNamespace);

    for (const statement of getTopLevelStatements(sourceFile)) {
      processDeclaration(statement, sourceFile, namespace, ownerIdentity);
    }
  }

  return {
    resolveNominal: (fqName: string): TypeRegistryEntry | undefined =>
      entries.get(fqName),

    resolveBySimpleName: (
      simpleName: string
    ): TypeRegistryEntry | undefined => {
      const fqName = simpleNameToFQ.get(simpleName);
      return fqName ? entries.get(fqName) : undefined;
    },

    getFQName: (simpleName: string): string | undefined =>
      simpleNameToFQ.get(simpleName),

    getFQNames: (simpleName: string): readonly string[] => [
      ...(simpleNameToFQs.get(simpleName) ?? []),
    ],

    getMemberType: (
      fqNominal: string,
      memberName: string
    ): IrType | undefined => entries.get(fqNominal)?.members.get(memberName)?.type,

    getHeritageTypes: (fqNominal: string) =>
      entries.get(fqNominal)?.heritage ?? [],

    getAllTypeNames: () => [...entries.keys()],

    hasType: (fqName: string): boolean => entries.has(fqName),
  };
};

export const preservesProviderIdentity = (fileName: string): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  const containingNamespace = resolveContainingSourcePackageNamespace(normalized);
  if (containingNamespace !== undefined) {
    return true;
  }

  let current = path.dirname(normalized);
  while (current && current !== path.dirname(current)) {
    if (
      current.endsWith("/node_modules/@tsonic/globals") ||
      current.endsWith("/node_modules/@tsonic/core")
    ) {
      return true;
    }
    current = path.dirname(current);
  }

  return false;
};

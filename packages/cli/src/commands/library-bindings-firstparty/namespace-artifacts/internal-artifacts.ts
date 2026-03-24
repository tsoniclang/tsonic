import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrType,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import * as ts from "typescript";
import { buildAnonymousStructuralAliasMap } from "../anonymous-structural.js";
import {
  buildAnonymousAliasNamespaceMap,
  rewriteAnonymousBindingsTypeNamespaces,
} from "../canonical-anonymous-types.js";
import {
  buildTypeBindingFromClass,
  buildTypeBindingFromContainer,
  buildTypeBindingFromEnum,
  buildTypeBindingFromInterface,
  buildTypeBindingFromSourceAnonymousStructuralAlias,
  buildTypeBindingFromStructuralAlias,
  renderClassInternal,
  renderContainerInternal,
  renderEnumInternal,
  renderInterfaceInternal,
  renderSourceAnonymousStructuralAliasInternal,
  renderSourceAliasPlan,
  renderStructuralAliasInternal,
  renderTypeAliasInternal,
} from "../rendering.js";
import { renderPortableType } from "../portable-types.js";
import type {
  AnonymousStructuralAliasInfo,
  FirstPartyBindingsType,
  MemberOverride,
  NamespacePlan,
  SourceAnonymousStructuralAliasPlan,
} from "../types.js";
import type { ResolvedConfig } from "../../../types.js";

export interface BuiltNamespaceArtifacts {
  readonly anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
  readonly sourceAnonymousStructuralAliases: readonly SourceAnonymousStructuralAliasPlan[];
  readonly internalBodyLines: readonly string[];
  readonly sourceAliasLines: readonly string[];
  readonly sourceAliasInternalImports: readonly string[];
  readonly typeBindings: readonly FirstPartyBindingsType[];
}

export const buildNamespaceArtifacts = (
  config: ResolvedConfig,
  plan: NamespacePlan
): BuiltNamespaceArtifacts => {
  const internalBodyLines: string[] = [];
  const memberOverridesByClass = buildMemberOverridesByClass(
    plan.memberOverrides
  );
  const sourceAnonymousStructuralAliases =
    collectSourceAnonymousStructuralAliasPlans(
      plan,
      memberOverridesByClass,
      config.rootNamespace
    );
  const anonymousAliasNamespaces = buildAnonymousAliasNamespaceMap(
    sourceAnonymousStructuralAliases
  );
  const anonymousStructuralAliases = buildAnonymousStructuralAliasMap(
    plan,
    sourceAnonymousStructuralAliases
  );
  const typeBindings: FirstPartyBindingsType[] = [];

  for (const sourceAnonymousStructuralAlias of sourceAnonymousStructuralAliases) {
    internalBodyLines.push(
      ...renderSourceAnonymousStructuralAliasInternal(
        sourceAnonymousStructuralAlias,
        plan.namespace,
        anonymousStructuralAliases
      )
    );
    const binding = buildTypeBindingFromSourceAnonymousStructuralAlias(
      sourceAnonymousStructuralAlias,
      plan.namespace,
      config.outputName
    );
    if (binding) {
      typeBindings.push(binding);
    }
  }

  renderPlanTypeDeclarations({
    config,
    plan,
    memberOverridesByClass,
    anonymousStructuralAliases,
    internalBodyLines,
    typeBindings,
  });

  const renderedSourceAliases = plan.sourceAliases.map((sourceAliasPlan) =>
    renderSourceAliasPlan(sourceAliasPlan, anonymousStructuralAliases)
  );
  const sourceAliasLines = renderedSourceAliases.map((entry) => entry.line);
  const sourceAliasInternalImports = renderedSourceAliases
    .map((entry) => entry.internalImport)
    .filter((entry): entry is string => entry !== undefined)
    .sort((left, right) => left.localeCompare(right));

  for (const container of plan.moduleContainers) {
    internalBodyLines.push(
      ...renderContainerInternal(container, anonymousStructuralAliases)
    );
    typeBindings.push(
      buildTypeBindingFromContainer(
        container,
        plan.namespace,
        config.outputName
      )
    );
  }

  for (const symbol of plan.crossNamespaceTypeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          symbol.declaringNamespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        symbol.declaringNamespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  return {
    anonymousStructuralAliases,
    sourceAnonymousStructuralAliases,
    internalBodyLines,
    sourceAliasLines,
    sourceAliasInternalImports,
    typeBindings: typeBindings.map((typeBinding) =>
      rewriteAnonymousBindingsTypeNamespaces(
        typeBinding,
        anonymousAliasNamespaces
      )
    ),
  };
};

const buildMemberOverridesByClass = (
  memberOverrides: readonly MemberOverride[]
): Map<string, Map<string, MemberOverride>> => {
  const memberOverridesByClass = new Map<string, Map<string, MemberOverride>>();
  for (const override of memberOverrides) {
    const byMember =
      memberOverridesByClass.get(override.className) ??
      new Map<string, MemberOverride>();
    byMember.set(override.memberName, override);
    memberOverridesByClass.set(override.className, byMember);
  }
  return memberOverridesByClass;
};

const renderPlanTypeDeclarations = (opts: {
  readonly config: ResolvedConfig;
  readonly plan: NamespacePlan;
  readonly memberOverridesByClass: ReadonlyMap<
    string,
    ReadonlyMap<string, MemberOverride>
  >;
  readonly anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
  readonly internalBodyLines: string[];
  readonly typeBindings: FirstPartyBindingsType[];
}): void => {
  for (const symbol of opts.plan.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      opts.internalBodyLines.push(
        ...renderClassInternal(
          symbol.declaration,
          opts.plan.namespace,
          opts.memberOverridesByClass.get(symbol.declaration.name) ?? new Map(),
          symbol.declaration.name,
          new Map(),
          symbol.declaration.name,
          symbol.declaration.name,
          opts.anonymousStructuralAliases
        )
      );
      opts.typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          opts.plan.namespace,
          opts.config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      opts.internalBodyLines.push(
        ...renderInterfaceInternal(
          symbol.declaration,
          opts.plan.namespace,
          opts.memberOverridesByClass.get(symbol.declaration.name) ?? new Map(),
          symbol.declaration.name,
          new Map(),
          symbol.declaration.name,
          symbol.declaration.name,
          opts.anonymousStructuralAliases
        )
      );
      opts.typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          opts.plan.namespace,
          opts.config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      opts.internalBodyLines.push(...renderEnumInternal(symbol.declaration));
      opts.typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          opts.plan.namespace,
          opts.config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      opts.internalBodyLines.push(
        ...renderStructuralAliasInternal(
          symbol.declaration,
          opts.plan.namespace,
          opts.memberOverridesByClass.get(
            aliasInternalName(symbol.declaration)
          ) ?? new Map(),
          symbol.declaration.name,
          new Map(),
          undefined,
          undefined,
          opts.anonymousStructuralAliases
        )
      );
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        opts.plan.namespace,
        opts.config.outputName
      );
      if (binding) opts.typeBindings.push(binding);
    }
  }

  const helperRemapsByModuleKey = new Map<
    string,
    ReadonlyMap<string, string>
  >();
  for (const helper of opts.plan.internalHelperTypeDeclarations) {
    const current = new Map(
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? []
    );
    current.set(helper.originalName, helper.emittedName);
    helperRemapsByModuleKey.set(helper.moduleFileKey, current);
  }

  for (const helper of opts.plan.internalHelperTypeDeclarations) {
    const localTypeNameRemaps =
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? new Map();
    switch (helper.kind) {
      case "class":
        opts.internalBodyLines.push(
          ...renderClassInternal(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            opts.memberOverridesByClass.get(helper.emittedName) ??
              opts.memberOverridesByClass.get(
                (helper.declaration as IrClassDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrClassDeclaration).name,
            (helper.declaration as IrClassDeclaration).name,
            opts.anonymousStructuralAliases
          )
        );
        opts.typeBindings.push(
          buildTypeBindingFromClass(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            opts.config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "interface":
        opts.internalBodyLines.push(
          ...renderInterfaceInternal(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            opts.memberOverridesByClass.get(helper.emittedName) ??
              opts.memberOverridesByClass.get(
                (helper.declaration as IrInterfaceDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrInterfaceDeclaration).name,
            (helper.declaration as IrInterfaceDeclaration).name,
            opts.anonymousStructuralAliases
          )
        );
        opts.typeBindings.push(
          buildTypeBindingFromInterface(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            opts.config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "enum":
        opts.internalBodyLines.push(
          ...renderEnumInternal(
            helper.declaration as IrEnumDeclaration,
            helper.emittedName
          )
        );
        opts.typeBindings.push(
          buildTypeBindingFromEnum(
            helper.declaration as IrEnumDeclaration,
            helper.declaringNamespace,
            opts.config.outputName
          )
        );
        continue;
      case "typeAlias": {
        const declaration = helper.declaration as IrTypeAliasDeclaration;
        const defaultAliasName = aliasInternalName(declaration);
        const structuralLines = renderStructuralAliasInternal(
          declaration,
          helper.declaringNamespace,
          opts.memberOverridesByClass.get(helper.emittedName) ??
            opts.memberOverridesByClass.get(defaultAliasName) ??
            new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            defaultAliasName,
            defaultAliasName,
            opts.anonymousStructuralAliases
          );
        if (structuralLines.length > 0) {
          opts.internalBodyLines.push(...structuralLines);
          const binding = buildTypeBindingFromStructuralAlias(
            declaration,
            helper.declaringNamespace,
            opts.config.outputName,
            localTypeNameRemaps
          );
          if (binding) opts.typeBindings.push(binding);
          continue;
        }
        opts.internalBodyLines.push(
          ...renderTypeAliasInternal(
            declaration,
            helper.emittedName,
            localTypeNameRemaps,
            opts.anonymousStructuralAliases
          )
        );
        continue;
      }
    }
  }
};

const aliasInternalName = (declaration: IrTypeAliasDeclaration): string => {
  const arity = declaration.typeParameters?.length ?? 0;
  return `${declaration.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
};

const parseSourceTypeNode = (sourceTypeText: string): ts.TypeNode | undefined => {
  const sourceFile = ts.createSourceFile(
    "__tsonic_source_type__.ts",
    `type __T = ${sourceTypeText};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  return statement && ts.isTypeAliasDeclaration(statement)
    ? statement.type
    : undefined;
};

const unwrapParenthesizedTypeNode = (node: ts.TypeNode): ts.TypeNode => {
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }
  return node;
};

const collectSourceAnonymousStructuralAliasPlans = (
  plan: NamespacePlan,
  memberOverridesByClass: ReadonlyMap<string, ReadonlyMap<string, MemberOverride>>,
  rootNamespace: string
): readonly SourceAnonymousStructuralAliasPlan[] => {
  const collected = new Map<string, SourceAnonymousStructuralAliasPlan>();
  const sourceAliasesByName = new Map(
    plan.sourceAliases.flatMap((sourceAliasPlan) => {
      const fallbackTypeText = renderPortableType(
        sourceAliasPlan.declaration.type,
        sourceAliasPlan.declaration.typeParameters?.map(
          (typeParameter) => typeParameter.name
        ) ?? []
      );
      const fallbackTypeNode = parseSourceTypeNode(fallbackTypeText);
      const sourceAlias =
        sourceAliasPlan.sourceAlias ??
        (fallbackTypeNode
          ? {
              type: fallbackTypeNode,
              typeText: fallbackTypeText,
              typeParameterNames:
                sourceAliasPlan.declaration.typeParameters?.map(
                  (typeParameter) => typeParameter.name
                ) ?? [],
              typeParametersText:
                sourceAliasPlan.declaration.typeParameters &&
                sourceAliasPlan.declaration.typeParameters.length > 0
                  ? `<${sourceAliasPlan.declaration.typeParameters
                      .map((typeParameter) => typeParameter.name)
                      .join(", ")}>`
                  : "",
            }
          : undefined);
      return sourceAlias
        ? [[sourceAliasPlan.declaration.name, sourceAlias] as const]
        : [];
    })
  );
  const registerAnonymousAlias = (
    aliasName: string,
    declaringNamespace: string,
    sourceTypeNode: ts.TypeNode,
    localTypeNameRemaps: ReadonlyMap<string, string>
  ): void => {
    const collectedKey = `${declaringNamespace}::${aliasName}`;
    if (collected.has(collectedKey)) {
      return;
    }
    const normalizedNode = unwrapParenthesizedTypeNode(sourceTypeNode);
    if (!ts.isTypeLiteralNode(normalizedNode)) return;
    collected.set(collectedKey, {
      name: aliasName,
      declaringNamespace,
      sourceTypeText: normalizedNode.getText(normalizedNode.getSourceFile()),
      localTypeNameRemaps,
    });
  };

  const visitAnonymousTypePair = (
    semanticType: IrType | undefined,
    sourceTypeNode: ts.TypeNode | undefined,
    localTypeNameRemaps: ReadonlyMap<string, string>
  ): void => {
    if (!semanticType || !sourceTypeNode) return;
    const normalizedSourceTypeNode = unwrapParenthesizedTypeNode(sourceTypeNode);

    if (semanticType.kind === "referenceType") {
      if (semanticType.name.startsWith("__Anon_")) {
        registerAnonymousAlias(
          semanticType.name,
          rootNamespace,
          normalizedSourceTypeNode,
          localTypeNameRemaps
        );
      }
      const sourceTypeArguments =
        ts.isTypeReferenceNode(normalizedSourceTypeNode) &&
        normalizedSourceTypeNode.typeArguments
          ? normalizedSourceTypeNode.typeArguments
          : [];
      semanticType.typeArguments?.forEach((typeArgument, index) => {
        visitAnonymousTypePair(
          typeArgument,
          sourceTypeArguments[index],
          localTypeNameRemaps
        );
      });
      return;
    }

    const expandedSourceTypeNode = expandSourceAliasTypeNode(
      normalizedSourceTypeNode
    );

    if (expandedSourceTypeNode !== normalizedSourceTypeNode) {
      visitAnonymousTypePair(
        semanticType,
        expandedSourceTypeNode,
        localTypeNameRemaps
      );
      return;
    }

    if (semanticType.kind === "arrayType") {
      if (ts.isArrayTypeNode(normalizedSourceTypeNode)) {
        visitAnonymousTypePair(
          semanticType.elementType,
          normalizedSourceTypeNode.elementType,
          localTypeNameRemaps
        );
        return;
      }
      if (
        ts.isTypeReferenceNode(normalizedSourceTypeNode) &&
        normalizedSourceTypeNode.typeArguments?.length === 1
      ) {
        visitAnonymousTypePair(
          semanticType.elementType,
          normalizedSourceTypeNode.typeArguments[0],
          localTypeNameRemaps
        );
      }
      return;
    }

    if (semanticType.kind === "tupleType") {
      if (!ts.isTupleTypeNode(normalizedSourceTypeNode)) return;
      semanticType.elementTypes.forEach((elementType, index) => {
        visitAnonymousTypePair(
          elementType,
          normalizedSourceTypeNode.elements[index],
          localTypeNameRemaps
        );
      });
      return;
    }

    if (semanticType.kind === "unionType") {
      if (!ts.isUnionTypeNode(normalizedSourceTypeNode)) return;
      for (const memberType of semanticType.types) {
        for (const sourceMemberType of normalizedSourceTypeNode.types) {
          visitAnonymousTypePair(
            memberType,
            sourceMemberType,
            localTypeNameRemaps
          );
        }
      }
      return;
    }

    if (semanticType.kind === "intersectionType") {
      if (!ts.isIntersectionTypeNode(normalizedSourceTypeNode)) return;
      for (const memberType of semanticType.types) {
        for (const sourceMemberType of normalizedSourceTypeNode.types) {
          visitAnonymousTypePair(
            memberType,
            sourceMemberType,
            localTypeNameRemaps
          );
        }
      }
      return;
    }

    if (semanticType.kind === "dictionaryType") {
      if (
        ts.isTypeReferenceNode(normalizedSourceTypeNode) &&
        normalizedSourceTypeNode.typeArguments?.length === 2
      ) {
        visitAnonymousTypePair(
          semanticType.keyType,
          normalizedSourceTypeNode.typeArguments[0],
          localTypeNameRemaps
        );
        visitAnonymousTypePair(
          semanticType.valueType,
          normalizedSourceTypeNode.typeArguments[1],
          localTypeNameRemaps
        );
      }
      return;
    }

    if (semanticType.kind === "functionType") {
      if (!ts.isFunctionTypeNode(normalizedSourceTypeNode)) return;
      semanticType.parameters.forEach((parameter, index) => {
        visitAnonymousTypePair(
          parameter.type,
          normalizedSourceTypeNode.parameters[index]?.type,
          localTypeNameRemaps
        );
      });
      visitAnonymousTypePair(
        semanticType.returnType,
        normalizedSourceTypeNode.type,
        localTypeNameRemaps
      );
      return;
    }

    if (semanticType.kind === "objectType") {
      if (!ts.isTypeLiteralNode(normalizedSourceTypeNode)) return;
      const sourceMembersByName = new Map<string, ts.TypeElement>();
      for (const sourceMember of normalizedSourceTypeNode.members) {
        if (
          ts.isPropertySignature(sourceMember) ||
          ts.isMethodSignature(sourceMember)
        ) {
          const sourceMemberName = sourceMember.name
            ? ts.isIdentifier(sourceMember.name) ||
                ts.isStringLiteral(sourceMember.name) ||
                ts.isNumericLiteral(sourceMember.name)
              ? sourceMember.name.text
              : undefined
            : undefined;
          if (sourceMemberName) {
            sourceMembersByName.set(sourceMemberName, sourceMember);
          }
        }
      }
      for (const member of semanticType.members) {
        const sourceMember = sourceMembersByName.get(member.name);
        if (!sourceMember) continue;
        if (
          member.kind === "propertySignature" &&
          ts.isPropertySignature(sourceMember)
        ) {
          visitAnonymousTypePair(
            member.type,
            sourceMember.type,
            localTypeNameRemaps
          );
          continue;
        }
        if (
          member.kind === "methodSignature" &&
          ts.isMethodSignature(sourceMember)
        ) {
          member.parameters.forEach((parameter, index) => {
            visitAnonymousTypePair(
              parameter.type,
              sourceMember.parameters[index]?.type,
              localTypeNameRemaps
            );
          });
          visitAnonymousTypePair(
            member.returnType,
            sourceMember.type,
            localTypeNameRemaps
          );
        }
      }
    }
  };

  const collectAnonymousReferenceNames = (
    semanticType: IrType | undefined,
    names: string[],
    visited: Set<object> = new Set()
  ): void => {
    if (!semanticType) return;
    if (visited.has(semanticType)) return;
    visited.add(semanticType);

    switch (semanticType.kind) {
      case "referenceType":
        if (semanticType.name.startsWith("__Anon_")) {
          names.push(semanticType.name);
        }
        semanticType.typeArguments?.forEach((typeArgument) =>
          collectAnonymousReferenceNames(typeArgument, names, visited)
        );
        semanticType.structuralMembers?.forEach((member) => {
          if (member.kind === "propertySignature") {
            collectAnonymousReferenceNames(member.type, names, visited);
            return;
          }
          member.parameters.forEach((parameter) =>
            collectAnonymousReferenceNames(parameter.type, names, visited)
          );
          collectAnonymousReferenceNames(member.returnType, names, visited);
        });
        return;
      case "arrayType":
        collectAnonymousReferenceNames(
          semanticType.elementType,
          names,
          visited
        );
        return;
      case "tupleType":
        semanticType.elementTypes.forEach((elementType) =>
          collectAnonymousReferenceNames(elementType, names, visited)
        );
        return;
      case "unionType":
      case "intersectionType":
        semanticType.types.forEach((memberType) =>
          collectAnonymousReferenceNames(memberType, names, visited)
        );
        return;
      case "dictionaryType":
        collectAnonymousReferenceNames(semanticType.keyType, names, visited);
        collectAnonymousReferenceNames(semanticType.valueType, names, visited);
        return;
      case "functionType":
        semanticType.parameters.forEach((parameter) =>
          collectAnonymousReferenceNames(parameter.type, names, visited)
        );
        collectAnonymousReferenceNames(semanticType.returnType, names, visited);
        return;
      case "objectType":
        semanticType.members.forEach((member) => {
          if (member.kind === "propertySignature") {
            collectAnonymousReferenceNames(member.type, names, visited);
            return;
          }
          member.parameters.forEach((parameter) =>
            collectAnonymousReferenceNames(parameter.type, names, visited)
          );
          collectAnonymousReferenceNames(member.returnType, names, visited);
        });
        return;
      default:
        return;
    }
  };

  const collectSourceTypeLiteralNodes = (
    sourceTypeNode: ts.TypeNode | undefined,
    nodes: ts.TypeLiteralNode[]
  ): void => {
    if (!sourceTypeNode) return;

    const visit = (current: ts.Node): void => {
      if (ts.isTypeLiteralNode(current)) {
        nodes.push(current);
      }
      ts.forEachChild(current, visit);
    };

    visit(sourceTypeNode);
  };

  const registerAnonymousAliasesByTraversal = (opts: {
    readonly semanticType: IrType | undefined;
    readonly sourceTypeNode: ts.TypeNode | undefined;
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  }): void => {
    if (!opts.semanticType || !opts.sourceTypeNode) return;

    const anonymousNames: string[] = [];
    collectAnonymousReferenceNames(opts.semanticType, anonymousNames);
    if (anonymousNames.length === 0) return;

    const sourceTypeLiterals: ts.TypeLiteralNode[] = [];
    collectSourceTypeLiteralNodes(opts.sourceTypeNode, sourceTypeLiterals);
    if (sourceTypeLiterals.length !== anonymousNames.length) return;

    anonymousNames.forEach((anonymousName, index) => {
      const sourceTypeLiteral = sourceTypeLiterals[index];
      if (!sourceTypeLiteral) return;
      registerAnonymousAlias(
        anonymousName,
        rootNamespace,
        sourceTypeLiteral,
        opts.localTypeNameRemaps
      );
    });
  };

  const collectFromMembers = (
    members: readonly IrInterfaceMember[],
    overrides: ReadonlyMap<string, MemberOverride>,
    localTypeNameRemaps: ReadonlyMap<string, string>
  ): void => {
    for (const member of members) {
      if (member.kind !== "propertySignature") continue;
      const override = overrides.get(member.name);
      if (!override?.replaceWithSourceType || !override.sourceTypeText) continue;
      visitAnonymousTypePair(
        member.type,
        parseSourceTypeNode(override.sourceTypeText),
        localTypeNameRemaps
      );
    }
  };

  const collectFromFunctionSurface = (opts: {
    readonly parameters: readonly { readonly type?: IrType }[];
    readonly returnType?: IrType;
    readonly sourceSignatures: readonly {
      readonly parameters: readonly { readonly typeText: string }[];
      readonly returnTypeText: string;
    }[];
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  }): void => {
    for (const sourceSignature of opts.sourceSignatures) {
      opts.parameters.forEach((parameter, index) => {
        const sourceParameter = sourceSignature.parameters[index];
        if (!sourceParameter) return;
        const sourceTypeNode = parseSourceTypeNode(sourceParameter.typeText);
        const collectedBefore = collected.size;
        visitAnonymousTypePair(
          parameter.type,
          sourceTypeNode,
          opts.localTypeNameRemaps
        );
        if (collected.size === collectedBefore) {
          registerAnonymousAliasesByTraversal({
            semanticType: parameter.type,
            sourceTypeNode,
            localTypeNameRemaps: opts.localTypeNameRemaps,
          });
        }
      });
      const returnSourceTypeNode = parseSourceTypeNode(
        sourceSignature.returnTypeText
      );
      const collectedBefore = collected.size;
      visitAnonymousTypePair(
        opts.returnType,
        returnSourceTypeNode,
        opts.localTypeNameRemaps
      );
      if (collected.size === collectedBefore) {
        registerAnonymousAliasesByTraversal({
          semanticType: opts.returnType,
          sourceTypeNode: returnSourceTypeNode,
          localTypeNameRemaps: opts.localTypeNameRemaps,
        });
      }
    }
  };

  const collectFromValueSurface = (opts: {
    readonly semanticType: IrType | undefined;
    readonly sourceTypeText: string | undefined;
    readonly sourceAnonymousTypeTexts?: readonly string[];
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  }): void => {
    if (opts.sourceTypeText) {
      const sourceTypeNode = parseSourceTypeNode(opts.sourceTypeText);
      const collectedBefore = collected.size;
      visitAnonymousTypePair(
        opts.semanticType,
        sourceTypeNode,
        opts.localTypeNameRemaps
      );
      if (collected.size === collectedBefore) {
        registerAnonymousAliasesByTraversal({
          semanticType: opts.semanticType,
          sourceTypeNode,
          localTypeNameRemaps: opts.localTypeNameRemaps,
        });
      }
      return;
    }

    for (const sourceAnonymousTypeText of opts.sourceAnonymousTypeTexts ?? []) {
      registerAnonymousAliasesByTraversal({
        semanticType: opts.semanticType,
        sourceTypeNode: parseSourceTypeNode(sourceAnonymousTypeText),
        localTypeNameRemaps: opts.localTypeNameRemaps,
      });
    }
  };

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      collectFromMembers(
        symbol.declaration.members,
        memberOverridesByClass.get(symbol.declaration.name) ?? new Map(),
        new Map()
      );
      continue;
    }

    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      const classMembers: IrInterfaceMember[] = symbol.declaration.members.flatMap(
        (member) =>
          member.kind === "propertyDeclaration" && member.type
            ? [
                {
                  kind: "propertySignature" as const,
                  name: member.name,
                  type: member.type,
                  isOptional: false,
                  isReadonly: member.isReadonly,
                },
              ]
            : []
      );
      collectFromMembers(
        classMembers,
        memberOverridesByClass.get(symbol.declaration.name) ?? new Map(),
        new Map()
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration" &&
      symbol.declaration.type.kind === "objectType"
    ) {
      collectFromMembers(
        symbol.declaration.type.members.filter(
          (member): member is Extract<IrInterfaceMember, { kind: "propertySignature" }> =>
            member.kind === "propertySignature"
        ),
        memberOverridesByClass.get(aliasInternalName(symbol.declaration)) ??
          new Map(),
        new Map()
      );
    }
  }

  for (const container of plan.moduleContainers) {
    for (const method of container.methods) {
      collectFromFunctionSurface({
        parameters: method.declaration.parameters,
        returnType: method.declaration.returnType,
        sourceSignatures: method.sourceSignatures,
        localTypeNameRemaps: method.localTypeNameRemaps,
      });
    }

    for (const variable of container.variables) {
      if (variable.declarator?.type?.kind === "functionType") {
        collectFromFunctionSurface({
          parameters: variable.declarator.type.parameters,
          returnType: variable.declarator.type.returnType,
          sourceSignatures: variable.sourceSignatures,
          localTypeNameRemaps: variable.localTypeNameRemaps,
        });
        continue;
      }

      collectFromValueSurface({
        semanticType: variable.declarator?.type,
        sourceTypeText: variable.sourceType?.typeText,
        sourceAnonymousTypeTexts: variable.sourceAnonymousTypeTexts,
        localTypeNameRemaps: variable.localTypeNameRemaps,
      });
    }
  }

  for (const valueExport of plan.valueExports) {
    if (valueExport.facade.kind === "function") {
      collectFromFunctionSurface({
        parameters:
          valueExport.binding.semanticSignature?.parameters ??
          valueExport.facade.declaration.parameters,
        returnType:
          valueExport.binding.semanticSignature?.returnType ??
          valueExport.facade.declaration.returnType,
        sourceSignatures: valueExport.facade.sourceSignatures ?? [],
        localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
      });
      continue;
    }

    if (valueExport.facade.declarator?.type?.kind === "functionType") {
      collectFromFunctionSurface({
        parameters:
          valueExport.binding.semanticSignature?.parameters ??
          valueExport.facade.declarator.type.parameters,
        returnType:
          valueExport.binding.semanticSignature?.returnType ??
          valueExport.facade.declarator.type.returnType,
        sourceSignatures: valueExport.facade.sourceSignatures ?? [],
        localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
      });
      continue;
    }

    collectFromValueSurface({
      semanticType: valueExport.facade.declarator?.type,
      sourceTypeText: valueExport.facade.sourceType?.typeText,
      sourceAnonymousTypeTexts:
        valueExport.facade.kind === "variable"
          ? valueExport.facade.sourceAnonymousTypeTexts
          : [],
      localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
    });
  }

  for (const sourceAlias of plan.sourceAliases) {
    if (!sourceAlias.sourceAlias) continue;
    collectFromValueSurface({
      semanticType: sourceAlias.declaration.type,
      sourceTypeText: sourceAlias.sourceAlias.typeText,
      localTypeNameRemaps: new Map(),
    });
  }

  return Array.from(collected.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  function expandSourceAliasTypeNode(node: ts.TypeNode): ts.TypeNode {
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName)) {
      return node;
    }

    const sourceAlias = sourceAliasesByName.get(node.typeName.text);
    if (!sourceAlias) return node;

    const substitutions = new Map<string, ts.TypeNode>();
    sourceAlias.typeParameterNames.forEach((typeParameterName, index) => {
      const sourceTypeArgument = node.typeArguments?.[index];
      if (sourceTypeArgument) {
        substitutions.set(typeParameterName, sourceTypeArgument);
      }
    });

    if (substitutions.size === 0) {
      return sourceAlias.type;
    }

    const transformed = ts.transform(sourceAlias.type, [
      (context) => {
        const visit = (current: ts.Node): ts.Node => {
          if (
            ts.isTypeReferenceNode(current) &&
            ts.isIdentifier(current.typeName) &&
            (!current.typeArguments || current.typeArguments.length === 0)
          ) {
            const replacement = substitutions.get(current.typeName.text);
            if (replacement) {
              return replacement;
            }
          }
          return ts.visitEachChild(current, visit, context);
        };
        return (current: ts.Node): ts.Node => ts.visitNode(current, visit);
      },
    ]).transformed[0];

    return transformed && ts.isTypeNode(transformed)
      ? transformed
      : sourceAlias.type;
  }
};

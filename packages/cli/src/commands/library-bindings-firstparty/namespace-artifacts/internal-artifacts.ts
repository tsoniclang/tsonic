import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import { buildAnonymousStructuralAliasMap } from "../anonymous-structural.js";
import {
  buildTypeBindingFromClass,
  buildTypeBindingFromContainer,
  buildTypeBindingFromEnum,
  buildTypeBindingFromInterface,
  buildTypeBindingFromStructuralAlias,
  renderClassInternal,
  renderContainerInternal,
  renderEnumInternal,
  renderInterfaceInternal,
  renderSourceAliasPlan,
  renderStructuralAliasInternal,
  renderTypeAliasInternal,
} from "../rendering.js";
import type {
  AnonymousStructuralAliasInfo,
  FirstPartyBindingsType,
  MemberOverride,
  NamespacePlan,
} from "../types.js";
import type { ResolvedConfig } from "../../../types.js";

export interface BuiltNamespaceArtifacts {
  readonly anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
  readonly internalBodyLines: readonly string[];
  readonly sourceAliasLines: readonly string[];
  readonly sourceAliasInternalImports: readonly string[];
  readonly typeBindings: readonly FirstPartyBindingsType[];
}

export const buildNamespaceArtifacts = (
  config: ResolvedConfig,
  plan: NamespacePlan
): BuiltNamespaceArtifacts => {
  const anonymousStructuralAliases = buildAnonymousStructuralAliasMap(plan);
  const internalBodyLines: string[] = [];
  const memberOverridesByClass = buildMemberOverridesByClass(plan.memberOverrides);
  const typeBindings: FirstPartyBindingsType[] = [];

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
    internalBodyLines,
    sourceAliasLines,
    sourceAliasInternalImports,
    typeBindings,
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
  readonly memberOverridesByClass: ReadonlyMap<string, ReadonlyMap<string, MemberOverride>>;
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
          opts.memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
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
          opts.memberOverridesByClass.get(symbol.declaration.name) ??
            new Map()
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
          ) ?? new Map()
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

  const helperRemapsByModuleKey = new Map<string, ReadonlyMap<string, string>>();
  for (const helper of opts.plan.internalHelperTypeDeclarations) {
    const current = new Map(helperRemapsByModuleKey.get(helper.moduleFileKey) ?? []);
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
            (helper.declaration as IrClassDeclaration).name
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
            (helper.declaration as IrInterfaceDeclaration).name
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
          defaultAliasName
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

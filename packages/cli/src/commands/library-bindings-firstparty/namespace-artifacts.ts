import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import type { ResolvedConfig, Result } from "../../types.js";
import { buildAnonymousStructuralAliasMap } from "./anonymous-structural.js";
import {
  moduleNamespaceToInternalSpecifier,
  reattachBindingClrIdentities,
  serializeBindingsJsonSafe,
} from "./binding-semantics.js";
import { moduleNamespacePath } from "./module-paths.js";
import {
  normalizeTypeReferenceName,
  primitiveImportLine,
  printTypeParameters,
  renderPortableType,
  renderUnknownParameters,
  selectSourceTypeImportsForRenderedText,
} from "./portable-types.js";
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
} from "./rendering.js";
import {
  renderSourceFunctionSignature,
  renderSourceFunctionType,
  renderSourceValueType,
} from "./source-type-text.js";
import type {
  FirstPartyBindingsExport,
  FirstPartyBindingsFile,
  FirstPartyBindingsType,
  MemberOverride,
  NamespacePlan,
} from "./types.js";

export const writeNamespaceArtifacts = (
  config: ResolvedConfig,
  outDir: string,
  plan: NamespacePlan
): Result<void, string> => {
  const namespacePath = moduleNamespacePath(plan.namespace);
  const namespaceDir = join(outDir, namespacePath);
  const internalDir = join(namespaceDir, "internal");
  mkdirSync(internalDir, { recursive: true });

  const internalIndexPath = join(internalDir, "index.d.ts");
  const facadeDtsPath = join(outDir, `${namespacePath}.d.ts`);
  const facadeJsPath = join(outDir, `${namespacePath}.js`);
  const bindingsPath = join(namespaceDir, "bindings.json");

  const anonymousStructuralAliases = buildAnonymousStructuralAliasMap(plan);
  const internalBodyLines: string[] = [];
  const memberOverridesByClass = new Map<string, Map<string, MemberOverride>>();
  for (const override of plan.memberOverrides) {
    const byMember =
      memberOverridesByClass.get(override.className) ??
      new Map<string, MemberOverride>();
    byMember.set(override.memberName, override);
    memberOverridesByClass.set(override.className, byMember);
  }

  const typeBindings: FirstPartyBindingsType[] = [];

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      internalBodyLines.push(
        ...renderClassInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromClass(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "interface" &&
      symbol.declaration.kind === "interfaceDeclaration"
    ) {
      internalBodyLines.push(
        ...renderInterfaceInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(symbol.declaration.name) ?? new Map()
        )
      );
      typeBindings.push(
        buildTypeBindingFromInterface(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "enum" &&
      symbol.declaration.kind === "enumDeclaration"
    ) {
      internalBodyLines.push(...renderEnumInternal(symbol.declaration));
      typeBindings.push(
        buildTypeBindingFromEnum(
          symbol.declaration,
          plan.namespace,
          config.outputName
        )
      );
      continue;
    }

    if (
      symbol.kind === "typeAlias" &&
      symbol.declaration.kind === "typeAliasDeclaration"
    ) {
      internalBodyLines.push(
        ...renderStructuralAliasInternal(
          symbol.declaration,
          plan.namespace,
          memberOverridesByClass.get(
            `${symbol.declaration.name}__Alias${
              (symbol.declaration.typeParameters?.length ?? 0) > 0
                ? `_${symbol.declaration.typeParameters?.length ?? 0}`
                : ""
            }`
          ) ?? new Map()
        )
      );
      const binding = buildTypeBindingFromStructuralAlias(
        symbol.declaration,
        plan.namespace,
        config.outputName
      );
      if (binding) typeBindings.push(binding);
    }
  }

  const helperRemapsByModuleKey = new Map<
    string,
    ReadonlyMap<string, string>
  >();
  for (const helper of plan.internalHelperTypeDeclarations) {
    const current = new Map(
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? []
    );
    current.set(helper.originalName, helper.emittedName);
    helperRemapsByModuleKey.set(helper.moduleFileKey, current);
  }

  for (const helper of plan.internalHelperTypeDeclarations) {
    const localTypeNameRemaps =
      helperRemapsByModuleKey.get(helper.moduleFileKey) ?? new Map();
    switch (helper.kind) {
      case "class":
        internalBodyLines.push(
          ...renderClassInternal(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            memberOverridesByClass.get(helper.emittedName) ??
              memberOverridesByClass.get(
                (helper.declaration as IrClassDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrClassDeclaration).name,
            (helper.declaration as IrClassDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromClass(
            helper.declaration as IrClassDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "interface":
        internalBodyLines.push(
          ...renderInterfaceInternal(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            memberOverridesByClass.get(helper.emittedName) ??
              memberOverridesByClass.get(
                (helper.declaration as IrInterfaceDeclaration).name
              ) ??
              new Map(),
            helper.emittedName,
            localTypeNameRemaps,
            (helper.declaration as IrInterfaceDeclaration).name,
            (helper.declaration as IrInterfaceDeclaration).name
          )
        );
        typeBindings.push(
          buildTypeBindingFromInterface(
            helper.declaration as IrInterfaceDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          )
        );
        continue;
      case "enum":
        internalBodyLines.push(
          ...renderEnumInternal(
            helper.declaration as IrEnumDeclaration,
            helper.emittedName
          )
        );
        typeBindings.push(
          buildTypeBindingFromEnum(
            helper.declaration as IrEnumDeclaration,
            helper.declaringNamespace,
            config.outputName
          )
        );
        continue;
      case "typeAlias": {
        const structuralLines = renderStructuralAliasInternal(
          helper.declaration as IrTypeAliasDeclaration,
          helper.declaringNamespace,
          memberOverridesByClass.get(helper.emittedName) ??
            memberOverridesByClass.get(
              `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
                ((helper.declaration as IrTypeAliasDeclaration).typeParameters
                  ?.length ?? 0) > 0
                  ? `_${
                      (helper.declaration as IrTypeAliasDeclaration)
                        .typeParameters?.length ?? 0
                    }`
                  : ""
              }`
            ) ??
            new Map(),
          helper.emittedName,
          localTypeNameRemaps,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`,
          `${(helper.declaration as IrTypeAliasDeclaration).name}__Alias${
            ((helper.declaration as IrTypeAliasDeclaration).typeParameters
              ?.length ?? 0) > 0
              ? `_${
                  (helper.declaration as IrTypeAliasDeclaration).typeParameters
                    ?.length ?? 0
                }`
              : ""
          }`
        );
        if (structuralLines.length > 0) {
          internalBodyLines.push(...structuralLines);
          const binding = buildTypeBindingFromStructuralAlias(
            helper.declaration as IrTypeAliasDeclaration,
            helper.declaringNamespace,
            config.outputName,
            localTypeNameRemaps
          );
          if (binding) typeBindings.push(binding);
          continue;
        }
        internalBodyLines.push(
          ...renderTypeAliasInternal(
            helper.declaration as IrTypeAliasDeclaration,
            helper.emittedName,
            localTypeNameRemaps,
            anonymousStructuralAliases
          )
        );
        continue;
      }
    }
  }

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

  const internalSourceAliasLines =
    sourceAliasLines.length > 0
      ? [
          "",
          "// Tsonic source type aliases (generated)",
          ...sourceAliasLines,
          "// End Tsonic source type aliases",
        ]
      : [];
  const requiredInternalTypeImports = selectSourceTypeImportsForRenderedText(
    [...internalSourceAliasLines, ...internalBodyLines].join("\n"),
    plan.internalTypeImports
  );

  const internalLines: string[] = [];
  internalLines.push("// Generated by Tsonic - Source bindings");
  internalLines.push(`// Namespace: ${plan.namespace}`);
  internalLines.push(`// Assembly: ${config.outputName}`);
  internalLines.push("");
  internalLines.push(primitiveImportLine);
  if (requiredInternalTypeImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source type imports (generated)");
    for (const typeImport of requiredInternalTypeImports) {
      if (typeImport.importedName === typeImport.localName) {
        internalLines.push(
          `import type { ${typeImport.importedName} } from '${typeImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source type imports");
  }
  if (plan.wrapperImports.length > 0) {
    internalLines.push("");
    internalLines.push("// Tsonic source member type imports (generated)");
    for (const wrapperImport of plan.wrapperImports) {
      if (wrapperImport.importedName === wrapperImport.aliasName) {
        internalLines.push(
          `import type { ${wrapperImport.importedName} } from '${wrapperImport.source}';`
        );
        continue;
      }
      internalLines.push(
        `import type { ${wrapperImport.importedName} as ${wrapperImport.aliasName} } from '${wrapperImport.source}';`
      );
    }
    internalLines.push("// End Tsonic source member type imports");
  }
  internalLines.push("");
  if (internalSourceAliasLines.length > 0) {
    internalLines.push(...internalSourceAliasLines);
    internalLines.push("");
  }
  internalLines.push(...internalBodyLines);

  writeFileSync(
    internalIndexPath,
    internalLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  const internalSpecifier = moduleNamespaceToInternalSpecifier(plan.namespace);

  const facadeLines: string[] = [];
  facadeLines.push(`// Namespace: ${plan.namespace}`);
  facadeLines.push("// Generated by Tsonic - Source bindings");
  facadeLines.push("");
  facadeLines.push(`import * as Internal from '${internalSpecifier}';`);
  facadeLines.push("");

  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") {
      continue;
    }
    const isValueType = symbol.kind === "class" || symbol.kind === "enum";
    const isSyntheticAnonymousClass =
      symbol.kind === "class" && symbol.localName.startsWith("__Anon_");
    if (isValueType) {
      const specifier =
        symbol.exportName === symbol.localName
          ? symbol.exportName
          : `${symbol.localName} as ${symbol.exportName}`;
      if (!isSyntheticAnonymousClass) {
        facadeLines.push(
          `export { ${specifier} } from '${internalSpecifier}';`
        );
      }
      facadeLines.push(
        `export type { ${specifier} } from '${internalSpecifier}';`
      );
      if (symbol.kind === "class") {
        facadeLines.push(
          `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
        );
      }
      continue;
    }

    const specifier =
      symbol.exportName === symbol.localName
        ? symbol.exportName
        : `${symbol.localName} as ${symbol.exportName}`;
    facadeLines.push(
      `export type { ${specifier} } from '${internalSpecifier}';`
    );
    if (symbol.kind === "interface") {
      facadeLines.push(
        `export type { ${symbol.localName}$instance } from '${internalSpecifier}';`
      );
    }
  }

  for (const container of plan.moduleContainers) {
    facadeLines.push(
      `export { ${container.module.className}$instance as ${container.module.className} } from '${internalSpecifier}';`
    );
  }

  const valueBindings = new Map<string, FirstPartyBindingsExport>();

  const localTypeImports = new Set<string>();
  for (const symbol of plan.typeDeclarations) {
    if (symbol.kind === "typeAlias") continue;
    localTypeImports.add(symbol.localName);
    if (symbol.kind === "class" || symbol.kind === "interface") {
      localTypeImports.add(`${symbol.localName}$instance`);
    }
  }
  for (const internalImport of sourceAliasInternalImports) {
    localTypeImports.add(internalImport);
  }
  for (const helper of plan.internalHelperTypeDeclarations) {
    localTypeImports.add(helper.emittedName);
  }

  if (localTypeImports.size > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source alias imports (generated)");
    facadeLines.push(
      `import type { ${Array.from(localTypeImports.values())
        .sort((left, right) => left.localeCompare(right))
        .join(", ")} } from '${internalSpecifier}';`
    );
    facadeLines.push("// End Tsonic source alias imports");
  }

  if (sourceAliasLines.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic source type aliases (generated)");
    facadeLines.push(...sourceAliasLines);
    facadeLines.push("// End Tsonic source type aliases");
  }

  if (plan.crossNamespaceReexports.dtsStatements.length > 0) {
    facadeLines.push("");
    facadeLines.push("// Tsonic cross-namespace re-exports (generated)");
    facadeLines.push(...plan.crossNamespaceReexports.dtsStatements);
    facadeLines.push("// End Tsonic cross-namespace re-exports");
  }

  for (const valueExport of plan.valueExports) {
    valueBindings.set(valueExport.exportName, valueExport.binding);
    if (
      plan.crossNamespaceReexports.valueExportNames.has(valueExport.exportName)
    ) {
      continue;
    }
    if (valueExport.facade.kind === "function") {
      const sourceSignature = renderSourceFunctionSignature({
        declaration: valueExport.facade.declaration,
        sourceSignatures: valueExport.facade.sourceSignatures ?? [],
        localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases,
      });
      facadeLines.push(
        sourceSignature
          ? `export declare function ${valueExport.exportName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
          : `export declare function ${valueExport.exportName}${printTypeParameters(
              valueExport.facade.declaration.typeParameters
            )}(${renderUnknownParameters(
              valueExport.facade.declaration.parameters,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps,
              anonymousStructuralAliases
            )}): ${renderPortableType(
              valueExport.facade.declaration.returnType,
              valueExport.facade.declaration.typeParameters?.map(
                (typeParameter) => typeParameter.name
              ) ?? [],
              valueExport.facade.localTypeNameRemaps,
              anonymousStructuralAliases
            )};`
      );
      continue;
    }

    const sourceFunctionTypeText = renderSourceFunctionType({
      sourceSignatures: valueExport.facade.sourceSignatures ?? [],
      localTypeNameRemaps: valueExport.facade.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    const sourceTypeText =
      sourceFunctionTypeText ??
      renderSourceValueType(
        valueExport.facade.sourceType,
        valueExport.facade.localTypeNameRemaps,
        anonymousStructuralAliases
      );
    facadeLines.push(
      `export declare const ${valueExport.exportName}: ${
        sourceTypeText ??
        renderPortableType(
          valueExport.facade.declarator?.type,
          [],
          valueExport.facade.localTypeNameRemaps,
          anonymousStructuralAliases
        )
      };`
    );
  }

  const requiredFacadeTypeImports = selectSourceTypeImportsForRenderedText(
    facadeLines.join("\n"),
    plan.facadeTypeImports
  );
  if (requiredFacadeTypeImports.length > 0) {
    facadeLines.splice(
      4,
      0,
      "",
      "// Tsonic source type imports (generated)",
      ...requiredFacadeTypeImports.map((typeImport) =>
        typeImport.importedName === typeImport.localName
          ? `import type { ${typeImport.importedName} } from '${typeImport.source}';`
          : `import type { ${typeImport.importedName} as ${typeImport.localName} } from '${typeImport.source}';`
      ),
      "// End Tsonic source type imports"
    );
  }

  if (
    plan.typeDeclarations.length === 0 &&
    plan.moduleContainers.length === 0 &&
    plan.valueExports.length === 0 &&
    sourceAliasLines.length === 0 &&
    plan.crossNamespaceReexports.dtsStatements.length === 0
  ) {
    facadeLines.push("export {};");
  }

  writeFileSync(
    facadeDtsPath,
    facadeLines.join("\n").trimEnd() + "\n",
    "utf-8"
  );

  writeFileSync(
    facadeJsPath,
    [
      `// Namespace: ${plan.namespace}`,
      "// Generated by Tsonic - Source bindings",
      "// Module Stub - Do Not Execute",
      "",
      ...(plan.crossNamespaceReexports.jsValueStatements.length > 0
        ? [
            "// Tsonic cross-namespace value re-exports (generated)",
            ...plan.crossNamespaceReexports.jsValueStatements,
            "// End Tsonic cross-namespace value re-exports",
            "",
          ]
        : []),
      "throw new Error(",
      `  'Cannot import CLR namespace ${plan.namespace} in JavaScript runtime. ' +`,
      "  'This module provides TypeScript type definitions only. ' +",
      "  'Actual implementation requires .NET runtime via Tsonic compiler.'",
      ");",
      "",
    ].join("\n"),
    "utf-8"
  );

  const clrNamesByAlias = new Map<string, string>();
  for (const typeBinding of typeBindings) {
    clrNamesByAlias.set(typeBinding.alias, typeBinding.clrName);
    clrNamesByAlias.set(
      normalizeTypeReferenceName(typeBinding.alias, typeBinding.arity),
      typeBinding.clrName
    );
  }

  const normalizedTypeBindings = typeBindings.map((typeBinding) => ({
    ...typeBinding,
    methods: typeBinding.methods.map((method) => ({
      ...method,
      semanticSignature: method.semanticSignature
        ? {
            ...method.semanticSignature,
            parameters: method.semanticSignature.parameters.map(
              (parameter) => ({
                ...parameter,
                type:
                  reattachBindingClrIdentities(
                    parameter.type,
                    clrNamesByAlias
                  ) ?? parameter.type,
              })
            ),
            returnType: reattachBindingClrIdentities(
              method.semanticSignature.returnType,
              clrNamesByAlias
            ),
          }
        : undefined,
    })),
    properties: typeBinding.properties.map((property) => ({
      ...property,
      semanticType: reattachBindingClrIdentities(
        property.semanticType,
        clrNamesByAlias
      ),
    })),
    fields: typeBinding.fields.map((field) => ({
      ...field,
      semanticType: reattachBindingClrIdentities(
        field.semanticType,
        clrNamesByAlias
      ),
    })),
  }));

  const normalizedValueBindings =
    valueBindings.size > 0
      ? new Map(
          Array.from(valueBindings.entries()).map(([exportName, binding]) => [
            exportName,
            {
              ...binding,
              semanticType: reattachBindingClrIdentities(
                binding.semanticType,
                clrNamesByAlias
              ),
              semanticSignature: binding.semanticSignature
                ? {
                    ...binding.semanticSignature,
                    parameters: binding.semanticSignature.parameters.map(
                      (parameter) => ({
                        ...parameter,
                        type:
                          reattachBindingClrIdentities(
                            parameter.type,
                            clrNamesByAlias
                          ) ?? parameter.type,
                      })
                    ),
                    returnType: reattachBindingClrIdentities(
                      binding.semanticSignature.returnType,
                      clrNamesByAlias
                    ),
                  }
                : undefined,
            } satisfies FirstPartyBindingsExport,
          ])
        )
      : undefined;

  const bindings: FirstPartyBindingsFile = {
    namespace: plan.namespace,
    contributingAssemblies: [config.outputName],
    types: normalizedTypeBindings.sort((left, right) =>
      left.clrName.localeCompare(right.clrName)
    ),
    exports:
      normalizedValueBindings && normalizedValueBindings.size > 0
        ? Object.fromEntries(
            Array.from(normalizedValueBindings.entries()).sort((left, right) =>
              left[0].localeCompare(right[0])
            )
          )
        : undefined,
    producer: {
      tool: "tsonic",
      mode: "aikya-firstparty",
    },
  };

  writeFileSync(
    bindingsPath,
    JSON.stringify(serializeBindingsJsonSafe(bindings), null, 2) + "\n",
    "utf-8"
  );
  return { ok: true, value: undefined };
};

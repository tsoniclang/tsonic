import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import {
  buildParameterModifiers,
  isPublicOverloadSurfaceMethod,
  makeMethodBinding,
  rewriteBindingSemanticType,
  toBindingTypeAlias,
  toClrTypeName,
  toSignatureType,
  toStableId,
} from "./binding-semantics.js";
import {
  applyWrappersToBaseType,
  ensureUndefinedInType,
  printTypeParameters,
  renderBindingAliasMarker,
  renderMethodSignature,
  renderPortableType,
  sanitizeForBrand,
} from "./portable-types.js";
import {
  renderSourceFunctionSignature,
  renderSourceFunctionType,
  renderSourceValueType,
  rewriteSourceTypeText,
} from "./source-type-text.js";
import type {
  AnonymousStructuralAliasInfo,
  FirstPartyBindingsType,
  MemberOverride,
  ModuleContainerEntry,
  SourceAliasPlan,
} from "./types.js";

export const renderClassInternal = (
  declaration: IrClassDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandName = declaration.name,
  bindingAlias = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  const isSyntheticAnonymousStructuralClass =
    emittedName.startsWith("__Anon_") || brandName.startsWith("__Anon_");
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandName)}`;
  const heritageNames = [
    declaration.superClass
      ? renderPortableType(
          declaration.superClass,
          typeParameterScope,
          localTypeNameRemaps
        )
      : undefined,
    ...declaration.implements.map((implementedType) =>
      renderPortableType(
        implementedType,
        typeParameterScope,
        localTypeNameRemaps
      )
    ),
  ]
    .filter((name): name is string => name !== undefined)
    .map((name) => name.trim())
    .filter(
      (name) =>
        name.length > 0 &&
        name !== "unknown" &&
        name !== "never" &&
        name !== "void"
    );
  const extendsClause =
    heritageNames.length > 0
      ? ` extends ${Array.from(new Set(heritageNames)).join(", ")}`
      : "";

  lines.push(
    `export interface ${emittedName}$instance${typeParameters}${extendsClause} {`
  );
  if (!isSyntheticAnonymousStructuralClass) {
    lines.push(`    readonly ${markerName}: never;`);
  }
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));

  const instanceMembers = declaration.members.filter((member) => {
    if (member.kind === "constructorDeclaration") return false;
    if ("isStatic" in member && member.isStatic) return false;
    return true;
  });

  for (const member of instanceMembers) {
    if (member.kind === "methodDeclaration") {
      if (!isPublicOverloadSurfaceMethod(member)) {
        continue;
      }
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      const memberOverride = memberOverrides.get(member.name);
      const hasAccessorBody =
        member.getterBody !== undefined || member.setterBody !== undefined;
      const hasGetter = hasAccessorBody
        ? member.getterBody !== undefined
        : true;
      const hasSetter = hasAccessorBody
        ? member.setterBody !== undefined
        : !member.isReadonly;
      const optionalBySource =
        memberOverride?.emitOptionalPropertySyntax === true &&
        memberOverride.isOptional === true &&
        !member.name.startsWith("__tsonic_type_");
      const optionalMark = optionalBySource ? "?" : "";
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        );
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional === true && !optionalBySource
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;

      if (hasGetter && !hasSetter) {
        lines.push(
          `    readonly ${member.name}${optionalMark}: ${memberType};`
        );
        continue;
      }
      lines.push(`    ${member.name}${optionalMark}: ${memberType};`);
    }
  }

  lines.push("}");
  lines.push("");
  if (isSyntheticAnonymousStructuralClass) {
    lines.push(
      `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
    );
    return lines;
  }
  lines.push(`export const ${emittedName}: {`);
  lines.push(`    new(...args: unknown[]): ${emittedName}${typeParameters};`);

  const staticMembers = declaration.members.filter((member) => {
    if (member.kind === "constructorDeclaration") return false;
    return "isStatic" in member && member.isStatic;
  });

  for (const member of staticMembers) {
    if (member.kind === "methodDeclaration") {
      if (!isPublicOverloadSurfaceMethod(member)) {
        continue;
      }
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      lines.push(
        `    ${member.name}: ${renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        )};`
      );
    }
  }

  lines.push("};");
  lines.push("");
  lines.push(
    `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
  );
  lines.push("");

  return lines;
};

export const renderInterfaceInternal = (
  declaration: IrInterfaceDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandName = declaration.name,
  bindingAlias = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandName)}`;
  const extendsNames = declaration.extends
    .map((baseType) =>
      renderPortableType(
        baseType,
        typeParameterScope,
        localTypeNameRemaps
      ).trim()
    )
    .filter(
      (name) =>
        name.length > 0 &&
        name !== "unknown" &&
        name !== "never" &&
        name !== "void"
    );
  const extendsClause =
    extendsNames.length > 0
      ? ` extends ${Array.from(new Set(extendsNames)).join(", ")}`
      : "";

  lines.push(
    `export interface ${emittedName}$instance${typeParameters}${extendsClause} {`
  );
  lines.push(`    readonly ${markerName}?: never;`);
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));
  for (const member of declaration.members) {
    if (member.kind === "methodSignature") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType,
          localTypeNameRemaps
        )}`
      );
      continue;
    }
    if (member.kind === "propertySignature") {
      const memberOverride = memberOverrides.get(member.name);
      const optionalBySource =
        memberOverride?.emitOptionalPropertySyntax === true &&
        memberOverride.isOptional === true &&
        !member.name.startsWith("__tsonic_type_");
      const optionalMark = optionalBySource || member.isOptional ? "?" : "";
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        );
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional && !optionalBySource
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;
      lines.push(`    ${member.name}${optionalMark}: ${memberType};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${emittedName}${typeParameters} = ${emittedName}$instance${typeParameters};`
  );
  lines.push("");
  return lines;
};

export const renderEnumInternal = (
  declaration: IrEnumDeclaration,
  emittedName = declaration.name
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export enum ${emittedName} {`);
  declaration.members.forEach((member, index) => {
    lines.push(`    ${member.name} = ${index},`);
  });
  lines.push("}");
  lines.push("");
  return lines;
};

export const renderStructuralAliasInternal = (
  declaration: IrTypeAliasDeclaration,
  namespace: string,
  memberOverrides: ReadonlyMap<string, MemberOverride>,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  brandAliasName = `${declaration.name}__Alias${
    (declaration.typeParameters?.length ?? 0) > 0
      ? `_${declaration.typeParameters?.length ?? 0}`
      : ""
  }`,
  bindingAlias = `${declaration.name}__Alias${
    (declaration.typeParameters?.length ?? 0) > 0
      ? `_${declaration.typeParameters?.length ?? 0}`
      : ""
  }`
): readonly string[] => {
  if (declaration.type.kind !== "objectType") return [];

  const lines: string[] = [];
  const arity = declaration.typeParameters?.length ?? 0;
  const typeParameters = printTypeParameters(declaration.typeParameters);
  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const internalAliasName = `${emittedName}__Alias${arity > 0 ? `_${arity}` : ""}`;
  const markerName = `__tsonic_type_${sanitizeForBrand(namespace)}_${sanitizeForBrand(brandAliasName)}`;

  lines.push(
    `export interface ${internalAliasName}$instance${typeParameters} {`
  );
  lines.push(`    readonly ${markerName}?: never;`);
  lines.push(renderBindingAliasMarker(namespace, bindingAlias));
  for (const member of declaration.type.members) {
    if (member.kind === "methodSignature") {
      lines.push(
        `    ${renderMethodSignature(
          member.name,
          member.typeParameters,
          member.parameters,
          member.returnType
        )}`
      );
      continue;
    }
    if (member.kind === "propertySignature") {
      const memberOverride = memberOverrides.get(member.name);
      const optionalMark = member.isOptional ? "?" : "";
      const baseType =
        (memberOverride?.replaceWithSourceType
          ? memberOverride.sourceTypeText
          : undefined) ??
        renderPortableType(
          member.type,
          typeParameterScope,
          localTypeNameRemaps
        );
      const wrappedType = applyWrappersToBaseType(
        baseType,
        memberOverride?.wrappers ?? []
      );
      const memberType =
        memberOverride?.isOptional === true
          ? ensureUndefinedInType(wrappedType)
          : wrappedType;
      lines.push(`    ${member.name}${optionalMark}: ${memberType};`);
    }
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${internalAliasName}${typeParameters} = ${internalAliasName}$instance${typeParameters};`
  );
  lines.push("");
  return lines;
};

export const renderTypeAliasInternal = (
  declaration: IrTypeAliasDeclaration,
  emittedName = declaration.name,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map(),
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): readonly string[] => {
  if (declaration.type.kind === "objectType") return [];

  const typeParameterScope = (declaration.typeParameters ?? []).map(
    (typeParameter) => typeParameter.name
  );
  const typeParameters = printTypeParameters(declaration.typeParameters);
  return [
    `export type ${emittedName}${typeParameters} = ${renderPortableType(
      declaration.type,
      typeParameterScope,
      localTypeNameRemaps,
      anonymousStructuralAliases
    )};`,
    "",
  ];
};

export const renderSourceAliasPlan = (
  plan: SourceAliasPlan,
  anonymousStructuralAliases: ReadonlyMap<string, AnonymousStructuralAliasInfo>
): {
  readonly line: string;
  readonly internalImport?: string;
} => {
  const containsInlineStructuralObjectType = (type: import("@tsonic/frontend").IrType): boolean => {
    switch (type.kind) {
      case "objectType":
        return true;
      case "arrayType":
        return containsInlineStructuralObjectType(type.elementType);
      case "tupleType":
        return type.elementTypes.some(containsInlineStructuralObjectType);
      case "unionType":
      case "intersectionType":
        return type.types.some(containsInlineStructuralObjectType);
      case "dictionaryType":
        return (
          containsInlineStructuralObjectType(type.keyType) ||
          containsInlineStructuralObjectType(type.valueType)
        );
      case "functionType":
        return (
          type.parameters.some((parameter) =>
            parameter.type
              ? containsInlineStructuralObjectType(parameter.type)
              : false
          ) ||
          (type.returnType
            ? containsInlineStructuralObjectType(type.returnType)
            : false)
        );
      case "referenceType":
        return (type.typeArguments ?? []).some(
          containsInlineStructuralObjectType
        );
      default:
        return false;
    }
  };
  const shouldPreserveSourceAliasText = (() => {
    if (!plan.sourceAlias) return false;
    if (/\btypeof\b/.test(plan.sourceAlias.typeText)) {
      return false;
    }
    if (/[{]/.test(plan.sourceAlias.typeText)) {
      return false;
    }
    return !containsInlineStructuralObjectType(plan.declaration.type);
  })();
  const sourceTypeParams =
    plan.sourceAlias?.typeParametersText ??
    printTypeParameters(plan.declaration.typeParameters);

  if (plan.declaration.type.kind === "objectType") {
    const arity = plan.declaration.typeParameters?.length ?? 0;
    const internalName = `${plan.declaration.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
    const typeArgs =
      plan.sourceAlias && plan.sourceAlias.typeParameterNames.length > 0
        ? `<${plan.sourceAlias.typeParameterNames.join(", ")}>`
        : plan.declaration.typeParameters &&
            plan.declaration.typeParameters.length > 0
          ? `<${plan.declaration.typeParameters.map((tp) => tp.name).join(", ")}>`
          : "";
    return {
      line: `export type ${plan.declaration.name}${sourceTypeParams} = ${internalName}${typeArgs};`,
      internalImport: internalName,
    };
  }

  const rhs = renderPortableType(
    plan.declaration.type,
    plan.declaration.typeParameters?.map((tp) => tp.name) ?? [],
    new Map(),
    anonymousStructuralAliases
  );
  return {
    line: `export type ${plan.declaration.name}${sourceTypeParams} = ${
      shouldPreserveSourceAliasText && plan.sourceAlias
        ? rewriteSourceTypeText(
            plan.sourceAlias.typeText,
            new Map(),
            anonymousStructuralAliases
          )
        : rhs
    };`,
  };
};

export const renderContainerInternal = (
  entry: ModuleContainerEntry,
  anonymousStructuralAliases: ReadonlyMap<string, AnonymousStructuralAliasInfo>
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export abstract class ${entry.module.className}$instance {`);
  for (const method of entry.methods) {
    const sourceSignature = renderSourceFunctionSignature({
      declaration: method.declaration,
      sourceSignatures: method.sourceSignatures,
      localTypeNameRemaps: method.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    lines.push(
      `    static ${
        sourceSignature
          ? `${method.localName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
          : renderMethodSignature(
              method.localName,
              method.declaration.typeParameters,
              method.declaration.parameters,
              method.declaration.returnType,
              method.localTypeNameRemaps,
              anonymousStructuralAliases
            )
      }`
    );
  }
  for (const variable of entry.variables) {
    const sourceFunctionTypeText = renderSourceFunctionType({
      sourceSignatures: variable.sourceSignatures,
      localTypeNameRemaps: variable.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    const sourceTypeText =
      sourceFunctionTypeText ??
      renderSourceValueType(
        variable.sourceType,
        variable.localTypeNameRemaps,
        anonymousStructuralAliases
      );
    lines.push(
      `    static ${variable.localName}: ${
        sourceTypeText ??
        renderPortableType(
          variable.declarator?.type,
          [],
          variable.localTypeNameRemaps,
          anonymousStructuralAliases
        )
      };`
    );
  }
  lines.push("}");
  lines.push("");
  lines.push(
    `export type ${entry.module.className} = ${entry.module.className}$instance;`
  );
  lines.push("");
  return lines;
};

export const buildTypeBindingFromClass = (
  declaration: IrClassDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(
    namespace,
    declaration.name,
    declaration.typeParameters?.length ?? 0
  );
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods = [];
  const properties = [];
  const constructors = [];
  for (const member of declaration.members) {
    if (member.kind === "constructorDeclaration") {
      constructors.push({
        normalizedSignature: `.ctor|(${member.parameters
          .map((parameter) =>
            toSignatureType(
              parameter.type,
              typeParameterScope,
              localTypeNameRemaps
            )
          )
          .join(",")})|static=false`,
        isStatic: false,
        parameterCount: member.parameters.length,
      });
      continue;
    }

    if (member.kind === "methodDeclaration") {
      if (!isPublicOverloadSurfaceMethod(member)) {
        continue;
      }
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          typeParameters: member.typeParameters,
          overloadFamily: member.overloadFamily,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: member.isStatic,
          isAbstract: member.body === undefined,
          isVirtual: member.isVirtual,
          isOverride: member.isOverride,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    if (member.kind === "propertyDeclaration") {
      const hasAccessorBody =
        member.getterBody !== undefined || member.setterBody !== undefined;
      const hasGetter = hasAccessorBody
        ? member.getterBody !== undefined
        : true;
      const hasSetter = hasAccessorBody
        ? member.setterBody !== undefined
        : !member.isReadonly;
      const propertyType = toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      );

      properties.push({
        stableId: `${typeStableId}::property:${member.name}`,
        clrName: member.name,
        normalizedSignature: `${member.name}|:${propertyType}|static=${
          member.isStatic ? "true" : "false"
        }|accessor=${hasGetter && hasSetter ? "getset" : hasSetter ? "set" : "get"}`,
        semanticType: rewriteBindingSemanticType(
          member.type,
          localTypeNameRemaps
        ),
        isStatic: member.isStatic,
        isAbstract:
          member.getterBody === undefined && member.setterBody === undefined
            ? false
            : false,
        isVirtual: member.isVirtual ?? false,
        isOverride: member.isOverride ?? false,
        isIndexer: false,
        hasGetter,
        hasSetter,
        declaringClrType,
        declaringAssemblyName: assemblyName,
      });
    }
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(
      namespace,
      declaration.name,
      declaration.typeParameters?.length ?? 0
    ),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Class",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity: declaration.typeParameters?.length ?? 0,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors:
      constructors.length > 0
        ? constructors
        : [
            {
              normalizedSignature: ".ctor|()|static=false",
              isStatic: false,
              parameterCount: 0,
            },
          ],
  };
};

export const buildTypeBindingFromInterface = (
  declaration: IrInterfaceDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(
    namespace,
    declaration.name,
    declaration.typeParameters?.length ?? 0
  );
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods = [];
  const properties = [];

  for (const member of declaration.members) {
    if (member.kind === "methodSignature") {
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          typeParameters: member.typeParameters,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: false,
          isAbstract: true,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      )}|static=false|accessor=${member.isReadonly ? "get" : "getset"}`,
      semanticType: rewriteBindingSemanticType(
        member.type,
        localTypeNameRemaps
      ),
      semanticOptional: member.isOptional,
      isStatic: false,
      isAbstract: true,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !member.isReadonly,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    });
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(
      namespace,
      declaration.name,
      declaration.typeParameters?.length ?? 0
    ),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Interface",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity: declaration.typeParameters?.length ?? 0,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

export const buildTypeBindingFromEnum = (
  declaration: IrEnumDeclaration,
  namespace: string,
  assemblyName: string
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(namespace, declaration.name);
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const fields = declaration.members.map((member) => ({
    stableId: `${typeStableId}::field:${member.name}`,
    clrName: member.name,
    normalizedSignature: `${member.name}|${declaringClrType}|static=true|const=true`,
    isStatic: true,
    isReadOnly: true,
    isLiteral: true,
    declaringClrType,
    declaringAssemblyName: assemblyName,
  }));
  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, declaration.name),
    assemblyName,
    kind: "Enum",
    accessibility: "Public",
    isAbstract: false,
    isSealed: true,
    isStatic: false,
    arity: 0,
    typeParameters: [],
    methods: [],
    properties: [],
    fields,
    events: [],
    constructors: [],
  };
};

export const buildTypeBindingFromStructuralAlias = (
  declaration: IrTypeAliasDeclaration,
  namespace: string,
  assemblyName: string,
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): FirstPartyBindingsType | undefined => {
  if (declaration.type.kind !== "objectType") return undefined;

  const arity = declaration.typeParameters?.length ?? 0;
  const internalAliasName = `${declaration.name}__Alias`;
  const declaringClrType = toClrTypeName(namespace, internalAliasName, arity);
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const typeParameterScope =
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
    [];

  const methods = [];
  const properties = [];

  for (const member of declaration.type.members) {
    if (member.kind === "methodSignature") {
      methods.push(
        makeMethodBinding({
          declaringClrType,
          declaringAssemblyName: assemblyName,
          methodName: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          typeParameters: member.typeParameters,
          arity: member.typeParameters?.length ?? 0,
          parameterModifiers: buildParameterModifiers(member.parameters),
          isStatic: false,
          isAbstract: true,
          localTypeNameRemaps,
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        typeParameterScope,
        localTypeNameRemaps
      )}|static=false|accessor=${member.isReadonly ? "get" : "getset"}`,
      semanticType: rewriteBindingSemanticType(
        member.type,
        localTypeNameRemaps
      ),
      semanticOptional: member.isOptional,
      isStatic: false,
      isAbstract: true,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !member.isReadonly,
      declaringClrType,
      declaringAssemblyName: assemblyName,
    });
  }

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, internalAliasName, arity),
    assemblyName,
    kind: declaration.isStruct ? "Struct" : "Class",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity,
    typeParameters:
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

export const buildTypeBindingFromContainer = (
  entry: ModuleContainerEntry,
  namespace: string,
  assemblyName: string
): FirstPartyBindingsType => {
  const declaringClrType = toClrTypeName(namespace, entry.module.className);
  const typeStableId = toStableId(assemblyName, declaringClrType);

  const methods = entry.methods.map((method) =>
    makeMethodBinding({
      declaringClrType,
      declaringAssemblyName: assemblyName,
      methodName: method.localName,
      parameters: method.declaration.parameters,
      returnType: method.declaration.returnType,
      arity: method.declaration.typeParameters?.length ?? 0,
      parameterModifiers: buildParameterModifiers(
        method.declaration.parameters
      ),
      isStatic: true,
      localTypeNameRemaps: method.localTypeNameRemaps,
    })
  );

  const properties = entry.variables.map((variable) => ({
    stableId: `${typeStableId}::property:${variable.localName}`,
    clrName: variable.localName,
    normalizedSignature: `${variable.localName}|:${toSignatureType(
      variable.declarator?.type,
      [],
      variable.localTypeNameRemaps
    )}|static=true|accessor=getset`,
    semanticType: rewriteBindingSemanticType(
      variable.declarator?.type,
      variable.localTypeNameRemaps
    ),
    isStatic: true,
    isAbstract: false,
    isVirtual: false,
    isOverride: false,
    isIndexer: false,
    hasGetter: true,
    hasSetter: true,
    declaringClrType,
    declaringAssemblyName: assemblyName,
  }));

  return {
    stableId: typeStableId,
    clrName: declaringClrType,
    alias: toBindingTypeAlias(namespace, entry.module.className),
    assemblyName,
    kind: "Class",
    accessibility: "Public",
    isAbstract: true,
    isSealed: false,
    isStatic: true,
    arity: 0,
    typeParameters: [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [],
  };
};

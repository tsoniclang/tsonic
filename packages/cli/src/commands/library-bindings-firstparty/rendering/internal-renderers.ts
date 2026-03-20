import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import { isPublicOverloadSurfaceMethod } from "../binding-semantics.js";
import {
  applyWrappersToBaseType,
  ensureUndefinedInType,
  printTypeParameters,
  renderBindingAliasMarker,
  renderMethodSignature,
  renderPortableType,
  sanitizeForBrand,
} from "../portable-types.js";
import {
  renderSourceFunctionSignatures,
  renderSourceFunctionType,
  renderSourceValueType,
} from "../source-type-text.js";
import type {
  AnonymousStructuralAliasInfo,
  MemberOverride,
  ModuleContainerEntry,
} from "../types.js";

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

export const renderContainerInternal = (
  entry: ModuleContainerEntry,
  anonymousStructuralAliases: ReadonlyMap<string, AnonymousStructuralAliasInfo>
): readonly string[] => {
  const lines: string[] = [];
  lines.push(`export abstract class ${entry.module.className}$instance {`);
  for (const method of entry.methods) {
    const sourceSignatures = renderSourceFunctionSignatures({
      sourceSignatures: method.sourceSignatures,
      localTypeNameRemaps: method.localTypeNameRemaps,
      anonymousStructuralAliases,
    });
    if (sourceSignatures.length > 0) {
      for (const sourceSignature of sourceSignatures) {
        lines.push(
          `    static ${method.localName}${sourceSignature.typeParametersText}(${sourceSignature.parametersText}): ${sourceSignature.returnTypeText};`
        );
      }
      continue;
    }
    lines.push(
      `    static ${renderMethodSignature(
        method.localName,
        method.declaration.typeParameters,
        method.declaration.parameters,
        method.declaration.returnType,
        method.localTypeNameRemaps,
        anonymousStructuralAliases
      )}`
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

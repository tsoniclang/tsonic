import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrParameter,
  IrType,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import {
  isPortableMarkerMemberName,
  renderPortableType,
  renderReferenceType,
} from "./portable-types.js";
import type { AnonymousStructuralAliasInfo, NamespacePlan } from "./types.js";

export const isGeneratedStructuralHelperName = (name: string): boolean =>
  name.startsWith("__Anon_") || /__\d+$/.test(name);

export const buildAnonymousStructuralAliasMap = (
  plan: NamespacePlan
): ReadonlyMap<string, AnonymousStructuralAliasInfo> => {
  const aliases = new Map<string, AnonymousStructuralAliasInfo[]>();

  const registerAnonymousClass = (
    localName: string,
    declaration: IrClassDeclaration
  ): void => {
    if (!isGeneratedStructuralHelperName(localName)) return;

    const members: IrInterfaceMember[] = [];
    for (const member of declaration.members) {
      if (member.kind === "propertyDeclaration") {
        if (isPortableMarkerMemberName(member.name)) continue;
        members.push({
          kind: "propertySignature",
          name: member.name,
          type: member.type ?? { kind: "unknownType" },
          isOptional: false,
          isReadonly: member.isReadonly,
        });
        continue;
      }
      if (member.kind === "methodDeclaration") {
        if (isPortableMarkerMemberName(member.name)) continue;
        members.push({
          kind: "methodSignature",
          name: member.name,
          parameters: member.parameters,
          returnType: member.returnType,
          typeParameters: member.typeParameters,
        });
      }
    }

    const shape = renderPortableType(
      { kind: "objectType", members },
      declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
        [],
      new Map(),
      new Map()
    );
    const existing = aliases.get(shape) ?? [];
    existing.push({
      name: localName,
      typeParameters:
        declaration.typeParameters?.map(
          (typeParameter) => typeParameter.name
        ) ?? [],
    });
    aliases.set(shape, existing);
  };

  for (const symbol of plan.typeDeclarations) {
    if (
      symbol.kind !== "class" ||
      symbol.declaration.kind !== "classDeclaration"
    ) {
      continue;
    }
    registerAnonymousClass(symbol.localName, symbol.declaration);
  }

  for (const helper of plan.internalHelperTypeDeclarations) {
    if (helper.kind !== "class") continue;
    registerAnonymousClass(
      helper.emittedName,
      helper.declaration as IrClassDeclaration
    );
  }

  const uniqueAliases = new Map<string, AnonymousStructuralAliasInfo>();
  for (const [shape, candidates] of aliases.entries()) {
    if (candidates.length !== 1) continue;
    const onlyCandidate = candidates[0];
    if (!onlyCandidate) continue;
    uniqueAliases.set(shape, onlyCandidate);
  }

  return uniqueAliases;
};

export const collectReferencedPortableTypeNames = (
  type: IrType | undefined,
  typeParametersInScope: ReadonlySet<string>,
  out: Set<string>
): void => {
  if (!type) return;

  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "voidType":
    case "neverType":
    case "unknownType":
    case "anyType":
      return;
    case "typeParameterType":
      if (!typeParametersInScope.has(type.name)) {
        out.add(type.name);
      }
      return;
    case "arrayType":
      collectReferencedPortableTypeNames(
        type.elementType,
        typeParametersInScope,
        out
      );
      return;
    case "tupleType":
      for (const element of type.elementTypes) {
        collectReferencedPortableTypeNames(element, typeParametersInScope, out);
      }
      return;
    case "unionType":
    case "intersectionType":
      for (const member of type.types) {
        collectReferencedPortableTypeNames(member, typeParametersInScope, out);
      }
      return;
    case "dictionaryType":
      collectReferencedPortableTypeNames(
        type.keyType,
        typeParametersInScope,
        out
      );
      collectReferencedPortableTypeNames(
        type.valueType,
        typeParametersInScope,
        out
      );
      return;
    case "functionType":
      for (const parameter of type.parameters) {
        collectReferencedPortableTypeNames(
          parameter.type,
          typeParametersInScope,
          out
        );
      }
      collectReferencedPortableTypeNames(
        type.returnType,
        typeParametersInScope,
        out
      );
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          collectReferencedPortableTypeNames(
            member.type,
            typeParametersInScope,
            out
          );
          continue;
        }
        const nestedTypeParameters = new Set(typeParametersInScope);
        for (const typeParameter of member.typeParameters ?? []) {
          nestedTypeParameters.add(typeParameter.name);
        }
        for (const parameter of member.parameters) {
          collectReferencedPortableTypeNames(
            parameter.type,
            nestedTypeParameters,
            out
          );
        }
        collectReferencedPortableTypeNames(
          member.returnType,
          nestedTypeParameters,
          out
        );
      }
      return;
    case "referenceType":
      {
        const renderedName = renderReferenceType(
          type.name,
          type.typeArguments,
          []
        );
        const baseName = renderedName.split("<")[0];
        if (!baseName) return;
        out.add(baseName);
      }
      for (const typeArgument of type.typeArguments ?? []) {
        collectReferencedPortableTypeNames(
          typeArgument,
          typeParametersInScope,
          out
        );
      }
      return;
  }
};

export const collectReferencedPortableTypesFromParameters = (
  parameters: readonly IrParameter[],
  typeParametersInScope: ReadonlySet<string>,
  out: Set<string>
): void => {
  for (const parameter of parameters) {
    collectReferencedPortableTypeNames(
      parameter.type,
      typeParametersInScope,
      out
    );
  }
};

export const collectReferencedPortableTypeNamesFromDeclaration = (
  declaration:
    | IrClassDeclaration
    | IrInterfaceDeclaration
    | IrEnumDeclaration
    | IrTypeAliasDeclaration,
  out: Set<string>
): void => {
  switch (declaration.kind) {
    case "enumDeclaration":
      return;
    case "typeAliasDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map(
          (typeParameter) => typeParameter.name
        )
      );
      collectReferencedPortableTypeNames(
        declaration.type,
        typeParametersInScope,
        out
      );
      return;
    }
    case "interfaceDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map(
          (typeParameter) => typeParameter.name
        )
      );
      for (const baseType of declaration.extends) {
        collectReferencedPortableTypeNames(
          baseType,
          typeParametersInScope,
          out
        );
      }
      for (const member of declaration.members) {
        if (member.kind === "propertySignature") {
          collectReferencedPortableTypeNames(
            member.type,
            typeParametersInScope,
            out
          );
          continue;
        }
        const nestedTypeParameters = new Set(typeParametersInScope);
        for (const typeParameter of member.typeParameters ?? []) {
          nestedTypeParameters.add(typeParameter.name);
        }
        collectReferencedPortableTypesFromParameters(
          member.parameters,
          nestedTypeParameters,
          out
        );
        collectReferencedPortableTypeNames(
          member.returnType,
          nestedTypeParameters,
          out
        );
      }
      return;
    }
    case "classDeclaration": {
      const typeParametersInScope = new Set(
        (declaration.typeParameters ?? []).map(
          (typeParameter) => typeParameter.name
        )
      );
      if (declaration.superClass) {
        collectReferencedPortableTypeNames(
          declaration.superClass,
          typeParametersInScope,
          out
        );
      }
      for (const implementedType of declaration.implements) {
        collectReferencedPortableTypeNames(
          implementedType,
          typeParametersInScope,
          out
        );
      }
      for (const member of declaration.members) {
        switch (member.kind) {
          case "constructorDeclaration":
            collectReferencedPortableTypesFromParameters(
              member.parameters,
              typeParametersInScope,
              out
            );
            continue;
          case "propertyDeclaration":
            collectReferencedPortableTypeNames(
              member.type,
              typeParametersInScope,
              out
            );
            continue;
          case "methodDeclaration": {
            const nestedTypeParameters = new Set(typeParametersInScope);
            for (const typeParameter of member.typeParameters ?? []) {
              nestedTypeParameters.add(typeParameter.name);
            }
            collectReferencedPortableTypesFromParameters(
              member.parameters,
              nestedTypeParameters,
              out
            );
            collectReferencedPortableTypeNames(
              member.returnType,
              nestedTypeParameters,
              out
            );
            continue;
          }
        }
      }
      return;
    }
  }
};

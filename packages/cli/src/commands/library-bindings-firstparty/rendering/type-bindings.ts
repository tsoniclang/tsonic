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
} from "../binding-semantics.js";
import type {
  FirstPartyBindingsType,
  ModuleContainerEntry,
} from "../types.js";

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

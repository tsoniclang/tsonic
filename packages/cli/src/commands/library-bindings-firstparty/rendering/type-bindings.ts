import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrParameter,
  IrType,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import * as ts from "typescript";
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
import { getPropertyNameText } from "../portable-types.js";
import type {
  FirstPartyBindingsType,
  ModuleContainerEntry,
  SourceAnonymousStructuralAliasPlan,
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

const parseSourceTypeLiteralNode = (
  sourceTypeText: string
): ts.TypeLiteralNode | undefined => {
  const sourceFile = ts.createSourceFile(
    "__tsonic_source_anon__.ts",
    `type __T = ${sourceTypeText};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  if (!statement || !ts.isTypeAliasDeclaration(statement)) return undefined;
  const typeNode = statement.type;
  return ts.isTypeLiteralNode(typeNode) ? typeNode : undefined;
};

const sourceTypeNodeToIrType = (
  node: ts.TypeNode,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  inScopeTypeParameters: ReadonlySet<string> = new Set()
): IrType => {
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }

  if (ts.isTypeReferenceNode(node)) {
    const rawName = node.typeName.getText();
    const remappedName = localTypeNameRemaps.get(rawName) ?? rawName;

    if (remappedName === "Record" && node.typeArguments?.length === 2) {
      const [keyNode, valueNode] = node.typeArguments;
      if (keyNode && valueNode) {
        return {
          kind: "dictionaryType",
          keyType: sourceTypeNodeToIrType(
            keyNode,
            localTypeNameRemaps,
            inScopeTypeParameters
          ),
          valueType: sourceTypeNodeToIrType(
            valueNode,
            localTypeNameRemaps,
            inScopeTypeParameters
          ),
        };
      }
    }

    if (!node.typeArguments?.length && inScopeTypeParameters.has(remappedName)) {
      return { kind: "typeParameterType", name: remappedName };
    }

    const primitiveKeywordAlias =
      remappedName === "int" || remappedName === "char"
        ? remappedName
        : undefined;
    if (primitiveKeywordAlias) {
      return {
        kind: "primitiveType",
        name: primitiveKeywordAlias,
      };
    }

    return {
      kind: "referenceType",
      name: remappedName,
      typeArguments:
        node.typeArguments?.map((typeArgument) =>
          sourceTypeNodeToIrType(
            typeArgument,
            localTypeNameRemaps,
            inScopeTypeParameters
          )
        ) ?? [],
    };
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "arrayType",
      elementType: sourceTypeNodeToIrType(
        node.elementType,
        localTypeNameRemaps,
        inScopeTypeParameters
      ),
      origin: "explicit",
    };
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: "tupleType",
      elementTypes: node.elements.map((element) =>
        sourceTypeNodeToIrType(element, localTypeNameRemaps, inScopeTypeParameters)
      ),
    };
  }

  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((typeNode) =>
        sourceTypeNodeToIrType(typeNode, localTypeNameRemaps, inScopeTypeParameters)
      ),
    };
  }

  if (ts.isIntersectionTypeNode(node)) {
    return {
      kind: "intersectionType",
      types: node.types.map((typeNode) =>
        sourceTypeNodeToIrType(typeNode, localTypeNameRemaps, inScopeTypeParameters)
      ),
    };
  }

  if (ts.isFunctionTypeNode(node)) {
    return {
      kind: "functionType",
      parameters: node.parameters.map((parameter, index) =>
        sourceParameterToIrParameter(
          parameter,
          index,
          localTypeNameRemaps,
          inScopeTypeParameters
        )
      ),
      returnType: node.type
        ? sourceTypeNodeToIrType(
            node.type,
            localTypeNameRemaps,
            inScopeTypeParameters
          )
        : { kind: "voidType" },
    };
  }

  if (ts.isTypeLiteralNode(node)) {
    return {
      kind: "objectType",
      members: sourceTypeLiteralMembersToIrMembers(
        node,
        localTypeNameRemaps,
        inScopeTypeParameters
      ),
    };
  }

  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) {
      return { kind: "literalType", value: node.literal.text };
    }
    if (ts.isNumericLiteral(node.literal)) {
      return { kind: "literalType", value: Number(node.literal.text) };
    }
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword) {
      return { kind: "literalType", value: true };
    }
    if (node.literal.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: "literalType", value: false };
    }
  }

  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    default:
      return { kind: "unknownType" };
  }
};

const sourceParameterToIrParameter = (
  parameter: ts.ParameterDeclaration,
  index: number,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  inScopeTypeParameters: ReadonlySet<string>
): IrParameter => ({
  kind: "parameter",
  pattern: {
    kind: "identifierPattern",
    name: ts.isIdentifier(parameter.name) ? parameter.name.text : `p${index + 1}`,
  },
  type: parameter.type
    ? sourceTypeNodeToIrType(
        parameter.type,
        localTypeNameRemaps,
        inScopeTypeParameters
      )
    : { kind: "unknownType" },
  initializer: undefined,
  isOptional: parameter.questionToken !== undefined,
  isRest: parameter.dotDotDotToken !== undefined,
  passing: "value",
});

const sourceTypeLiteralMembersToIrMembers = (
  typeLiteralNode: ts.TypeLiteralNode,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  inScopeTypeParameters: ReadonlySet<string>
): readonly IrInterfaceMember[] => {
  const members: IrInterfaceMember[] = [];
  for (const member of typeLiteralNode.members) {
    if (ts.isPropertySignature(member)) {
      const propertyName = member.name ? getPropertyNameText(member.name) : undefined;
      if (!propertyName || !member.type) continue;
      members.push({
        kind: "propertySignature",
        name: propertyName,
        type: sourceTypeNodeToIrType(
          member.type,
          localTypeNameRemaps,
          inScopeTypeParameters
        ),
        isOptional: member.questionToken !== undefined,
        isReadonly:
          member.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false,
      });
      continue;
    }

    if (ts.isMethodSignature(member)) {
      const methodName = member.name ? getPropertyNameText(member.name) : undefined;
      if (!methodName) continue;
      const nestedTypeParameters = new Set(inScopeTypeParameters);
      member.typeParameters?.forEach((typeParameter) =>
        nestedTypeParameters.add(typeParameter.name.text)
      );
      members.push({
        kind: "methodSignature",
        name: methodName,
        typeParameters: member.typeParameters?.map((typeParameter) => ({
          kind: "typeParameter",
          name: typeParameter.name.text,
          constraint: undefined,
          default: undefined,
        })),
        parameters: member.parameters.map((parameter, index) =>
          sourceParameterToIrParameter(
            parameter,
            index,
            localTypeNameRemaps,
            nestedTypeParameters
          )
        ),
        returnType: member.type
          ? sourceTypeNodeToIrType(
              member.type,
              localTypeNameRemaps,
              nestedTypeParameters
            )
          : { kind: "voidType" },
      });
      continue;
    }
  }
  return members;
};

export const buildTypeBindingFromSourceAnonymousStructuralAlias = (
  alias: SourceAnonymousStructuralAliasPlan,
  namespace: string,
  assemblyName: string
): FirstPartyBindingsType | undefined => {
  const typeLiteralNode = parseSourceTypeLiteralNode(alias.sourceTypeText);
  if (!typeLiteralNode) return undefined;

  const effectiveNamespace = alias.declaringNamespace || namespace;
  const declaringClrType = toClrTypeName(effectiveNamespace, alias.name);
  const typeStableId = toStableId(assemblyName, declaringClrType);
  const members = sourceTypeLiteralMembersToIrMembers(
    typeLiteralNode,
    alias.localTypeNameRemaps,
    new Set()
  );

  const methods = [];
  const properties = [];

  for (const member of members) {
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
          localTypeNameRemaps: alias.localTypeNameRemaps,
        })
      );
      continue;
    }

    properties.push({
      stableId: `${typeStableId}::property:${member.name}`,
      clrName: member.name,
      normalizedSignature: `${member.name}|:${toSignatureType(
        member.type,
        [],
        alias.localTypeNameRemaps
      )}|static=false|accessor=${member.isReadonly ? "get" : "getset"}`,
      semanticType: rewriteBindingSemanticType(
        member.type,
        alias.localTypeNameRemaps
      ),
      semanticOptional: member.isOptional,
      isStatic: false,
      isAbstract: false,
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
    alias: toBindingTypeAlias(effectiveNamespace, alias.name),
    assemblyName,
    kind: "Class",
    accessibility: "Public",
    isAbstract: false,
    isSealed: false,
    isStatic: false,
    arity: 0,
    typeParameters: [],
    methods,
    properties,
    fields: [],
    events: [],
    constructors: [
      {
        normalizedSignature: ".ctor|()|static=false",
        isStatic: false,
        parameterCount: 0,
      },
    ],
  };
};

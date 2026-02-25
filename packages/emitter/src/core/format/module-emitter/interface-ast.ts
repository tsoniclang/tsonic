import {
  IrStatement,
  type IrAttribute,
  type IrInterfaceMember,
  type IrParameter,
  type IrTypeParameter,
} from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import {
  emitParameterType,
  emitType,
  emitTypeParameters,
} from "../../../type-emitter.js";
import { emitExpression } from "../../../expression-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { emitAttributes } from "../attributes.js";
import { typeAstFromText } from "../backend-ast/type-factories.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassDeclarationAst,
  CSharpInterfaceDeclarationAst,
  CSharpInterfaceMemberAst,
  CSharpParameterAst,
  CSharpStructDeclarationAst,
} from "../backend-ast/types.js";

const getterSetterAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  {
    kind: "accessorDeclaration",
    accessorKind: "get",
  },
  {
    kind: "accessorDeclaration",
    accessorKind: "set",
  },
];

const getterInitAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  {
    kind: "accessorDeclaration",
    accessorKind: "get",
  },
  {
    kind: "accessorDeclaration",
    accessorKind: "init",
  },
];

const splitAttributeLines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const emitAttributeList = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [readonly string[], EmitterContext] => {
  const [text, next] = emitAttributes(attributes, {
    ...context,
    indentLevel: 0,
  });
  return [splitAttributeLines(text), next];
};

const buildReservedTypeParameterNames = (
  members: readonly IrInterfaceMember[]
): ReadonlySet<string> => {
  const reserved = new Set<string>();
  for (const member of members) {
    if (member.kind === "propertySignature") {
      reserved.add(member.name);
      continue;
    }
    reserved.add(member.name);
  }
  return reserved;
};

const emitInterfaceParameter = (
  parameter: IrParameter,
  context: EmitterContext
): [CSharpParameterAst, EmitterContext] => {
  const modifiers = [
    ...(parameter.isExtensionReceiver ? ["this"] : []),
    ...(parameter.passing !== "value" ? [parameter.passing] : []),
  ];

  const [typeText, typeContext] = emitParameterType(
    parameter.type,
    parameter.isOptional,
    context
  );
  let currentContext = typeContext;

  const [attributes, attrContext] = emitAttributeList(
    parameter.attributes,
    currentContext
  );
  currentContext = attrContext;

  let defaultValue;
  if (parameter.initializer) {
    const [expr, next] = emitExpression(
      parameter.initializer,
      currentContext,
      parameter.type
    );
    currentContext = next;
    defaultValue = { kind: "rawExpression", text: expr.text } as const;
  } else if (parameter.isOptional && !parameter.isRest) {
    defaultValue = { kind: "literalExpression", text: "default" } as const;
  }

  return [
    {
      kind: "parameter",
      attributes,
      modifiers,
      type: typeAstFromText(typeText),
      name:
        parameter.pattern.kind === "identifierPattern"
          ? escapeCSharpIdentifier(parameter.pattern.name)
          : "param",
      defaultValue,
    },
    currentContext,
  ];
};

const emitMethodSignatureMember = (
  member: Extract<IrInterfaceMember, { kind: "methodSignature" }>,
  context: EmitterContext
): [
  Extract<CSharpInterfaceMemberAst, { kind: "methodSignature" }>,
  EmitterContext,
] => {
  const methodTypeParamNames = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  let methodContext: EmitterContext = {
    ...context,
    typeParameters: methodTypeParamNames,
  };

  const [, whereClauses, typeParamContext] = emitTypeParameters(
    member.typeParameters,
    methodContext
  );
  methodContext = typeParamContext;

  const emittedTypeParameters =
    member.typeParameters?.map(
      (tp: IrTypeParameter) =>
        methodContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  let returnTypeText = "void";
  if (member.returnType) {
    const [returnType, next] = emitType(member.returnType, methodContext);
    methodContext = next;
    returnTypeText = returnType;
  }

  const parameters: CSharpParameterAst[] = [];
  for (const parameter of member.parameters) {
    const [parameterAst, next] = emitInterfaceParameter(
      parameter,
      methodContext
    );
    parameters.push(parameterAst);
    methodContext = next;
  }

  return [
    {
      kind: "methodSignature",
      attributes: [],
      returnType: typeAstFromText(returnTypeText),
      name: emitCSharpName(member.name, "methods", context),
      typeParameters: emittedTypeParameters,
      parameters,
      whereClauses,
    },
    {
      ...methodContext,
      typeParameters: context.typeParameters,
      typeParamConstraints: context.typeParamConstraints,
      typeParameterNameMap: context.typeParameterNameMap,
    },
  ];
};

const emitPropertyMemberAsClassProperty = (
  member: Extract<IrInterfaceMember, { kind: "propertySignature" }>,
  context: EmitterContext
): [
  Extract<
    CSharpClassDeclarationAst["members"][number],
    { kind: "propertyDeclaration" }
  >,
  EmitterContext,
] => {
  let currentContext = context;
  let typeText = member.isOptional ? "object?" : "object";
  if (member.type) {
    const [emittedType, nextContext] = emitType(member.type, currentContext);
    currentContext = nextContext;
    typeText = member.isOptional ? `${emittedType}?` : emittedType;
  }

  const propertyModifiers = [
    "public",
    ...(!member.isOptional ? ["required"] : []),
  ];

  return [
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: propertyModifiers,
      type: typeAstFromText(typeText),
      name: emitCSharpName(member.name, "properties", context),
      accessorList: member.isReadonly
        ? getterInitAccessorList
        : getterSetterAccessorList,
    },
    currentContext,
  ];
};

const emitPropertyMemberAsInterfaceProperty = (
  member: Extract<IrInterfaceMember, { kind: "propertySignature" }>,
  context: EmitterContext
): [
  Extract<CSharpInterfaceMemberAst, { kind: "propertyDeclaration" }>,
  EmitterContext,
] => {
  let currentContext = context;
  let typeText = member.isOptional ? "object?" : "object";
  if (member.type) {
    const [emittedType, nextContext] = emitType(member.type, currentContext);
    currentContext = nextContext;
    typeText = member.isOptional ? `${emittedType}?` : emittedType;
  }

  return [
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: [],
      type: typeAstFromText(typeText),
      name: emitCSharpName(member.name, "properties", context),
      accessorList: member.isReadonly
        ? [{ kind: "accessorDeclaration", accessorKind: "get" }]
        : getterSetterAccessorList,
    },
    currentContext,
  ];
};

/**
 * Emits TS interfaces as:
 * - C# interfaces when method signatures are present
 * - C# class/struct DTOs when property-only
 */
export const emitInterfaceDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext,
  indentLevel: number
): [
  (
    | CSharpClassDeclarationAst
    | CSharpStructDeclarationAst
    | CSharpInterfaceDeclarationAst
    | undefined
  ),
  EmitterContext,
] => {
  const hasMethodSignatures = stmt.members.some(
    (member) => member.kind === "methodSignature"
  );

  const interfaceTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  let currentContext: EmitterContext = {
    ...context,
    typeParameters: interfaceTypeParams,
  };

  const reservedTypeParameterNames = buildReservedTypeParameterNames(
    stmt.members
  );
  const [, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext,
    reservedTypeParameterNames
  );
  currentContext = typeParamContext;

  const emittedTypeParameters =
    stmt.typeParameters?.map(
      (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  const baseTypes: string[] = [];
  for (const extendedType of stmt.extends) {
    const [baseType, next] = emitType(extendedType, currentContext);
    currentContext = next;
    baseTypes.push(baseType);
  }

  const needsUnsafe = statementUsesPointer(stmt);
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  if (!hasMethodSignatures) {
    const members: Array<CSharpClassDeclarationAst["members"][number]> = [];
    for (const member of stmt.members) {
      if (member.kind !== "propertySignature") continue;
      const [propertyMember, next] = emitPropertyMemberAsClassProperty(
        member,
        currentContext
      );
      members.push(propertyMember);
      currentContext = next;
    }

    if (stmt.isStruct) {
      return [
        {
          kind: "structDeclaration",
          indentLevel,
          attributes: [],
          modifiers: [accessibility, ...(needsUnsafe ? ["unsafe"] : [])],
          name: escapeCSharpIdentifier(stmt.name),
          typeParameters:
            emittedTypeParameters.length > 0
              ? emittedTypeParameters
              : undefined,
          baseTypes: baseTypes.length > 0 ? baseTypes : undefined,
          whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
          members,
        },
        currentContext,
      ];
    }

    return [
      {
        kind: "classDeclaration",
        indentLevel,
        attributes: [],
        modifiers: [accessibility, ...(needsUnsafe ? ["unsafe"] : [])],
        name: escapeCSharpIdentifier(stmt.name),
        typeParameters:
          emittedTypeParameters.length > 0 ? emittedTypeParameters : undefined,
        baseTypes: baseTypes.length > 0 ? baseTypes : undefined,
        whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
        members,
      },
      currentContext,
    ];
  }

  const members: CSharpInterfaceMemberAst[] = [];
  for (const member of stmt.members) {
    if (member.kind === "propertySignature") {
      const [propertyMember, next] = emitPropertyMemberAsInterfaceProperty(
        member,
        currentContext
      );
      members.push(propertyMember);
      currentContext = next;
      continue;
    }

    const [methodMember, next] = emitMethodSignatureMember(
      member,
      currentContext
    );
    members.push(methodMember);
    currentContext = next;
  }

  return [
    {
      kind: "interfaceDeclaration",
      indentLevel,
      attributes: [],
      modifiers: [accessibility, ...(needsUnsafe ? ["unsafe"] : [])],
      name: escapeCSharpIdentifier(stmt.name),
      typeParameters:
        emittedTypeParameters.length > 0 ? emittedTypeParameters : undefined,
      baseTypes: baseTypes.length > 0 ? baseTypes : undefined,
      whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
      members,
    },
    currentContext,
  ];
};

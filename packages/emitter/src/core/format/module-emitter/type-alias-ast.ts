import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitType, emitTypeParameters } from "../../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { typeUsesPointer } from "../../semantic/unsafe.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { typeAstFromText } from "../backend-ast/type-factories.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassMemberAst,
  CSharpClassDeclarationAst,
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

/**
 * Emits structural object type-alias declarations as class/struct AST nodes.
 * Returns `undefined` for unsupported aliases (generic/non-object) so callers can
 * fall back to legacy string emission.
 */
export const emitTypeAliasDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext,
  indentLevel: number
): [
  CSharpClassDeclarationAst | CSharpStructDeclarationAst | undefined,
  EmitterContext,
] => {
  if (stmt.type.kind !== "objectType") {
    return [undefined, context];
  }

  const aliasTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: aliasTypeParams,
  };

  const reservedTypeParamNames = new Set<string>();
  for (const member of stmt.type.members) {
    if (member.kind !== "propertySignature") continue;
    reservedTypeParamNames.add(
      emitCSharpName(member.name, "properties", context)
    );
  }
  const [, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext,
    reservedTypeParamNames
  );
  currentContext = typeParamContext;

  const emittedTypeParameters =
    stmt.typeParameters?.map(
      (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  const needsUnsafe = typeUsesPointer(stmt.type);
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers = [
    accessibility,
    ...(needsUnsafe ? ["unsafe"] : []),
    ...(!stmt.isStruct ? ["sealed"] : []),
  ] as const;

  const members: Array<CSharpClassDeclarationAst["members"][number]> = [];
  for (const member of stmt.type.members) {
    if (member.kind !== "propertySignature") continue;

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
    members.push({
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: propertyModifiers,
      type: typeAstFromText(typeText),
      name: emitCSharpName(member.name, "properties", context),
      accessorList: member.isReadonly
        ? getterInitAccessorList
        : getterSetterAccessorList,
    });
  }

  if (stmt.isStruct) {
    return [
      {
        kind: "structDeclaration",
        indentLevel,
        attributes: [],
        modifiers: [...modifiers],
        name: `${escapeCSharpIdentifier(stmt.name)}__Alias`,
        typeParameters:
          emittedTypeParameters.length > 0 ? emittedTypeParameters : undefined,
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
      modifiers: [...modifiers],
      name: `${escapeCSharpIdentifier(stmt.name)}__Alias`,
      typeParameters:
        emittedTypeParameters.length > 0 ? emittedTypeParameters : undefined,
      whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
      members,
    },
    currentContext,
  ];
};

export const emitNonStructuralTypeAliasCommentAst = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [CSharpClassMemberAst, EmitterContext] => {
  let currentContext = context;
  const [typeParamsStr, , typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;
  const [typeText, typeContext] = emitType(stmt.type, currentContext);
  currentContext = typeContext;
  return [
    {
      kind: "commentMember",
      text: `// type ${escapeCSharpIdentifier(stmt.name)}${typeParamsStr} = ${typeText}`,
    },
    currentContext,
  ];
};

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitType } from "../../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { typeUsesPointer } from "../../semantic/unsafe.js";
import { emitCSharpName } from "../../../naming-policy.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassDeclarationAst,
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
): [CSharpClassDeclarationAst | undefined, EmitterContext] => {
  if (stmt.type.kind !== "objectType") {
    return [undefined, context];
  }
  if ((stmt.typeParameters?.length ?? 0) > 0) {
    return [undefined, context];
  }

  let currentContext = context;
  const needsUnsafe = typeUsesPointer(stmt.type);
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers = stmt.isStruct
    ? ([accessibility, ...(needsUnsafe ? ["unsafe"] : [])] as const)
    : ([
        accessibility,
        ...(needsUnsafe ? ["unsafe"] : []),
        "sealed",
      ] as const);

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
      type: { kind: "rawType", text: typeText },
      name: emitCSharpName(member.name, "properties", context),
      accessorList: member.isReadonly
        ? getterInitAccessorList
        : getterSetterAccessorList,
    });
  }

  return [
    {
      kind: "classDeclaration",
      indentLevel,
      attributes: [],
      modifiers: [...modifiers],
      name: `${escapeCSharpIdentifier(stmt.name)}__Alias`,
      members,
    },
    currentContext,
  ];
};

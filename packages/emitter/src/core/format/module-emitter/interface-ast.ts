import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitType } from "../../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { emitCSharpName } from "../../../naming-policy.js";
import type {
  CSharpAccessorDeclarationAst,
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
 * Emits simple property-only TS interfaces as C# class/struct AST nodes.
 * Returns `undefined` for unsupported interfaces (generics/extends/methods) so
 * callers can fall back to legacy emission.
 */
export const emitInterfaceDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext,
  indentLevel: number
): [
  CSharpClassDeclarationAst | CSharpStructDeclarationAst | undefined,
  EmitterContext,
] => {
  const hasMethodSignatures = stmt.members.some(
    (member) => member.kind === "methodSignature"
  );
  if (hasMethodSignatures) {
    return [undefined, context];
  }
  if ((stmt.typeParameters?.length ?? 0) > 0) {
    return [undefined, context];
  }
  if ((stmt.extends?.length ?? 0) > 0) {
    return [undefined, context];
  }

  let currentContext = context;
  const needsUnsafe = statementUsesPointer(stmt);
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers = [
    accessibility,
    ...(needsUnsafe ? ["unsafe"] : []),
  ] as const;

  const members: Array<CSharpClassDeclarationAst["members"][number]> = [];
  for (const member of stmt.members) {
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

  if (stmt.isStruct) {
    return [
      {
        kind: "structDeclaration",
        indentLevel,
        attributes: [],
        modifiers: [...modifiers],
        name: escapeCSharpIdentifier(stmt.name),
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
      name: escapeCSharpIdentifier(stmt.name),
      members,
    },
    currentContext,
  ];
};

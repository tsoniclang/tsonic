import { type IrClassMember, type IrType } from "@tsonic/frontend";
import { EmitterContext, type LocalTypeInfo } from "../../types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { resolveLocalTypeInfo } from "../../core/semantic/type-resolution.js";
import type {
  CSharpMemberAst,
  CSharpStatementAst,
} from "../../core/format/backend-ast/types.js";

const emitsAsCSharpInterface = (
  localInfo: LocalTypeInfo | undefined
): boolean =>
  !!localInfo &&
  localInfo.kind === "interface" &&
  localInfo.members.some((member) => member.kind === "methodSignature");

export const isInterfaceReference = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): boolean => {
  const localInfo = resolveLocalTypeInfo(ref, context)?.info;
  if (emitsAsCSharpInterface(localInfo)) {
    return true;
  }

  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value) {
      candidates.add(value);
    }
  };

  add(ref.name);
  add(ref.resolvedClrType);
  add(ref.typeId?.tsName);
  add(ref.typeId?.clrName);
  for (const value of [...candidates]) {
    if (!value.includes(".")) continue;
    add(value.split(".").pop());
  }

  for (const candidate of candidates) {
    const binding = context.bindingsRegistry?.get(candidate);
    if (binding?.kind === "interface") {
      return true;
    }
  }

  return false;
};

const localTypeRequiresSetsRequiredMembersCtor = (
  name: string,
  localInfo: LocalTypeInfo,
  context: EmitterContext,
  visited: Set<string>
): boolean => {
  const key = `${context.moduleNamespace ?? context.options.rootNamespace}:${name}`;
  if (visited.has(key)) {
    return false;
  }
  visited.add(key);

  if (localInfo.kind === "interface") {
    const emitsAsClass = !localInfo.members.some(
      (member) => member.kind === "methodSignature"
    );
    if (!emitsAsClass) {
      return false;
    }

    if (
      localInfo.members.some(
        (member) =>
          member.kind === "propertySignature" && member.isOptional === false
      )
    ) {
      return true;
    }

    return localInfo.extends.some(
      (base) =>
        base.kind === "referenceType" &&
        referenceTypeRequiresSetsRequiredMembersCtor(base, context, visited)
    );
  }

  if (localInfo.kind === "class") {
    if (
      localInfo.members.some(
        (member) =>
          member.kind === "propertyDeclaration" && member.isRequired === true
      )
    ) {
      return true;
    }

    return (
      localInfo.superClass?.kind === "referenceType" &&
      referenceTypeRequiresSetsRequiredMembersCtor(
        localInfo.superClass,
        context,
        visited
      )
    );
  }

  return false;
};

export const referenceTypeRequiresSetsRequiredMembersCtor = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext,
  visited: Set<string> = new Set<string>()
): boolean => {
  const resolved = resolveLocalTypeInfo(ref, context);
  if (!resolved) {
    return false;
  }

  return localTypeRequiresSetsRequiredMembersCtor(
    resolved.name,
    resolved.info,
    context,
    visited
  );
};

const irNodeUsesInstanceContext = (
  value: unknown,
  visited: WeakSet<object> = new WeakSet<object>()
): boolean => {
  if (value == null) return false;

  if (Array.isArray(value)) {
    return value.some((item) => irNodeUsesInstanceContext(item, visited));
  }

  if (typeof value !== "object") {
    return false;
  }

  if (visited.has(value)) {
    return false;
  }
  visited.add(value);

  const candidate = value as { kind?: unknown; name?: unknown };
  if (candidate.kind === "this") {
    return true;
  }
  if (candidate.kind === "identifier" && candidate.name === "super") {
    return true;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    if (irNodeUsesInstanceContext(child, visited)) {
      return true;
    }
  }

  return false;
};

export const shouldHoistInstanceInitializer = (
  member: IrClassMember
): member is Extract<IrClassMember, { kind: "propertyDeclaration" }> =>
  member.kind === "propertyDeclaration" &&
  !member.isStatic &&
  member.initializer !== undefined &&
  irNodeUsesInstanceContext(member.initializer);

export const stripMemberInitializer = (
  memberAst: CSharpMemberAst
): CSharpMemberAst => {
  if (
    memberAst.kind !== "fieldDeclaration" &&
    memberAst.kind !== "propertyDeclaration"
  ) {
    return memberAst;
  }

  return {
    ...memberAst,
    initializer: undefined,
  };
};

export const buildHoistedInitializerStatement = (
  memberAst: Extract<
    CSharpMemberAst,
    { kind: "fieldDeclaration" | "propertyDeclaration" }
  >
): CSharpStatementAst | undefined => {
  if (!memberAst.initializer) {
    return undefined;
  }

  return {
    kind: "expressionStatement",
    expression: {
      kind: "assignmentExpression",
      operatorToken: "=",
      left: {
        kind: "memberAccessExpression",
        expression: identifierExpression("this"),
        memberName: memberAst.name,
      },
      right: memberAst.initializer,
    },
  };
};

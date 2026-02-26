/**
 * Member access expression emitters
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";

// ============================================================================
// CONTRACT: Emitter ONLY consumes proof markers.
// ============================================================================

/**
 * Check if an expression has proven Int32 type from the numeric proof pass.
 */
const hasInt32Proof = (expr: IrExpression): boolean => {
  if (
    expr.inferredType?.kind === "primitiveType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  if (
    expr.inferredType?.kind === "referenceType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  return false;
};

type MemberAccessUsage = "value" | "call";

type MemberAccessBucket = "methods" | "properties" | "fields" | "enumMembers";

const bucketFromMemberKind = (kind: string): MemberAccessBucket => {
  switch (kind) {
    case "method":
      return "methods";
    case "field":
      return "fields";
    case "enumMember":
      return "enumMembers";
    default:
      return "properties";
  }
};

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const getMemberAccessNarrowKey = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>
): string | undefined => {
  if (expr.isComputed) return undefined;
  if (typeof expr.property !== "string") return undefined;

  const obj = expr.object;
  if (obj.kind === "identifier") {
    return `${obj.name}.${expr.property}`;
  }

  if (obj.kind === "memberAccess") {
    const prefix = getMemberAccessNarrowKey(obj);
    return prefix ? `${prefix}.${expr.property}` : undefined;
  }

  return undefined;
};

const lookupMemberKindFromLocalTypes = (
  receiverTypeName: string,
  memberName: string,
  context: EmitterContext
): string | undefined => {
  const local = context.localTypes?.get(receiverTypeName);
  if (!local) return undefined;

  if (local.kind === "enum") {
    return local.members.includes(memberName) ? "enumMember" : undefined;
  }

  if (local.kind === "typeAlias") {
    if (local.type.kind !== "objectType") return undefined;
    const found = local.type.members.find((m) => m.name === memberName);
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  const members = local.members;
  for (const m of members) {
    if (!("name" in m) || m.name !== memberName) continue;
    if (m.kind === "methodDeclaration" || m.kind === "methodSignature") {
      return "method";
    }
    if (m.kind === "propertySignature") return "property";
    if (m.kind === "propertyDeclaration") {
      const hasAccessors = !!(m.getterBody || m.setterBody);
      return hasAccessors ? "property" : "field";
    }
  }

  return undefined;
};

const lookupMemberKindFromIndex = (
  receiverTypeFqn: string,
  memberName: string,
  context: EmitterContext
): string | undefined => {
  const perType = context.options.typeMemberIndex?.get(receiverTypeFqn);
  return perType?.get(memberName);
};

const hasPropertyFromBindingsRegistry = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): boolean | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) return undefined;

  const candidates = new Set<string>();
  const addCandidate = (value: string | undefined): void => {
    if (!value) return;
    candidates.add(value);
    if (value.includes(".")) {
      const leaf = value.split(".").pop();
      if (leaf) candidates.add(leaf);
    }
  };

  addCandidate(type.name);
  addCandidate(type.typeId?.tsName);
  addCandidate(type.resolvedClrType);
  addCandidate(type.typeId?.clrName);

  for (const value of Array.from(candidates)) {
    if (value.endsWith("$instance")) {
      candidates.add(value.slice(0, -"$instance".length));
    }
    if (value.startsWith("__") && value.endsWith("$views")) {
      candidates.add(value.slice("__".length, -"$views".length));
    }
  }

  for (const key of candidates) {
    const binding = registry.get(key);
    if (!binding) continue;
    return binding.members.some(
      (member) =>
        member.kind === "property" &&
        (member.alias === propertyName ||
          member.name === propertyName ||
          member.binding.member === propertyName)
    );
  }

  return undefined;
};

const resolveReceiverTypeFqn = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (receiverType?.kind === "referenceType" && receiverType.resolvedClrType) {
    return receiverType.resolvedClrType;
  }

  if (receiverExpr.kind === "identifier") {
    const binding = context.importBindings?.get(receiverExpr.name);
    if (binding?.kind === "type") {
      return stripGlobalPrefix(binding.clrName);
    }
  }

  return undefined;
};

const emitMemberName = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext,
  usage: MemberAccessUsage
): string => {
  if (usage === "call") {
    return emitCSharpName(memberName, "methods", context);
  }

  if (receiverExpr.kind === "identifier") {
    const binding = context.importBindings?.get(receiverExpr.name);
    if (binding?.kind === "namespace") {
      return emitCSharpName(memberName, "fields", context);
    }
  }

  const receiverTypeName =
    receiverType?.kind === "referenceType" ? receiverType.name : undefined;
  if (receiverTypeName) {
    const localKind = lookupMemberKindFromLocalTypes(
      receiverTypeName,
      memberName,
      context
    );
    if (localKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(localKind),
        context
      );
    }
  }

  if (receiverExpr.kind === "identifier") {
    const localKind = lookupMemberKindFromLocalTypes(
      receiverExpr.name,
      memberName,
      context
    );
    if (localKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(localKind),
        context
      );
    }
  }

  const receiverFqn = resolveReceiverTypeFqn(
    receiverExpr,
    receiverType,
    context
  );
  if (receiverFqn) {
    const indexedKind = lookupMemberKindFromIndex(
      receiverFqn,
      memberName,
      context
    );
    if (indexedKind) {
      return emitCSharpName(
        memberName,
        bucketFromMemberKind(indexedKind),
        context
      );
    }
  }

  return emitCSharpName(memberName, "properties", context);
};

/**
 * Check if an expression represents a static type reference (not an instance)
 */
const isStaticTypeReference = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding) return true;

    if (!expr.object.inferredType) return false;
  }

  const objectType = expr.object.inferredType;

  if (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    objectType?.kind === "typeParameterType" ||
    objectType?.kind === "unknownType"
  ) {
    return false;
  }

  return true;
};

/**
 * Emit a member access expression as CSharpExpressionAst
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value"
): [CSharpExpressionAst, EmitterContext] => {
  // Nullable guard narrowing for member-access expressions.
  const narrowKey = context.narrowedBindings
    ? getMemberAccessNarrowKey(expr)
    : undefined;
  if (narrowKey && context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(narrowKey);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [
          {
            kind: "identifierExpression",
            identifier: escapeCSharpIdentifier(narrowed.name),
          },
          context,
        ];
      }
      return [narrowed.exprAst, context];
    }
  }

  // Property access that targets a CLR runtime union
  if (!expr.isComputed && !expr.isOptional) {
    const prop = expr.property as string;
    const objectType: IrType | undefined = (() => {
      if (expr.object.kind === "identifier" && context.narrowedBindings) {
        const narrowed = context.narrowedBindings.get(expr.object.name);
        if (narrowed?.kind === "rename" && narrowed.type) {
          return narrowed.type;
        }
        if (narrowed?.kind === "expr") {
          return narrowed.type ?? undefined;
        }
      }
      return expr.object.inferredType;
    })();
    if (objectType) {
      const resolvedBase = resolveTypeAlias(stripNullish(objectType), context);
      const isClrUnionName = (name: string): boolean =>
        /^Union_[2-8]$/.test(name) ||
        name === "Union" ||
        name.endsWith(".Union");
      const resolved =
        resolvedBase.kind === "intersectionType"
          ? (resolvedBase.types.find(
              (t): t is Extract<IrType, { kind: "referenceType" }> =>
                t.kind === "referenceType" && isClrUnionName(t.name)
            ) ?? resolvedBase)
          : resolvedBase;
      const members: readonly IrType[] =
        resolved.kind === "unionType"
          ? resolved.types
          : resolved.kind === "referenceType" &&
              isClrUnionName(resolved.name) &&
              resolved.typeArguments &&
              resolved.typeArguments.length >= 2 &&
              resolved.typeArguments.length <= 8
            ? resolved.typeArguments
            : [];

      const arity = members.length;
      if (arity >= 2 && arity <= 8) {
        const memberHasProperty = members.map((m) => {
          if (m.kind !== "referenceType") return false;
          const props = getAllPropertySignatures(m, context);
          if (props) return props.some((p) => p.name === prop);
          const fromBindings = hasPropertyFromBindingsRegistry(
            m,
            prop,
            context
          );
          return fromBindings ?? false;
        });
        const count = memberHasProperty.filter(Boolean).length;

        if (count === arity || count === 1) {
          const [objectAst, newContext] = emitExpressionAst(
            expr.object,
            context
          );
          const escapedProp = emitMemberName(
            expr.object,
            objectType,
            prop,
            context,
            usage
          );

          if (count === arity) {
            // All members have the property: use Match lambda
            const lambdaArgs = members.map(
              (_, i): CSharpExpressionAst => ({
                kind: "lambdaExpression",
                isAsync: false,
                parameters: [{ name: `__m${i + 1}` }],
                body: {
                  kind: "memberAccessExpression",
                  expression: {
                    kind: "identifierExpression",
                    identifier: `__m${i + 1}`,
                  },
                  memberName: escapedProp,
                },
              })
            );
            return [
              {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: objectAst,
                  memberName: "Match",
                },
                arguments: lambdaArgs,
              },
              newContext,
            ];
          }

          const armIndex = memberHasProperty.findIndex(Boolean);
          if (armIndex >= 0) {
            const asMethod = emitCSharpName(
              `As${armIndex + 1}`,
              "methods",
              context
            );
            // receiver.AsN().prop
            return [
              {
                kind: "memberAccessExpression",
                expression: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: objectAst,
                    memberName: asMethod,
                  },
                  arguments: [],
                },
                memberName: escapedProp,
              },
              newContext,
            ];
          }
        }
      }
    }
  }

  // Check if this is a hierarchical member binding
  if (expr.memberBinding) {
    const { type, member } = expr.memberBinding;
    const escapedMember = escapeCSharpIdentifier(member);

    if (isStaticTypeReference(expr, context)) {
      // Static access: emit full CLR type and member with global:: prefix
      return [
        {
          kind: "identifierExpression",
          identifier: `global::${type}.${escapedMember}`,
        },
        context,
      ];
    } else {
      // Instance access: emit object.ClrMemberName
      const [objectAst, newContext] = emitExpressionAst(expr.object, context);
      if (expr.isOptional) {
        return [
          {
            kind: "conditionalMemberAccessExpression",
            expression: objectAst,
            memberName: escapedMember,
          },
          newContext,
        ];
      }
      return [
        {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: escapedMember,
        },
        newContext,
      ];
    }
  }

  const [objectAst, newContext] = emitExpressionAst(expr.object, context);

  if (expr.isComputed) {
    const accessKind = expr.accessKind;
    if (accessKind === undefined || accessKind === "unknown") {
      throw new Error(
        `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
          `(accessKind=${accessKind ?? "undefined"}).`
      );
    }

    const indexContext = { ...newContext, isArrayIndex: true };
    const [propAst, contextWithIndex] = emitExpressionAst(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };

    if (accessKind === "dictionary") {
      if (expr.isOptional) {
        return [
          {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          },
          finalContext,
        ];
      }
      return [
        {
          kind: "elementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }

    // HARD GATE: clrIndexer + stringChar require Int32 proof
    const indexExpr = expr.property as IrExpression;
    if (!hasInt32Proof(indexExpr)) {
      const propText = printExpression(propAst);
      throw new Error(
        `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
          `Expression '${propText}' has no Int32 proof. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    if (accessKind === "stringChar") {
      // str[i] returns char in C#, but string in TypeScript. Convert char → string.
      const elementAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalElementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          }
        : {
            kind: "elementAccessExpression",
            expression: objectAst,
            arguments: [propAst],
          };
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: elementAccess,
            memberName: "ToString",
          },
          arguments: [],
        },
        finalContext,
      ];
    }

    if (expr.isOptional) {
      return [
        {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        },
        finalContext,
      ];
    }
    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  // Property access
  const prop = expr.property as string;
  const objectType = expr.object.inferredType;

  // Handle explicit interface view properties (As_IInterface)
  if (isExplicitViewProperty(prop)) {
    const interfaceName = extractInterfaceNameFromView(prop);
    if (interfaceName) {
      // Emit as C# interface cast: ((IInterface)obj)
      const interfaceType: IrType = {
        kind: "referenceType",
        name: interfaceName,
      };
      const [interfaceTypeAst, ctxAfterType] = emitTypeAst(
        interfaceType,
        newContext
      );
      return [
        {
          kind: "castExpression",
          type: interfaceTypeAst,
          expression: objectAst,
        },
        ctxAfterType,
      ];
    }
  }

  // Regular property access
  const memberName = emitMemberName(
    expr.object,
    objectType,
    prop,
    context,
    usage
  );

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalMemberAccessExpression",
        expression: objectAst,
        memberName,
      },
      newContext,
    ];
  }

  return [
    {
      kind: "memberAccessExpression",
      expression: objectAst,
      memberName,
    },
    newContext,
  ];
};

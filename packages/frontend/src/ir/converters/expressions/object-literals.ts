/**
 * Object literal expression converter
 */

import * as ts from "typescript";
import {
  IrClassMember,
  IrFunctionType,
  IrObjectExpression,
  IrObjectProperty,
  IrDictionaryType,
  IrType,
  IrExpression,
} from "../../types.js";
import { getSourceSpan, getContextualType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { checkSynthesisEligibility } from "../anonymous-synthesis.js";
import type { ProgramContext } from "../../program-context.js";
import { createDiagnostic } from "../../../types/diagnostic.js";
import { convertAccessorProperty } from "../statements/declarations/classes/properties.js";
import { createObjectLiteralMethodArgumentPrelude } from "../../../object-literal-method-runtime.js";
import {
  getPropertyExpectedType,
  selectObjectLiteralContextualType,
  resolveObjectLiteralMemberKey,
  methodUsesObjectLiteralThis,
  buildObjectLiteralMethodFunctionType,
  getProvisionalAccessorPropertyType,
  collectSynthesizedObjectMembers,
  finalizeObjectLiteralMethodExpression,
  rebindObjectLiteralThisInClassMember,
  rebindObjectLiteralThisInExpression,
} from "./object-literal-helpers.js";

/**
 * Convert object literal expression
 *
 * If no contextual nominal type exists and the literal is eligible for synthesis,
 * a synthetic type is generated and used as the contextual type.
 *
 * Threads expectedType to property values when the expected type is an objectType.
 */
export const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  ctx: ProgramContext,
  expectedType?: IrType
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];
  const behaviorMembers: IrClassMember[] = [];
  const pendingMethods: {
    readonly key: string | IrExpression;
    readonly keyName: string;
    readonly node: ts.MethodDeclaration;
    readonly propExpectedType: IrType | undefined;
    readonly capturesObjectLiteralThis: boolean;
    readonly functionType: IrFunctionType;
  }[] = [];
  const accessorGroups = new Map<
    string,
    {
      getter?: ts.GetAccessorDeclaration;
      setter?: ts.SetAccessorDeclaration;
    }
  >();

  // Contextual type priority:
  // 1) expectedType threaded from the parent converter (return, assignment, parameter, etc.)
  // 2) AST-based contextual typing from explicit TypeNodes (getContextualType)
  const contextualCandidateRaw = expectedType ?? getContextualType(node, ctx);
  const literalKeys = node.properties
    .map((prop) => {
      if (ts.isPropertyAssignment(prop)) {
        return resolveObjectLiteralMemberKey(prop.name, ctx).keyName;
      }
      if (ts.isShorthandPropertyAssignment(prop)) {
        return prop.name.text;
      }
      if (ts.isMethodDeclaration(prop)) {
        return resolveObjectLiteralMemberKey(prop.name, ctx).keyName;
      }
      if (
        ts.isGetAccessorDeclaration(prop) ||
        ts.isSetAccessorDeclaration(prop)
      ) {
        return resolveObjectLiteralMemberKey(prop.name, ctx).keyName;
      }
      return undefined;
    })
    .filter((key): key is string => key !== undefined);

  // Type parameters are NOT valid instantiation targets for object literals.
  //
  // If we treat `T` as a contextual nominal type, the emitter can end up producing
  // `new T { ... }`, which is not valid C# and is not CLR-faithful.
  //
  // Example:
  //   export function id<T>(x: T): T { return x; }
  //   export const v = id({ ok: true });
  //
  // We must synthesize a nominal `__Anon_*` type for the literal so `T` can be
  // inferred deterministically from the argument type.
  const contextualCandidate =
    contextualCandidateRaw?.kind === "typeParameterType"
      ? undefined
      : selectObjectLiteralContextualType(
          contextualCandidateRaw,
          literalKeys,
          ctx
        );

  // `object`/`any`/`unknown` are not valid nominal instantiation targets for object literals.
  //
  // Historically we treated these as "no contextual type" and relied on TSN7403 synthesis to
  // produce a nominal `__Anon_*` type. That works for many cases, but it is a poor fit when
  // the target surface is truly dynamic (e.g. JSON payloads passed as `unknown`).
  //
  // For those dynamic contexts, we deterministically lower a "plain" object literal to a
  // Dictionary<string, object?> shape. This is:
  // - a valid CLR instantiation target (unlike `object`)
  // - stable and structurally faithful to JS object semantics for string keys
  // - AOT-friendly (no runtime reflection required by downstream libraries)
  //
  // Non-plain literals (spreads, computed keys) still fall back to TSN7403 synthesis.
  const isObjectLikeContext =
    contextualCandidate?.kind === "anyType" ||
    contextualCandidate?.kind === "unknownType" ||
    (contextualCandidate?.kind === "referenceType" &&
      contextualCandidate.name === "object");

  const isPlainObjectLiteralAst = node.properties.every(
    (p) =>
      (ts.isPropertyAssignment(p) &&
        !ts.isComputedPropertyName(p.name) &&
        (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) ||
      ts.isShorthandPropertyAssignment(p)
  );

  const shouldLowerToDictionary =
    isObjectLikeContext && isPlainObjectLiteralAst;
  const dictionaryValueExpectedType: IrType = { kind: "unknownType" };

  const getObjectLiteralPropertyExpectedType = (
    keyName: string | undefined
  ): IrType | undefined =>
    keyName
      ? (getPropertyExpectedType(keyName, expectedType, ctx) ??
        (shouldLowerToDictionary ? dictionaryValueExpectedType : undefined))
      : shouldLowerToDictionary
        ? dictionaryValueExpectedType
        : undefined;

  // Track if we have any spreads (needed for emitter IIFE lowering)
  let hasSpreads = false;

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const { key, keyName } = resolveObjectLiteralMemberKey(prop.name, ctx);

      const propExpectedType = getObjectLiteralPropertyExpectedType(keyName);

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer, ctx, propExpectedType),
        shorthand: false,
      });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      // DETERMINISTIC: Derive identifier type from the VALUE being assigned, not the property
      // For { value }, we need to get the type of the variable `value`, not the property `value`
      // Prefer lexical flow/local env types first so shorthand properties preserve
      // exact narrowed/inferred local types from earlier statements in the block.
      const declId = ctx.binding.resolveShorthandAssignment(prop);
      let inferredType: IrType | undefined;

      if (declId) {
        const fromEnv = ctx.typeEnv?.get(declId.id);
        if (
          fromEnv &&
          fromEnv.kind !== "unknownType" &&
          fromEnv.kind !== "anyType"
        ) {
          inferredType = fromEnv;
        } else {
          const typeSystem = ctx.typeSystem;
          const declType = typeSystem.typeOfDecl(declId);
          // If TypeSystem returns unknownType, treat as not found
          if (declType.kind !== "unknownType") {
            inferredType = declType;
          }
        }
      }

      properties.push({
        kind: "property",
        key: prop.name.text,
        value: {
          kind: "identifier",
          name: prop.name.text,
          inferredType,
          sourceSpan: getSourceSpan(prop.name),
          declId,
        },
        shorthand: true,
      });
    } else if (ts.isSpreadAssignment(prop)) {
      hasSpreads = true;
      properties.push({
        kind: "spread",
        expression: convertExpression(prop.expression, ctx, undefined),
      });
    } else if (ts.isMethodDeclaration(prop)) {
      const { key, keyName } = resolveObjectLiteralMemberKey(prop.name, ctx);

      if (!keyName) {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7403",
            "error",
            "Object literal cannot be synthesized: computed method key is not a deterministically known string/number literal",
            getSourceSpan(prop),
            "Use an identifier, string literal key, or explicit type annotation."
          )
        );
        return;
      }

      const propExpectedType = getObjectLiteralPropertyExpectedType(keyName);
      pendingMethods.push({
        key,
        keyName,
        node: prop,
        propExpectedType,
        capturesObjectLiteralThis: methodUsesObjectLiteralThis(prop),
        functionType: buildObjectLiteralMethodFunctionType(
          prop,
          ctx,
          propExpectedType
        ),
      });
    } else if (
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      const { keyName: memberName } = resolveObjectLiteralMemberKey(
        prop.name,
        ctx
      );
      if (!memberName) {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7403",
            "error",
            "Object literal cannot be synthesized: computed accessor key is not a deterministically known string/number literal",
            getSourceSpan(prop),
            "Use an identifier, string literal key, or explicit type annotation."
          )
        );
        return;
      }

      const existing = accessorGroups.get(memberName) ?? {};
      if (ts.isGetAccessorDeclaration(prop)) {
        existing.getter = prop;
      } else {
        existing.setter = prop;
      }
      accessorGroups.set(memberName, existing);
    }
  });

  const provisionalAccessorTypeFromContext = Array.from(
    accessorGroups.entries()
  ).map(([memberName, group]) => ({
    memberName,
    getter: group.getter,
    setter: group.setter,
    propertyType: getProvisionalAccessorPropertyType(
      memberName,
      group.getter,
      group.setter,
      getObjectLiteralPropertyExpectedType(memberName),
      ctx,
      undefined
    ),
  }));

  const baselineObjectLiteralThisType = (() => {
    const synthesized = collectSynthesizedObjectMembers(
      properties,
      pendingMethods,
      provisionalAccessorTypeFromContext.filter(
        (accessor) => accessor.propertyType !== undefined
      ) as readonly {
        readonly memberName: string;
        readonly propertyType: IrType;
      }[],
      accessorGroups.size > 0
    );
    if (!synthesized.ok || !synthesized.members) return undefined;
    return {
      kind: "objectType" as const,
      members: synthesized.members,
    };
  })();

  const pendingAccessors = Array.from(accessorGroups.entries()).map(
    ([memberName, group]) => ({
      memberName,
      getter: group.getter,
      setter: group.setter,
      propertyType: getProvisionalAccessorPropertyType(
        memberName,
        group.getter,
        group.setter,
        getObjectLiteralPropertyExpectedType(memberName),
        ctx,
        baselineObjectLiteralThisType
      ),
    })
  );

  let contextualType = contextualCandidate;

  if (isObjectLikeContext) {
    contextualType = shouldLowerToDictionary
      ? ({
          kind: "dictionaryType",
          keyType: { kind: "primitiveType", name: "string" },
          valueType: { kind: "unknownType" },
        } satisfies IrDictionaryType)
      : undefined;
  }

  // If no contextual type, check if eligible for synthesis
  // DETERMINISTIC IR TYPING (INV-0 compliant): Uses AST-based synthesis
  if (!contextualType) {
    const eligibility = checkSynthesisEligibility(node, ctx);
    if (!eligibility.eligible) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7403",
          "error",
          `Object literal cannot be synthesized: ${eligibility.reason}`,
          getSourceSpan(node),
          "Use an explicit type annotation, or restructure to use only identifier keys, string literal keys, spread identifiers with type annotations, and function-valued properties."
        )
      );
    } else {
      const synthesized = collectSynthesizedObjectMembers(
        properties,
        pendingMethods,
        pendingAccessors,
        pendingAccessors.length > 0
      );

      if (synthesized.ok && synthesized.members) {
        contextualType = {
          kind: "objectType",
          members: synthesized.members,
        };
      } else {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7403",
            "error",
            `Object literal cannot be synthesized: ${synthesized.failureReason ?? "not supported in this context"}`,
            getSourceSpan(node),
            "Use an explicit type annotation, or restructure to use only identifier keys, string literal keys, spread identifiers with type annotations, and function-valued properties."
          )
        );
      }
    }
  }

  const objectLiteralThisType =
    contextualType && contextualType.kind !== "dictionaryType"
      ? contextualType
      : undefined;
  const objectBehaviorContext = objectLiteralThisType
    ? { ...ctx, objectLiteralThisType }
    : ctx;
  const resolvedMethodTypes = new Map<string, IrFunctionType>();

  for (const pendingMethod of pendingMethods) {
    const methodPrelude = createObjectLiteralMethodArgumentPrelude(
      pendingMethod.node
    );
    const methodBody = pendingMethod.node.body
      ? methodPrelude.length > 0
        ? ts.factory.updateBlock(pendingMethod.node.body, [
            ...methodPrelude,
            ...pendingMethod.node.body.statements,
          ])
        : pendingMethod.node.body
      : ts.factory.createBlock(methodPrelude, true);
    const methodModifiers = pendingMethod.node.modifiers?.filter(ts.isModifier);
    const methodAsFunctionExpr = ts.setTextRange(
      ts.factory.createFunctionExpression(
        methodModifiers,
        pendingMethod.node.asteriskToken,
        undefined,
        pendingMethod.node.typeParameters,
        pendingMethod.node.parameters,
        pendingMethod.node.type,
        methodBody
      ),
      pendingMethod.node
    );
    const convertedValue = finalizeObjectLiteralMethodExpression(
      convertExpression(
        methodAsFunctionExpr,
        objectBehaviorContext,
        pendingMethod.propExpectedType
      )
    );

    if (
      convertedValue.kind === "functionExpression" &&
      convertedValue.inferredType?.kind === "functionType"
    ) {
      resolvedMethodTypes.set(
        pendingMethod.keyName,
        convertedValue.inferredType
      );
    }

    properties.push({
      kind: "property",
      key: pendingMethod.key,
      value:
        convertedValue.kind === "functionExpression" &&
        pendingMethod.capturesObjectLiteralThis
          ? {
              ...convertedValue,
              capturesObjectLiteralThis: true,
            }
          : convertedValue,
      shorthand: false,
    });
  }

  for (const pendingAccessor of pendingAccessors) {
    behaviorMembers.push(
      convertAccessorProperty(
        pendingAccessor.memberName,
        pendingAccessor.getter,
        pendingAccessor.setter,
        objectBehaviorContext,
        undefined
      )
    );
  }

  if (contextualType?.kind === "objectType" && resolvedMethodTypes.size > 0) {
    contextualType = {
      ...contextualType,
      members: contextualType.members.map((member) => {
        if (member.kind !== "propertySignature") return member;
        const resolvedMethodType = resolvedMethodTypes.get(member.name);
        if (!resolvedMethodType) return member;
        return {
          ...member,
          type: resolvedMethodType,
        };
      }),
    };
  }

  const finalObjectLiteralThisType =
    contextualType && contextualType.kind !== "dictionaryType"
      ? contextualType
      : undefined;
  const finalProperties = finalObjectLiteralThisType
    ? properties.map((property) =>
        property.kind === "property" &&
        property.value.kind === "functionExpression" &&
        property.value.capturesObjectLiteralThis
          ? {
              ...property,
              value: rebindObjectLiteralThisInExpression(
                property.value,
                finalObjectLiteralThisType
              ),
            }
          : property
      )
    : properties;
  const finalBehaviorMembers = finalObjectLiteralThisType
    ? behaviorMembers.map((member) =>
        rebindObjectLiteralThisInClassMember(
          member,
          finalObjectLiteralThisType
        )
      )
    : behaviorMembers;

  // DETERMINISTIC TYPING: Object's inferredType comes from contextualType
  // (which may be from LHS annotation or synthesized type).
  // We don't derive from properties because that would require TS inference.
  return {
    kind: "object",
    properties: finalProperties,
    behaviorMembers:
      finalBehaviorMembers.length > 0 ? finalBehaviorMembers : undefined,
    inferredType: contextualType, // Use contextual type if available
    sourceSpan: getSourceSpan(node),
    contextualType,
    hasSpreads, // Add flag for emitter to know about spreads
  };
};

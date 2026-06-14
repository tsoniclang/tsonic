/**
 * Object literal expression converter
 */

import {
  getTstsIdentifierText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrClassMember,
  IrFunctionType,
  IrObjectExpression,
  IrObjectProperty,
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
import { selectUnionArm } from "../union-arm-selection.js";
import {
  getPropertyExpectedType,
  selectObjectLiteralContextualType,
  collectObjectLiteralPrimitiveValues,
  resolveObjectLiteralMemberKey,
  methodUsesObjectLiteralThis,
  buildObjectLiteralMethodFunctionType,
  getProvisionalAccessorPropertyType,
  collectSynthesizedObjectMembers,
  finalizeObjectLiteralMethodExpression,
  rebindObjectLiteralThisInClassMember,
  rebindObjectLiteralThisInExpression,
} from "./object-literal-helpers.js";
import { isAttributeMetadataNamedArgumentObjectLiteral } from "./attribute-metadata-context.js";
import { convertFunctionExpression } from "./functions.js";

const isDirectBroadObjectLiteralContext = (
  type: IrType | undefined
): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "anyType" || type.kind === "unknownType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  if (
    type.structuralMembers?.some(
      (member) => member.kind === "propertySignature"
    )
  ) {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  if (
    simpleName === "object" ||
    simpleName === "Object" ||
    simpleName === "JsValue"
  ) {
    return true;
  }

  return type.typeId?.sourceName === "Object";
};

const containsBroadObjectLiteralContext = (
  type: IrType | undefined
): boolean => {
  if (!type) {
    return false;
  }

  if (isDirectBroadObjectLiteralContext(type)) {
    return true;
  }

  if (type.kind === "unionType") {
    return type.types.some((member) =>
      containsBroadObjectLiteralContext(member)
    );
  }

  return false;
};

const contextualTypeContainsBroadObjectLiteralContext = (
  type: IrType | undefined,
  ctx: ProgramContext
): boolean => {
  if (!type) {
    return false;
  }

  if (containsBroadObjectLiteralContext(type)) {
    return true;
  }

  return ctx.typeSystem
    .collectNarrowingCandidates(type)
    .some((candidate) => containsBroadObjectLiteralContext(candidate));
};

const isJsValueContext = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "referenceType") {
    return (
      type.name === "JsValue" ||
      type.typeId?.sourceName === "JsValue" ||
      type.providerQualifiedName === "core:Object"
    );
  }

  return (
    type.kind === "unionType" &&
    type.types.some((member) => isJsValueContext(member))
  );
};

const createJsValueReferenceType = (): IrType => ({
  kind: "referenceType",
  name: "JsValue",
  providerQualifiedName: "core:Object",
  structuralOrigin: "namedReference",
});

const createDynamicJsonObjectType = (): IrType => ({
  kind: "dictionaryType",
  keyType: { kind: "primitiveType", name: "string" },
  valueType: createJsValueReferenceType(),
});

const isObjectLiteralContextualTypeCandidate = (
  type: IrType | undefined
): boolean => {
  if (!type) {
    return true;
  }

  switch (type.kind) {
    case "anyType":
    case "unknownType":
    case "objectType":
    case "referenceType":
    case "dictionaryType":
    case "unionType":
    case "intersectionType":
    case "typeParameterType":
      return true;
    default:
      return false;
  }
};

/**
 * Convert object literal expression
 *
 * If no contextual nominal type exists and the literal is eligible for synthesis,
 * a synthetic type is generated and used as the contextual type.
 *
 * Threads expectedType to property values when the expected type is an objectType.
 */
export const convertObjectLiteral = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedType?: IrType
): IrObjectExpression => {
  const objectProperties = TstsSyntax.Node_Properties(node) ?? [];
  const properties: IrObjectProperty[] = [];
  const behaviorMembers: IrClassMember[] = [];
  const emitAsAnonymousObject = (ctx.expressionTreeLambdaDepth ?? 0) > 0;
  const pendingMethods: {
    readonly key: string | IrExpression;
    readonly keyName: string;
    readonly node: TstsNode;
    readonly propExpectedType: IrType | undefined;
    readonly capturesObjectLiteralThis: boolean;
    readonly functionType: IrFunctionType;
  }[] = [];
  const accessorGroups = new Map<
    string,
    {
      getter?: TstsNode;
      setter?: TstsNode;
    }
  >();

  // Contextual type priority:
  // 1) expectedType threaded from the parent converter (return, assignment, parameter, etc.)
  // 2) AST-based contextual typing from explicit TypeNodes (getContextualType)
  const shouldSuppressContextualType =
    ctx.suppressObjectLiteralContextualTypeNodes?.has(node) ||
    isAttributeMetadataNamedArgumentObjectLiteral(node, ctx.sourceSemantics);
  const contextualCandidateFromParent =
    expectedType ??
    (shouldSuppressContextualType
      ? undefined
      : getContextualType(node, ctx));
  const hasBroadObjectLiteralContext =
    contextualTypeContainsBroadObjectLiteralContext(
      contextualCandidateFromParent,
      ctx
    );
  const dynamicJsonObjectContext = isJsValueContext(
    contextualCandidateFromParent
  )
    ? createDynamicJsonObjectType()
    : undefined;
  const contextualCandidateRaw = (() => {
    const candidate = dynamicJsonObjectContext ?? contextualCandidateFromParent;
    return isObjectLiteralContextualTypeCandidate(candidate)
      ? candidate
      : undefined;
  })();
  const literalKeys = objectProperties
    .map((prop) => {
      if (!prop) return undefined;
      if (prop.Kind === TstsSyntax.KindPropertyAssignment) {
        const name = TstsSyntax.Node_Name(prop);
        return name ? resolveObjectLiteralMemberKey(name, ctx).keyName : undefined;
      }
      if (prop.Kind === TstsSyntax.KindShorthandPropertyAssignment) {
        return getTstsIdentifierText(TstsSyntax.Node_Name(prop));
      }
      if (prop.Kind === TstsSyntax.KindMethodDeclaration) {
        const name = TstsSyntax.Node_Name(prop);
        return name ? resolveObjectLiteralMemberKey(name, ctx).keyName : undefined;
      }
      if (
        prop.Kind === TstsSyntax.KindGetAccessor ||
        prop.Kind === TstsSyntax.KindSetAccessor
      ) {
        const name = TstsSyntax.Node_Name(prop);
        return name ? resolveObjectLiteralMemberKey(name, ctx).keyName : undefined;
      }
      return undefined;
    })
    .filter((key): key is string => key !== undefined);
  const literalValues = collectObjectLiteralPrimitiveValues(node, ctx);

  if (emitAsAnonymousObject) {
    for (const prop of objectProperties) {
      if (!prop) continue;
      const propName = TstsSyntax.Node_Name(prop);
      const isSupportedAnonymousProperty =
        (prop.Kind === TstsSyntax.KindPropertyAssignment &&
          propName?.Kind !== TstsSyntax.KindComputedPropertyName &&
          (propName?.Kind === TstsSyntax.KindIdentifier ||
            propName?.Kind === TstsSyntax.KindStringLiteral)) ||
        prop.Kind === TstsSyntax.KindShorthandPropertyAssignment;
      if (isSupportedAnonymousProperty) {
        continue;
      }

      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7403",
          "error",
          "Expression-tree object literal must use only identifier or string-literal data properties.",
          getSourceSpan(prop),
          "Use a plain object literal such as ({ Id: row.Id, Name: row.Name })."
        )
      );
    }
  }

  // Type parameters are NOT valid instantiation targets for object literals.
  //
  // If we treat `T` as a contextual nominal type, the emitter can end up producing
  // `new T { ... }`, which is not valid target output and is not native target-faithful.
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
          ctx,
          literalValues
        );

  const getObjectLiteralPropertyExpectedType = (
    keyName: string | undefined
  ): IrType | undefined =>
    keyName
      ? getPropertyExpectedType(
          keyName,
          contextualCandidateRaw ?? expectedType,
          ctx
        )
      : undefined;

  // Track if we have any spreads (needed for emitter IIFE lowering)
  let hasSpreads = false;

  objectProperties.forEach((prop) => {
    if (!prop) return;
    if (prop.Kind === TstsSyntax.KindPropertyAssignment) {
      const propName = TstsSyntax.Node_Name(prop);
      const initializer = TstsSyntax.Node_Initializer(prop);
      if (!propName || !initializer) return;
      const { key, keyName } = resolveObjectLiteralMemberKey(propName, ctx);

      const propExpectedType = getObjectLiteralPropertyExpectedType(keyName);

      properties.push({
        kind: "property",
        key,
        value: convertExpression(initializer, ctx, propExpectedType),
        shorthand: false,
      });
    } else if (prop.Kind === TstsSyntax.KindShorthandPropertyAssignment) {
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
      const propName = TstsSyntax.Node_Name(prop);
      const nameText = getTstsIdentifierText(propName) ?? "";

      properties.push({
        kind: "property",
        key: nameText,
        value: {
          kind: "identifier",
          name: nameText,
          inferredType,
          sourceSpan: propName ? getSourceSpan(propName) : getSourceSpan(prop),
          declId,
        },
        shorthand: true,
      });
    } else if (prop.Kind === TstsSyntax.KindSpreadAssignment) {
      const spreadExpression = TstsSyntax.AsSpreadAssignment(prop)?.Expression;
      if (!spreadExpression) return;
      hasSpreads = true;
      properties.push({
        kind: "spread",
        expression: convertExpression(spreadExpression, ctx, undefined),
      });
    } else if (prop.Kind === TstsSyntax.KindMethodDeclaration) {
      const propName = TstsSyntax.Node_Name(prop);
      if (!propName) return;
      const { key, keyName } = resolveObjectLiteralMemberKey(propName, ctx);

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
      prop.Kind === TstsSyntax.KindGetAccessor ||
      prop.Kind === TstsSyntax.KindSetAccessor
    ) {
      const propName = TstsSyntax.Node_Name(prop);
      if (!propName) return;
      const { keyName: memberName } = resolveObjectLiteralMemberKey(
        propName,
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
      if (prop.Kind === TstsSyntax.KindGetAccessor) {
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

  if (
    hasBroadObjectLiteralContext &&
    !dynamicJsonObjectContext &&
    !emitAsAnonymousObject &&
    contextualTypeContainsBroadObjectLiteralContext(contextualType, ctx)
  ) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN7403",
        "error",
        "Object literal cannot target a broad runtime object type deterministically.",
        getSourceSpan(node),
        "Use a concrete object type, dictionary type, or expression-tree projection context."
      )
    );
    contextualType = undefined;
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
    const convertedValue = finalizeObjectLiteralMethodExpression(
      convertFunctionExpression(
        pendingMethod.node,
        objectBehaviorContext,
        pendingMethod.propExpectedType
      )
    );
    const methodPrelude =
      convertedValue.kind === "functionExpression"
        ? createObjectLiteralMethodArgumentPrelude(
            pendingMethod.node,
            convertedValue.parameters
          )
        : [];
    const convertedValueWithPrelude =
      convertedValue.kind === "functionExpression" && methodPrelude.length > 0
        ? {
            ...convertedValue,
            body: {
              ...convertedValue.body,
              statements: [
                ...methodPrelude,
                ...convertedValue.body.statements,
              ],
            },
          }
        : convertedValue;

    if (
      convertedValueWithPrelude.kind === "functionExpression" &&
      convertedValueWithPrelude.inferredType?.kind === "functionType"
    ) {
      resolvedMethodTypes.set(
        pendingMethod.keyName,
        convertedValueWithPrelude.inferredType
      );
    }

    properties.push({
      kind: "property",
      key: pendingMethod.key,
      value:
        convertedValueWithPrelude.kind === "functionExpression" &&
        pendingMethod.capturesObjectLiteralThis
          ? {
              ...convertedValueWithPrelude,
              capturesObjectLiteralThis: true,
            }
          : convertedValueWithPrelude,
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
        rebindObjectLiteralThisInClassMember(member, finalObjectLiteralThisType)
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
    armSelection:
      contextualType && expectedType?.kind === "unionType"
        ? selectUnionArm({
            kind: "semanticProjection",
            sourceType: contextualType,
            targetUnion: expectedType,
          })
        : undefined,
    hasSpreads, // Add flag for emitter to know about spreads
    emitAsAnonymousObject: emitAsAnonymousObject || undefined,
  };
};

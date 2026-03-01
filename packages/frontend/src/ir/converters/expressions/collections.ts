/**
 * Collection expression converters (arrays and objects)
 */

import * as ts from "typescript";
import {
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
  IrDictionaryType,
  IrType,
  IrExpression,
} from "../../types.js";
import { typesEqual } from "../../types/ir-substitution.js";
import { getSourceSpan, getContextualType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  checkSynthesisEligibility,
  PropertyInfo,
} from "../anonymous-synthesis.js";
import { NumericKind } from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";
import { createDiagnostic } from "../../../types/diagnostic.js";

/**
 * Compute the element type for an array literal from its elements' types.
 *
 * Rules:
 * 1. All numeric literals with same intent → use that intent (int, long, double)
 * 2. Mixed Int32/Int64 → Int64
 * 3. Any Double present → double
 * 4. String literals → string
 * 5. Boolean literals → boolean
 * 6. Mixed or complex → fall back to TS inference
 */
const computeArrayElementType = (
  elements: readonly (IrExpression | undefined)[],
  fallbackType: IrType | undefined
): IrType | undefined => {
  // Filter out holes and spreads for type analysis
  const regularElements = elements.filter(
    (e): e is IrExpression => e !== undefined && e.kind !== "spread"
  );

  if (regularElements.length === 0) {
    // Empty array - use fallback
    return fallbackType;
  }

  // Check if all elements are numeric literals
  const numericIntents: NumericKind[] = [];
  let allNumericLiterals = true;
  let allStringLiterals = true;
  let allBooleanLiterals = true;

  for (const elem of regularElements) {
    if (elem.kind === "literal") {
      if (typeof elem.value === "number" && elem.numericIntent) {
        numericIntents.push(elem.numericIntent);
        allStringLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "string") {
        allNumericLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "boolean") {
        allNumericLiterals = false;
        allStringLiterals = false;
      } else {
        // null or other literal
        allNumericLiterals = false;
        allStringLiterals = false;
        allBooleanLiterals = false;
      }
    } else {
      // Non-literal element - can't determine type deterministically from literals
      allNumericLiterals = false;
      allStringLiterals = false;
      allBooleanLiterals = false;
    }
  }

  // All numeric literals - determine widest type
  if (allNumericLiterals && numericIntents.length > 0) {
    // Any Double → number (emits as "double" in C#)
    if (
      numericIntents.includes("Double") ||
      numericIntents.includes("Single")
    ) {
      return { kind: "primitiveType", name: "number" };
    }
    // Any Int64/UInt64 → fall back to TS inference (no primitive for long)
    if (numericIntents.includes("Int64") || numericIntents.includes("UInt64")) {
      return fallbackType;
    }
    // All Int32 or smaller → int
    return { kind: "primitiveType", name: "int" };
  }

  // All string literals
  if (allStringLiterals) {
    return { kind: "primitiveType", name: "string" };
  }

  // All boolean literals
  if (allBooleanLiterals) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Mixed or complex - fall back to TS inference
  // If all elements have a deterministically known IR type and they match, use it.
  // This enables arrays like `[wrap(1), wrap(2)]` to infer `Container<int>[]`
  // instead of defaulting to `number[]`.
  const knownTypes: IrType[] = [];
  for (const elem of regularElements) {
    const t = elem.inferredType;
    if (!t || t.kind === "unknownType") {
      return fallbackType;
    }
    knownTypes.push(t);
  }

  const first = knownTypes[0];
  if (first && knownTypes.every((t) => typesEqual(first, t))) {
    return first;
  }

  return fallbackType;
};

/**
 * Convert array literal expression
 *
 * DETERMINISTIC TYPING:
 * - If expectedType is provided (from LHS annotation), use it
 * - Otherwise, derive from element types using literal form analysis
 * - Default to number[] (double[]) for ergonomics when type cannot be determined
 *
 * @param node - The TypeScript array literal expression
 * @param ctx - ProgramContext for type system and binding access
 * @param expectedType - Expected type from context (e.g., `const a: number[] = [1,2,3]`).
 *                       Pass `undefined` explicitly when no contextual type exists.
 */
export const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrArrayExpression => {
  // Determine element expected type from array expected type
  const expectedElementType =
    expectedType?.kind === "arrayType" ? expectedType.elementType : undefined;

  // Convert all elements, passing expected element type for contextual typing
  const elements = node.elements.map((elem) => {
    if (ts.isOmittedExpression(elem)) {
      return undefined; // Hole in sparse array
    }
    if (ts.isSpreadElement(elem)) {
      // Spread element - convert and derive type from expression
      const spreadExpr = convertExpression(elem.expression, ctx, expectedType);
      return {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(elem),
      };
    }
    return convertExpression(elem, ctx, expectedElementType);
  });

  // DETERMINISTIC TYPING: Determine inferredType using priority:
  // 1. Expected type from context (e.g., LHS annotation, parameter type)
  // 2. Literal-form inference (derive from element types)
  // 3. Default: number[] (double[]) for ergonomics
  const inferredType: IrType | undefined =
    expectedType?.kind === "arrayType"
      ? expectedType
      : (() => {
          // No expected type - derive from element types
          const elementType = computeArrayElementType(elements, undefined);
          if (elementType) {
            return { kind: "arrayType" as const, elementType };
          }
          // Default to number[] (double[]) for ergonomics
          // This matches Alice's guidance: untyped arrays default to double[]
          return {
            kind: "arrayType" as const,
            elementType: {
              kind: "primitiveType" as const,
              name: "number" as const,
            },
          };
        })();

  return {
    kind: "array",
    elements,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Get the expected type for an object property from the parent expected type.
 *
 * If expectedType is an objectType, looks up the property member directly.
 * If expectedType is a referenceType, we can't resolve it here (would need symbol table).
 */
const getPropertyExpectedType = (
  propName: string,
  expectedType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!expectedType) return undefined;

  if (expectedType.kind === "objectType") {
    // Direct member lookup - only check property signatures (not methods)
    const member = expectedType.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  if (expectedType.kind === "referenceType") {
    // Use TypeSystem to resolve nominal members deterministically, including inherited members
    // and generic substitutions (e.g., `DeepContainer<T>.level1`).
    const memberType = ctx.typeSystem.typeOfMember(expectedType, {
      kind: "byName",
      name: propName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  if (expectedType.kind === "dictionaryType") {
    // Thread dictionary value type to values (for nested object literal lowering).
    // Example: Record<string, unknown> → nested objects should lower deterministically.
    return expectedType.valueType;
  }

  return undefined;
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
  node: ts.ObjectLiteralExpression,
  ctx: ProgramContext,
  expectedType?: IrType
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  // Contextual type priority:
  // 1) expectedType threaded from the parent converter (return, assignment, parameter, etc.)
  // 2) AST-based contextual typing from explicit TypeNodes (getContextualType)
  const contextualCandidateRaw = expectedType ?? getContextualType(node, ctx);

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
      : contextualCandidateRaw;

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

  // Track if we have any spreads (needed for emitter IIFE lowering)
  let hasSpreads = false;

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const keyName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;

      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression, ctx, undefined)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      // Look up property expected type from parent expected type
      const propExpectedType = keyName
        ? (getPropertyExpectedType(keyName, expectedType, ctx) ??
          (shouldLowerToDictionary ? dictionaryValueExpectedType : undefined))
        : shouldLowerToDictionary
          ? dictionaryValueExpectedType
          : undefined;

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer, ctx, propExpectedType),
        shorthand: false,
      });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      // DETERMINISTIC: Derive identifier type from the VALUE being assigned, not the property
      // For { value }, we need to get the type of the variable `value`, not the property `value`
      // ALICE'S SPEC: Use TypeSystem.typeOfDecl() to get the variable's type
      const declId = ctx.binding.resolveShorthandAssignment(prop);
      let inferredType: IrType | undefined;

      if (declId) {
        const typeSystem = ctx.typeSystem;
        const declType = typeSystem.typeOfDecl(declId);
        // If TypeSystem returns unknownType, treat as not found
        if (declType.kind !== "unknownType") {
          inferredType = declType;
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
      const keyName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;

      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression, ctx, undefined)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      const propExpectedType = keyName
        ? (getPropertyExpectedType(keyName, expectedType, ctx) ??
          (shouldLowerToDictionary ? dictionaryValueExpectedType : undefined))
        : shouldLowerToDictionary
          ? dictionaryValueExpectedType
          : undefined;

      const methodModifiers = prop.modifiers?.filter(ts.isModifier);
      const methodAsFunctionExpr = ts.setTextRange(
        ts.factory.createFunctionExpression(
          methodModifiers,
          prop.asteriskToken,
          undefined,
          prop.typeParameters,
          prop.parameters,
          prop.type,
          prop.body ?? ts.factory.createBlock([], true)
        ),
        prop
      );

      properties.push({
        kind: "property",
        key,
        value: convertExpression(methodAsFunctionExpr, ctx, propExpectedType),
        shorthand: false,
      });
    }
  });

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
      // Extract property info from already-converted properties (AST-based)
      const propInfos: PropertyInfo[] = [];
      let canSynthesize = true;
      let synthesisFailureReason: string | undefined;

      for (const prop of properties) {
        if (prop.kind === "property") {
          // Get property name (identifier or computed string-literal keys).
          const keyName =
            typeof prop.key === "string"
              ? prop.key
              : prop.key.kind === "literal" &&
                  typeof prop.key.value === "string"
                ? prop.key.value
                : undefined;
          if (!keyName) {
            canSynthesize = false;
            synthesisFailureReason =
              "Only identifier and computed string-literal keys are supported";
            break;
          }

          // Get type from converted expression's inferredType
          const propType = prop.value.inferredType;
          if (
            !propType ||
            propType.kind === "unknownType" ||
            propType.kind === "anyType"
          ) {
            // Cannot synthesize if property type is unknown/any
            canSynthesize = false;
            synthesisFailureReason = `Property '${keyName}' type cannot be recovered deterministically`;
            break;
          }

          propInfos.push({
            name: keyName,
            type: propType,
            optional: false,
            readonly: false,
          });
        } else if (prop.kind === "spread") {
          // For spreads, merge properties from the spread source's objectType
          const spreadType = prop.expression.inferredType;
          if (spreadType?.kind === "objectType") {
            for (const member of spreadType.members) {
              if (member.kind === "propertySignature") {
                propInfos.push({
                  name: member.name,
                  type: member.type,
                  optional: member.isOptional,
                  readonly: member.isReadonly,
                });
              }
            }
          } else {
            canSynthesize = false;
            synthesisFailureReason =
              "Spread sources must have a deterministically known object literal shape";
            break;
          }
        }
      }

      if (canSynthesize) {
        // DETERMINISTIC: synthesize an objectType shape from the AST, then allow the
        // anonymous-type-lowering pass to generate a nominal type (class) for emission.
        contextualType = {
          kind: "objectType",
          members: propInfos.map((p) => ({
            kind: "propertySignature",
            name: p.name,
            type: p.type,
            isOptional: p.optional,
            isReadonly: p.readonly,
          })),
        };
      } else {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7403",
            "error",
            `Object literal cannot be synthesized: ${synthesisFailureReason ?? "not supported in this context"}`,
            getSourceSpan(node),
            "Use an explicit type annotation, or restructure to use only identifier keys, string literal keys, spread identifiers with type annotations, and function-valued properties."
          )
        );
      }
    }
  }

  // DETERMINISTIC TYPING: Object's inferredType comes from contextualType
  // (which may be from LHS annotation or synthesized type).
  // We don't derive from properties because that would require TS inference.
  return {
    kind: "object",
    properties,
    inferredType: contextualType, // Use contextual type if available
    sourceSpan: getSourceSpan(node),
    contextualType,
    hasSpreads, // Add flag for emitter to know about spreads
  };
};

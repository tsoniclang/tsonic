/**
 * Member access expression emitters
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";
import { emitType } from "../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
} from "../core/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  formatCastOperandText,
  formatPostfixExpressionText,
} from "./parentheses.js";

// ============================================================================
// CONTRACT: Emitter ONLY consumes proof markers.
//
// The emitter MUST NOT re-derive numeric proofs. It only checks IR markers:
// - primitiveType(name="int") - Distinct integer primitive type
// - referenceType(name === "int") - CLR int from .NET interop
//
// NO BigInt parsing, NO parseInt, NO lexeme (.raw) inspection, NO literal
// special-casing, NO loop-var tables. If the proof pass didn't annotate it,
// the emitter ICEs. Period.
//
// The numeric proof pass is the ONLY source of numeric proofs.
// ============================================================================

/**
 * Check if an expression has proven Int32 type from the numeric proof pass.
 * The emitter MUST NOT re-derive proofs - it only checks markers set by the proof pass.
 * This is the SINGLE source of truth for numeric proofs in the emitter.
 *
 * INVARIANT: `int` is a distinct primitive type, NOT `number` with numericIntent.
 */
const hasInt32Proof = (expr: IrExpression): boolean => {
  // Check primitiveType(name="int") - distinct integer primitive
  if (
    expr.inferredType?.kind === "primitiveType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  // Check referenceType for CLR int (from .NET interop)
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

  // Namespace imports (import * as M): treat property access as value access to the module container.
  // For non-call usage, prefer "fields" because `M.value` denotes a value export.
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
      return emitCSharpName(memberName, bucketFromMemberKind(localKind), context);
    }
  }

  if (receiverExpr.kind === "identifier") {
    const localKind = lookupMemberKindFromLocalTypes(
      receiverExpr.name,
      memberName,
      context
    );
    if (localKind) {
      return emitCSharpName(memberName, bucketFromMemberKind(localKind), context);
    }
  }

  const receiverFqn = resolveReceiverTypeFqn(receiverExpr, receiverType, context);
  if (receiverFqn) {
    const indexedKind = lookupMemberKindFromIndex(receiverFqn, memberName, context);
    if (indexedKind) {
      return emitCSharpName(memberName, bucketFromMemberKind(indexedKind), context);
    }
  }

  return emitCSharpName(memberName, "properties", context);
};

/**
 * Check if an expression represents a static type reference (not an instance)
 * Static type references are: namespace.Type or direct Type identifiers that resolve to types
 */
const isStaticTypeReference = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  // Imported CLR types/modules are always static receivers in emitted C#.
  // This is true even when the frontend did not attach an inferredType for the identifier.
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding) return true;

    // If this isn't an import and we don't have a receiver type, default to instance.
    // This prevents CLR-bound instance property accesses (e.g. `x.expression`) from
    // incorrectly becoming `Type.Expression`.
    if (!expr.object.inferredType) return false;
  }

  // If the object is an identifier that's a type name (e.g., Console, Enumerable)
  // we need to check if the member binding's type matches what would be
  // accessed statically. For instance access, the object would be a variable.
  //
  // A simple heuristic: if the member binding exists and the object is an identifier
  // or a member access (like System.Console), AND the property name is being looked up
  // on the type itself (not on an instance), it's static.
  //
  // The key insight: for instance calls, the object will have an inferredType that's
  // the CLR type (e.g., List<T>), whereas for static calls the object IS the type.
  //
  // For now, we use the presence of inferredType on the object to detect instance access:
  // - Instance: `numbers.add()` → numbers has inferredType: List<T>
  // - Static: `Console.WriteLine()` → Console doesn't have a meaningful inferredType
  //   (or its inferredType would be "typeof Console" not "Console")
  const objectType = expr.object.inferredType;

  // If object has a value type as inferredType, it's an instance access.
  // This includes:
  // - referenceType: class/interface instances (e.g., List<T>)
  // - arrayType: array instances
  // - intersectionType: tsbindgen-generated types like TypeName$instance & __TypeName$views
  // - primitiveType: string, number, boolean primitives with BCL methods
  // - literalType: string/number/boolean literals like "hello".split()
  if (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    // Type parameters (e.g. `T`) are values at runtime, not static type receivers.
    objectType?.kind === "typeParameterType" ||
    // Unknown still represents a value receiver; never treat as a static type reference.
    objectType?.kind === "unknownType"
  ) {
    return false;
  }

  // Otherwise it's likely a static access (type.member pattern)
  return true;
};

/**
 * Emit a member access expression (dot notation or bracket notation)
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  usage: MemberAccessUsage = "value"
): [CSharpFragment, EmitterContext] => {
  // Check if this is a hierarchical member binding
  if (expr.memberBinding) {
    const { type, member } = expr.memberBinding;

    // Determine if this is a static or instance member access
    if (isStaticTypeReference(expr, context)) {
      // Static access: emit full CLR type and member with global:: prefix
      const text = `global::${type}.${member}`;
      return [{ text }, context];
    } else {
      // Instance access: emit object.ClrMemberName
      const [objectFrag, newContext] = emitExpression(expr.object, context);
      const accessor = expr.isOptional ? "?." : ".";
      const receiverText = formatPostfixExpressionText(
        expr.object,
        objectFrag.text
      );
      const text = `${receiverText}${accessor}${member}`;
      return [{ text }, newContext];
    }
  }

  const [objectFrag, newContext] = emitExpression(expr.object, context);
  const receiverText = formatPostfixExpressionText(expr.object, objectFrag.text);

  if (expr.isComputed) {
    // Check if this is array index access
    const objectType = expr.object.inferredType;
    const isArrayType = objectType?.kind === "arrayType";

    // TypeScript array access - unified for both js and dotnet modes
    // HARD GATE: Index must be proven Int32 (validated by proof pass)
    if (isArrayType) {
      const indexContext = { ...newContext, isArrayIndex: true };
      const [propFrag, contextWithIndex] = emitExpression(
        expr.property as IrExpression,
        indexContext
      );
      const finalContext = { ...contextWithIndex, isArrayIndex: false };
      const indexExpr = expr.property as IrExpression;

      if (!hasInt32Proof(indexExpr)) {
        // ICE: Unproven index should have been caught by proof pass (TSN5107)
        throw new Error(
          `Internal Compiler Error: Array index must be proven Int32. ` +
            `Expression '${propFrag.text}' has no Int32 proof. ` +
            `This should have been caught by the numeric proof pass (TSN5107).`
        );
      }

      // Use native CLR indexer
      const text = `${receiverText}${expr.isOptional ? "?[" : "["}${propFrag.text}]`;
      return [{ text }, finalContext];
    }

    // CLR indexer access (non-TS-array types like List<T>, string, Dictionary, etc.)
    const indexContext = { ...newContext, isArrayIndex: true };
    const [propFrag, contextWithIndex] = emitExpression(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };
    const accessor = expr.isOptional ? "?[" : "[";

    // Check if this is dictionary access (no cast needed - use key type directly)
    const isDictionaryType = objectType?.kind === "dictionaryType";

    if (isDictionaryType) {
      // Dictionary: use key as-is (double for number keys, string for string keys)
      const text = `${receiverText}${accessor}${propFrag.text}]`;
      return [{ text }, finalContext];
    }

    // HARD GATE: Non-dictionary CLR indexers (List<T>, string) require Int32 proof
    const indexExpr = expr.property as IrExpression;

    if (!hasInt32Proof(indexExpr)) {
      // ICE: Unproven index should have been caught by proof pass (TSN5107)
      throw new Error(
        `Internal Compiler Error: CLR indexer requires Int32 index. ` +
          `Expression '${propFrag.text}' has no Int32 proof. ` +
          `This should have been caught by the numeric proof pass (TSN5107).`
      );
    }

    // String indexer: str[i] returns char in C#, but string in TypeScript.
    // Emit .ToString() to convert char back to string for TypeScript semantics.
    const isStringIndexer =
      objectType?.kind === "primitiveType" && objectType.name === "string";

    if (isStringIndexer) {
      const text = `${receiverText}${accessor}${propFrag.text}].ToString()`;
      return [{ text }, finalContext];
    }

    const text = `${receiverText}${accessor}${propFrag.text}]`;
    return [{ text }, finalContext];
  }

  // Property access
  const prop = expr.property as string;
  const objectType = expr.object.inferredType;
  const isArrayType = objectType?.kind === "arrayType";

  // Union member projection: u.prop → u.Match(__m1 => __m1.prop, __m2 => __m2.prop, ...)
  // This handles accessing properties on union types where the property exists on all members.
  // Example: account.kind where account is Union<User, Admin> and both have .kind
  if (objectType && !expr.isOptional) {
    const resolved = resolveTypeAlias(stripNullish(objectType), context);
    if (resolved.kind === "unionType") {
      const members = resolved.types;
      const arity = members.length;

      // Only handle unions with 2-8 members (runtime supports Union<T1..T8>)
      if (arity >= 2 && arity <= 8) {
        // Check if all members are reference types with the property
        const allHaveProp = members.every((m) => {
          if (m.kind !== "referenceType") return false;
          const props = getAllPropertySignatures(m, context);
          return props?.some((p) => p.name === prop) ?? false;
        });

        if (allHaveProp) {
          // Emit: object.Match(__m1 => __m1.prop, __m2 => __m2.prop, ...)
          const escapedProp = emitMemberName(
            expr.object,
            objectType,
            prop,
            context,
            usage
          );
          const lambdas = members.map(
            (_, i) => `__m${i + 1} => __m${i + 1}.${escapedProp}`
          );
          const text = `${receiverText}.Match(${lambdas.join(", ")})`;
          return [{ text }, newContext];
        }
      }
    }
  }

  // Array.length → .Length (C# arrays use .Length property)
  if (isArrayType && prop === "length") {
    const text = `${receiverText}.Length`;
    return [{ text }, newContext];
  }

  // Check if this is a string type
  const isStringType =
    objectType?.kind === "primitiveType" && objectType.name === "string";

  // String.length → .Length (C# strings use .Length property)
  if (isStringType && prop === "length") {
    const text = `${receiverText}.Length`;
    return [{ text }, newContext];
  }

  // Span<T>.length → .Length (C# Span<T> uses .Length)
  if (prop === "length" && objectType) {
    const resolved = resolveTypeAlias(stripNullish(objectType), context);
    if (
      resolved.kind === "referenceType" &&
      (resolved.name === "Span" || resolved.resolvedClrType?.endsWith("System.Span"))
    ) {
      const text = `${receiverText}.Length`;
      return [{ text }, newContext];
    }
  }

  // Handle explicit interface view properties (As_IInterface)
  if (isExplicitViewProperty(prop)) {
    const interfaceName = extractInterfaceNameFromView(prop);
    if (interfaceName) {
      // Emit as C# interface cast: ((IInterface)obj)
      const interfaceType: IrType = { kind: "referenceType", name: interfaceName };
      const [interfaceTypeStr, ctxAfterType] = emitType(
        interfaceType,
        newContext
      );
      const operandText = formatCastOperandText(expr.object, objectFrag.text);
      const text = `((${interfaceTypeStr})${operandText})`;
      return [{ text }, ctxAfterType];
    }
  }

  // Regular property access
  const accessor = expr.isOptional ? "?." : ".";
  const text = `${receiverText}${accessor}${emitMemberName(
    expr.object,
    objectType,
    prop,
    context,
    usage
  )}`;
  return [{ text }, newContext];
};

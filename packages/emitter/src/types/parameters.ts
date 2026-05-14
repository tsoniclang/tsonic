/**
 * Type parameter and parameter type emission
 */

import { IrType, IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { nullableType } from "../core/format/backend-ast/builders.js";
import { unwrapParameterModifierType } from "../core/semantic/parameter-modifier-types.js";
import type {
  CSharpTypeAst,
  CSharpTypeParameterConstraintNodeAst,
  CSharpTypeParameterAst,
  CSharpTypeParameterConstraintAst,
} from "../core/format/backend-ast/types.js";

type TypeParamConstraintKind = "class" | "struct" | "numeric" | "unconstrained";

const NON_CONSTRAINT_REFERENCE_TYPES = new Set([
  // TS/C# primitives and aliases that cannot appear as C# generic constraints.
  "string",
  "bool",
  "char",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "int128",
  "uint128",
  "half",
  "float",
  "double",
  "decimal",
  "void",
]);

const NUMERIC_CONSTRAINT_REFERENCE_TYPES = new Set([
  "Number",
  "double",
  "float",
  "half",
  "decimal",
  "int",
  "short",
  "long",
  "byte",
  "sbyte",
  "uint",
  "ushort",
  "ulong",
  "nint",
  "nuint",
  "int128",
  "uint128",
]);

const NUMERIC_CONSTRAINT_CLR_TYPES = new Set([
  "System.Double",
  "global::System.Double",
  "System.Single",
  "global::System.Single",
  "System.Half",
  "global::System.Half",
  "System.Decimal",
  "global::System.Decimal",
  "System.Int32",
  "global::System.Int32",
  "System.Int16",
  "global::System.Int16",
  "System.Int64",
  "global::System.Int64",
  "System.Byte",
  "global::System.Byte",
  "System.SByte",
  "global::System.SByte",
  "System.UInt32",
  "global::System.UInt32",
  "System.UInt16",
  "global::System.UInt16",
  "System.UInt64",
  "global::System.UInt64",
  "System.IntPtr",
  "global::System.IntPtr",
  "System.UIntPtr",
  "global::System.UIntPtr",
  "System.Int128",
  "global::System.Int128",
  "System.UInt128",
  "global::System.UInt128",
]);

const isNumericConstraintType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return (
      type.name === "number" ||
      NUMERIC_CONSTRAINT_REFERENCE_TYPES.has(type.name)
    );
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  return (
    NUMERIC_CONSTRAINT_REFERENCE_TYPES.has(type.name) ||
    (type.resolvedClrType !== undefined &&
      NUMERIC_CONSTRAINT_CLR_TYPES.has(type.resolvedClrType))
  );
};

const inferTypeParamConstraintKind = (
  tp: IrTypeParameter
): TypeParamConstraintKind => {
  // No constraint → unconstrained (can be class or struct in C# terms)
  if (!tp.constraint) return "unconstrained";

  // Structural constraints are object-shape constraints (reference-like).
  if (tp.isStructuralConstraint) return "class";

  if (isNumericConstraintType(tp.constraint)) return "numeric";

  // Direct markers
  if (
    tp.constraint.kind === "referenceType" &&
    tp.constraint.name === "struct"
  ) {
    return "struct";
  }
  if (
    tp.constraint.kind === "referenceType" &&
    tp.constraint.name === "object"
  ) {
    return "class";
  }

  // Intersection constraints may include object/struct markers
  if (tp.constraint.kind === "intersectionType") {
    const hasStruct = tp.constraint.types.some(
      (t) => t.kind === "referenceType" && t.name === "struct"
    );
    const hasObject = tp.constraint.types.some(
      (t) => t.kind === "referenceType" && t.name === "object"
    );
    if (hasStruct) return "struct";
    if (hasObject) return "class";
  }

  // Interface/class constraints are not enough to determine reference vs value.
  return "unconstrained";
};

const isConstraintTypeNodeEmittable = (type: IrType): boolean => {
  if (type.kind === "typeParameterType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  if (type.name === "object" || type.name === "struct") {
    return false;
  }

  return !NON_CONSTRAINT_REFERENCE_TYPES.has(type.name);
};

const isObjectTypeConstraintAst = (type: CSharpTypeAst): boolean => {
  if (type.kind === "predefinedType") {
    return type.keyword === "object";
  }

  if (type.kind === "identifierType") {
    return type.name === "object" || type.name === "Object";
  }

  if (type.kind === "qualifiedIdentifierType") {
    const joinedName = type.name.segments.join(".");
    return joinedName === "System.Object" || joinedName === "Object";
  }

  if (type.kind === "nullableType") {
    return isObjectTypeConstraintAst(type.underlyingType);
  }

  return false;
};

const addEmittableTypeConstraint = (
  type: CSharpTypeAst,
  constraints: CSharpTypeParameterConstraintNodeAst[]
): void => {
  if (!isObjectTypeConstraintAst(type)) {
    constraints.push({ kind: "typeConstraint", type });
  }
};

/**
 * Emit C# type parameters with constraints as AST nodes.
 * Example: <T, U extends Foo> → typeParams=[{name:"T"},{name:"U"}], constraints=[{...}]
 */
export const emitTypeParametersAst = (
  typeParams: readonly IrTypeParameter[] | undefined,
  context: EmitterContext,
  reservedCsharpNames?: ReadonlySet<string>
): [
  readonly CSharpTypeParameterAst[],
  readonly CSharpTypeParameterConstraintAst[],
  EmitterContext,
] => {
  if (!typeParams || typeParams.length === 0) {
    return [[], [], context];
  }

  const normalizeCsharpIdentifier = (id: string): string =>
    id.startsWith("@") ? id.slice(1) : id;

  const used = new Set<string>();
  for (const reserved of reservedCsharpNames ?? []) {
    used.add(normalizeCsharpIdentifier(reserved));
  }
  for (const mapped of context.typeParameterNameMap?.values() ?? []) {
    used.add(normalizeCsharpIdentifier(mapped));
  }

  const allocateTypeParamName = (base: string): string => {
    if (!used.has(base)) return base;

    let attempt = `T${base}`;
    if (!used.has(attempt)) return attempt;

    let suffix = 2;
    while (true) {
      attempt = `T${base}${suffix}`;
      if (!used.has(attempt)) return attempt;
      suffix += 1;
    }
  };

  const mergedTypeParamNameMap = new Map(context.typeParameterNameMap ?? []);
  for (const tp of typeParams) {
    const candidate = allocateTypeParamName(tp.name);
    const escaped = escapeCSharpIdentifier(candidate);
    mergedTypeParamNameMap.set(tp.name, escaped);
    used.add(normalizeCsharpIdentifier(escaped));
  }

  // Track constraint kinds for type parameters in this scope.
  // Used by union emission to decide whether `T | null` can be represented as `T?`.
  const mergedConstraints = new Map(context.typeParamConstraints ?? []);
  for (const tp of typeParams) {
    mergedConstraints.set(tp.name, inferTypeParamConstraintKind(tp));
  }

  const typeParamAsts: CSharpTypeParameterAst[] = typeParams.map((tp) => ({
    name: mergedTypeParamNameMap.get(tp.name) ?? tp.name,
  }));

  // Build where clause AST nodes for constraints
  const constraintAsts: CSharpTypeParameterConstraintAst[] = [];
  let currentContext: EmitterContext = {
    ...context,
    typeParamConstraints: mergedConstraints,
    typeParameterNameMap: mergedTypeParamNameMap,
  };

  for (const tp of typeParams) {
    const tpName = mergedTypeParamNameMap.get(tp.name) ?? tp.name;

    if (tp.constraint) {
      // Handle structural constraints specially - they generate adapter interfaces
      // Don't call emitType on objectType constraints (would trigger ICE)
      if (tp.isStructuralConstraint) {
        // Structural constraints generate interfaces - reference them
        constraintAsts.push({
          typeParameter: tpName,
          constraints: [
            {
              kind: "typeConstraint",
              type: {
                kind: "identifierType",
                name: `__Constraint_${tp.name}`,
              },
            },
          ],
        });
      } else if (tp.constraint.kind === "intersectionType") {
        // Multiple constraints: T extends A & B → where T : A, B
        const constraintParts: CSharpTypeParameterConstraintNodeAst[] = [];
        for (const member of tp.constraint.types) {
          if (member.kind === "referenceType" && member.name === "struct") {
            constraintParts.push({ kind: "structConstraint" });
          } else if (
            member.kind === "referenceType" &&
            member.name === "object"
          ) {
            constraintParts.push({ kind: "classConstraint" });
          } else if (isConstraintTypeNodeEmittable(member)) {
            const [cAst, newContext] = emitTypeAst(member, currentContext);
            currentContext = newContext;
            addEmittableTypeConstraint(cAst, constraintParts);
          }
        }
        if (constraintParts.length > 0) {
          constraintAsts.push({
            typeParameter: tpName,
            constraints: constraintParts,
          });
        }
      } else if (
        tp.constraint.kind === "referenceType" &&
        tp.constraint.name === "struct"
      ) {
        // Special case: T extends struct → where T : struct (C# value type constraint)
        constraintAsts.push({
          typeParameter: tpName,
          constraints: [{ kind: "structConstraint" }],
        });
      } else if (
        tp.constraint.kind === "referenceType" &&
        tp.constraint.name === "object"
      ) {
        // Special case: T extends object → where T : class (C# reference type constraint)
        constraintAsts.push({
          typeParameter: tpName,
          constraints: [{ kind: "classConstraint" }],
        });
      } else if (isConstraintTypeNodeEmittable(tp.constraint)) {
        const [cAst, newContext] = emitTypeAst(tp.constraint, currentContext);
        currentContext = newContext;
        const constraintParts: CSharpTypeParameterConstraintNodeAst[] = [];
        addEmittableTypeConstraint(cAst, constraintParts);
        if (constraintParts.length > 0) {
          constraintAsts.push({
            typeParameter: tpName,
            constraints: constraintParts,
          });
        }
      } else if (isNumericConstraintType(tp.constraint)) {
        constraintAsts.push({
          typeParameter: tpName,
          constraints: [
            {
              kind: "typeConstraint",
              type: {
                kind: "qualifiedIdentifierType",
                name: {
                  aliasQualifier: "global",
                  segments: ["System", "Numerics", "INumber"],
                },
                typeArguments: [{ kind: "identifierType", name: tpName }],
              },
            },
          ],
        });
      }
    }
  }

  return [typeParamAsts, constraintAsts, currentContext];
};

/**
 * Emit a parameter type as CSharpTypeAst with optional/nullable handling
 */
export const emitParameterType = (
  type: IrType | undefined,
  isOptional: boolean,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const typeNode = type ?? { kind: "anyType" as const };

  // Unwrap ref/out/in wrapper types - the modifier is handled separately
  const unwrapped = unwrapParameterModifierType(typeNode);
  const actualType = unwrapped ?? typeNode;

  const [baseTypeAst, newContext] = emitTypeAst(actualType, context);

  // For optional parameters, wrap in nullable
  // This includes both value types (double?, int?) and reference types (string?)
  // per spec/04-type-mappings.md:21-78
  if (isOptional) {
    return [nullableType(baseTypeAst), newContext];
  }

  return [baseTypeAst, newContext];
};

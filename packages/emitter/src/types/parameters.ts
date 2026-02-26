/**
 * Type parameter and parameter type emission
 */

import { IrType, IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import type {
  CSharpTypeAst,
  CSharpTypeParameterConstraintNodeAst,
  CSharpTypeParameterAst,
  CSharpTypeParameterConstraintAst,
} from "../core/format/backend-ast/types.js";

type TypeParamConstraintKind = "class" | "struct" | "unconstrained";

const inferTypeParamConstraintKind = (
  tp: IrTypeParameter
): TypeParamConstraintKind => {
  // No constraint → unconstrained (can be class or struct in C# terms)
  if (!tp.constraint) return "unconstrained";

  // Structural constraints are object-shape constraints (reference-like).
  if (tp.isStructuralConstraint) return "class";

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
          } else {
            const [cAst, newContext] = emitTypeAst(member, currentContext);
            currentContext = newContext;
            constraintParts.push({ kind: "typeConstraint", type: cAst });
          }
        }
        constraintAsts.push({
          typeParameter: tpName,
          constraints: constraintParts,
        });
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
      } else {
        const [cAst, newContext] = emitTypeAst(tp.constraint, currentContext);
        currentContext = newContext;
        constraintAsts.push({
          typeParameter: tpName,
          constraints: [{ kind: "typeConstraint", type: cAst }],
        });
      }
    }
  }

  return [typeParamAsts, constraintAsts, currentContext];
};

/**
 * Check if a type is a ref/out/in wrapper type and return the inner type
 */
const unwrapParameterModifierType = (type: IrType): IrType | null => {
  if (type.kind !== "referenceType") {
    return null;
  }

  const name = type.name;
  // Check for wrapper types: out<T>, ref<T>, In<T>
  if (
    (name === "out" || name === "ref" || name === "In") &&
    type.typeArguments &&
    type.typeArguments.length === 1
  ) {
    const innerType = type.typeArguments[0];
    return innerType ?? null;
  }

  return null;
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
    return [{ kind: "nullableType", underlyingType: baseTypeAst }, newContext];
  }

  return [baseTypeAst, newContext];
};

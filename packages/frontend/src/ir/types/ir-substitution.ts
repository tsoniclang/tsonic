/**
 * IR Type Substitution — Facade
 *
 * Re-exports from sub-modules:
 * - ir-substitution-core: containsTypeParameter, TypeSubstitutionMap,
 *     SubstitutionResult, unify, typesEqual
 * - ir-substitution-builders: substituteIrType, buildIrSubstitutionMap,
 *     buildSubstitutionFromExplicitTypeArgs, buildSubstitutionFromArguments,
 *     CompleteSubstitution, CompleteSubstitutionResult, buildCompleteSubstitutionMap
 */

export {
  containsTypeParameter,
  unify,
  typesEqual,
} from "./ir-substitution-core.js";

export type {
  TypeSubstitutionMap,
  SubstitutionResult,
} from "./ir-substitution-core.js";

export {
  substituteIrType,
  buildIrSubstitutionMap,
  buildSubstitutionFromExplicitTypeArgs,
  buildSubstitutionFromArguments,
  buildCompleteSubstitutionMap,
} from "./ir-substitution-builders.js";

export type {
  CompleteSubstitution,
  CompleteSubstitutionResult,
} from "./ir-substitution-builders.js";

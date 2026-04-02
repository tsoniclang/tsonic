/**
 * Helper functions for object literal expression conversion — Facade
 *
 * Re-exports from sub-modules:
 * - object-literal-type-helpers: type resolution, key resolution, method params,
 *     function type helpers
 * - object-literal-synthesis: property type synthesis, accessor provisioning,
 *     return type inference, method finalization, member collection
 */

export {
  getPropertyExpectedType,
  selectObjectLiteralContextualType,
  unwrapDeterministicKeyExpression,
  tryResolveDeterministicObjectKeyNameFromSyntax,
  resolveObjectLiteralMemberKey,
  methodUsesObjectLiteralThis,
  normalizeExpectedFunctionType,
  getExpectedFunctionParameterTypes,
  convertObjectLiteralMethodParameters,
  buildObjectLiteralMethodFunctionType,
} from "./object-literal-type-helpers.js";

export {
  getSynthesizedPropertyType,
  getProvisionalAccessorPropertyType,
  collectReturnExpressionTypes,
  inferDeterministicReturnTypeFromBlock,
  finalizeObjectLiteralMethodExpression,
  rebindObjectLiteralThisInExpression,
  rebindObjectLiteralThisInClassMember,
  collectSynthesizedObjectMembers,
} from "./object-literal-synthesis.js";

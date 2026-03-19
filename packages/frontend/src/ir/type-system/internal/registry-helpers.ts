/**
 * TypeRegistry helper functions — Facade
 *
 * Re-exports extraction and inference logic from sub-modules:
 * - registry-helpers-inference: inferExpressionTypeSyntax, inferMemberType,
 *     convertMethodToSignature, convertMethodSignatureToIr
 * - registry-helpers-extraction: CLR name helpers, type parameter extraction,
 *     member extraction, callable interface conversion, heritage extraction
 */

export {
  inferExpressionTypeSyntax,
  inferMemberType,
  convertMethodToSignature,
  convertMethodSignatureToIr,
} from "./registry-helpers-inference.js";

export {
  isWellKnownLibrary,
  getCanonicalClrFQName,
  extractTypeParameters,
  getTypeNodeName,
  resolveHeritageTypeName,
  extractMembers,
  extractMembersFromAliasedObjectType,
  convertCallableInterfaceOnlyType,
  extractHeritage,
} from "./registry-helpers-extraction.js";

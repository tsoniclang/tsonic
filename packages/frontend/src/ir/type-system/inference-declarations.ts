/**
 * Declaration Type Queries & Inspection Utilities (facade)
 *
 * Sub-modules:
 * - inference-declarations-types.ts     : typeOfDecl, typeOfValueRead, kind checks
 * - inference-declarations-overrides.ts : override checking, signature queries, typeFromSyntax
 */

export {
  typeOfDecl,
  typeOfValueRead,
  getFQNameOfDecl,
  hasTypeParameters,
  isTypeDecl,
  isInterfaceDecl,
  isTypeAliasToObjectLiteral,
  declHasTypeAnnotation,
} from "./inference-declarations-types.js";

export {
  signatureHasConditionalReturn,
  signatureHasVariadicTypeParams,
  checkTsClassMemberOverride,
  typeFromSyntax,
} from "./inference-declarations-overrides.js";

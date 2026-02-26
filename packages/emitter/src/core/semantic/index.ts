/**
 * Semantic analysis modules — pure type/IR analysis, no C# text output.
 */

export {
  substituteTypeArgs,
  resolveTypeAlias,
  stripNullish,
  isDefinitelyValueType,
  containsTypeParameter,
  getPropertyType,
  getAllPropertySignatures,
  selectUnionMemberForObjectLiteral,
} from "./type-resolution.js";
export { isAssignable, isIntegerType } from "./type-compatibility.js";
export { collectTypeParameters } from "./type-params.js";
export { buildLocalTypes } from "./local-types.js";
export { buildTypeMemberIndex } from "./type-member-index.js";
export { buildTypeAliasIndex } from "./type-alias-index.js";
export {
  buildModuleMap,
  resolveImportPath,
  canonicalizeFilePath,
} from "./module-map.js";
export { validateNamingPolicyCollisions } from "./naming-collisions.js";
export { processImports, resolveLocalImport } from "./imports.js";
export {
  statementUsesPointer,
  expressionUsesPointer,
  typeUsesPointer,
  moduleUsesPointer,
} from "./unsafe.js";
export {
  isBooleanType,
  toBooleanCondition,
  toBooleanConditionAst,
  emitBooleanConditionAst,
  type EmitExprAstFn,
} from "./boolean-context.js";

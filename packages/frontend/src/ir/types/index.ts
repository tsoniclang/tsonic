/**
 * IR types barrel exports
 * Intermediate Representation (IR) types for Tsonic compiler
 */

// Module types
export type {
  IrModule,
  IrImport,
  IrImportSpecifier,
  IrExport,
} from "./module.js";

// Statement types
export type {
  IrStatement,
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrClassMember,
  IrMethodDeclaration,
  IrPropertyDeclaration,
  IrConstructorDeclaration,
  IrInterfaceDeclaration,
  IrEnumDeclaration,
  IrEnumMember,
  IrTypeAliasDeclaration,
  IrExpressionStatement,
  IrReturnStatement,
  IrIfStatement,
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrForInStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrThrowStatement,
  IrTryStatement,
  IrCatchClause,
  IrBlockStatement,
  IrBreakStatement,
  IrContinueStatement,
  IrEmptyStatement,
  IrYieldStatement,
  IrGeneratorReturnStatement,
} from "./statements.js";

// Expression types
export type {
  IrExpression,
  IrLiteralExpression,
  IrIdentifierExpression,
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrMemberExpression,
  IrCallExpression,
  IrNewExpression,
  IrThisExpression,
  IrUpdateExpression,
  IrUnaryExpression,
  IrBinaryExpression,
  IrLogicalExpression,
  IrConditionalExpression,
  IrAssignmentExpression,
  IrTemplateLiteralExpression,
  IrSpreadExpression,
  IrAwaitExpression,
  IrYieldExpression,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  NumericProof,
  ProofSource,
  ComputedAccessKind,
} from "./expressions.js";

// Type system types
export type {
  IrType,
  IrPrimitiveType,
  IrReferenceType,
  IrTypeParameterType,
  IrArrayType,
  IrTupleType,
  IrFunctionType,
  IrObjectType,
  IrDictionaryType,
  IrUnionType,
  IrIntersectionType,
  IrLiteralType,
  IrAnyType,
  IrUnknownType,
  IrVoidType,
  IrNeverType,
  // Attribute types
  IrAttribute,
  IrAttributePrimitiveArg,
  IrAttributeArg,
} from "./ir-types.js";

// Helper types
export type {
  IrPattern,
  IrIdentifierPattern,
  IrArrayPattern,
  IrArrayPatternElement,
  IrObjectPattern,
  IrObjectPatternProperty,
  IrTypeParameter,
  IrParameter,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
  IrAccessibility,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "./helpers.js";

// Type guards
export { isStatement, isExpression } from "./guards.js";

// Numeric types
export type { NumericKind } from "./numeric-kind.js";
export {
  TSONIC_TO_NUMERIC_KIND,
  NUMERIC_KIND_TO_CSHARP,
  NUMERIC_RANGES,
  isIntegerKind,
  isSignedKind,
  getBinaryResultKind,
  literalFitsInKind,
  isWideningConversion,
} from "./numeric-kind.js";

// Numeric helpers (literal type inference)
export {
  isValidIntegerLexeme,
  parseBigIntFromRaw,
  bigIntFitsInKind,
  inferNumericKindFromRaw,
} from "./numeric-helpers.js";

// IR type substitution (deterministic type parameter substitution)
export type {
  TypeSubstitutionMap,
  SubstitutionResult,
  CompleteSubstitution,
  CompleteSubstitutionResult,
} from "./ir-substitution.js";
export {
  containsTypeParameter,
  unify,
  typesEqual,
  substituteIrType,
  buildIrSubstitutionMap,
  buildSubstitutionFromExplicitTypeArgs,
  buildSubstitutionFromArguments,
  buildCompleteSubstitutionMap,
} from "./ir-substitution.js";

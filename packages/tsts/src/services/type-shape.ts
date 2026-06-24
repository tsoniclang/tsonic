import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
import { Program_GetSourceFiles, Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import type { Context } from "../go/context.js";
import { Background } from "../go/context.js";
import {
  Checker_GetApparentType,
  Checker_GetIndexInfosOfType,
  Checker_GetPropertiesOfType,
  Checker_GetPropertyOfType,
  Checker_GetReturnTypeOfSignature,
  Checker_GetSignaturesOfType,
  Checker_GetTypeArguments,
  Checker_GetTypeFromTypeNode,
  Checker_GetTypeOfPropertyOfType,
  Checker_GetWidenedType,
  Checker_IsArrayLikeType,
  Checker_RemoveMissingOrUndefinedType,
} from "../internal/checker/exports.js";
import { Checker_GetConstantValue } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import type { Checker } from "../internal/checker/checker/state.js";
import {
  ObjectFlagsReference,
  ObjectFlagsTuple,
  SignatureKindCall,
  SignatureKindConstruct,
  TypeFlagsAny,
  TypeFlagsBigIntLike,
  TypeFlagsBooleanLike,
  TypeFlagsIntersection,
  TypeFlagsLiteral,
  TypeFlagsNever,
  TypeFlagsNull,
  TypeFlagsNumberLike,
  TypeFlagsObject,
  TypeFlagsStringLike,
  TypeFlagsUnion,
  TypeFlagsUnknown,
  TypeFlagsVoidLike,
  TypeFlagsUndefined,
  TypeFlagsVoid,
  Type_Target,
  Type_Types,
  Type_AsLiteralType,
  LiteralType_Value,
} from "../internal/checker/types.js";
import type { IndexInfo, Signature, Type } from "../internal/checker/types.js";

export interface TypeShapeQueryOptions {
  readonly context?: Context;
  readonly sourceFile?: GoPtr<SourceFile>;
}

export interface TypeShapeQueries {
  readonly typeToString: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => string;
  readonly getTypeFromTypeNode: (node: GoPtr<Node>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
  readonly getConstantValue: (node: GoPtr<Node>, options?: TypeShapeQueryOptions) => unknown;
  readonly isAny: (type: GoPtr<Type>) => boolean;
  readonly isUnknown: (type: GoPtr<Type>) => boolean;
  readonly isNever: (type: GoPtr<Type>) => boolean;
  readonly isVoidLike: (type: GoPtr<Type>) => boolean;
  readonly isNullish: (type: GoPtr<Type>) => boolean;
  readonly isStringLike: (type: GoPtr<Type>) => boolean;
  readonly isNumberLike: (type: GoPtr<Type>) => boolean;
  readonly isBooleanLike: (type: GoPtr<Type>) => boolean;
  readonly isBigIntLike: (type: GoPtr<Type>) => boolean;
  readonly isUnion: (type: GoPtr<Type>) => boolean;
  readonly isIntersection: (type: GoPtr<Type>) => boolean;
  readonly isTypeReference: (type: GoPtr<Type>) => boolean;
  readonly isTuple: (type: GoPtr<Type>) => boolean;
  readonly isArrayLike: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => boolean;
  readonly getUnionOrIntersectionTypes: (type: GoPtr<Type>) => readonly GoPtr<Type>[];
  readonly getTypeReferenceTarget: (type: GoPtr<Type>) => GoPtr<Type>;
  readonly getTypeArguments: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Type>[];
  readonly getTupleElementTypes: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Type>[];
  readonly getLiteralValue: (type: GoPtr<Type>) => string | number | boolean | null | undefined;
  readonly getProperties: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Symbol>[];
  readonly getProperty: (type: GoPtr<Type>, name: string, options?: TypeShapeQueryOptions) => GoPtr<Symbol>;
  readonly getPropertyType: (type: GoPtr<Type>, name: string, options?: TypeShapeQueryOptions) => GoPtr<Type>;
  readonly getCallSignatures: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Signature>[];
  readonly getConstructSignatures: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Signature>[];
  readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
  readonly getIndexInfos: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<IndexInfo>[];
  readonly getApparentType: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
  readonly getWidenedType: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
  readonly removeMissingOrUndefined: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
}

export function createTypeShapeQueries(program: GoPtr<Program>, defaultOptions: TypeShapeQueryOptions = {}): TypeShapeQueries {
  return {
    typeToString: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_TypeToString(checker, type)) ?? "",
    getTypeFromTypeNode: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
    getConstantValue: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetConstantValue(checker, node)),
    isAny: (type) => hasFlags(type, TypeFlagsAny),
    isUnknown: (type) => hasFlags(type, TypeFlagsUnknown),
    isNever: (type) => hasFlags(type, TypeFlagsNever),
    isVoidLike: (type) => hasFlags(type, TypeFlagsVoidLike) || hasFlags(type, TypeFlagsVoid),
    isNullish: (type) => hasFlags(type, TypeFlagsNull) || hasFlags(type, TypeFlagsUndefined),
    isStringLike: (type) => hasFlags(type, TypeFlagsStringLike),
    isNumberLike: (type) => hasFlags(type, TypeFlagsNumberLike),
    isBooleanLike: (type) => hasFlags(type, TypeFlagsBooleanLike),
    isBigIntLike: (type) => hasFlags(type, TypeFlagsBigIntLike),
    isUnion: (type) => hasFlags(type, TypeFlagsUnion),
    isIntersection: (type) => hasFlags(type, TypeFlagsIntersection),
    isTypeReference: (type) => type !== undefined && (type.objectFlags & ObjectFlagsReference) !== 0,
    isTuple: isTupleType,
    isArrayLike: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_IsArrayLikeType(checker, type)) === true,
    getUnionOrIntersectionTypes: (type) => Type_Types(type) ?? [],
    getTypeReferenceTarget: (type) => Type_Target(type),
    getTypeArguments: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetTypeArguments(checker, type)) ?? [],
    getTupleElementTypes: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => {
      if (!isTupleType(type)) {
        return [];
      }
      return Checker_GetTypeArguments(checker, type);
    }) ?? [],
    getLiteralValue,
    getProperties: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetPropertiesOfType(checker, type)) ?? [],
    getProperty: (type, name, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetPropertyOfType(checker, type, name)),
    getPropertyType: (type, name, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
    getCallSignatures: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
    getConstructSignatures: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
    getReturnTypeOfSignature: (signature, options = {}) => withChecker(program, signature, defaultOptions, options, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
    getIndexInfos: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetIndexInfosOfType(checker, type)) ?? [],
    getApparentType: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetApparentType(checker, type)),
    getWidenedType: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetWidenedType(checker, type)),
    removeMissingOrUndefined: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_RemoveMissingOrUndefinedType(checker, type)),
  };
}

function hasFlags(type: GoPtr<Type>, flags: number): boolean {
  return type !== undefined && (type.flags & flags) !== 0;
}

function isTupleType(type: GoPtr<Type>): boolean {
  if (type === undefined) {
    return false;
  }
  if ((type.flags & TypeFlagsObject) === 0) {
    return false;
  }
  if ((type.objectFlags & ObjectFlagsTuple) !== 0) {
    return true;
  }
  const target = Type_Target(type);
  return target !== undefined && (target.objectFlags & ObjectFlagsTuple) !== 0;
}

function getLiteralValue(type: GoPtr<Type>): string | number | boolean | null | undefined {
  if (type === undefined || (type.flags & TypeFlagsLiteral) === 0) {
    return undefined;
  }
  const value = LiteralType_Value(Type_AsLiteralType(type));
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
    ? value
    : undefined;
}

function withCheckerForNode<T>(
  program: GoPtr<Program>,
  node: GoPtr<Node>,
  defaultOptions: TypeShapeQueryOptions,
  options: TypeShapeQueryOptions,
  callback: (checker: GoPtr<Checker>) => T,
): T | undefined {
  if (node === undefined) {
    return undefined;
  }
  return withChecker(program, node, defaultOptions, options, callback);
}

function withChecker<T>(
  program: GoPtr<Program>,
  subject: object | undefined,
  defaultOptions: TypeShapeQueryOptions,
  options: TypeShapeQueryOptions,
  callback: (checker: GoPtr<Checker>) => T,
): T | undefined {
  if (program === undefined || subject === undefined) {
    return undefined;
  }
  const sourceFile = options.sourceFile ?? defaultOptions.sourceFile ?? (isNode(subject) ? GetSourceFileOfNode(subject) : undefined) ?? Program_GetSourceFiles(program)?.[0];
  if (sourceFile === undefined) {
    return undefined;
  }
  const [checker, done] = Program_GetTypeCheckerForFile(program, options.context ?? defaultOptions.context ?? Background(), sourceFile);
  try {
    return callback(checker);
  } finally {
    done();
  }
}

function isNode(subject: object | undefined): subject is Node {
  return subject !== undefined && "Kind" in subject && "Loc" in subject;
}

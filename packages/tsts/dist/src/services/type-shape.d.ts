import type { GoPtr } from "../go/compat.js";
import type { TypeIndexedAccessComponents, TypeIndexedAccessSelection } from "./type-indexed-access.js";
import type { TypeKeyOfComponents, TypeSubstitutionComponents } from "./type-dependent-operands.js";
import { type RetainedTypeAliasApplication, type TypeAliasApplicationInfo } from "./type-applications.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
import { type NativeCheckerAdmission, type NativeCheckerResult } from "../internal/checker/resource-admission.js";
import type { CheckerDiagnosticMembership, ResolvedSourceTypeInfo } from "../internal/checker/checker/source-type-answers.js";
import type { Context } from "../go/context.js";
import type { Signature, Type } from "../internal/checker/types.js";
export interface TypeIndexInfo {
    readonly keyType: GoPtr<Type>;
    readonly valueType: GoPtr<Type>;
    readonly readonly: boolean;
    readonly declaration: GoPtr<Node>;
    readonly symbol: GoPtr<Symbol>;
    readonly components: readonly GoPtr<Node>[];
}
export interface TypeReferenceArgumentInfo {
    readonly parameter: Type;
    readonly argument: Type;
    readonly scope: "outer" | "local";
}
export interface TypeConditionalBranch {
    readonly kind: "completed" | "invariant-atom";
    readonly type: Type;
}
export interface TypeConditionalComponents {
    readonly declaration: Node;
    readonly checkType: Type;
    readonly extendsType: Type;
    readonly distributive: boolean;
    readonly inferParameters: readonly Type[];
    readonly application: RetainedTypeAliasApplication["bindings"] | null;
    readonly trueBranch: TypeConditionalBranch | undefined;
    readonly falseBranch: TypeConditionalBranch | undefined;
}
export interface TypeMappedPropertyInfo {
    readonly keyType: GoPtr<Type>;
    readonly syntheticOrigin: GoPtr<Symbol>;
    readonly declaration: GoPtr<Node>;
}
export interface TypePropertyHeader {
    readonly symbol: Symbol;
    readonly rootSymbols: readonly Symbol[];
    readonly name: string;
    readonly optional: boolean;
    readonly readonly: boolean;
    readonly intrinsicOrigin?: "global-this" | "undefined";
    readonly classPrototype?: Node;
}
export interface TypePropertyInfo extends TypePropertyHeader {
    readonly type: Type;
    readonly typeSource?: Node;
    readonly bindingPattern?: {
        readonly element: Node;
        readonly keyType: Type;
    };
    readonly mapped?: TypeMappedPropertyInfo;
}
export type TypePropertyRead<Stop extends object> = NativeCheckerResult<TypePropertyInfo, Stop>;
export interface TypePropertyInventory {
    readonly length: number;
    readonly read: <Stop extends object>(index: number, admit: NativeCheckerAdmission<Stop>) => TypePropertyRead<Stop>;
}
export interface StructuredTypeInventory {
    readonly signatures: readonly GoPtr<Signature>[];
    readonly callSignatureCount: number;
    readonly indexes: readonly TypeIndexInfo[];
    readonly properties: TypePropertyInventory;
}
export interface TypeTupleElementInfo {
    readonly type: Type;
    readonly elementKind: "required" | "optional" | "rest" | "variadic";
    readonly declaration?: Node;
}
export interface TypeTupleInfo {
    readonly readonly: boolean;
    readonly elements: readonly TypeTupleElementInfo[];
}
export interface TypeSignatureParameterInfo {
    readonly sourceSymbol: Symbol;
    readonly type: Type;
    readonly typeSource?: Node;
    readonly parameterKind: "required" | "optional" | "rest";
    readonly acceptsOmission: boolean;
    readonly declaration?: Node;
}
export interface TypeSignatureThisParameterInfo {
    readonly symbol: Symbol;
    readonly type: Type;
    readonly declaration?: Node;
}
export interface TypeSignatureInfo {
    readonly signature: Signature;
    readonly parameters: readonly TypeSignatureParameterInfo[];
    readonly thisParameter?: TypeSignatureThisParameterInfo;
    readonly returnType: ResolvedSourceTypeInfo | undefined;
}
export interface CreateTypeShapeQueriesOptions {
    readonly sourceFile: GoPtr<SourceFile>;
    readonly context?: Context;
    readonly admitsCheckerDiagnostic?: CheckerDiagnosticMembership;
}
export interface TypeIntrinsicNullishFlags {
    readonly null: boolean;
    readonly undefined: boolean;
}
export interface TypeShapeQueries {
    readonly typeToString: (type: GoPtr<Type>) => string;
    readonly getTypeFromTypeNode: (node: GoPtr<Node>) => GoPtr<ResolvedSourceTypeInfo>;
    readonly instantiateTypeAlias: (declaration: GoPtr<Node>, arguments_: readonly Type[]) => TypeAliasApplicationInfo | undefined;
    readonly getTypeAliasApplication: (type: GoPtr<Type>) => RetainedTypeAliasApplication | undefined;
    readonly getConstantValue: (node: GoPtr<Node>) => unknown;
    readonly getNumericLiteralTypeValue: (type: GoPtr<Type>) => number | bigint | undefined;
    readonly getStringLiteralTypeValue: (type: GoPtr<Type>) => string | undefined;
    readonly getBooleanLiteralTypeValue: (type: GoPtr<Type>) => boolean | undefined;
    readonly isAny: (type: GoPtr<Type>) => boolean;
    readonly isError: (type: GoPtr<Type>) => boolean;
    readonly isUnknown: (type: GoPtr<Type>) => boolean;
    readonly isNever: (type: GoPtr<Type>) => boolean;
    readonly isNonPrimitive: (type: GoPtr<Type>) => boolean;
    readonly isGlobalScopeObject: (type: GoPtr<Type>) => boolean;
    readonly isVoidLike: (type: GoPtr<Type>) => boolean;
    readonly isNullish: (type: GoPtr<Type>) => boolean;
    readonly intrinsicNullishFlags: (type: GoPtr<Type>) => TypeIntrinsicNullishFlags;
    readonly isStringLike: (type: GoPtr<Type>) => boolean;
    readonly isNumberLike: (type: GoPtr<Type>) => boolean;
    readonly isBooleanLike: (type: GoPtr<Type>) => boolean;
    readonly isBigIntLike: (type: GoPtr<Type>) => boolean;
    readonly isSymbolLike: (type: GoPtr<Type>) => boolean;
    readonly isUnion: (type: GoPtr<Type>) => boolean;
    readonly isIntersection: (type: GoPtr<Type>) => boolean;
    readonly isTypeReference: (type: GoPtr<Type>) => boolean;
    readonly isTuple: (type: GoPtr<Type>) => boolean;
    readonly isArrayLike: (type: GoPtr<Type>) => boolean;
    readonly isTypeIdenticalTo: (left: GoPtr<Type>, right: GoPtr<Type>) => boolean;
    readonly couldContainTypeVariables: (type: GoPtr<Type>) => boolean;
    readonly getUnionOrIntersectionTypes: (type: GoPtr<Type>) => readonly GoPtr<Type>[];
    readonly getTypeReferenceTarget: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly getTypeArguments: (type: GoPtr<Type>) => readonly GoPtr<Type>[];
    readonly getTypeReferenceArgumentInfos: (type: GoPtr<Type>) => readonly TypeReferenceArgumentInfo[] | undefined;
    readonly getInstantiatedBaseTypes: (type: GoPtr<Type>) => readonly Type[] | undefined;
    readonly getKeyOfComponents: (type: GoPtr<Type>) => TypeKeyOfComponents | undefined;
    readonly getSubstitutionComponents: (type: GoPtr<Type>) => TypeSubstitutionComponents | undefined;
    readonly getTupleInfo: (type: GoPtr<Type>) => TypeTupleInfo | undefined;
    readonly getObjectPropertyInfo: (type: GoPtr<Type>, name: string) => TypePropertyInfo | null | undefined;
    readonly forEachObjectPropertyHeader: (type: GoPtr<Type>, admit: () => boolean, visit: (header: TypePropertyHeader) => boolean) => "complete" | "stopped" | undefined;
    readonly getStructuredInventory: <Stop extends object>(type: GoPtr<Type>, admit: NativeCheckerAdmission<Stop>) => NativeCheckerResult<StructuredTypeInventory, Stop>;
    readonly getCallSignatures: (type: GoPtr<Type>) => readonly GoPtr<Signature>[];
    readonly getConstructSignatures: (type: GoPtr<Type>) => readonly GoPtr<Signature>[];
    readonly getSignatureInfos: (type: GoPtr<Type>, kind: "call" | "construct") => readonly TypeSignatureInfo[];
    readonly getDeclarationSignatureInfo: (declaration: GoPtr<Node>) => TypeSignatureInfo | undefined;
    readonly getSignatureParameterInfos: (signature: GoPtr<Signature>) => readonly TypeSignatureParameterInfo[];
    readonly getSignatureThisParameterInfo: (signature: GoPtr<Signature>) => TypeSignatureThisParameterInfo | undefined;
    readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>) => GoPtr<ResolvedSourceTypeInfo>;
    readonly getIndexInfos: (type: GoPtr<Type>) => readonly TypeIndexInfo[];
    readonly getIndexedAccessComponents: (type: GoPtr<Type>) => TypeIndexedAccessComponents | undefined;
    readonly getConditionalComponents: (type: GoPtr<Type>) => TypeConditionalComponents | undefined;
    readonly selectIndexedAccess: (objectType: GoPtr<Type>, indexType: GoPtr<Type>) => TypeIndexedAccessSelection | undefined;
    readonly getApparentType: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly getWidenedType: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly getBaseTypeOfLiteralType: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly removeMissingOrUndefined: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly getNonNullableType: (type: GoPtr<Type>) => GoPtr<Type>;
}
export declare function createTypeShapeQueries(program: GoPtr<Program>, defaultOptions: CreateTypeShapeQueriesOptions): TypeShapeQueries;
//# sourceMappingURL=type-shape.d.ts.map
import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
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
    readonly getProperties: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Symbol>[];
    readonly getProperty: (type: GoPtr<Type>, name: string, options?: TypeShapeQueryOptions) => GoPtr<Symbol>;
    readonly getPropertyType: (type: GoPtr<Type>, name: string, options?: TypeShapeQueryOptions) => GoPtr<Type>;
    readonly getCallSignatures: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Signature>[];
    readonly getConstructSignatures: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly GoPtr<Signature>[];
    readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
    readonly getIndexInfos: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => readonly TypeIndexInfo[];
    readonly getApparentType: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
    readonly getWidenedType: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
    readonly removeMissingOrUndefined: (type: GoPtr<Type>, options?: TypeShapeQueryOptions) => GoPtr<Type>;
}
export declare function createTypeShapeQueries(program: GoPtr<Program>, defaultOptions?: TypeShapeQueryOptions): TypeShapeQueries;
//# sourceMappingURL=type-shape.d.ts.map
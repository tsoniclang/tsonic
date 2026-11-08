import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import { type SourceAnalysisProgram } from "../../analysis-program.js";
type Descriptor = SourceTypeDescriptor;
type StorageFacts = Pick<SourceAnalysisProgram, "ast" | "facts">;
/** A scalar storage type: a primitive, string, bigint, symbol or enum value has no storage identity. */
export declare function sourceStorageIsScalarType(type: Descriptor, ast: AstReader): boolean;
/** The value is wholly absent (null / undefined / void). */
export declare function sourceStorageIsAbsentType(type: Descriptor): boolean;
/** The value has no arm at all (never). */
export declare function sourceStorageIsNeverType(type: Descriptor): boolean;
/** Some present arm is any / unknown (its structure is open). */
export declare function sourceStorageIsOpenType(ast: Pick<AstReader, "is">, type: Descriptor): boolean;
/** The present (non-absent, non-never) arms of a storage type. Empty: never present. */
export declare function sourcePresentStorageArms(type: Descriptor): readonly Descriptor[];
/** Two storage types are the same Host type. */
export declare function sourceStorageTypesEqual(left: Descriptor, right: Descriptor): boolean;
/** The storage type mentions an unbound type parameter (checker couldContainTypeVariables). */
export declare function sourceStorageTypeHasTypeVariables(type: Descriptor, ast: AstReader): boolean;
/** The tuple elements of every present arm (one list per arm); undefined unless every present arm is a tuple. */
export declare function sourceStorageTupleElements(type: Descriptor): readonly (readonly {
    readonly kind: "required" | "optional" | "rest";
    readonly type: Descriptor;
}[])[] | undefined;
/** The array element of an array type (checker sourceArrayElementType): the Host join of the per-arm elements. */
export declare function sourceStorageArrayElementType(source: Pick<StorageFacts, "facts">, type: Descriptor): Descriptor | undefined;
/** Whether every present arm is an array or tuple (checker isArrayLike). */
export declare function sourceStorageIsArrayLikeType(type: Descriptor): boolean;
/**
 * The declaration of an accessor pair for an access role: the get accessor for reads, the set accessor for writes
 * (from the pair's merged declarations); any other declaration is its own role declaration.
 */
export declare function sourceStorageRoleDeclaration(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, declaration: Node, mode: "read" | "write"): Node | undefined;
/** The declarations a member access reads or writes (navigation member witness; accessor pair by role). */
export declare function sourceStorageAccessDeclarations(source: SourceAnalysisProgram, access: Node, mode: "read" | "write"): readonly Node[] | undefined;
/** The member key of an access whose receiver is `any` (dynamic member): the property name or the literal index. */
export declare function sourceStorageDynamicMemberKey(source: SourceAnalysisProgram, access: Node): string | undefined;
/** The constant key text of an element-access argument (string literal, else numeric literal). */
export declare function sourceStorageLiteralKey(source: Pick<SourceAnalysisProgram, "facts">, argument: Node | undefined): string | undefined;
/** The members named `key` of a subject's type (dynamic member resolution). */
export declare function sourceStorageDynamicMemberDeclarations(source: SourceAnalysisProgram, receiver: SourceStorageSubject, key: string, mode: "read" | "write", step: () => boolean): {
    readonly type: Descriptor;
    readonly declarations: readonly Node[];
} | undefined;
/** The type of one component of a storage type. */
export declare function sourceStorageComponentType(source: StorageFacts, type: Descriptor, component: SourceStorageProjection): Descriptor | undefined;
/** The source components a destination component is read from, across a value edge `from` → `to`. */
export declare function sourceStorageOriginalComponents(source: StorageFacts, from: Descriptor, to: Descriptor, component: SourceStorageProjection): Iterable<SourceStorageProjection>;
/** The element components of a storage type (tuple positions, else the array element). */
export declare function sourceStorageComponents(type: Descriptor): Iterable<SourceStorageProjection>;
/** The Host type of an array literal, else of the nearest transparent parent whose Host type is a tuple. */
export declare function sourceStorageArrayLiteralType(source: SourceAnalysisProgram, node: Node, step?: () => boolean): Descriptor | undefined;
/**
 * The Host type of a storage subject: its node's Host descriptor (values.type / callable result / iteration element /
 * receiver type), projected through its components. undefined when a Host value on the path is refused.
 */
export declare function sourceStorageSubjectType(source: SourceAnalysisProgram, value: SourceStorageSubject, sourceFile?: SourceFile): Descriptor | undefined;
/**
 * The instance type of a class: the one result every construct signature of the class shares (a class has one instance
 * type for all its overloads; this is not a join of components). undefined when the Host construction is refused, has
 * no signature, or its signatures disagree.
 */
export declare function sourceStorageInstanceType(source: Pick<StorageFacts, "facts">, declaration: Node): Descriptor | undefined;
/** The projection an element access selects on a storage type (literal tuple position, else the array element). */
export declare function sourceIndexedStorageProjection(source: StorageFacts, type: Descriptor, index: Node | undefined): SourceStorageProjection | undefined;
export {};
//# sourceMappingURL=components.d.ts.map
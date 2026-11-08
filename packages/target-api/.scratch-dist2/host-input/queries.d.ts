import { type AstReader, type Node, type ReadonlySourceFactResolver, type SourcePrimitiveKind, type Type } from "@tsonic/tsts";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "./semantics-types.js";
import type { ResolvedSourceCallInfo } from "./navigation-checker.js";
import type { SourcePropertyNameSelection } from "../source-semantics/property-names-model.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { type SourceMemberOriginResult } from "./member-origins.js";
import type { SourceMemberKey } from "../source-semantics/descriptor-model.js";
declare const sourceHostTypeBrand: unique symbol;
declare const sourceHostSymbolBrand: unique symbol;
declare const sourceHostQueriesBrand: unique symbol;
/** Opaque checker type input: a declared, authored, selected-signature or selection-witness component type. */
export interface SourceHostType {
    readonly [sourceHostTypeBrand]: "SourceHostType";
}
/** Opaque checker symbol identity (compared by identity only). */
export interface SourceHostSymbol {
    readonly [sourceHostSymbolBrand]: "SourceHostSymbol";
}
/** A type component: the opaque type plus the declaration and authored syntax it was selected from. */
export interface SourceHostComponent {
    readonly selectedType: SourceHostType;
    readonly declaration?: Node;
    readonly authoredTypeNode?: Node;
    /** The call whose selected signature this component belongs to (parameter, result or type argument). */
    readonly contextualCall?: SourceHostCall;
}
export interface SourceHostValue {
    readonly expression: Node;
    readonly type: SourceHostType;
}
export interface SourceHostArgumentBinding {
    readonly sourceArgumentIndex: number;
    readonly effectiveArgumentIndex: number;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex?: number;
    readonly sourceParameterIndex: number;
    readonly sourceParameterForm: "parameter" | "rest-element" | "rest-sequence";
    readonly selectedArgumentType: SourceHostType;
    readonly selectedParameterType: SourceHostType;
}
export interface SourceHostCallParameter {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterDeclaration?: Node;
    readonly selectedType: SourceHostType;
    readonly authoredTypeNode?: Node;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
}
export interface SourceHostMethodTypeArgument {
    readonly typeParameterName: string;
    readonly typeParameter: SourceHostType;
    readonly selectedType: SourceHostType;
    readonly explicitTypeNode?: Node;
    readonly defaultTypeNode?: Node;
}
/** The checker's selection at a call, `new`, tagged template or `super(...)`: selected signature, arguments, bindings. */
export interface SourceHostCall {
    readonly call: Node;
    readonly optionalChain: boolean;
    readonly sourceSelectedSignatureKind: "resolved" | "untyped";
    readonly sourceCallee: SourceHostValue;
    readonly sourceReceiver?: SourceHostValue;
    readonly sourceCalleeAccess?: {
        readonly selectedDeclaration?: Node;
    };
    readonly sourceArguments: readonly SourceHostValue[];
    readonly sourceArgumentBindings: readonly SourceHostArgumentBinding[];
    readonly sourceSelectedSignatureParameters: readonly SourceHostCallParameter[];
    readonly sourceSelectedMethodTypeArguments?: readonly SourceHostMethodTypeArgument[];
    readonly sourceResultType: SourceHostType;
}
/** The checker's selection at a property or element access. */
export interface SourceHostAccess {
    readonly expression: Node;
    readonly receiver: SourceHostValue;
    readonly argument?: SourceHostValue;
    readonly selectedSymbol?: SourceHostSymbol;
    readonly selectedDeclaration?: Node;
    readonly selectedReadDeclaration?: Node;
    readonly selectedWriteDeclaration?: Node;
    readonly optionalChain: boolean;
    readonly sourceReadType?: SourceHostType;
    readonly sourceWriteType?: SourceHostType;
}
export interface SourceHostObjectLiteralElement {
    readonly objectLiteral: Node;
    readonly element: Node;
    readonly objectLiteralType: SourceHostType;
    readonly contextualType?: SourceHostType;
    readonly sourceElementSymbol?: SourceHostSymbol;
}
export interface SourceHostProperty {
    readonly symbol: SourceHostSymbol;
    readonly rootSymbols: readonly SourceHostSymbol[];
    readonly name: string;
    readonly type: SourceHostType;
    readonly optional: boolean;
    readonly readonly: boolean;
}
export interface SourceHostSignatureParameter {
    readonly type: SourceHostType;
    readonly parameterKind: "required" | "optional" | "rest";
    readonly acceptsOmission: boolean;
    readonly declaration?: Node;
}
export interface SourceHostSignatureInfo {
    readonly parameters: readonly SourceHostSignatureParameter[];
    readonly returnType: SourceHostType | undefined;
    /** The signature's declaration; undefined for a signature with no declaration (an intrinsic or synthesized one). */
    readonly declaration?: Node;
}
/** One index signature of a type: its declaration (absent for a mapped index) and its key and value types. */
export interface SourceHostIndex {
    readonly declaration?: Node;
    readonly keyType?: SourceHostType;
    readonly valueType?: SourceHostType;
    readonly readonly: boolean;
}
/** The binding of one type parameter in a type application (declaration, its own parameter type, the argument). */
export interface SourceHostTypeArgumentBinding {
    readonly declaration: Node;
    readonly parameterType: SourceHostType;
    readonly argumentType: SourceHostType;
}
/** One step of the checker's conditional-alias instantiation journal (selected branch, its node, its bindings). */
export interface SourceHostConditionalStep {
    readonly conditional: Node;
    readonly branch: "true" | "false" | "deferred";
    readonly selectedNode?: Node;
    readonly selectedType?: SourceHostType;
    readonly bindings: readonly {
        readonly declarations: readonly Node[];
        readonly parameter: SourceHostType;
        readonly argument: SourceHostType;
        readonly applicationParameter?: SourceHostType;
    }[];
}
/** A type alias application: the alias, its body, its parameter bindings and, for a conditional body, its steps. */
export interface SourceHostAliasApplication {
    readonly kind: "direct" | "conditional";
    readonly declaration: Node;
    readonly typeNode: Node;
    readonly bindings: readonly {
        readonly declaration: Node;
        readonly parameter: SourceHostType;
        readonly argument: SourceHostType;
    }[];
    readonly result: SourceHostType;
    readonly conditionalSteps: readonly SourceHostConditionalStep[];
}
export interface SourceHostCallable {
    readonly parameters: readonly SourceHostSignatureParameter[];
    readonly result: SourceHostComponent;
}
export interface SourceHostTupleElement {
    readonly type: SourceHostType;
    readonly elementKind: "required" | "optional" | "rest" | "variadic";
    readonly declaration?: Node;
}
export interface SourceHostGenerator {
    readonly declaration: Node;
    readonly sourceReturnType: SourceHostType;
    readonly returnTypeBinding?: {
        readonly declaration: Node;
        readonly parameterType: SourceHostType;
    };
}
export type SourceHostAuthoredSelection = {
    readonly kind: "authored-members";
    readonly nodes: readonly Node[];
    readonly nullishCount: number;
} | {
    readonly kind: "ambiguous" | "unrelated";
};
export type SourceHostContributionPathPart = {
    readonly kind: "element";
    readonly owner: SourceHostType;
} | {
    readonly kind: "tuple";
    readonly owner: SourceHostType;
    readonly index: number;
} | {
    readonly kind: "type-argument";
    readonly owner: SourceHostType;
    readonly index: number;
} | {
    readonly kind: "member";
    readonly owner: SourceHostType;
    readonly symbol: SourceHostSymbol;
    readonly declaration: Node;
} | {
    readonly kind: "index";
    readonly owner: SourceHostType;
    readonly key: SourceHostType;
    readonly declaration: Node;
} | {
    readonly kind: "callable-result";
    readonly owner: SourceHostType;
    readonly declaration: Node;
} | {
    readonly kind: "callable-parameter";
    readonly owner: SourceHostType;
    readonly index: number;
    readonly declaration: Node;
} | {
    readonly kind: "union-member";
    readonly owner: SourceHostType;
    readonly member: SourceHostType;
    readonly index: number;
};
/** One recorded G4 inference contribution (Legacy journal) of a call: binder, origin and the source/formal paths. */
export interface SourceHostContribution {
    readonly typeParameter: SourceHostType;
    readonly origin: {
        readonly kind: "argument";
        readonly subject: Node;
        readonly effectiveArgumentIndex: number;
        readonly parameterIndex: number;
    } | {
        readonly kind: "receiver" | "contextual-result";
        readonly subject: Node;
    };
    readonly sourcePath: readonly SourceHostContributionPathPart[];
    readonly formalPath: readonly SourceHostContributionPathPart[];
}
/** Which primitive fact applies to a value, in this order: the value node, its declaration, its type, an annotation. */
export interface SourceHostPrimitiveSubjects {
    readonly node?: Node;
    readonly declaration?: Node;
    readonly type?: SourceHostType;
    readonly annotation?: Node;
}
export interface SourceHostQueries {
    readonly [sourceHostQueriesBrand]: "SourceHostQueries";
    call(node: Node): SourceHostCall | undefined;
    /** The selected signature's declaration; undefined for an intrinsic signature. */
    callSignature(call: SourceHostCall): Node | undefined;
    /** The selected result (declared return of the selected signature) and its authored return annotation. */
    callResult(call: SourceHostCall): {
        readonly resultType: SourceHostType;
        readonly authoredTypeNode?: Node;
    } | undefined;
    /** The type parameter declaration a selected method type argument binds. */
    callTypeParameter(invocation: Node, call: SourceHostCall, argument: SourceHostMethodTypeArgument): Node | undefined;
    methodTypeArgumentComponent(argument: SourceHostMethodTypeArgument): SourceHostComponent;
    /** The G4 journal of the call; undefined when Legacy recorded none. */
    inferenceContributions(call: SourceHostCall): readonly SourceHostContribution[] | undefined;
    propertyAccess(node: Node): SourceHostAccess | undefined;
    elementAccess(node: Node): SourceHostAccess | undefined;
    objectLiteralElement(property: Node): SourceHostObjectLiteralElement | undefined;
    /** The member of the literal's own construction that an authored property element creates. */
    objectLiteralProperty(element: SourceHostObjectLiteralElement): SourceHostProperty | undefined;
    /** The accessor or method declaration an authored method/accessor element creates (read declaration first). */
    objectLiteralAccessor(element: SourceHostObjectLiteralElement, property: SourceHostProperty): Node | undefined;
    /** The checker's iteration selection at a for-of/for-in statement or spread: its subject and selected element type. */
    iteration(node: Node): {
        readonly subjectKind: string;
        readonly subject: Node;
        readonly elementType: SourceHostType;
    } | undefined;
    generator(node: Node): SourceHostGenerator | undefined;
    callableCompletion(node: Node): {
        readonly canFallThrough: boolean;
    } | undefined;
    propertyName(name: Node): SourcePropertyNameSelection | undefined;
    /** Whether a function expression or arrow function has a contextual (destination) type. */
    hasContextualType(node: Node): boolean;
    declaredType(declaration: Node): SourceHostType | undefined;
    declaredValueType(declaration: Node): SourceHostType | undefined;
    authoredType(node: Node): SourceHostType | undefined;
    declarationSignature(declaration: Node): SourceHostSignatureInfo | undefined;
    isDefaultLibrary(node: Node): boolean;
    /** The class, interface, alias, enum, type literal or type parameter declaration that names a type. */
    typeDeclaration(type: SourceHostType, authoredTypeNode?: Node, excluded?: ReadonlySet<Node>): Node | undefined;
    /** All declarations of the type's symbol. */
    typeSymbolDeclarations(type: SourceHostType): readonly Node[];
    /** The primary declaration of the type's symbol. */
    primaryTypeDeclaration(type: SourceHostType): Node | undefined;
    /** The primary declaration of a property's symbol. */
    propertyDeclaration(property: SourceHostProperty): Node | undefined;
    homomorphicInput(type: SourceHostType, authoredTypeNode?: Node): SourceHostType | undefined;
    memberOrigin(property: SourceHostProperty, receiver: SourceHostType): SourceMemberOriginResult | undefined;
    /** The first primitive fact over the given subjects (value node, declaration, type, annotation). */
    primitive(subjects: SourceHostPrimitiveSubjects): SourcePrimitiveKind | undefined;
    /** The authored arms of `annotation` that make up `type` (a narrowed or selected type of the same annotation). */
    authoredSelection(annotation: Node, type: SourceHostType): SourceHostAuthoredSelection;
    isAny(type: SourceHostType): boolean;
    isUnknown(type: SourceHostType): boolean;
    isNonPrimitive(type: SourceHostType): boolean;
    isNullish(type: SourceHostType): boolean;
    /** The one absence classifier (sourceHostAbsentConstituent): null, undefined or void as a union constituent (A11). */
    isAbsentConstituent(type: SourceHostType): boolean;
    isUnion(type: SourceHostType): boolean;
    isIntersection(type: SourceHostType): boolean;
    isTuple(type: SourceHostType): boolean;
    isArrayLike(type: SourceHostType): boolean;
    isVoidLike(type: SourceHostType): boolean;
    isBooleanLike(type: SourceHostType): boolean;
    isNumberLike(type: SourceHostType): boolean;
    isStringLike(type: SourceHostType): boolean;
    isSymbolLike(type: SourceHostType): boolean;
    isNever(type: SourceHostType): boolean;
    isBigIntLike(type: SourceHostType): boolean;
    stringLiteralValue(type: SourceHostType): string | undefined;
    numericLiteralValue(type: SourceHostType): number | bigint | undefined;
    booleanLiteralValue(type: SourceHostType): boolean | undefined;
    literalBaseType(type: SourceHostType): SourceHostType | undefined;
    /** The declaration an authored type reference names (declaration identity only). */
    authoredTypeDeclaration(node: Node): Node | undefined;
    /** The member key of an authored property name: a string or finite number literal key, or a unique symbol. */
    propertyNameKey(name: Node): SourceMemberKey | undefined;
    members(type: SourceHostType): readonly SourceHostType[];
    tupleElements(type: SourceHostType): readonly SourceHostTupleElement[];
    tupleElementTypes(type: SourceHostType): readonly SourceHostType[];
    typeArguments(type: SourceHostType): readonly SourceHostType[];
    typeArgumentBindings(type: SourceHostType): readonly SourceHostTypeArgumentBinding[] | undefined;
    aliasApplication(type: SourceHostType): SourceHostAliasApplication | undefined;
    /** The application of an alias declaration to the given argument types. */
    instantiateAlias(declaration: Node, arguments_: readonly SourceHostType[]): SourceHostAliasApplication | undefined;
    indexes(type: SourceHostType): readonly SourceHostIndex[];
    properties(type: SourceHostType): readonly SourceHostProperty[];
    callable(type: SourceHostType): SourceHostCallable | undefined;
    signatures(type: SourceHostType, kind: "call" | "construct"): readonly SourceHostSignatureInfo[];
    couldContainTypeVariables(type: SourceHostType): boolean;
    nonNullableType(type: SourceHostType): SourceHostType | undefined;
    arrayElementType(type: SourceHostType): SourceHostType | undefined;
    instantiatedBaseTypes(type: SourceHostType): readonly SourceHostType[] | undefined;
    isIdentical(left: SourceHostType, right: SourceHostType): boolean;
}
export declare const hostType: (type: Type) => SourceHostType;
export declare const checkerType: (type: SourceHostType) => Type;
export declare const hostTypes: (types: readonly Type[]) => readonly SourceHostType[];
export declare const hostComponent: (component: SourceTypeComponentEvidence) => SourceHostComponent;
export declare const checkerComponent: (component: SourceHostComponent) => SourceTypeComponentEvidence;
export declare const hostCall: (call: ResolvedSourceCallInfo) => SourceHostCall;
export declare const checkerCall: (call: SourceHostCall) => ResolvedSourceCallInfo;
/**
 * The checker flow witness at a read: whether the value read there can be null/undefined. A selection witness only (R3):
 * the Host uses it to keep or drop the absence arm of its own descriptor, never as a type.
 */
export type SourceHostPresence = "present" | "possibly-absent" | "absent";
/**
 * The one absence classifier over checker input (R4: every host-input presence, absence-admission and narrowed-arm
 * answer reads it). A constituent is absence when it is null, undefined or void: a `void` union arm is absence (WP0
 * A11), exactly as the Host union builder makes it (terms.ts). A bare `void` is not absence: it is the void intrinsic.
 */
export declare function sourceHostAbsentConstituent(types: SourceFileSemantics["types"], type: Type): boolean;
/** The presence of a checker type under the one absence classifier. */
export declare function sourceHostPresence(types: SourceFileSemantics["types"], type: Type): SourceHostPresence;
/** The per-file query facade. One per checker file view, owned by the program's host-input adapter (I5). */
export declare function createSourceHostQueries(ast: AstReader, queries: SourceFileSemantics, sourceFacts: ReadonlySourceFactResolver, source: Parameters<typeof sourceTypeFlowHomomorphicInput>[0]): SourceHostQueries;
/**
 * The declaration that names a checked type: the authored reference's declaration first, else the type's alias or
 * type symbol declarations (class, interface, alias, enum, type literal, or the type parameter whose declared type it is).
 */
export declare function sourceHostTypeDeclaration(ast: AstReader, queries: SourceFileSemantics, type: Type, authoredTypeNode?: Node, excludedDeclarations?: ReadonlySet<Node>): Node | undefined;
export {};
//# sourceMappingURL=queries.d.ts.map
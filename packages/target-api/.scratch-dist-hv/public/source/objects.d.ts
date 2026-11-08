import type { Node } from "@tsonic/tsts";
import type { SourceMemberKey, SourceTypeDescriptor, SourceTypeDescriptorSignature } from "../../source-semantics/descriptor-model.js";
import type { SourceRefusal, SourceTypeofCategoryName } from "./facts.js";
import type { SourceCallSelection } from "./selections.js";
export interface SourceObjectMember {
    readonly key: SourceMemberKey;
    readonly name: string;
    readonly kind: "property" | "method" | "get" | "set" | "accessor-pair";
    readonly declarations: readonly Node[];
    readonly type: SourceTypeDescriptor;
    readonly writeType?: SourceTypeDescriptor;
    readonly optional: boolean;
    readonly readonly: boolean;
    readonly static: boolean;
    readonly owner: Node;
    readonly inherited: boolean;
}
export interface SourceHeritageEdge {
    readonly kind: "extends" | "implements";
    readonly declaration: Node;
    readonly heritage: Node;
    readonly target: Node;
    readonly typeArguments: readonly SourceTypeDescriptor[];
    /**
     * The base reference as the Host describes it: the Host descriptor of the heritage type node (`values.type(heritage)`),
     * the target applied to `typeArguments`, with its `definition`. For a class `extends` clause it is the base
     * constructor's instance type (`extends Error` gives the Error interface, not ErrorConstructor).
     */
    readonly type: SourceTypeDescriptor;
}
export interface SourceConstructFacts {
    readonly declaration: Node;
    readonly implicit: boolean;
    readonly signatures: readonly SourceTypeDescriptorSignature[];
}
export interface SourceMemberImplementation {
    readonly contract: Node;
    readonly implementation: Node;
    readonly overridesBase: boolean;
    readonly hasDerivedOverride: boolean;
}
export interface SourceObjectFacts {
    /** Members of a type in declaration order, inherited members after own. */
    members(type: SourceTypeDescriptor): readonly SourceObjectMember[] | SourceRefusal;
    member(type: SourceTypeDescriptor, key: SourceMemberKey): SourceObjectMember | undefined;
    indexes(type: SourceTypeDescriptor): readonly {
        readonly key: SourceTypeDescriptor;
        readonly value: SourceTypeDescriptor;
        readonly readonly: boolean;
        readonly declaration: Node;
    }[];
    heritage(declaration: Node): readonly SourceHeritageEdge[] | SourceRefusal;
    /**
     * The instance type of a class or interface declaration (R3 #17): its Host descriptor, declared with its definition;
     * for a class expression the declared reference its constructions produce. Any other node is an invariant failure.
     */
    selfType(declaration: Node): SourceTypeDescriptor | SourceRefusal;
    construction(declaration: Node): SourceConstructFacts | SourceRefusal;
    implementation(classDeclaration: Node, contractMember: Node): SourceMemberImplementation | "unrelated" | SourceRefusal;
    contracts(implementation: Node): readonly Node[] | SourceRefusal;
    /**
     * The implementation declaration of a project callable contract: a function, method, accessor or constructor
     * declaration, or a method signature merged with a class method. A contract with a body is its own implementation; a
     * bodyless one (an overload signature, or a signature merged with its implementation) yields the one declaration of
     * the same entity and callable kind that has a body. "unrelated": the contract is not a project callable declaration,
     * or no callable declaration of its entity has a body (interface and abstract members, ambient
     * declarations). TSONIC_SOURCE_CALLABLE_IMPLEMENTATION_UNRESOLVED: a callable declaration of the entity has a body but
     * no single implementation of the contract's kind exists (refusal at the contract, collected in `refusals()`).
     */
    callableImplementation(contract: Node): Node | "unrelated" | SourceRefusal;
    /** Own enumerable property keys of a value in producer order, or ambiguous (A17/R12). */
    ownKeys(value: Node): readonly SourceMemberKey[] | "ambiguous";
    /**
     * The members of a type joined over its present arms: a member exists only when every present arm has it (joined by
     * name). undefined when the type has no present arm, an arm is open (any / unknown), or an arm's members are refused.
     */
    joinedMembers(type: SourceTypeDescriptor): readonly SourceJoinedMember[] | undefined;
    /**
     * The structural member correspondence from a source type to a destination type, joined by member name. A union side
     * has its pairs (for one-member selection) but no whole correspondence ("unresolved-shape"). "read": a present member
     * must be readable.
     */
    correspondence(from: SourceTypeDescriptor, to: SourceTypeDescriptor, purpose: "correspondence" | "read"): SourceMemberCorrespondence;
    /** The pair of one destination member declaration; undefined unless exactly one pair names it (and is usable). */
    correspondingMember(from: SourceTypeDescriptor, to: SourceTypeDescriptor, declaration: Node, purpose: "correspondence" | "read"): SourceMemberPair | undefined;
    /**
     * The pair of one destination member declaration for an object literal VALUE (its physical members, not its Host type:
     * the Host type of a contextually typed literal is its destination type, B4 D8). The source is the literal element
     * that supplies the member at runtime (the last element of that name in element order, a getter and setter of one
     * name together, present and not optional), or the member of a later spread operand's Host type; "absent" when no
     * element supplies it. A declaration that is an element of the literal itself pairs with that element. undefined when
     * the supplying element cannot be named exactly, a spread operand's member is optional or its members are not joined,
     * or no single destination member has the declaration.
     */
    literalCorrespondingMember(literal: Node, to: SourceTypeDescriptor, declaration: Node, purpose: "correspondence" | "read"): SourceMemberPair | undefined;
}
/** One member of a type joined over its present arms (objects.joinedMembers). */
export interface SourceJoinedMember {
    readonly name: string;
    /** Optional in some arm. */
    readonly optional: boolean;
    /** Read-only in some arm (readonly property or getter-only member). */
    readonly readonly: boolean;
    /** The type the member was selected from. */
    readonly receiverType: SourceTypeDescriptor;
    readonly declarations: readonly Node[];
    readonly getters: readonly Node[];
    readonly setters: readonly Node[];
    readonly read: "property" | "accessor" | "method" | "unavailable";
    /** The read type: the arms' member types through the one union builder (sums.join); undefined when not formed. */
    readonly type: SourceTypeDescriptor | undefined;
}
export type SourceMemberPair = {
    readonly kind: "present";
    readonly destination: SourceJoinedMember;
    readonly source: SourceJoinedMember;
} | {
    readonly kind: "absent";
    readonly destination: SourceJoinedMember;
};
export type SourceMemberCorrespondence = ({
    readonly kind: "available";
    readonly members: readonly SourceMemberPair[];
} | {
    readonly kind: "unavailable";
    readonly reason: "unresolved-shape" | "missing-required-member" | "unreadable-member" | "disjoint-shape";
}) & {
    readonly pairs: readonly SourceMemberPair[];
};
/** A collection key category: a typeof category other than "undefined" (Q86). */
export type SourceKeyCategory = Exclude<SourceTypeofCategoryName, "undefined">;
export type SourceJsCollectionKind = "array" | "readonly-array" | "typed-array" | "set" | "map" | "weak-set" | "weak-map" | "string";
export interface SourceJsCollectionFacts {
    readonly kind: SourceJsCollectionKind;
    readonly element?: SourceTypeDescriptor;
    readonly key?: SourceTypeDescriptor;
    readonly value?: SourceTypeDescriptor;
}
/** Target-neutral meaning of a JS standard library member (the Source half of the target tables). */
export interface SourceJsApiMember {
    readonly declaration: Node;
    readonly owner: SourceJsCollectionKind | "object" | "promise" | "regexp" | "number" | "math" | "json" | "intl" | "date" | "global" | "symbol" | "bigint" | "error" | "binary";
    readonly name: string;
    readonly receiver: "mutating" | "readonly" | "static";
    readonly parameters: readonly ("value" | "callback" | "index" | "count" | "key" | "options" | "rest")[];
    readonly result: "receiver" | "element" | "new-collection" | "value" | "boolean" | "number" | "string" | "void" | "iterator";
    readonly effects: {
        readonly invokesCallbacks: boolean;
        readonly storesArguments: boolean;
    };
}
/** The JS standard-library identity of a declaration (D18): its declaring entity and member name. */
export interface SourceJsApiIdentity {
    readonly kind: "type" | "member" | "indexer" | "call" | "construct";
    /** The declaring interface / class / alias (`Map`, `ArrayConstructor`); `Global` for top-level functions. */
    readonly declaringName?: string;
    readonly name?: string;
    readonly declaration: Node;
}
/** The global binding a JS API operation belongs to (`Object`, `Error`), with the provider that declares it. */
export interface SourceJsGlobalBinding {
    readonly name: string;
    readonly providerId: string;
}
/** What a JS API call does to storage: its result aliases an argument, is a fresh allocation, or resumes the receiver. */
export interface SourceJsCallStorageEffect {
    readonly resultAlias?: Node;
    readonly resultAllocation?: Node;
    readonly resumeReceiver?: true;
}
/**
 * The storage effect of one JS API call, with the operation declaration (the selected signature) and how the call names
 * it: through a member of its global binding (`Object.freeze(x)`), through the binding as a value (`new Error()`,
 * `Error()`), or through its receiver (`generator.next()`).
 */
export type SourceJsCallStorage = {
    readonly declaration: Node;
    readonly effect: SourceJsCallStorageEffect;
} & ({
    readonly form: "member" | "value";
    readonly binding: SourceJsGlobalBinding;
} | {
    readonly form: "receiver";
});
/** A native constructor a JS global binding constructs (`new Error()`): the construct signature and the binding. */
export interface SourceJsNativeConstructorStorage {
    readonly declaration: Node;
    readonly binding: SourceJsGlobalBinding;
}
/** When a JS API call runs a callback argument, and which values flow into the callback parameters. */
export interface SourceJsCallbackEffect {
    readonly parameterIndex: number;
    readonly timing: "synchronous" | "deferred";
    /** The parameter index (in the callback) of the rejection function it receives (`new Promise((resolve, reject) => …)`). */
    readonly rejection?: number;
    readonly inputs?: readonly {
        readonly parameterIndex: number;
        readonly from: "receiver-element" | "argument-element" | "receiver-rejection";
        readonly sourceParameterIndex?: number;
    }[];
}
/**
 * The JS API profile facts (D18), all read from one meaning table keyed by the JS API identity. The effect members
 * (callStorage, callbackEffects, nativeConstructorStorage) also cover the shared base declarations a target source
 * profile includes, for their constructor and call signatures and native operations only.
 */
export interface SourceJsApiFacts {
    /** The JS API identity of a JS profile declaration; undefined for any other declaration. */
    identity(declaration: Node): SourceJsApiIdentity | undefined;
    collection(type: SourceTypeDescriptor): SourceJsCollectionFacts | undefined;
    member(declaration: Node): SourceJsApiMember | undefined;
    /**
     * The Source refusal of calling this JS API member (`Generator.throw`, `Object.isFrozen`), or undefined when calling
     * it is supported. The Host raises it at every call that selects the member (facts.refusals()).
     */
    callRefusal(declaration: Node): {
        readonly code: string;
        readonly message: string;
    } | undefined;
    /**
     * The Source key category of each present arm of a union key or set element type, in authored arm order (Q77, Q82,
     * Q86): the N3' typeof category of the arm's Host type (int64 / uint64 / int128 / uint128 are bigint), "function" and
     * an arm proving no category taken as "object". undefined for a key type that is not a union.
     */
    keyCategories(type: SourceTypeDescriptor): readonly SourceKeyCategory[] | undefined;
    /** The storage effect of a call whose selected signature is a JS API operation; undefined when it has none. */
    callStorage(call: SourceCallSelection): SourceJsCallStorage | undefined;
    /**
     * The callback effects of a call whose selected signature is a JS API operation. An empty list is a classified
     * operation that runs no callback; undefined means the operation has no callback classification.
     */
    callbackEffects(call: SourceCallSelection): readonly SourceJsCallbackEffect[] | undefined;
    /**
     * The parameter indexes of a JS profile member whose callback arguments the member only invokes during the call (never
     * retains or defers); empty for every other declaration.
     */
    invocationOnlyParameters(declaration: Node): readonly number[];
    /** The native constructor storage of a JS API construct signature (`new Error()`); undefined otherwise. */
    nativeConstructorStorage(declaration: Node): SourceJsNativeConstructorStorage | undefined;
}
//# sourceMappingURL=objects.d.ts.map
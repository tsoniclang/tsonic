// SourceObjectFacts (G8) and SourceJsApiFacts (D18). Replace propertyInfos / indexInfos / isTuple /
// structural member queries, heritage edges with selected Types, class constructor Signatures (I1).
import type { Node } from "@tsonic/tsts";
import type {
  SourceMemberKey,
  SourceTypeDescriptor,
  SourceTypeDescriptorSignature,
} from "../../source-semantics/local-type-flow/types.js";
import type { SourceRefusal } from "./facts.js";

export interface SourceObjectMember {
  readonly key: SourceMemberKey;
  readonly name: string;
  readonly kind: "property" | "method" | "get" | "set" | "accessor-pair";
  readonly declarations: readonly Node[];
  readonly type: SourceTypeDescriptor;              // read type; for accessors the getter result
  readonly writeType?: SourceTypeDescriptor;        // when different from the read type
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly static: boolean;
  readonly owner: Node;                             // declaring class / interface / literal
  readonly inherited: boolean;
}

export interface SourceHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly declaration: Node;
  readonly heritage: Node;
  readonly target: Node;
  readonly typeArguments: readonly SourceTypeDescriptor[];
}

export interface SourceConstructFacts {
  readonly declaration: Node;
  readonly implicit: boolean;
  readonly signatures: readonly SourceTypeDescriptorSignature[];
  /** Parameter properties and field initializers in execution order (class init regions). */
  readonly initialization: readonly { readonly member: Node; readonly region: "parameter-property" | "field" | "constructor-body" }[];
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
  indexes(type: SourceTypeDescriptor): readonly { readonly key: SourceTypeDescriptor; readonly value: SourceTypeDescriptor;
    readonly readonly: boolean; readonly declaration: Node }[];
  heritage(declaration: Node): readonly SourceHeritageEdge[] | SourceRefusal;
  heritagePath(from: Node, to: Node): readonly SourceHeritageEdge[] | "unrelated" | SourceRefusal;
  construction(declaration: Node): SourceConstructFacts | SourceRefusal;
  implementation(classDeclaration: Node, contractMember: Node): SourceMemberImplementation | "unrelated" | SourceRefusal;
  contracts(implementation: Node): readonly Node[] | SourceRefusal;
  /** Members an object literal must supply for its destination (required-member coverage). */
  requiredMembers(objectLiteral: Node): readonly SourceObjectMember[];
  /** Own enumerable property keys of a value in producer order, or ambiguous (A17/R12). */
  ownKeys(value: Node): readonly SourceMemberKey[] | "ambiguous";
}

export type SourceJsCollectionKind = "array" | "readonly-array" | "typed-array" | "set" | "map" | "weak-set" | "weak-map" | "string";

export interface SourceJsCollectionFacts {
  readonly kind: SourceJsCollectionKind;
  readonly element?: SourceTypeDescriptor;          // array / set / typed array element
  readonly key?: SourceTypeDescriptor;              // map key
  readonly value?: SourceTypeDescriptor;            // map value
}

/** Target-neutral meaning of a JS standard library member (the Source half of the target tables). */
export interface SourceJsApiMember {
  readonly declaration: Node;
  readonly owner: SourceJsCollectionKind | "object" | "promise" | "regexp" | "number" | "math" | "json" | "intl" | "date" | "global"
    | "symbol" | "bigint" | "error" | "binary";
  readonly name: string;
  readonly receiver: "mutating" | "readonly" | "static";
  readonly parameters: readonly ("value" | "callback" | "index" | "count" | "key" | "options" | "rest")[];
  readonly result: "receiver" | "element" | "new-collection" | "value" | "boolean" | "number" | "string" | "void" | "iterator";
  readonly effects: { readonly invokesCallbacks: boolean; readonly storesArguments: boolean };
}

export interface SourceJsApiFacts {
  collection(type: SourceTypeDescriptor): SourceJsCollectionFacts | undefined;
  member(declaration: Node): SourceJsApiMember | undefined;
}

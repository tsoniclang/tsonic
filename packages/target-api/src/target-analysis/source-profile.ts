import type { AstReader, Node, ProviderVirtualDeclarationFact } from "@tsonic/tsts";
import type { SourceApplication, SourceDescriptorView, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";

export interface SourceJsApiIdentity {
  readonly kind: "type" | "member" | "indexer" | "call" | "construct";
  readonly declaringName: string | undefined;
  readonly name: string | undefined;
  readonly declaration: Node;
}

export type SourceJsCollectionFacts =
  | { readonly kind: "string" }
  | { readonly kind: "array" | "readonly-array" | "typed-array" | "set" | "weak-set"; readonly element: SourceTypeEvidence }
  | { readonly kind: "map" | "weak-map"; readonly key: SourceTypeEvidence; readonly value: SourceTypeEvidence };

export interface SourceJsApiMember {
  readonly declaration: Node;
  readonly owner: "array" | "readonly-array" | "typed-array" | "set" | "weak-set" | "map" | "weak-map"
    | "string" | "promise" | "regexp" | "number" | "math" | "json" | "object" | "global" | "date"
    | "symbol" | "bigint" | "error" | "binary" | "intl";
  readonly name: string;
  readonly receiver: "readonly" | "mutating" | "static";
  readonly parameters: readonly ("value" | "callback" | "index" | "count" | "key" | "options" | "rest")[];
}

export interface SourceJsCallbackEffect {
  readonly parameterIndex: number;
  readonly timing: "synchronous" | "deferred";
  readonly rejection?: number;
  readonly inputs?: readonly {
    readonly parameterIndex: number;
    readonly from: "receiver-element" | "argument-element" | "receiver-rejection";
    readonly sourceParameterIndex?: number;
  }[];
}

export interface SourceJsGlobalBinding {
  readonly name: string;
  readonly providerId: string;
}

export type SourceJsCallStorageEffect =
  | { readonly kind: "result-alias"; readonly argument: Node }
  | { readonly kind: "result-allocation"; readonly allocation: Node }
  | { readonly kind: "receiver-resume" };

export type SourceJsCallStorage = {
  readonly declaration: Node;
  readonly effect: SourceJsCallStorageEffect;
} & (
  | { readonly form: "member" | "value"; readonly binding: SourceJsGlobalBinding }
  | { readonly form: "receiver" }
);

export interface SourceJsNativeConstructorStorage {
  readonly declaration: Node;
  readonly binding: SourceJsGlobalBinding;
}

export interface SourceJsArrayMemberEffect {
  readonly kind: "length" | "copy" | "entries" | "method";
  readonly mayShrink?: boolean;
  readonly callbackReceiverIndex?: number;
}

export interface SourceJsApiFactsInput {
  readonly syntax: AstReader;
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly assertApplication: (application: SourceApplication) => void;
  readonly profileDeclaration: (node: Node) => "js" | "shared" | undefined;
  readonly providerDeclaration: (node: Node) => ProviderVirtualDeclarationFact | undefined;
  readonly wellKnownSymbol: (node: Node) => string | undefined;
}

export interface SourceJsApiFacts {
  identity(declaration: Node): SourceJsApiIdentity | undefined;
  member(declaration: Node): SourceJsApiMember | undefined;
  collection(value: SourceTypeEvidence): SourceResult<SourceJsCollectionFacts | undefined>;
  arrayMemberEffect(declaration: Node): SourceJsArrayMemberEffect | undefined;
  callStorage(application: SourceApplication): SourceJsCallStorage | undefined;
  callbackEffects(application: SourceApplication): readonly SourceJsCallbackEffect[] | undefined;
  invocationOnlyParameters(declaration: Node): readonly number[];
  nativeConstructorStorage(declaration: Node): SourceJsNativeConstructorStorage | undefined;
  callRefusal(declaration: Node): { readonly code: string; readonly message: string } | undefined;
}

export type SourceJsApiFactsFactory = (input: SourceJsApiFactsInput) => SourceJsApiFacts;

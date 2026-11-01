import { type Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../../../packages/target-api/src/source-semantics/types.js";
export declare function nativeEntryFixture(text: string, timing?: "synchronous" | "deferred"): {
    source: TargetSourceProgram;
    nodes: Node[];
    query: (maximumSteps?: number, exemptTypeParameter?: (node: Node) => boolean) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved | {
        readonly kind: "resolved";
        readonly issues: readonly import("../../../../../packages/target-api/src/target-analysis/ownership/generic-adoption.js").SourceGenericAdoptionIssue[];
    };
    textFor: (node: Node) => string;
};
export declare const nativePayloadContinuationCases: readonly [{
    readonly name: "source-helper";
    readonly declarations: "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }";
    readonly ordinary: "send(resolve, 7);";
    readonly adopter: "send((actual: number): void => { void actual; }, 7);";
    readonly expression: "done(value)";
}, {
    readonly name: "source-helper-chain";
    readonly declarations: "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function forward<Part>(done: (value: Part) => void, value: Part): void { send(done, value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { forward(done, value); }; }";
    readonly ordinary: "send(resolve, 7);";
    readonly adopter: "send((actual: number): void => { void actual; }, 7);";
    readonly expression: "done(value)";
}, {
    readonly name: "native-forwarded-helper";
    readonly declarations: "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }";
    readonly ordinary: "send(resolve, 7);";
    readonly adopter: "send((actual: number): void => { void actual; }, 7);";
    readonly expression: "done(value)";
}, {
    readonly name: "default-helper";
    readonly declarations: "function send<Part>(done: (value: Part) => void, value: Part, actual: Part = value): void { done(actual); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }";
    readonly ordinary: "send(resolve, 7);";
    readonly adopter: "send((actual: number): void => { void actual; }, 7);";
    readonly expression: "done(actual)";
}, {
    readonly name: "component-helper";
    readonly declarations: "function send<Part>(done: (value: Part) => void, input: { payload: Part }): void { done(input.payload); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, { payload: value }); }; }";
    readonly ordinary: "send(resolve, { payload: 7 });";
    readonly adopter: "send((actual: number): void => { void actual; }, { payload: 7 });";
    readonly expression: "done(input.payload)";
}, {
    readonly name: "recursive-helper";
    readonly declarations: "function send<Part>(done: (value: Part) => void, value: Part, depth: number): void { if (depth > 0) send(done, value, depth - 1); else done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value, 1); }; }";
    readonly ordinary: "send(resolve, 7, 1);";
    readonly adopter: "send((actual: number): void => { void actual; }, 7, 1);";
    readonly expression: "done(value)";
}, {
    readonly name: "receiver-helper";
    readonly declarations: "class Relay<Part> { constructor(readonly done: (value: Part) => void, readonly value: Part) {} run(): void { this.done(this.value); } } function make<Part>(done: (value: Part) => void, value: Part): () => void { const relay = new Relay(done, value); return () => { relay.run(); }; }";
    readonly ordinary: "new Relay(resolve, 7).run();";
    readonly adopter: "new Relay((actual: number): void => { void actual; }, 7).run();";
    readonly expression: "this.done(this.value)";
}];
export declare function fixture(text: string, projectRoot?: string): {
    source: TargetSourceProgram;
    nodes: Node[];
    query: (maximumSteps?: number, exemptTypeParameter?: (node: Node) => boolean) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved | {
        readonly kind: "resolved";
        readonly issues: readonly import("../../../../../packages/target-api/src/target-analysis/ownership/generic-adoption.js").SourceGenericAdoptionIssue[];
    };
    textFor: (node: Node) => string;
};
export declare function sourcePosition(source: TargetSourceProgram, node: Node, finish?: boolean): {
    line: number;
    column: number;
};
export declare function assertDeclaredAdoption(current: ReturnType<typeof fixture>, expected: 0, call: string): void;
export declare function sourceSpan(source: TargetSourceProgram, node: Node): {
    line: number;
    column: number;
    fileName: string;
    endLine: number;
    endColumn: number;
};
export declare const identity = "async function identity<T>(value: T) { return value; }";
export declare const declarations: readonly [readonly ["direct return", "async function identity<T>(value: T) { return value; }", "identity"], readonly ["await forwarding", "async function identity<T>(value: T) { return value; }\nasync function outer<V>(value: V) { await identity(value); }", "outer"], readonly ["local await forwarding", "async function identity<T>(value: T) { return value; }\nasync function outer2<V>(value: V) { const result = await identity(value); return 0; }", "outer2"], readonly ["synchronous forwarding", "async function identity<T>(value: T) { return value; }\nfunction sync<V>(value: V): void { void identity(value); }", "sync"], readonly ["pending forwarding", `async function later<T>(value: T, pending: Promise<void>) { await pending; return value; }
    async function outer3<V>(value: V) { await later(value, Promise.resolve(undefined)); }`, "outer3"], readonly ["generic resolving call", "function wrap<T>(value: T): void { void Promise.resolve(value); }", "wrap"], readonly ["nested async arrow", "function nested<T>(value: T) { return async () => value; }", "nested"], readonly ["reaction return", "function reaction<T>(value: T) { void Promise.resolve(0).then(() => value); }", "reaction"], readonly ["reaction catch", "function caught<T>(value: T) { void Promise.resolve(0).catch(() => value); }", "caught"], readonly ["reaction finally", "function final<T>(value: T) { void Promise.resolve(0).finally(() => value); }", "final"], readonly ["PromiseLike reaction", `function likeReaction<T>(value: T): void {
    const pending: PromiseLike<number> = Promise.resolve(0); void pending.then(() => value);
  }`, "likeReaction"], readonly ["named reaction", "function named<T>(value: T) { function read(): T { return value; } void Promise.resolve(0).then(read); }", "named"], readonly ["resolve callback", "function resolving<T>(value: T) { return new Promise<T>(resolve => { resolve(value); }); }", "resolving"], readonly ["aliased resolver", "function aliased<T>(value: T) { return new Promise<T>(resolve => { const done = resolve; done(value); }); }", "aliased"], readonly ["named executor", `function namedExecutor<T>(value: T) {
    function execute(resolve: (value: T | PromiseLike<T>) => void): void { resolve(value); }
    return new Promise<T>(execute);
  }`, "namedExecutor"], readonly ["resolver helper", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    function deliver(callback: (value: T) => void): void { callback(value); } deliver(resolve);
  }); }`, "helper"], readonly ["generic resolver helper", `function deliver<V>(callback: (value: V) => void, value: V): void { callback(value); }
    function helper<T>(value: T) { return new Promise<T>(resolve => deliver(resolve, value)); }`, "helper"], readonly ["member resolver", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    const cell = { done: resolve }; const alias = cell.done; alias(value);
  }); }`, "helper"], readonly ["typed returned executor", `type Executor<T> = (resolve: (value: T | PromiseLike<T>) => void) => void;
    function make<T>(value: T): Executor<T> { return resolve => resolve(value); }
    function helper<T>(value: T) { return new Promise<T>(make(value)); }`, "helper"], readonly ["generic callable body unknown", "function unknown<Value>(callback: <T>(value: T) => Promise<T>, value: Value): void {\n    void callback(value);\n  }\nfunction unknownRoot<Value>(value: Value): void { unknown(identity, value); }\nasync function identity<T>(value: T) { return value; }", "unknownRoot"]];

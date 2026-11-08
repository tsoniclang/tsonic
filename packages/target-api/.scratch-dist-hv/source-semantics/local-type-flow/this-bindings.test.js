import assert from "node:assert/strict";
import test from "node:test";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { createSourceHostInput } from "../../host-input/index.js";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { createSourceTypeDescriptorUnions } from "./terms.js";
function fixture(text) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length === 0, true, "the original Source fixture checks without diagnostics");
    const source = createSourceTypeFlowTestProgram(checked);
    const owner = source.navigation.nodes.find(node => source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node));
    const receiver = source.navigation.nodes.find(node => source.ast.kindName(node) === "KindThisKeyword");
    if (owner === undefined || receiver === undefined)
        throw new Error("The actual class and its original this occurrence are required.");
    const queries = source.semantics.forNode(receiver);
    const declared = queries.declarations.declaredType(owner);
    const bindings = declared === undefined ? undefined : queries.types.typeArgumentBindings(declared);
    if (bindings === undefined)
        throw new Error("The checked class declaration requires its complete argument vector.");
    return { source, unions: createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles), owner, receiver, declared, bindings, queries };
}
const examples = [
    { name: "outer and local", count: 2, text: `export function wrap<Outer>(first: Outer) {
    class Local<Inner> { first: Outer; value: Inner;
      constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
    return new Local<string>(first, "value"); }` },
    { name: "unused outer", count: 2, text: `export function wrap<Outer>() {
    class Local<Inner> { constructor(readonly value: Inner) {} read(): Inner { return this.value; } }
    return Local; }` },
    { name: "shadowed binder", count: 2, text: `export function wrap<Value>() {
    class Local<Value> { constructor(readonly value: Value) {} read(): Value { return this.value; } }
    return Local; }` },
    { name: "anonymous class", count: 2, text: `export function wrap<Outer>() {
    const Local = class<Inner> { constructor(readonly value: Inner) {} read(): Inner { return this.value; } };
    return Local; }` },
    { name: "nongeneric class", count: 0, text: `export class Plain { value: number = 0; read(): number { return this.value; } }` },
    { name: "outer-only capture", count: 1, text: `export function wrap<Outer>(value: Outer) {
    class Local { constructor(readonly value: Outer) {} read(): Outer { return this.value; } }
    return new Local(value); }` },
];
for (const example of examples)
    test(`a ${example.name} this-type retains the complete original checked binder vector`, () => {
        const current = fixture(example.text);
        assert.equal(current.bindings.length === example.count, true, "the independent checked owner vector has the expected arity");
        const outcome = current.source.effectiveTypes.get(current.receiver);
        assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared", true, "the exact receiver remains one resolved nominal instance");
        if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "declared")
            return;
        assert.equal(outcome.provenance.occurrence === current.receiver && outcome.type.declaration === current.owner, true, "the original receiver and class identities are unchanged");
        assert.equal(outcome.type.typeArguments.length === current.bindings.length, true, "no outer or local argument is omitted");
        for (const [index, binding] of current.bindings.entries()) {
            const argument = outcome.type.typeArguments[index];
            assert.equal(argument?.kind === "declared" && argument.declaration === binding.declaration && argument.typeArguments.length === 0, true, `argument ${index} is the identical original parameter, not a constraint or primitive substitute`);
        }
    });
for (const unavailable of ["missing", "foreign"])
    test(`a ${unavailable} checked this-owner binding vector cannot be reconstructed from syntax`, () => {
        const current = fixture(examples[0].text);
        const foreign = current.bindings[1];
        const changed = { ...current.queries, types: { ...current.queries.types,
                typeArgumentBindings(type) {
                    if (type !== current.declared)
                        return current.queries.types.typeArgumentBindings(type);
                    return unavailable === "missing" ? undefined : current.bindings.map((binding, index) => index === 0
                        ? { ...binding, declaration: foreign.declaration } : binding);
                } } };
        const source = { ...current.source, semantics: { ...current.source.semantics,
                forNode: (_node) => changed, forFile: () => changed } };
        const context = createSourceTypeFlowAnalysisContext(source, current.unions, createSourceHostInput(source));
        assert.equal(context.context.describe(current.receiver) === undefined, true, "missing or foreign owner evidence cannot manufacture a lexical capture vector");
    });
//# sourceMappingURL=this-bindings.test.js.map
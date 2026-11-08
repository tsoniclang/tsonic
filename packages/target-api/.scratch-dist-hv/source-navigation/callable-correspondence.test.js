import assert from "node:assert/strict";
import test from "node:test";
import { sourceCallArgumentCorrespondences, sourceExpressionCallArgument } from "./callable-arguments.js";
import { fixture } from "../../../../test/target-api/fixtures/source-navigation/callable-arguments-fixtures.mjs";
function selected(body) {
    const current = fixture(body, true);
    const location = sourceExpressionCallArgument(current.expression, current.source);
    assert.equal(location !== undefined, true, "original checked argument location");
    const call = location.call;
    const checked = current.source.navigation.call(call);
    assert.equal(checked !== undefined, true, "the host-input call witness");
    const context = { ast: current.source.ast, navigation: current.source.navigation };
    const injected = (record) => ({ ast: current.source.ast, navigation: { call: () => record } });
    return { ...current, call, checked: checked, context, injected };
}
test("call correspondence retains the original call, formal, binding and argument identities", () => {
    for (const body of [
        "consume((value: unknown): void => {});",
        "consume((((value: unknown): void => {})));",
        "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
        "new construct((value: unknown): void => {});",
    ]) {
        const current = selected(body);
        const rows = sourceCallArgumentCorrespondences(current.context, current.call);
        assert.equal(rows?.length, 1, body);
        const row = rows[0];
        assert.equal(row.bindingIndex, 0, body);
        assert.equal(row.binding === current.checked.bindings[0], true, body);
        assert.equal(row.parameter === current.checked.parameters[0], true, body);
        assert.equal(row.argument.expression === current.source.ast.arguments(current.call)[0], true, body);
        assert.equal(Object.isFrozen(row) && Object.isFrozen(rows), true, body);
    }
});
test("call correspondence keeps source and effective indexes distinct for spread elements", () => {
    const current = selected("declare function many(callback: () => void, ...values: number[]): void; many(() => {}, ...[1, 2] as const);");
    const rows = sourceCallArgumentCorrespondences(current.context, current.call);
    assert.equal(rows?.length, 3);
    assert.deepEqual(rows.map(row => row.bindingIndex), [0, 1, 2]);
    assert.deepEqual(rows.map(row => row.binding.sourceArgumentIndex), [0, 1, 1]);
    assert.deepEqual(rows.map(row => row.binding.effectiveArgumentIndex), [0, 1, 2]);
    assert.deepEqual(rows.map(row => row.binding.sourceForm), ["value", "spread-element", "spread-element"]);
    assert.deepEqual(rows.map(row => row.binding.spreadElementIndex), [undefined, 0, 1]);
    assert.equal(rows[1].argument.expression === rows[2].argument.expression, true, "one original spread, two checked elements");
    assert.equal(rows[1].parameter === rows[2].parameter, true, "one original rest formal");
});
test("call correspondence is an invariant failure for invalid indexes, foreign expressions and duplicate slots", () => {
    const current = selected("consume((value: unknown): void => {});");
    const binding = current.checked.bindings[0];
    const malformed = [
        ...[
            { sourceArgumentIndex: -1 }, { sourceArgumentIndex: 0.5 }, { sourceArgumentIndex: 1 },
            { effectiveArgumentIndex: -1 }, { effectiveArgumentIndex: 0.5 },
            { sourceParameterIndex: -1 }, { sourceParameterIndex: 0.5 }, { sourceParameterIndex: 1 },
            { sourceForm: "spread-element" }, { spreadElementIndex: 0 },
        ].map(invalid => ({ ...current.checked, bindings: [{ ...binding, ...invalid }] })),
        { ...current.checked, arguments: [{}] },
        { ...current.checked, arguments: [] },
        { ...current.checked, bindings: [binding, binding] },
        { ...current.checked, parameters: [{ ...current.checked.parameters[0], parameterIndex: 1 }] },
    ];
    for (const record of malformed) {
        assert.throws(() => sourceCallArgumentCorrespondences(current.injected(record), current.call), /A checked call/u, "a selected call witness that breaks its own vectors is a producer defect, never a silent unsupported input");
    }
    assert.equal(sourceCallArgumentCorrespondences(current.injected({ ...current.checked, selection: "untyped" }), current.call), undefined, "an untyped call has no correspondence");
});
test("call correspondence does not authorize an optional callback consumer", () => {
    const current = fixture("consume?.((value: unknown): void => {});", true);
    const parent = current.source.ast.parent(current.expression);
    assert.equal(parent !== undefined, true);
    assert.equal(sourceCallArgumentCorrespondences({ ast: current.source.ast, navigation: current.source.navigation }, parent)?.length, 1, "the checked relation exists independently of native callback policy");
    assert.equal(sourceExpressionCallArgument(current.expression, current.source) === undefined, true, "the location consumer keeps its original optional-call refusal");
});
test("call correspondence never reads a call of another checked program", () => {
    const current = selected("consume((value: unknown): void => {});");
    const foreign = selected("consume((value: unknown): void => {});");
    // R2 #49: the invariant text is matched (navigation input or the checked program's source-file query), so an
    // unrelated crash does not pass this negative.
    assert.throws(() => sourceCallArgumentCorrespondences(current.context, foreign.call), /(?:Navigation input requires a node of the checked program|Source-file queries require an exact source file from the checked program)/u, "a call node of another checked program has no witness in this program's input");
});
//# sourceMappingURL=callable-correspondence.test.js.map
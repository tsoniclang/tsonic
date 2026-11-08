import assert from "node:assert/strict";
import test from "node:test";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { createSourceHostInput } from "../../host-input/index.js";
import { isDeepStrictEqual } from "node:util";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive } from "@tsonic/tsts";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { TargetCompilerResourceLimitFailure } from "../../artifacts.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { createSourceTypeDescriptorUnions, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowDiscardedSelection } from "./value-syntax.js";
function fixture(text, noImplicitAny = true) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
            "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
            "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
        }, compilerOptions: { strict: true, noImplicitAny, target: "es2022", module: "esnext", moduleResolution: "bundler" },
        extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
                            exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const source = createSourceTypeFlowTestProgram(checked);
    const defaults = createSourceTypeFlowAnalysisContext(source, createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles), createSourceHostInput(source));
    const declaration = (name) => {
        const selected = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
        if (selected === undefined)
            throw new Error(`The original declaration ${name} is required.`);
        return selected;
    };
    return { source, defaults, declaration };
}
test("C2533 void union arms publish canonical absence while whole void and sole type arguments stay void", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
            "/src/node_modules/@test/words/index.d.ts": "export type uint64 = bigint;",
            "/src/index.ts": `import type { uint64 } from "@test/words";
      declare function fixed(value: uint64 | void): uint64 | void;
      declare function generic<Value>(value: Value | void): Value | void;
      declare function promised(value: Promise<void> | void): Promise<void> | void;
      function whole(): void {}
      declare const single: Promise<void>;
      export { fixed, generic, promised, whole, single };`,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
        extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
                            exports: [sourcePrimitive("uint64", "uint64", "bigint", false, 64)] }] })] } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    assert.equal(checked.extensionDiagnostics.length, 0);
    const source = createSourceTypeFlowTestProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The original union publications are required.");
    const nodes = [];
    const pending = [file];
    while (pending.length > 0) {
        const node = pending.pop();
        nodes.push(node);
        for (const child of source.ast.children(node))
            if (child !== undefined)
                pending.push(child);
    }
    const unions = nodes.filter(node => source.ast.is.IsUnionTypeNode(node));
    assert.equal(unions.length, 6, "the same checked three parameter and three return components are retained");
    const generic = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "generic");
    const originalParameter = generic === undefined ? undefined : source.ast.typeParameters(generic)[0];
    for (const node of unions) {
        const outcome = source.effectiveTypes.get(node);
        const type = outcome === undefined || outcome.kind === "refused" ? undefined : outcome.type;
        assert.equal(type?.kind === "optional", true, `original union ${source.ast.pos(node)} retains one absence and no void payload`);
        if (type?.kind !== "optional")
            throw new Error("A union void arm must use the original optional descriptor owner.");
        const payload = type.value;
        const name = source.ast.text(source.ast.name(source.ast.parent(node)));
        const text = source.ast.getSourceText(file).slice(source.ast.pos(node), source.ast.end(node));
        assert.equal(text.includes("uint64") ? payload.kind === "primitive" && payload.primitive === "uint64"
            : text.includes("Value") ? payload.kind === "declared" && payload.declaration === originalParameter
                : payload.kind === "declared" && payload.typeArguments[0]?.kind === "intrinsic" && payload.typeArguments[0].intrinsic === "void", true, `the original payload width/binder/Promise<void> survives at ${name ?? "return"}`);
    }
    const whole = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "whole");
    const result = whole === undefined ? undefined : source.effectiveTypes.callableReturn(whole);
    assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "intrinsic" && result.type.intrinsic === "void", true, "a whole void return is not a union arm and remains void");
    const single = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "single");
    const value = single === undefined ? undefined : source.effectiveTypes.get(single);
    assert.equal(value !== undefined && value.kind !== "refused" && value.type.kind === "declared" &&
        value.type.typeArguments[0]?.kind === "intrinsic" && value.type.typeArguments[0].intrinsic === "void", true, "a sole Promise type argument is never projected as an absence arm");
    assert.equal(source.effectiveTypes.refusals().length, 0);
});
test("C2428 aliased generic method callbacks publish the original selected binder's exact argument", () => {
    const current = fixture(`export function run<Value>(values: Value[]): Value[] {
    const mapper = (value: Value): Value => value;
    const alias = mapper;
    const mapped = values.map(alias);
    return mapped;
  }`);
    const { ast } = current.source;
    const call = current.defaults.nodes.find(node => ast.is.IsCallExpression(node));
    const outcome = call === undefined ? undefined : current.source.effectiveTypes.get(call);
    const selected = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
    const owner = current.defaults.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "run");
    const parameter = owner === undefined ? undefined : ast.typeParameters(owner)[0];
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
        outcome.type.element.kind === "declared" && outcome.type.element.declaration === parameter, true, "the result contains the project's original generic parameter, never the uninstantiated library method parameter");
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
        selected?.method.length === 1 && selected.method[0]?.type.kind === "declared" &&
        selected.method[0].type.declaration === parameter && sourceTypeDescriptorsEqual(outcome.type.element, selected.method[0].type), true, "the result and the same call's method argument retain the identical original declaration and full descriptor");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("C2446 narrowed callable reads retain their original authored branch without retargeting union storage", () => {
    const current = fixture(`function run(values: int32[]): void {
    const mapper: ((value: int32) => int32) | string = (value: int32): int32 => value;
    const alias = mapper; const second = alias; const mapped = values.map(alias);
    void mapper; void alias; void second; void mapped;
  }`);
    const { ast } = current.source;
    const declaration = current.declaration("mapper");
    const stored = current.source.effectiveTypes.get(declaration);
    assert.equal(stored !== undefined && stored.kind !== "refused" && stored.type.kind === "union" &&
        stored.type.types.length === 2, true, "the original declaration keeps its complete authored storage union");
    const reads = current.defaults.values.filter(node => ast.is.IsIdentifier(node) &&
        current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
    assert.equal(reads.length, 2, "both actual mapper reads are retained");
    const alias = current.declaration("alias");
    const aliasReads = current.defaults.values.filter(node => ast.is.IsIdentifier(node) &&
        current.source.navigation.sourceReferenceFor(node)?.declaration === alias);
    assert.equal(aliasReads.length, 3, "each original alias read, including the actual map argument, is retained");
    for (const node of [...reads, ...aliasReads, alias, current.declaration("second")]) {
        const described = current.defaults.context.describe(node);
        const outcome = current.source.effectiveTypes.get(node);
        const callable = described === undefined ? undefined : sourceTypeDescriptorStructure(described);
        const published = outcome === undefined || outcome.kind === "refused" ? undefined : sourceTypeDescriptorStructure(outcome.type);
        for (const selected of [callable, published]) {
            const signature = selected?.kind === "callable" ? selected.calls[0] : undefined;
            assert.equal(signature?.parameters[0]?.type.kind === "primitive" &&
                signature.parameters[0].type.primitive === "int32" && signature.result.kind === "primitive" &&
                signature.result.primitive === "int32" && signature.declaration !== undefined &&
                ast.is.IsFunctionTypeNode(signature.declaration), true, "the selected original callable syntax, parameter width and result width survive each alias/read");
        }
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("C2446 union occurrence projection preserves subsets and refuses to guess erased numeric branches", () => {
    const current = fixture(`function run(value: int32 | float32 | string, input: ((value: int32) => int32) | string,
    partial: ((value: int32) => int32) | string | undefined): void {
    const unchanged = input;
    if (typeof input !== "string") { const callable = input; void callable; }
    if (typeof value !== "string") { const numeric = value; void numeric; }
    if (typeof partial !== "string") { const optional = partial; void optional; }
    void unchanged;
  }`);
    const unchanged = current.defaults.context.describe(current.declaration("unchanged"));
    assert.equal(unchanged?.kind === "union" && unchanged.types.length === 2, true, "an unrefined callable|string occurrence retains both original branches");
    const numeric = current.defaults.context.describe(current.declaration("numeric"));
    assert.equal(numeric?.kind === "union" && numeric.types.some(type => type.kind === "primitive" && type.primitive === "int32") &&
        numeric.types.some(type => type.kind === "primitive" && type.primitive === "float32") &&
        numeric.types.length === 3 && numeric.types.some(type => type.kind === "string"), true, "equal erased numeric backing types never choose a native width");
    const optional = current.defaults.context.describe(current.declaration("optional"));
    const present = optional === undefined ? undefined : sourceTypeDescriptorStructure(optional);
    const value = present?.kind === "optional" ? sourceTypeDescriptorStructure(present.value) : undefined;
    assert.equal(value?.kind === "callable" && value.calls[0]?.parameters[0]?.type.kind === "primitive" &&
        value.calls[0].parameters[0].type.primitive === "int32" && value.calls[0].result.kind === "primitive" &&
        value.calls[0].result.primitive === "int32", true, "a checked callable-and-absence subset retains its original callable and one absence state");
    const outcome = current.source.effectiveTypes.get(current.declaration("optional"));
    const published = outcome === undefined || outcome.kind === "refused" ? undefined : sourceTypeDescriptorStructure(outcome.type);
    const publishedValue = published?.kind === "optional" ? sourceTypeDescriptorStructure(published.value) : undefined;
    assert.equal(publishedValue?.kind === "callable" && value?.kind === "callable" &&
        sourceTypeDescriptorsEqual(publishedValue, value) && publishedValue.calls[0]?.declaration === value.calls[0]?.declaration, true, "the same optional subset, original callable and native widths reach the canonical value publication");
    const partial = current.defaults.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === "partial");
    const storage = partial === undefined ? undefined : current.source.effectiveTypes.get(partial);
    const stored = storage === undefined || storage.kind === "refused" ? undefined : sourceTypeDescriptorStructure(storage.type);
    const storedValue = stored?.kind === "optional" ? sourceTypeDescriptorStructure(stored.value) : undefined;
    assert.equal(storedValue?.kind === "union" && storedValue.types.length === 2 &&
        storedValue.types.some(member => member.kind === "string") && storedValue.types.some(member => member.kind === "callable"), true, "the original parameter remains absence-capable storage with both authored present branches");
});
test("C2429 only a published winning default contributes its original authored primitive component", () => {
    const current = fixture(`declare function create<Value = int32>(): Value;
    declare function infer<Value = int32>(value: Value): Value;
    function run(narrow: float32, wide: number): void {
      const chosen = create(); const explicit = create<float32>();
      const authored = infer(narrow); const equalBacking = infer(wide); const fractional = infer(1.5);
      void chosen; void explicit; void authored; void equalBacking; void fractional;
    }`);
    const { ast } = current.source;
    const expected = [["chosen", "int32", "default"], ["explicit", "float32", "explicit"],
        ["authored", "float32", "inferred"], ["equalBacking", "float64", "inferred"], ["fractional", "float64", "inferred"]];
    for (const [name, primitive, origin] of expected) {
        const declaration = current.declaration(name);
        const callNode = ast.as.AsVariableDeclaration(declaration)?.Initializer;
        const call = callNode === undefined ? undefined : current.source.semantics.forNode(callNode).operations.call(callNode);
        const argument = call?.sourceSelectedMethodTypeArguments?.[0];
        const outcome = current.source.effectiveTypes.get(declaration);
        const selected = callNode === undefined ? undefined : current.source.effectiveTypes.callInstantiation(callNode);
        assert.equal(argument !== undefined && (argument.defaultTypeNode !== undefined) === (origin === "default") &&
            (argument.explicitTypeNode !== undefined) === (origin === "explicit"), true, name + ": only the checked selected contribution supplies authored syntax");
        assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
            outcome.type.primitive === primitive && selected?.method.length === 1 && selected.method[0]?.type.kind === "primitive" &&
            selected.method[0].type.primitive === primitive, true, name + ": value and same-call binder retain the original Source primitive");
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("C2431 typeof object members retain their original authored value producers", () => {
    const current = fixture(`declare function produced<Value>(): Value;
    const original = { exact: produced<int32>(), floating: produced<number>(), integer: 7 };
    type Snapshot = typeof original;
    declare const selected: Snapshot;`);
    const type = current.defaults.context.describe(current.declaration("selected"));
    const shape = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
    assert.equal(shape?.kind === "shape", true, "the original object's alias has one canonical member inventory");
    if (shape?.kind !== "shape")
        throw new Error("The retained original member inventory is required.");
    for (const [name, expected] of [["exact", "int32"], ["floating", "float64"], ["integer", "int64"]]) {
        const selectedMember = shape.members.find(candidate => candidate.name === name);
        assert.equal(selectedMember?.type.kind === "primitive" && selectedMember.type.primitive === expected &&
            selectedMember.origin.kind === "declared" && current.source.ast.is.IsPropertyAssignment(selectedMember.origin.declaration), true, name + ": the original member initializer owns its native type without reopening its backing Type");
    }
});
test("an unresolved foreign conditional alias is not an identity-only nominal cut", () => {
    const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; const count: int32 = 1; void count; }`);
    assert.equal(current.defaults.context.describe(current.declaration("local")) === undefined, true, "an open conditional has no nominal identity and makes its project declaration inexpressible");
    const read = current.defaults.values.find(node => current.source.ast.is.IsIdentifier(node) && current.source.ast.text(node) === "local");
    const outcome = read === undefined ? undefined : current.source.effectiveTypes.get(read);
    assert.equal(outcome?.kind === "refused" && outcome.site === read && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, "the original local read owns its one precise Source refusal");
    assert.equal(current.source.effectiveTypes.refusals().filter(issue => issue.site === read).length, 1);
    const count = current.source.effectiveTypes.get(current.declaration("count"));
    assert.equal(count !== undefined && count.kind !== "refused" && count.type.kind === "primitive" && count.type.primitive === "int32", true, "an expressible sibling is independent of the unresolved alias");
});
test("a present object construction retains canonical member correspondence into nullable storage", () => {
    const current = fixture(`interface Row { user: int32; system?: int32; }
    function run(other: Row): void { let value: Row | null | undefined = { user: 1 }; value = other; void value; }`);
    const { ast } = current.source;
    const literal = current.defaults.nodes.find(node => ast.is.IsObjectLiteralExpression(node));
    const property = literal === undefined ? undefined : ast.properties(literal)[0];
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const storage = current.source.effectiveTypes.get(current.declaration("value"));
    assert.equal(storage !== undefined && storage.kind !== "refused" && storage.type.kind === "optional", true, "the declaration retains its exact absence-capable storage");
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared" &&
        outcome.memberCorrespondence?.length === 1 && outcome.memberCorrespondence[0]?.property === property, true, "the present literal selects its one actual authored property");
    if (outcome === undefined || outcome.kind === "refused")
        throw new Error("The present literal publication is required.");
    const structure = sourceTypeDescriptorStructure(outcome.type);
    const user = structure.kind === "shape" ? structure.members.find(member => member.name === "user") : undefined;
    assert.equal(user !== undefined && outcome.memberCorrespondence?.[0]?.origin === user.origin, true, "the correspondence retains the identical member origin of the published present contract");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("a closed foreign conditional alias publishes its exact primitive result inside a project interface", () => {
    const current = fixture(`interface Local { read(value: int32): Awaited<Promise<int32>>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; }`);
    const descriptor = current.defaults.context.describe(current.declaration("local"));
    assert.equal(descriptor?.kind === "declared" && descriptor.definition?.kind === "shape", true, "the closed alias has a complete project interface definition");
    if (descriptor?.kind !== "declared" || descriptor.definition?.kind !== "shape")
        throw new Error("The original interface definition is required.");
    const method = descriptor.definition.members.find(member => member.name === "read");
    const callable = method === undefined ? undefined : sourceTypeDescriptorStructure(method.type);
    const result = callable?.kind === "callable" ? callable.calls[0]?.result : undefined;
    const primitive = result === undefined ? undefined : sourceTypeDescriptorStructure(result);
    assert.equal(primitive?.kind === "primitive" && primitive.primitive === "int32", true, "Awaited's resolved result retains the exact authored int32 width");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("conditional structural infer patterns retain exact member callback widths and recursive applications", () => {
    for (const primitive of ["int32", "float32"]) {
        const current = fixture(`interface Thenable<Value> { then(callback: (value: Value) => void): void; }
      type Payload<Value> = Value extends object & { then(callback: infer Callback): void }
        ? Callback extends (value: infer Result) => void ? Result : never : never;
      declare const selected: Payload<Thenable<${primitive}>>;
      declare const recursive: Awaited<Promise<Promise<${primitive}>>>;
      declare const unrelated: Payload<{ other: ${primitive} }>;
      declare const optionalCallback: Awaited<{ then(callback?: ((value: ${primitive}) => void) | undefined): void }>;
      declare const keyed: { key: ${primitive} };`);
        for (const name of ["selected", "recursive", "optionalCallback"]) {
            const descriptor = current.defaults.context.describe(current.declaration(name));
            const result = descriptor === undefined ? undefined : sourceTypeDescriptorStructure(descriptor);
            assert.equal(result?.kind === "primitive" && result.primitive === primitive, true, `${name}: structural inference and recursive alias applications preserve ${primitive}`);
        }
        const unrelated = current.defaults.context.describe(current.declaration("unrelated"));
        const result = unrelated === undefined ? undefined : sourceTypeDescriptorStructure(unrelated);
        assert.equal(result?.kind === "intrinsic" && result.intrinsic === "never", true, "a false structural branch never borrows an unrelated member");
        const keyed = current.defaults.context.describe(current.declaration("keyed"));
        assert.equal(keyed !== undefined, true, "the preceding conditional binding scope never contaminates a sibling read");
    }
});
test("conditional distribution selects retained presence and absence without erasing exact primitive widths", () => {
    const current = fixture(`type Split<Value> = Value extends null | undefined ? int32 : Value;
    type Keep<Value> = Value extends null | undefined ? Value : Value;
    declare const split: Split<float32 | null | undefined>;
    declare const kept: Keep<float32 | null | undefined>;`);
    const split = current.defaults.context.describe(current.declaration("split"));
    const result = split === undefined ? undefined : sourceTypeDescriptorStructure(split);
    assert.equal(result?.kind === "union" && result.types.length === 2 &&
        result.types.every(type => type.kind === "primitive") &&
        result.types.some(type => type.kind === "primitive" && type.primitive === "int32") &&
        result.types.some(type => type.kind === "primitive" && type.primitive === "float32"), true, "a checked numeric union cannot erase either authored Source primitive");
    const kept = current.defaults.context.describe(current.declaration("kept"));
    const optional = kept === undefined ? undefined : sourceTypeDescriptorStructure(kept);
    assert.equal(optional?.kind === "optional" && optional.value.kind === "primitive" && optional.value.primitive === "float32", true, "both checked nullish branches retain the one native absence and original present descriptor");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("C2373 distributed callback inference retains its lexical scope through every sibling and recursive tail", () => {
    const current = fixture(`type Unwrap<Value> = Value extends { then(callback: infer Callback): void }
      ? Callback extends ((value: infer Inner) => void) ? Unwrap<Inner> : never : Value;
    interface Layer<Value> { then(callback?: ((value: Value) => void) | null): void; }
    declare const first: Unwrap<Layer<Layer<int32>>>;
    declare const second: Unwrap<Layer<float32>>;
    declare const nested: Awaited<Promise<Promise<float32>>>;
    declare const sibling: int32;
    interface NativeIndex { readonly [key: int32]: float32; }
    declare const indexed: NativeIndex;`);
    for (const [name, primitive] of [["first", "int32"], ["second", "float32"], ["nested", "float32"], ["sibling", "int32"]]) {
        const type = current.defaults.context.describe(current.declaration(name));
        const value = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
        assert.equal(value?.kind === "primitive" && value.primitive === primitive, true, name + ": the actual inferred width survives each captured branch");
    }
    const indexed = current.defaults.context.describe(current.declaration("indexed"));
    const shape = indexed === undefined ? undefined : sourceTypeDescriptorStructure(indexed);
    assert.equal(shape?.kind === "shape" && shape.indexes.length === 1 && shape.indexes[0]?.key.kind === "primitive" &&
        shape.indexes[0].key.primitive === "int32" && shape.indexes[0]?.value.kind === "primitive" && shape.indexes[0].value.primitive === "float32", true, "an authored native index retains its exact key and value kinds");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("normalized mapped union bodies do not reopen their own alias on an object constituent", () => {
    for (const alias of [false, true]) {
        const current = fixture(`type Input = readonly (string | float32)[] | { readonly marker: string; readonly value: float32 };
      type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
      type Result = Locked<Input>;
      declare const selected: ${alias ? "Result" : "Locked<Input>"};`);
        const descriptor = current.defaults.context.describe(current.declaration("selected"));
        const normalized = descriptor === undefined ? undefined : sourceTypeDescriptorStructure(descriptor);
        assert.equal(normalized?.kind === "union" && normalized.types.length === 2, true, `the exact normalized union has two complete alternatives, alias=${alias}`);
        if (normalized?.kind !== "union")
            throw new Error("The normalized mapped union is required.");
        const alternatives = normalized.types.map(sourceTypeDescriptorStructure);
        const object = alternatives.find(type => type.kind === "shape");
        const array = alternatives.find(type => type.kind === "array");
        const member = object?.kind === "shape" ? object.members.find(property => property.name === "value") : undefined;
        const value = member === undefined ? undefined : sourceTypeDescriptorStructure(member.type);
        assert.equal(array?.kind === "array" && array.readonly && object?.kind === "shape" &&
            member?.readonly === true && member.origin.kind === "declared" &&
            value?.kind === "primitive" && value.primitive === "float32", true, `array and object alternatives retain their exact published kind, width and origin, alias=${alias}`);
        assert.equal(alternatives.some(type => type.kind === "declared" && type.cut !== undefined), false, "a normalized constituent is not a recursive application of the enclosing mapped alias");
    }
});
test("tail conditional applications retain their successive exact Source binder scopes", () => {
    for (const primitive of ["int32", "float32"]) {
        const current = fixture(`interface Layer<Value> { item: Value; }
      type Peel<Value> = Value extends Layer<infer Inner> ? Peel<Inner> : Value;
      declare const first: Peel<Layer<Layer<Layer<${primitive}>>>>;
      declare const sibling: ${primitive};`);
        for (const name of ["first", "sibling"]) {
            const descriptor = current.defaults.context.describe(current.declaration(name));
            const structure = descriptor === undefined ? undefined : sourceTypeDescriptorStructure(descriptor);
            assert.equal(structure?.kind === "primitive" && structure.primitive === primitive, true, `${name}: the captured tail application and its exact Source argument describe the same scope`);
        }
        assert.equal(current.source.effectiveTypes.refusals().length, 0);
    }
});
test("normalized mapped definitions exclude all enclosing alias metadata but retain genuine member recursion", () => {
    const current = fixture(`type Input = readonly (string | float32)[] | { readonly value: float32 };
    type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
    type First = Locked<Input>; type Second = First; type Third = Second;
    type Link<Value> = { value: Value; next?: Link<Value> };
    declare const selected: Third; declare const recursive: Link<float32>;`);
    const descriptor = current.defaults.context.describe(current.declaration("selected"));
    const structure = descriptor === undefined ? undefined : sourceTypeDescriptorStructure(descriptor);
    assert.equal(structure?.kind === "union" && structure.types.length === 2 && structure.types.every(type => {
        const selected = sourceTypeDescriptorStructure(type);
        return selected.kind === "array" || selected.kind === "shape";
    }), true, "normalization does not reenter any alias in its own completed chain");
    const recursive = current.defaults.context.describe(current.declaration("recursive"));
    const root = recursive === undefined ? undefined : sourceTypeDescriptorStructure(recursive);
    const next = root?.kind === "shape" ? root.members.find(member => member.name === "next")?.type : undefined;
    const target = next?.kind === "optional" ? next.value : next;
    assert.equal(target?.kind === "declared" && target.cut === "recursion" && target.declaration ===
        (recursive?.kind === "declared" ? recursive.declaration : undefined), true, "a separate authored recursive member retains its real nominal cut");
});
test("generic recursive aliases publish their original exact template separately from concrete occurrences", () => {
    const current = fixture(`type Tree<Value> = Value | readonly Tree<Value>[];
    declare const selected: Tree<float32>;`);
    const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === "Tree");
    const parameter = declaration === undefined ? undefined : current.source.ast.typeParameters(declaration)[0];
    const template = declaration === undefined ? undefined : current.source.effectiveTypes.get(declaration);
    const concrete = current.source.effectiveTypes.get(current.declaration("selected"));
    assert.equal(template?.kind === "resolved" && template.type.kind === "declared" && template.type.declaration === declaration &&
        template.type.typeArguments.length === 1 && template.type.typeArguments[0]?.kind === "declared" &&
        template.type.typeArguments[0].declaration === parameter && template.type.definition?.kind === "union", true, "the actual alias declaration owns its complete generic arm definition");
    assert.equal(concrete !== undefined && concrete.kind !== "refused" && concrete.type.kind === "declared" &&
        concrete.type.declaration === declaration && concrete.type.typeArguments[0]?.kind === "primitive" &&
        concrete.type.typeArguments[0].primitive === "float32", true, "a concrete occurrence never replaces the declaration template or its original binder identity");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("inferred local-class call results use the solved body and exact call binders before member reads", () => {
    for (const reversed of [false, true]) {
        const wrapper = `function wrap<Outer>(first: Outer) {
      class Local<Inner> { first: Outer; value: Inner;
        constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
      return new Local<float32>(first, 1);
    }`;
        const consumer = `function run(first: int32): void {
      const result = wrap(first); const value = result.value; void value;
    }`;
        const current = fixture((reversed ? [consumer, wrapper] : [wrapper, consumer]).join("\n"));
        const nodes = current.defaults.nodes;
        const ast = current.source.ast;
        const wrap = nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "wrap");
        const call = nodes.find(node => ast.is.IsCallExpression(node) &&
            ast.text(ast.as.AsCallExpression(node)?.Expression) === "wrap");
        const body = wrap === undefined ? undefined : current.source.effectiveTypes.callableReturn(wrap);
        const result = call === undefined ? undefined : current.source.effectiveTypes.get(call);
        const instantiation = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
        assert.equal(body !== undefined && body.kind !== "refused" && body.type.kind === "declared" &&
            body.type.typeArguments[0]?.kind === "declared" && body.type.typeArguments[1]?.kind === "primitive" &&
            body.type.typeArguments[1].primitive === "float32", true, `original body template, reversed=${reversed}`);
        assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "declared" &&
            result.type.typeArguments[0]?.kind === "primitive" && result.type.typeArguments[0].primitive === "int32" &&
            result.type.typeArguments[1]?.kind === "primitive" && result.type.typeArguments[1].primitive === "float32" &&
            instantiation?.result === result.type, true, `one actual instantiated result, reversed=${reversed}`);
        const value = current.source.effectiveTypes.get(current.declaration("value"));
        assert.equal(value !== undefined && value.kind !== "refused" && value.type.kind === "primitive" &&
            value.type.primitive === "float32", true, "dependent member groups consume the solved result, not a final-outcome overwrite");
        assert.equal(current.source.effectiveTypes.refusals().length, 0);
    }
});
test("an inferred call result preserves an unavailable body's original Source refusal", () => {
    const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    function read() { return local; }
    const result = read(); void result;`);
    const { ast } = current.source;
    const call = current.defaults.nodes.find(node => ast.is.IsCallExpression(node) &&
        ast.text(ast.as.AsCallExpression(node)?.Expression) === "read");
    const returned = current.defaults.nodes.find(node => ast.is.IsReturnStatement(node));
    const value = returned === undefined ? undefined : ast.as.AsReturnStatement(returned)?.Expression;
    const outcome = call === undefined ? undefined : current.source.effectiveTypes.get(call);
    assert.equal(value !== undefined && outcome?.kind === "refused" && outcome.site === value &&
        outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, "an unrepresented body never re-enters a checked return-type reconstruction");
    assert.equal(call !== undefined && current.source.effectiveTypes.callInstantiation(call)?.result === undefined, true);
});
test("checked conditional aliases preserve distinct parameter and result widths through exact infer binders", () => {
    for (const reverse of [false, true]) {
        const declarations = [
            "type Callback = (value: float32, optional?: int32) => int32;",
            "type Arguments = Parameters<Callback>;",
            "type Result = ReturnType<Callback>;",
            "type Capture<Value> = Value extends (...arguments_: infer Parameters) => infer Result ? { arguments_: Parameters; result: Result } : never;",
        ];
        const current = fixture(`${(reverse ? declarations.reverse() : declarations).join("\n")}
      declare const arguments_: Arguments; declare const result: Result; declare const captured: Capture<Callback>;`);
        const argumentsType = current.defaults.context.describe(current.declaration("arguments_"));
        const resultType = current.defaults.context.describe(current.declaration("result"));
        const capturedType = current.defaults.context.describe(current.declaration("captured"));
        assert.equal(argumentsType !== undefined && resultType !== undefined && capturedType !== undefined, true, `all exact alias publications exist, reverse=${reverse}`);
        if (argumentsType === undefined || resultType === undefined || capturedType === undefined)
            throw new Error("The checked alias descriptors are required.");
        const tuple = sourceTypeDescriptorStructure(argumentsType);
        const result = sourceTypeDescriptorStructure(resultType);
        const captured = sourceTypeDescriptorStructure(capturedType);
        assert.equal(tuple.kind === "tuple" && tuple.elements.length === 2, true);
        if (tuple.kind !== "tuple")
            throw new Error("The original parameter tuple is required.");
        assert.equal(tuple.elements[0]?.type.kind === "primitive" && tuple.elements[0].type.primitive === "float32", true);
        assert.equal(tuple.elements[1]?.kind === "optional" && tuple.elements[1].type.kind === "optional" &&
            tuple.elements[1].type.value.kind === "primitive" && tuple.elements[1].type.value.primitive === "int32", true);
        assert.equal(tuple.elements.every(element => element.declaration !== undefined &&
            current.source.ast.is.IsParameterDeclaration(element.declaration)), true, "the exact authored formal nodes survive inference");
        assert.equal(result.kind === "primitive" && result.primitive === "int32", true, "a result cannot choose the parameter's checker-identical float32 width");
        assert.equal(captured.kind === "shape", true);
        if (captured.kind !== "shape")
            throw new Error("The checked conditional capture is required.");
        const parameters = captured.members.find(member => member.name === "arguments_")?.type;
        const returned = captured.members.find(member => member.name === "result")?.type;
        assert.equal(parameters !== undefined && sourceTypeDescriptorStructure(parameters).kind === "tuple", true);
        assert.equal(returned?.kind === "primitive" && returned.primitive === "int32", true);
        assert.equal(current.source.effectiveTypes.refusals().length, 0);
    }
});
test("nested checked conditional steps retain an outer infer binding by its exact selected scope", () => {
    const current = fixture(`interface Box<Value> { value: Value; }
    type Inner<Value> = Value extends Box<infer Element> ? (Element extends int32 ? Element : never) : never;
    declare const selected: Inner<Box<int32>>;`);
    const { ast } = current.source;
    const declaration = current.defaults.nodes.find(node => ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === "Inner");
    const inferred = current.defaults.nodes.find(node => ast.is.IsTypeParameterDeclaration(node) && ast.text(ast.name(node)) === "Element");
    const annotation = ast.typeNode(current.declaration("selected"));
    const argument = annotation === undefined ? undefined : ast.typeArguments(annotation)[0];
    const queries = current.source.semantics.forNode(current.declaration("selected"));
    const checked = argument === undefined ? undefined : queries.types.authoredType(argument);
    const application = declaration === undefined || checked === undefined ? undefined : queries.types.instantiateAlias(declaration, [checked]);
    assert.equal(application?.kind === "conditional" && application.conditionalSteps.length >= 2 && inferred !== undefined, true, "the real checked application contains the nested selected steps and original infer binder");
    const nestedCarriesOuter = application?.conditionalSteps.slice(1).some(step => step.bindings.some(binding => inferred !== undefined && binding.declarations.includes(inferred))) ?? false;
    console.info("C2329_NESTED_INFER", JSON.stringify({ steps: application?.conditionalSteps.length ?? 0, nestedCarriesOuter }));
    const descriptor = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(descriptor !== undefined, true, "the nested conditional has its exact complete descriptor");
    if (descriptor === undefined)
        throw new Error("The nested conditional descriptor is required.");
    const type = sourceTypeDescriptorStructure(descriptor);
    assert.equal(type.kind === "primitive" && type.primitive === "int32", true, "the outer infer binding survives into the checker's selected inner branch");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("discarded selections leave the result-publication domain without dropping their operands", () => {
    const current = fixture(`function run(flag: boolean, optional?: () => number): number {
    flag && (() => 1); flag || (() => 2); optional ?? (() => 3); flag ? (() => 4) : (() => 5);
    const selected = flag && true; return selected ? 1 : 0;
  }`);
    const selections = current.defaults.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
    assert.equal(selections.length, 4, "only the three discarded logical forms and discarded conditional are excluded");
    for (const selection of selections) {
        assert.equal(current.defaults.values.includes(selection), false, "an effect selection publishes no result");
        const condition = current.source.ast.is.IsConditionalExpression(selection)
            ? current.source.ast.as.AsConditionalExpression(selection)?.Condition
            : current.source.ast.as.AsBinaryExpression(selection)?.Left;
        assert.equal(condition !== undefined && current.defaults.values.includes(condition), true, "the actual condition or presence operand remains in its own value domain");
    }
    const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
    assert.equal(initializer !== undefined && !sourceTypeFlowDiscardedSelection(current.source, initializer) &&
        current.defaults.values.includes(initializer), true, "a consumed logical expression still requires a Source result");
});
test("direct callable values retain their instantiated owner bindings without a property receiver", () => {
    for (const primitive of ["float32", "int32"]) {
        const current = fixture(`interface Transform<Value> { (value: Value): Value; }
      function apply(callback: Transform<${primitive}>, value: ${primitive}): ${primitive} {
        const selected = callback(value); return selected;
      }`);
        const descriptor = current.defaults.context.describe(current.declaration("selected"));
        assert.equal(descriptor?.kind === "primitive" && descriptor.primitive === primitive, true, `${primitive}: the callable's authored argument owns its formal result`);
        const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
        if (initializer === undefined)
            throw new Error("The original checked call is required.");
        const call = current.source.semantics.forNode(initializer).operations.call(initializer);
        assert.equal(call !== undefined && call.sourceReceiver === undefined, true, "this is the direct callable binding path, not a property receiver");
        assert.equal(current.source.effectiveTypes.refusals().length, 0);
    }
});
test("literal defaults select checked member symbols only from their own retained element tuple", () => {
    const current = fixture(`function run() {
    const selected = { value: 1, "quoted-value": true, 7: { width: 2 } }; return selected;
  }`);
    const descriptor = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(descriptor?.kind === "shape" && descriptor.members.length === 3, true);
    if (descriptor?.kind !== "shape")
        throw new Error("The complete literal shape is required.");
    const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
    if (literal === undefined)
        throw new Error("The original object literal is required.");
    const properties = current.source.ast.properties(literal);
    const queries = current.source.semantics.forNode(literal);
    for (const [index, member] of descriptor.members.entries()) {
        const property = properties[index];
        if (property === undefined)
            throw new Error("The original member declaration is required.");
        const element = queries.operations.objectLiteralElement(property);
        const checked = element === undefined ? undefined : queries.types.propertyInfos(element.objectLiteralType)
            .find(selected => selected.symbol === element.sourceElementSymbol);
        assert.equal(checked !== undefined && checked.name === member.name && member.origin.kind === "declared" &&
            member.origin.declaration === property, true, `member ${index}: one checked tuple and original declaration`);
    }
    const integer = descriptor.members[0]?.type;
    const boolean = descriptor.members[1]?.type;
    const nested = descriptor.members[2]?.type;
    assert.equal(integer?.kind === "primitive" && integer.primitive === "int64", true);
    assert.equal(boolean?.kind === "primitive" && boolean.primitive === "bool", true);
    assert.equal(nested?.kind === "shape" && nested.members[0]?.type.kind === "primitive" &&
        nested.members[0].type.primitive === "int64", true);
});
test("normalised intersection aliases preserve the underlying nominal declaration instead of a false self-recursion cut", () => {
    const current = fixture(`class Failure { readonly code: int32 = 1; }
    type Maybe = Failure | null | undefined;
    type Present = NonNullable<Maybe>;
    declare const selected: Present;`);
    const failure = current.defaults.nodes.find(node => current.source.ast.is.IsClassDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === "Failure");
    let selected = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(failure !== undefined && selected !== undefined, true);
    const visited = new Set();
    while (selected?.kind === "declared" && selected.declaration !== failure) {
        assert.equal(!visited.has(selected.declaration) && selected.definition !== undefined, true, "every non-recursive alias owns one complete checked definition");
        if (visited.has(selected.declaration))
            throw new Error("An alias must not manufacture a self cut.");
        visited.add(selected.declaration);
        selected = selected.definition;
    }
    assert.equal(selected?.kind === "declared" && selected.declaration === failure && selected.cut === undefined &&
        selected.definition?.kind === "shape", true, "the actual Failure identity and structure are retained");
    if (selected?.kind !== "declared" || selected.definition?.kind !== "shape")
        throw new Error("The checked nominal Failure is required.");
    const code = selected.definition.members.find(member => member.name === "code");
    assert.equal(code?.readonly && code.type.kind === "primitive" && code.type.primitive === "int32" &&
        code.origin.kind === "declared", true);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("declared tuples retain every finite position, named origin and optional or rest kind", () => {
    const current = fixture(`declare const one: readonly [int32]; declare const three: [int32, float32, number];
    declare const named: readonly [head: int32, tail?: float32, ...rest: number[]];`);
    const one = current.defaults.context.describe(current.declaration("one"));
    const three = current.defaults.context.describe(current.declaration("three"));
    const named = current.defaults.context.describe(current.declaration("named"));
    assert.equal(one?.kind === "tuple" && one.readonly && one.elements.length === 1 &&
        one.elements[0]?.kind === "required" && one.elements[0].type.kind === "primitive" &&
        one.elements[0].type.primitive === "int32", true);
    assert.equal(three?.kind === "tuple" && !three.readonly && three.elements.length === 3 &&
        three.elements.every(element => element.kind === "required") &&
        three.elements[2]?.type.kind === "primitive" && three.elements[2].type.primitive === "float64", true);
    assert.equal(named?.kind === "tuple" && named.readonly && named.elements.length === 3 &&
        named.elements[0]?.kind === "required" && named.elements[1]?.kind === "optional" && named.elements[2]?.kind === "rest", true);
    if (named?.kind !== "tuple")
        throw new Error("The actual named tuple descriptor is required.");
    assert.equal(named.elements.every(element => element.declaration !== undefined &&
        current.source.ast.is.IsNamedTupleMember(element.declaration)), true, "named tuple origins are the actual checked member nodes");
    assert.equal(named.elements[1]?.type.kind === "optional" && named.elements[1].type.value.kind === "primitive" &&
        named.elements[1].type.value.primitive === "float32", true);
    assert.equal(named.elements[2]?.type.kind === "primitive" && named.elements[2].type.primitive === "float64", true);
});
test("ordinary member origins retain fields, methods and read or write accessor declarations", () => {
    const current = fixture(`class Members {
    readonly field: int32 = 1;
    method(value: int32): int32 { return value; }
    get getter(): int32 { return 1; }
    set setter(next: int32) { void next; }
    get paired(): int32 { return 1; }
    set paired(next: int32) { void next; }
  } declare const selected: Members;`);
    const type = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The complete declared member shape is required.");
    const { ast } = current.source;
    for (const [name, kind] of [["field", "KindPropertyDeclaration"], ["method", "KindMethodDeclaration"],
        ["getter", "KindGetAccessor"], ["setter", "KindSetAccessor"], ["paired", "KindGetAccessor"]]) {
        const member = type.definition.members.find(candidate => candidate.name === name);
        const declaration = ast.members(type.declaration).find(candidate => candidate !== undefined &&
            ast.kindName(candidate) === kind && ast.text(ast.name(candidate)) === name);
        assert.equal(declaration !== undefined && member?.origin.kind === "declared" && member.origin.declaration === declaration, true, name);
        if (name === "method") {
            assert.equal(member?.type.kind === "callable" && member.type.calls.length === 1 &&
                member.type.calls[0]?.result.kind === "primitive" && member.type.calls[0].result.primitive === "int32", true, name);
        }
        else {
            assert.equal(member?.type.kind === "primitive" && member.type.primitive === "int32", true, name);
        }
    }
    assert.equal(type.definition.members.find(member => member.name === "field")?.readonly, true);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("declared structures have no open-inference depth limit", () => {
    const current = fixture("declare const deep: { a: { b: { c: { d: { e: int32 } } } } };");
    let selected = current.defaults.context.describe(current.declaration("deep"));
    for (const name of ["a", "b", "c", "d", "e"]) {
        assert.equal(selected?.kind === "shape", true, "each finite authored structural level remains described");
        if (selected?.kind !== "shape")
            throw new Error("The actual declared structural level is required.");
        const member = selected.members.find(member => member.name === name);
        assert.equal(member?.origin.kind === "declared" && current.source.ast.is.IsPropertySignatureDeclaration(member.origin.declaration), true);
        selected = member?.type;
    }
    assert.equal(selected?.kind === "primitive" && selected.primitive === "int32", true);
});
test("symbol indexes and inline mapped indexes retain their actual checked origins", () => {
    const current = fixture(`declare const symbols: { readonly [key: symbol]: int32 };
    declare const mapped: { readonly [Key in string]: float32 };`);
    for (const [name, origin, primitive] of [["symbols", "index", "int32"], ["mapped", "mapped", "float32"]]) {
        const selected = current.defaults.context.describe(current.declaration(name));
        assert.equal(selected?.kind === "shape" && selected.indexes.length === 1, true);
        if (selected?.kind !== "shape")
            throw new Error("The actual declared index shape is required.");
        const index = selected.indexes[0];
        assert.equal(index !== undefined && index.readonly && (origin === "index"
            ? current.source.ast.is.IsIndexSignatureDeclaration(index.declaration)
            : current.source.ast.is.IsMappedTypeNode(index.declaration)), true);
        assert.equal(index?.value.kind === "primitive" && index.value.primitive === primitive, true);
        assert.equal(origin === "index" ? index?.key.kind === "intrinsic" && index.key.intrinsic === "symbol"
            : index?.key.kind === "string", true);
    }
});
test("an unannotated self-dependent callable has one precise return-annotation refusal", () => {
    const current = fixture("function recursive() { return recursive; }", false);
    const returned = current.defaults.nodes.find(node => current.source.ast.is.IsReturnStatement(node));
    const value = returned === undefined ? undefined : current.source.ast.as.AsReturnStatement(returned)?.Expression;
    const issues = current.source.effectiveTypes.refusals();
    assert.equal(issues.length, 1);
    assert.equal(value !== undefined && issues[0]?.site === value && issues[0]?.code === "TSONIC_LOCAL_TYPE_SIGNATURE" &&
        issues[0].reason === "This unannotated callable return depends on itself. Annotate the return type.", true);
    assert.equal(value !== undefined && current.source.effectiveTypes.get(value) === issues[0], true, "the actual return expression carries the same canonical first cause");
});
test("C2284 finite mapped members retain their exact checked declaration tuple for the origin ruling", () => {
    const current = fixture('type Flags = { [Key in "left" | "right"]: number }; declare const flags: Flags;');
    const declaration = current.declaration("flags");
    const queries = current.source.semantics.forNode(declaration);
    const selected = queries.declarations.declaredValueType(declaration);
    const mapped = current.defaults.nodes.find(node => current.source.ast.is.IsMappedTypeNode(node));
    assert.equal(selected !== undefined && mapped !== undefined, true, "the actual checked mapped type and value are retained");
    if (selected === undefined || mapped === undefined)
        throw new Error("The original checked mapped type is required.");
    const members = queries.types.propertyInfos(selected);
    assert.equal(members.length, 2, "both finite authored keys are observed without an invented member origin");
});
test("one canonical structural form carries all member, index, call and construct inventories", () => {
    const current = fixture(`interface Factory { readonly prototype: object; new(): object }
    interface Empty {}
    interface IndexedCallable { [name: string]: unknown; (value: number): number }
    type Callback = (value: number) => number; type Construct = new() => object;
    type FunctionObject = { (value: number): number; count: number };
    declare const factory: Factory; declare const empty: Empty; declare const indexed: IndexedCallable;
    declare const callback: Callback; declare const construct: Construct; declare const functionObject: FunctionObject;`);
    for (const [name, form, calls, constructs, members, indexes] of [
        ["factory", "shape", 0, 1, 1, 0], ["empty", "shape", 0, 0, 0, 0],
        ["indexed", "shape", 1, 0, 0, 1], ["callback", "callable", 1, 0, 0, 0],
        ["construct", "callable", 0, 1, 0, 0], ["functionObject", "shape", 1, 0, 1, 0],
    ]) {
        let type = current.defaults.context.describe(current.declaration(name));
        if (type?.kind === "declared") {
            assert.equal(type.definition !== undefined && !("members" in type) && !("indexes" in type), true, name);
            type = type.definition;
        }
        assert.equal(type?.kind, form, name);
        if (type?.kind !== "shape" && type?.kind !== "callable")
            continue;
        assert.equal(type.calls.length, calls, name);
        assert.equal(type.constructs.length, constructs, name);
        if (type.kind === "shape") {
            assert.equal(type.members.length, members, name);
            assert.equal(type.indexes.length, indexes, name);
        }
    }
});
test("nominal recursion cuts by declaration identity even when its actual arguments expand", () => {
    const current = fixture("interface Nest<Value> { child: Nest<Value[]> } declare const value: Nest<number>;");
    const type = current.defaults.context.describe(current.declaration("value"));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The actual complete nominal definition is required.");
    const child = type.definition.members[0]?.type;
    assert.equal(child?.kind === "declared" && child.declaration === type.declaration && child.definition === undefined &&
        child.typeArguments.length === 1 && child.typeArguments[0]?.kind === "array" &&
        child.typeArguments[0].element.kind === "primitive" && child.typeArguments[0].element.primitive === "float64", true);
});
test("expanding alias recursion uses the shared declared resource budget rather than a silent cut", () => {
    assert.throws(() => fixture("type Nest<Value> = { child: Nest<Value[]> }; declare const value: Nest<number>;"), (failure) => failure instanceof TargetCompilerResourceLimitFailure &&
        failure.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" && failure.diagnostic.sourceNode !== undefined &&
        failure.diagnostic.evidence?.includes(`depth=${sourceTypeExpansionBudget.depth}`) === true);
});
test("integer tokens and fractional or exponent tokens retain distinct leaf defaults", () => {
    const current = fixture("export const integer = 1; export const fractional = 1.0; export const exponent = 1e3; export const radix = 0xff;");
    for (const name of ["integer", "radix"])
        assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "int64" });
    for (const name of ["fractional", "exponent"])
        assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "float64" });
});
test("authored array syntax preserves the element source fact instead of erasing to number", () => {
    const current = fixture("declare const integers: int32[]; declare const singles: readonly float32[];");
    assertSameValue(current.defaults.context.describe(current.declaration("integers")), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
    assertSameValue(current.defaults.context.describe(current.declaration("singles")), { kind: "array", readonly: true, element: { kind: "primitive", primitive: "float32" } });
});
test("never-open folded integer arithmetic retains its native int64 creation default", () => {
    const current = fixture("export const quotient = 7 / 2; export const sum = 1 + 2;");
    for (const name of ["quotient", "sum"]) {
        assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "int64" });
    }
});
test("an imported primitive qualifier keeps its declaration fact instead of its erased number type", () => {
    const current = fixture('declare const value: import("@test/words").int32;');
    assertSameValue(current.defaults.context.describe(current.declaration("value")), { kind: "primitive", primitive: "int32" });
});
test("optional member presence is independent of an absence-capable member value", () => {
    const current = fixture("declare const absent: { value?: int32 }; declare const present: { value: int32 | undefined };");
    for (const [name, optional] of [["absent", true], ["present", false]]) {
        const type = current.defaults.context.describe(current.declaration(name));
        assert.equal(type?.kind === "shape", true);
        if (type?.kind !== "shape")
            throw new Error("The exact declared shape is required.");
        assert.equal(type.members.length, 1);
        assert.equal(type.members[0].optional, optional);
        assertSameValue(type.members[0].type, { kind: "optional", value: { kind: "primitive", primitive: "int32" } });
    }
});
test("declared undefined and null are absence while a callable void result remains void", () => {
    const current = fixture("declare const empty: undefined; declare const nil: null; declare const callback: () => void;");
    for (const name of ["empty", "nil"]) {
        assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "intrinsic", intrinsic: "absence" });
    }
    const callback = current.defaults.context.describe(current.declaration("callback"));
    assert.equal(callback?.kind === "callable", true);
    if (callback?.kind !== "callable")
        throw new Error("The actual declared callback is required.");
    assertSameValue(callback.calls[0]?.result, { kind: "intrinsic", intrinsic: "void" });
});
test("a required component overrides the occurrence's literal default", () => {
    const current = fixture("declare const required: number[]; export const literal = [1];");
    const declaration = current.declaration("required");
    const selectedType = current.source.input.at(declaration).declaredValueType(declaration);
    if (selectedType === undefined)
        throw new Error("The declared required type is required.");
    const value = current.defaults.context.describe(current.declaration("literal"), { selectedType, declaration,
        authoredTypeNode: current.source.ast.typeNode(declaration) });
    assertSameValue(value, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
});
test("nominal source identity is a declaration and its ordered actual descriptors", () => {
    const current = fixture("declare class Box<T> { value: T } declare const box: Box<int32>;");
    const type = current.defaults.context.describe(current.declaration("box"));
    assert.equal(type?.kind === "declared", true);
    assert.equal(type?.kind === "declared" && current.source.ast.is.IsClassDeclaration(type.declaration), true);
    if (type?.kind === "declared")
        assertSameValue(type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
});
test("the two readonly tuple positions retain independent source widths", () => {
    const current = fixture("declare const pair: readonly [int32, float32];");
    assertSameValue(current.defaults.context.describe(current.declaration("pair")), { kind: "tuple", readonly: true,
        elements: [{ kind: "required", type: { kind: "primitive", primitive: "int32" } },
            { kind: "required", type: { kind: "primitive", primitive: "float32" } }] });
});
test("a descending or non-unit-step counter is fixed without a counted-loop proof", () => {
    const current = fixture("function run(): void { for (let index = 8; index >= 0; index -= 2) {} }");
    const node = current.declaration("index");
    const rule = current.defaults.fixedRule(node);
    assertSameValue(current.defaults.context.describe(node), { kind: "primitive", primitive: "int64" });
    assert.equal(rule?.kind, "loop-counter");
    assert.equal(rule?.declaration === node, true);
    assert.equal(Object.isFrozen(rule), true);
});
for (const selected of [{ annotation: "number", primitive: "float64" }, { annotation: "int32", primitive: "int32" }]) {
    test(`an annotated ${selected.annotation} counter and its reads never acquire loop-counter authority`, () => {
        const current = fixture(`function run(): void { for (let index: ${selected.annotation} = 0; index < 3; index++) { const value = index; } }`);
        const declaration = current.declaration("index");
        const reads = current.defaults.nodes.filter(node => current.source.ast.is.IsIdentifier(node) &&
            node !== current.source.ast.name(declaration) &&
            current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
        assert.equal(reads.length >= 3, true, "the exact checked counter reads are retained");
        for (const node of [declaration, ...reads]) {
            assert.equal(current.defaults.fixedRule(node) === undefined, true, "an annotation excludes counter authority before caching");
            assertSameValue(current.defaults.context.describe(node), { kind: "primitive", primitive: selected.primitive });
            assert.equal(current.defaults.fixedRule(node) === undefined, true, "describing an annotated read does not create a counter receipt");
            const outcome = current.source.effectiveTypes.get(node);
            assert.equal(outcome?.kind === "resolved" || outcome?.kind === "default", true, "the annotated occurrence is published");
            if (outcome?.kind !== "resolved" && outcome?.kind !== "default")
                throw new Error("The exact annotated effective type is required.");
            assertSameValue(outcome.type, { kind: "primitive", primitive: selected.primitive });
            assert.equal(outcome.provenance.fixedRule === undefined, true, "published annotated reads have no counter authority");
        }
    });
}
test("ordinary int64-compatible values do not acquire loop-counter authority", () => {
    const current = fixture("export const value = 8;");
    assert.equal(current.defaults.fixedRule(current.declaration("value")), undefined);
});
test("checked optional-property occurrences keep their narrowed declared width", () => {
    const current = fixture("declare const data: { value?: int32 }; function run(): void { if (data.value !== undefined) { const narrowed = data.value; } }");
    assertSameValue(current.defaults.context.describe(current.declaration("narrowed")), { kind: "primitive", primitive: "int32" });
});
test("excluded annotations and tuple aliases retain the included consumer's query", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
            "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
            "/src/index.ts": 'import { data } from "./native.js"; function run(): void { const retained = data; const pair = data.pair; }',
            "/src/native.ts": 'import type { int32, float32 } from "@test/words"; export type Pair = readonly [int32, float32]; export declare const data: { value: int32; pair: Pair };',
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
        extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
                            exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const consumer = checked.getSourceFile("/src/index.ts");
    const native = checked.getSourceFile("/src/native.ts");
    if (consumer === undefined || native === undefined)
        throw new Error("The exact checked files are required.");
    const source = createSourceTypeFlowTestProgram({ ...checked, sourceFiles: Object.freeze([consumer]), getSourceFileQueries(file) {
            assert.equal(file === consumer, true, "foreign metadata keeps the original consumer query");
            return checked.getSourceFileQueries(file);
        } });
    const defaults = createSourceTypeFlowAnalysisContext(source, createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles), createSourceHostInput(source));
    const retained = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "retained");
    const pair = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "pair");
    if (retained === undefined || pair === undefined)
        throw new Error("The included declarations are required.");
    const type = defaults.context.describe(retained);
    assert.equal(type?.kind === "shape", true);
    if (type?.kind !== "shape")
        throw new Error("The exact checked structural type is required.");
    assertSameValue(type.members.find(member => member.name === "value")?.type, { kind: "primitive", primitive: "int32" });
    assertSameValue(defaults.context.describe(pair), { kind: "tuple", readonly: true,
        elements: [{ kind: "required", type: { kind: "primitive", primitive: "int32" } },
            { kind: "required", type: { kind: "primitive", primitive: "float32" } }] });
    assert.equal(source.semantics.includes(native), false);
    assert.equal(source.sourceFiles.length, 1);
    assert.equal(type.members.every(member => member.origin.kind === "declared" &&
        source.ast.getSourceFile(member.origin.declaration) === native), true);
});
test("source order uses exact authored starts and one preorder tie breaker", () => {
    const current = fixture("export const first = 1; export const second = 2;");
    const first = current.defaults.context.order(current.declaration("first"));
    const second = current.defaults.context.order(current.declaration("second"));
    assert.equal(first.start < second.start, true);
    assert.equal(first.preorder < second.preorder, true);
});
test("range admission distinguishes signed, unsigned, floating and decimal domains", () => {
    const values = [2147483647n, 2147483648n, -1n, 18446744073709551615n, 18446744073709551616n,
        10n ** 40n, 10n ** 400n, 79228162514264337593543950336n];
    const current = fixture(values.map((value, index) => `const range${index} = ${value};`).join("\n"));
    const literals = values.map((_, index) => {
        const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration(`range${index}`))?.Initializer;
        const literal = initializer === undefined ? undefined : current.defaults.context.literal(initializer);
        if (literal === undefined)
            throw new Error("The original range-test Source literal receipt is required.");
        return literal;
    });
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[0], "int32"), true);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[1], "int32"), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[2], "uint32"), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[3], "uint64"), true);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[4], "uint64"), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[5], "float32"), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[6], "float64"), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literals[7], "decimal"), false);
});
test("negative zero keeps the same integer creation default as ordinary zero", () => {
    const current = fixture("function run(): void { const negative = -0; const ordinary = 0; } export const exported = -0;");
    for (const name of ["negative", "exported"]) {
        assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "int64" });
    }
    assertSameValue(current.defaults.context.describe(current.declaration("ordinary")), { kind: "primitive", primitive: "int64" });
});
test("the one integer default owner retains signed 64-bit creation for local, module and exported literals", () => {
    const cases = [
        ["positive_boundary", "2147483647", "int64"],
        ["positive_overflow", "2147483648", "int64"],
        ["positive_above", "2147483649", "int64"],
        ["negative_boundary", "-2147483648", "int64"],
        ["negative_overflow", "-2147483649", "int64"],
        ["wrapped_overflow", "(2147483648)", "int64"],
        ["positive_zero", "0", "int64"],
        ["negative_zero", "-0", "int64"],
        ["fractional", "1.5", "float64"],
        ["exponent", "1e2", "float64"],
    ];
    const current = fixture(cases.map(([name, literal]) => `const module_${name} = ${literal}; export const exported_${name} = ${literal};`).join("\n") + `\nfunction run(): void { ${cases.map(([name, literal]) => `const local_${name} = ${literal};`).join("\n")} }`);
    for (const scope of ["local", "module", "exported"])
        for (const [name, _literal, primitive] of cases) {
            const declaration = current.declaration(`${scope}_${name}`);
            const selected = current.defaults.context.describe(declaration);
            assert.equal(selected?.kind === "primitive" && selected.primitive === primitive, true, `${scope}_${name}`);
        }
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("integer creation describes the signed whole minimum and refuses values beyond int64 without a float fallback", () => {
    const cases = [
        ["maximum", "9223372036854775807", true],
        ["minimum", "-9223372036854775808", true],
        ["wrapped_minimum", "-(9223372036854775808)", true],
        ["positive_overflow", "9223372036854775808", false],
        ["negative_overflow", "-9223372036854775809", false],
        ["transport_overflow", "1000000000000000000000000000000000000000000", false],
    ];
    const current = fixture(cases.map(([name, literal]) => `const module_${name} = ${literal}; export const exported_${name} = ${literal};`).join("\n") + `\nfunction run(): void { ${cases.map(([name, literal]) => `const local_${name} = ${literal};`).join("\n")} }`);
    for (const scope of ["local", "module", "exported"])
        for (const [name, _literal, admitted] of cases) {
            const selected = current.defaults.context.describe(current.declaration(`${scope}_${name}`));
            assert.equal(admitted ? selected?.kind === "primitive" && selected.primitive === "int64" : selected === undefined, true, `${scope}_${name}: the exact whole literal owns its creation kind`);
        }
});
test("annotated unions and index signatures publish their declared type, never their initializer's narrower type", () => {
    const current = fixture("function run(): void { const value: number | string = 1; const dictionary: { [key: string]: number } = {}; }");
    const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
    assert.equal(index !== undefined, true);
    if (index === undefined)
        throw new Error("The actual checked index declaration is required.");
    for (const [name, expected] of [["value", { kind: "union", types: [{ kind: "primitive", primitive: "float64" }, { kind: "string" }] }],
        ["dictionary", { kind: "shape", members: [], indexes: [{ declaration: index, key: { kind: "string" },
                        value: { kind: "primitive", primitive: "float64" }, readonly: false }], calls: [], constructs: [] }]]) {
        const described = current.defaults.context.describe(current.declaration(name));
        const published = current.source.effectiveTypes.get(current.declaration(name));
        assertSameValue(described, expected);
        assert.equal(published !== undefined && published.kind !== "refused", true, name);
        if (published === undefined || published.kind === "refused")
            throw new Error("The declared type must be published.");
        assertSameValue(published.type, expected);
        assert.equal(described?.kind === "primitive" && described.primitive === "int32", false);
        assert.equal(name === "value" ? described?.kind === "union" && described.types.length > 1
            : described?.kind === "shape" && described.indexes.length > 0, true);
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("an opaque declared object publishes the object intrinsic, not a structural shape", () => {
    const current = fixture("declare const value: object;");
    const described = current.defaults.context.describe(current.declaration("value"));
    const published = current.source.effectiveTypes.get(current.declaration("value"));
    assertSameValue(described, { kind: "intrinsic", intrinsic: "object" });
    assert.equal(published !== undefined && published.kind !== "refused", true);
    if (published === undefined || published.kind === "refused")
        throw new Error("The declared type must be published.");
    assertSameValue(published.type, { kind: "intrinsic", intrinsic: "object" });
    assert.equal(described?.kind === "shape" || published.type.kind === "shape", false);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("a generic type annotation retains its checked type declaration beside a same-name constructor value", () => {
    const current = fixture(`interface Box<Value> { value: Value; }
    declare const Box: { new<Value>(value: Value): Box<Value> };
    function run(): void { const selected: Box<int32> = new Box<int32>(1); }`);
    const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === "Box");
    const type = current.defaults.context.describe(current.declaration("selected"));
    assert.equal(declaration !== undefined && type?.kind === "declared", true, "the real checked generic declaration is retained");
    if (type?.kind !== "declared")
        throw new Error("The declared generic descriptor is required.");
    assert.equal(type.declaration === declaration, true, "the constructor value cannot own a type annotation's binders");
    assertSameValue(type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
});
test("declared index aliases retain the actual signature only in their resolved definition", () => {
    const current = fixture("type Indexed = { [name: string]: number }; const data: Indexed = { value: 1 };");
    const alias = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
    const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
    const type = current.defaults.context.describe(current.declaration("data"));
    assert.equal(alias !== undefined && index !== undefined && type?.kind === "declared", true);
    if (type?.kind !== "declared")
        throw new Error("The nominal index alias is required.");
    assert.equal(type.declaration === alias && !("members" in type) && !("indexes" in type), true);
    assert.equal(type.definition?.kind === "shape", true);
    if (type.definition?.kind !== "shape")
        throw new Error("The Host-resolved alias body is required.");
    assert.equal(type.definition.indexes[0]?.declaration === index && type.definition.indexes[0]?.readonly === false, true);
    assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
    assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "float64" });
    assert.equal(type.definition.members.length === 0 && type.definition.indexes.length === 1, true);
    assert.equal(type.definition.calls.length === 0 && type.definition.constructs.length === 0, true);
    const literal = current.defaults.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
    assert.equal(current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal).length, 1);
});
test("a recursive alias definition closes at the same declaration and arguments without expanding the inner reference", () => {
    const current = fixture("type Tree = number | readonly Tree[]; declare const retained: Tree;");
    const alias = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
    const type = current.defaults.context.describe(current.declaration("retained"));
    assert.equal(type?.kind === "declared" && type.declaration === alias && type.definition?.kind === "union", true);
    if (type?.kind !== "declared" || type.definition?.kind !== "union")
        throw new Error("The complete recursive alias body is required.");
    assert.equal(type.typeArguments.length, 0);
    assert.equal(type.definition.types.some(member => member.kind === "primitive" && member.primitive === "float64"), true);
    const array = type.definition.types.find(member => member.kind === "array");
    assert.equal(array?.kind === "array" && array.readonly && array.element.kind === "declared", true);
    if (array?.kind !== "array" || array.element.kind !== "declared")
        throw new Error("The recursive array reference is required.");
    assert.equal(array.element.declaration === alias && array.element.typeArguments.length === 0 && array.element.definition === undefined, true);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("a mapped Record index retains its real mapped origin and substituted primitive width", () => {
    const current = fixture("const retained: Record<string, int32> = { count: 1 };");
    const type = current.defaults.context.describe(current.declaration("retained"));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape" && type.definition.indexes.length === 1, true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The resolved Record alias body is required.");
    const origin = current.source.ast.typeNode(type.declaration);
    assert.equal(origin !== undefined && current.source.ast.is.IsMappedTypeNode(origin), true);
    assert.equal(type.definition.indexes[0]?.declaration === origin && !("members" in type) && !("indexes" in type), true);
    assertSameValue(type.typeArguments, [{ kind: "string" }, { kind: "primitive", primitive: "int32" }]);
    assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
    assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
    assert.equal(type.definition.indexes[0]?.readonly, false);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
});
test("class and interface indexes retain their exact declaration and readonly metadata", () => {
    const current = fixture("interface Values { readonly [key: string]: int32; } declare const retained: Values;");
    const type = current.defaults.context.describe(current.declaration("retained"));
    const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
    const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
    assert.equal(type?.kind === "declared" && type.declaration === declaration &&
        type.definition?.kind === "shape" && type.definition.indexes.length === 1, true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The declared interface definition is required.");
    assert.equal(type.definition.indexes[0]?.declaration === index && type.definition.indexes[0]?.readonly === true &&
        !("members" in type) && !("indexes" in type), true);
    assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
    assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
});
function assertSameValue(actual, expected) {
    assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}
test("declared definitions have one canonical member and signature inventory", () => {
    const current = fixture(`interface Factory { readonly prototype: object; new(): object; }
    interface CallableObject { readonly tag: string; (value: int32): int32; }
    declare const factory: Factory; declare const callableObject: CallableObject;
    declare const callback: (value: int32) => int32; declare const constructor: new() => object;
    declare const empty: {};`);
    for (const [name, members, calls, constructs] of [["factory", 1, 0, 1], ["callableObject", 1, 1, 0]]) {
        const type = current.defaults.context.describe(current.declaration(name));
        assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true, name);
        if (type?.kind !== "declared" || type.definition?.kind !== "shape")
            throw new Error("The complete declared definition is required.");
        assert.equal(type.definition.members.length, members, name);
        assert.equal(type.definition.indexes.length, 0, name);
        assert.equal(type.definition.calls.length, calls, name);
        assert.equal(type.definition.constructs.length, constructs, name);
        assert.equal(type.definition.members.every(member => member.origin.kind === "declared"), true, name);
        assert.equal("members" in type || "indexes" in type, false, "nominal references have no duplicate structural inventory");
    }
    for (const [name, calls, constructs] of [["callback", 1, 0], ["constructor", 0, 1]]) {
        const type = current.defaults.context.describe(current.declaration(name));
        assert.equal(type?.kind === "callable" && type.calls.length === calls && type.constructs.length === constructs, true, name);
    }
    const empty = current.defaults.context.describe(current.declaration("empty"));
    assert.equal(empty?.kind === "shape" && empty.members.length === 0 && empty.indexes.length === 0 &&
        empty.calls.length === 0 && empty.constructs.length === 0, true, "an empty structure is a shape, never a signature-only callable");
});
test("nominal expanding recursion cuts by declaration identity while alias expansion uses the shared resource budget", () => {
    const current = fixture("interface Nest<Value> { child: Nest<Value[]> } declare const nested: Nest<int32>;");
    const type = current.defaults.context.describe(current.declaration("nested"));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The actual nominal definition is required.");
    const child = type.definition.members[0]?.type;
    assert.equal(child?.kind === "declared" && child.declaration === type.declaration && child.definition === undefined &&
        child.typeArguments[0]?.kind === "array" && child.typeArguments[0].element.kind === "primitive" &&
        child.typeArguments[0].element.primitive === "int32", true, "the recursive reference keeps its substituted arguments and no second definition");
    assert.throws(() => fixture("type Expanding<Value> = { child: Expanding<Value[]> }; declare const expanded: Expanding<int32>;"), error => error instanceof TargetCompilerResourceLimitFailure && error.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" &&
        error.diagnostic.sourceNode !== undefined && error.message.includes(`depth=${sourceTypeExpansionBudget.depth}`), "expanding aliases use the existing shared-budget resource failure at their declared site");
});
test("nominal definitions retain all structure once and cut recursive references by declaration and arguments", () => {
    const current = fixture(`interface Link<Value> { value: Value; next?: Link<Value>; }
    interface Empty {} declare const retained: Link<int32>; declare const empty: Empty;`);
    const type = current.defaults.context.describe(current.declaration("retained"));
    const empty = current.defaults.context.describe(current.declaration("empty"));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape")
        throw new Error("The complete nominal structure is required.");
    assert.equal("members" in type || "indexes" in type, false, "a nominal reference never duplicates its definition's structure");
    assert.equal(type.typeArguments[0]?.kind === "primitive" && type.typeArguments[0].primitive === "int32", true);
    const value = type.definition.members.find(member => member.name === "value");
    assert.equal(value?.type.kind === "primitive" && value.type.primitive === "int32", true);
    const next = type.definition.members.find(member => member.name === "next");
    assert.equal(next?.optional === true && next.type.kind === "optional" && next.type.value.kind === "declared", true);
    if (next?.type.kind !== "optional" || next.type.value.kind !== "declared")
        throw new Error("The actual recursive reference is required.");
    assert.equal(next.type.value.declaration === type.declaration && next.type.value.definition === undefined, true);
    assertSameValue(next.type.value.typeArguments, type.typeArguments);
    assert.equal(empty?.kind === "declared" && empty.definition?.kind === "shape" &&
        empty.definition.members.length === 0 && empty.definition.indexes.length === 0, true, "an empty definition remains distinguishable from a recursive reference");
});
test("K-2446 an overloaded member merged across declarations is identified by its symbol's first declaration", () => {
    const current = fixture(`interface Merged { run(value: int32): int32; run(value: string): string; }
    interface Merged { run(value: boolean): boolean; }
    declare const merged: Merged;`);
    const { ast } = current.source;
    const type = current.defaults.context.describe(current.declaration("merged"));
    const structure = type?.kind === "declared" ? type.definition : type;
    assert.equal(structure?.kind === "shape", true);
    if (structure?.kind !== "shape")
        return;
    const member = structure.members.find(candidate => candidate.name === "run");
    const first = current.defaults.nodes.find(node => ast.is.IsMethodSignatureDeclaration(node) && ast.text(ast.name(node)) === "run");
    assert.equal(member?.origin.kind === "declared" && member.origin.declaration === first, true, "one checked logical member keeps the first entry of its own checker declaration vector");
});
test("K-2446 an intersection of distinct same-named members has no single declared origin and is not described", () => {
    const current = fixture(`declare const both: { a: int32 } & { a: string };`);
    assert.equal(current.defaults.context.describe(current.declaration("both")), undefined, "several root symbols are not one logical member; no root is chosen");
});
//# sourceMappingURL=defaults.test.js.map
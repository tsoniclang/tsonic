import assert from "node:assert/strict";
import test from "node:test";
import { createSourceHostInput } from "../../host-input/index.js";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, pointerOperationFactKey } from "@tsonic/tsts";
import { collectSourceTypeFlowUses, sourceTypeFlowIsBroadSlot } from "./uses.js";
import { createSourceTypeDescriptorUnions } from "./terms.js";
const double = Object.freeze({ kind: "primitive", primitive: "float64" });
const integer = Object.freeze({ kind: "primitive", primitive: "int32" });
const wide = Object.freeze({ kind: "primitive", primitive: "int64" });
const single = Object.freeze({ kind: "primitive", primitive: "float32" });
const string = Object.freeze({ kind: "string" });
const array = (element, readonly = false) => Object.freeze({ kind: "array", element, readonly });
test("C2462 one Host broad-slot classifier preserves absorption, optionality and genuine union destinations", () => {
    const unknown = { kind: "intrinsic", intrinsic: "unknown" };
    const dynamic = { kind: "intrinsic", intrinsic: "any" };
    const object = { kind: "intrinsic", intrinsic: "object" };
    const empty = { kind: "intrinsic", intrinsic: "void" };
    const cases = [
        ["unknown", unknown, true], ["any", dynamic, true], ["object", object, true], ["void", empty, true],
        ["unknown absorbs string", { kind: "union", types: [unknown, string] }, true],
        ["any absorbs a primitive", { kind: "union", types: [double, dynamic] }, true],
        ["optional unknown", { kind: "optional", value: unknown }, true],
        ["optional object", { kind: "optional", value: object }, true],
        ["object does not absorb string", { kind: "union", types: [object, string] }, false],
        ["void does not absorb string", { kind: "union", types: [empty, string] }, false],
        ["optional genuine union", { kind: "optional", value: { kind: "union", types: [object, string] } }, false],
        ["primitive", double, false], ["string", string, false], ["absence", { kind: "intrinsic", intrinsic: "absence" }, false],
        ["broad nested element is not a broad array slot", array(unknown), false],
    ];
    for (const [name, type, expected] of cases)
        assert.equal(sourceTypeFlowIsBroadSlot(type), expected, name);
});
function fixture(program, options = {}) {
    const checked = createCompilerSessionFromFiles({
        currentDirectory: "/src",
        files: { ...options.files, "/src/index.ts": `type int32 = number; type int64 = number; type float32 = number; ${program}` },
        compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
        extensionHostOptions: { extensions: options.extensions },
    }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)).slice(0, 2048));
    const file = checked.getSourceFile("/src/index.ts");
    assert.equal(file !== undefined, true, "one exact checked source file");
    const source = createSourceTypeFlowTestProgram(options.onlyConsumer ? { ...checked, sourceFiles: Object.freeze([file]),
        getSourceFileQueries(selected) {
            assert.equal(selected === file, true, "excluded metadata never changes the actual checked consumer context");
            return checked.getSourceFileQueries(selected);
        }, } : checked);
    const { ast, navigation } = source;
    const inventory = navigation.nodesForFiles([file]);
    const root = inventory.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "run");
    if (root === undefined)
        throw new Error("The checked run function is required.");
    const text = (node) => {
        const range = ast.authoredRange(node);
        return range.kind === "authored" ? ast.getSourceText(ast.getSourceFile(node)).slice(range.start, range.end).trim() : ast.text(node);
    };
    const named = (name) => {
        const node = inventory.find(value => (ast.is.IsVariableDeclaration(value) || ast.is.IsParameterDeclaration(value)) &&
            ast.text(ast.name(value)) === name && belongs(value, root));
        if (node === undefined)
            throw new Error(`Missing checked declaration ${name}.`);
        return node;
    };
    const find = (sourceText, occurrence = 0) => {
        const found = inventory.filter(node => text(node) === sourceText && belongs(node, root));
        const selected = found[occurrence];
        if (selected === undefined)
            throw new Error(`Missing checked occurrence ${sourceText}.`);
        return selected;
    };
    const nodes = [];
    const calls = [];
    const links = [];
    const described = [];
    const descriptors = new Map([
        ["unknown", { kind: "intrinsic", intrinsic: "unknown" }], ["any", { kind: "intrinsic", intrinsic: "any" }],
        ["object", { kind: "intrinsic", intrinsic: "object" }], ["void", { kind: "intrinsic", intrinsic: "void" }],
        ["number", double], ["int32", integer], ["int64", wide], ["float32", single], ["string", string],
        ["unknown", Object.freeze({ kind: "intrinsic", intrinsic: "unknown" })],
        ["any", Object.freeze({ kind: "intrinsic", intrinsic: "any" })],
        ["object", Object.freeze({ kind: "intrinsic", intrinsic: "object" })],
        ["void", Object.freeze({ kind: "intrinsic", intrinsic: "void" })],
        ["number[]", array(double)], ["int32[]", array(integer)], ["int64[]", array(wide)], ["float32[]", array(single)],
        ["readonly number[]", array(double, true)], ["readonly int32[]", array(integer, true)],
    ]);
    const context = Object.freeze({
        source, unions: createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles),
        input: createSourceHostInput(source),
        authoredInheritedBindings: () => new Map(),
        describe(node, component) {
            described.push({ node, ...(component === undefined ? {} : { component }) });
            const authored = component?.authoredTypeNode;
            if (authored !== undefined) {
                const syntheticLeaf = descriptors.get(text(authored));
                if (syntheticLeaf !== undefined)
                    return syntheticLeaf;
                if (ast.is.IsTypeReferenceNode(authored)) {
                    const declaration = navigation.sourceReferenceFor(ast.as.AsTypeReferenceNode(authored)?.TypeName)?.declaration;
                    if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsInterfaceDeclaration(declaration))) {
                        return Object.freeze({ kind: "declared", declaration, typeArguments: Object.freeze([]) });
                    }
                }
            }
            const queries = context.input.at(node);
            const selected = component?.selectedType;
            return selected === undefined ? undefined : queries.isNumberLike(selected) ? double :
                queries.isStringLike(selected) ? string : queries.isArrayLike(selected) ? array(double) : undefined;
        },
        literal: () => undefined,
        order(node) {
            const range = ast.authoredRange(node);
            return Object.freeze({ start: range.kind === "authored" ? range.start : ast.pos(node),
                preorder: inventory.indexOf(node) });
        },
    });
    function belongs(node, owner) {
        for (let current = node; current !== undefined; current = ast.parent(current))
            if (current === owner)
                return true;
        return false;
    }
    function add(node, declaration, kind = "read", variable, term) {
        const record = Object.freeze({ node, root: root, kind, publish: true,
            variable: variable ?? Object.freeze({ node: declaration ?? node, path: Object.freeze([]) }),
            ...(declaration === undefined ? {} : { declaration }), ...(term === undefined ? {} : { term }) });
        nodes.push(record);
        return record;
    }
    function track(name) {
        const declaration = named(name);
        add(declaration, declaration, "open-local");
        for (const use of navigation.declarationUses(declaration)) {
            if (!use.captured && use.kind !== "type-only")
                add(use.reference, declaration);
        }
        return declaration;
    }
    function call(node, places = []) {
        const queries = context.input.at(node);
        const selected = queries.call(node);
        if (selected === undefined)
            throw new Error("The original selected call is required.");
        const receiver = selected.sourceReceiver === undefined ? [] :
            (queries.typeArgumentBindings(selected.sourceReceiver.type) ?? []).map(binding => Object.freeze({
                declaration: binding.declaration, variable: Object.freeze({ node, path: Object.freeze([{ kind: "binder", declaration: binding.declaration }]) }),
            }));
        const declaration = queries.callSignature(selected);
        const method = declaration === undefined ? [] : ast.typeParameters(declaration).filter((value) => value !== undefined).map(binder => Object.freeze({ declaration: binder, variable: Object.freeze({ node, path: Object.freeze([{ kind: "binder", declaration: binder }]) }) }));
        const result = Object.freeze({ node, source: selected, receiver: Object.freeze(receiver), method: Object.freeze(method),
            argumentPlaces: Object.freeze([...places]) });
        calls.push(result);
        return result;
    }
    function graph() {
        return Object.freeze({ roots: Object.freeze([root]), nodes: Object.freeze([...nodes]), calls: Object.freeze([...calls]),
            links: Object.freeze([...links]), inferenceInputs: Object.freeze([]), derived: Object.freeze([]), refusals: Object.freeze([]) });
    }
    function link(source, target, site) {
        links.push(Object.freeze({ source, target, site }));
    }
    function literalArray(node) {
        assert.equal(ast.is.IsArrayLiteralExpression(node), true, "the graph retains the actual array literal");
        const element = Object.freeze({ node, path: Object.freeze([{ kind: "element" }]) });
        const aggregate = add(node, undefined, "value", undefined, Object.freeze({ kind: "array", site: node, element, readonly: false }));
        for (const child of ast.elements(node)) {
            if (child === undefined)
                throw new Error("The finite aggregate control requires every original child.");
            const selected = nodes.find(record => record.node === child) ?? add(child, undefined, "value");
            link(selected.variable, element, child);
        }
        return aggregate;
    }
    return { source, context, root, inventory, text, named, find, add, track, call, graph, link, literalArray, described, descriptors,
        run: () => collectSourceTypeFlowUses(context, graph()) };
}
function kinds(uses) {
    return uses.map(use => use.kind);
}
test("U1 uses the real selected parameter with explicitly synthetic descriptor and finite graph leaves", () => {
    const current = fixture("declare function take(value: int32[]): void; function run() { const xs = [1]; take(xs); }");
    current.track("xs");
    const selected = current.call(current.find("take(xs)"));
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill"]);
    const use = uses[0];
    assert.equal(use.kind === "fill" && use.type.kind === "array" && use.type.element === integer, true, "the explicit descriptor leaf is retained");
    assert.equal(use.association?.call === selected.source, true, "the selected call is the same record");
    assert.equal(use.association?.binding === selected.source.sourceArgumentBindings[0], true, "the actual binding is not reconstructed");
    assert.equal(use.association?.parameter === selected.source.sourceSelectedSignatureParameters[0], true, "the selected parameter is not positional mock metadata");
    assert.equal(Object.isFrozen(uses) && Object.isFrozen(use), true, "owned result records are immutable");
});
test("U2 and U25 keep inferred and constrained method-binder places out of concrete demands", () => {
    for (const constraint of ["", " extends number[]"]) {
        const current = fixture(`declare function keep<T${constraint}>(value: T): T; function run() { const xs = [1]; keep(xs); }`);
        current.track("xs");
        const first = current.call(current.find("keep(xs)"));
        const binding = first.source.sourceArgumentBindings[0];
        const place = Object.freeze({ binding, parameter: first.source.sourceSelectedSignatureParameters[binding.sourceParameterIndex],
            binder: first.method[0].declaration, value: Object.freeze({ node: first.source.sourceArguments[0].expression, path: Object.freeze([]) }) });
        const graph = current.graph();
        const uses = collectSourceTypeFlowUses(current.context, { ...graph, calls: [{ ...first, argumentPlaces: [place] }] });
        assert.equal(uses.every(use => use.kind === "none"), true, "method inference and constraints belong to their actual generic owner");
        assert.equal(uses[0]?.association?.binding === binding, true, "the exact argument binding remains present");
    }
});
test("U3 refuses a selected overload whose candidates erase different authored numeric widths", () => {
    const current = fixture("declare function take(value: int32[]): void; declare function take(value: int64[]): void; function run() { const xs = [1]; take(xs); }");
    current.track("xs");
    const use = current.run()[0];
    assert.equal(use?.kind === "refused" && use.refusal.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, "the selected TS number overload cannot pick a width");
});
test("C15 does not retype or reject a fixed declared read", () => {
    const current = fixture("declare function take(value: int32): void; declare function take(value: int64): void; function run(value: int32) { take(value); }");
    const reference = current.source.navigation.declarationUses(current.named("value"))[0].reference;
    current.add(reference, current.named("value"), "fixed");
    assert.equal(current.run().length, 0, "a fixed value keeps the existing target conversion checks");
});
for (const type of ["unknown", "object"]) {
    test(`U4 ${type} does not fill an open array`, () => {
        const current = fixture(`declare function log(value: ${type}): void; function run() { const xs = [1]; log(xs); }`);
        current.track("xs");
        assert.deepEqual(kinds(current.run()), ["none"]);
    });
}
test("U5 declared returns fill while U6 inferred returns stay with the signature collector", () => {
    for (const [annotation, expected] of [[": int32[]", ["fill"]], ["", []]]) {
        const current = fixture(`function run()${annotation} { const xs = [1]; return xs; }`);
        current.track("xs");
        assert.deepEqual(kinds(current.run()), expected);
    }
});
test("U5 async declared returns retain the awaited child rather than Promise storage", () => {
    const current = fixture("async function run(): Promise<number[]> { const xs = [1]; return xs; }");
    current.track("xs");
    const use = current.run()[0];
    assert.equal(use?.kind === "fill" && use.type.kind === "array", true, "the awaited return is the array component");
    assert.equal(use?.association?.component?.declaration === current.root, true, "the authored return owner is unchanged");
});
test("U5 awaited return widths retain the actual authored child through a declaration alias", () => {
    for (const [prefix, annotation] of [["", "Promise<int32[]>"], ["type Reply = Promise<int32[]>;", "Reply"]]) {
        const current = fixture(`${prefix} async function run(): ${annotation} { const xs = [1]; return xs; }`);
        current.track("xs");
        const use = current.run()[0];
        assert.equal(use?.kind === "fill" && use.type.kind === "array" && use.type.element === integer, true, "awaiting cannot erase the declaration's native-width component");
        assert.equal(use?.association?.component?.authoredTypeNode !== undefined && current.text(use.association.component.authoredTypeNode) === "int32[]", true, "the component is original syntax, not a guessed inner target");
    }
});
test("U5 excluded return-alias metadata retains the actual return consumer's queries", () => {
    const current = fixture('import type { Reply } from "./excluded.js"; async function run(): Reply { const xs = [1]; return xs; }', {
        onlyConsumer: true, files: { "/src/excluded.ts": "export type Reply = Promise<number[]>;" },
    });
    current.track("xs");
    const use = current.run()[0];
    const component = use?.association?.component;
    assert.equal(use?.kind === "fill" && use.type.kind === "array" && use.type.element === double, true, "the same awaited component is retained");
    assert.equal(component?.declaration === current.root, true, "the authored return owner never moves to the alias");
    assert.equal(component?.authoredTypeNode !== undefined && current.text(component.authoredTypeNode) === "number[]", true, "the actual excluded alias child is kept");
    const file = component?.authoredTypeNode === undefined ? undefined : current.source.ast.getSourceFile(component.authoredTypeNode);
    assert.equal(file !== undefined && !current.source.semantics.includes(file), true, "the metadata file has no published semantic view");
});
test("U7 and U8 typed stores and annotated aliases fill only the source value", () => {
    const current = fixture("class Holder { items: number[] = []; } function run(holder: Holder) { const xs = [1]; const other: int32[] = xs; holder.items = xs; }");
    current.track("xs");
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill", "fill"]);
    assert.equal(uses[0]?.association?.component?.declaration === current.named("other"), true, "the alias annotation has its own declaration");
    assert.equal(uses[1]?.association?.component?.declaration !== current.named("xs"), true, "the property destination is not the source declaration");
});
test("U9 unannotated declaration aliases create no use-side fill", () => {
    const current = fixture("function run() { const xs = [1]; const alias = xs; void alias; }");
    current.track("xs");
    assert.equal(current.run().length, 0, "alias links belong to T3");
});
test("U10 typed literal members retain their original authored field rather than raw TS number", () => {
    const current = fixture("declare function take(value: { items: int32[] }): void; function run() { const xs = [1]; take({ items: xs }); }");
    current.track("xs");
    const literal = current.find("{ items: xs }");
    const member = Object.freeze({ node: literal, path: Object.freeze([{ kind: "member", name: "items" }]) });
    const aggregate = current.add(literal, undefined, "value", undefined, Object.freeze({ kind: "shape", site: literal,
        members: Object.freeze([{ name: "items", optional: false, variable: member }]) }));
    const property = current.source.ast.properties(literal)[0];
    const child = current.source.ast.as.AsPropertyAssignment(property).Initializer;
    const source = current.graph().nodes.find(record => record.node === child);
    current.link(source.variable, member, property);
    const declaration = current.inventory.find(node => current.source.ast.is.IsPropertySignatureDeclaration(node));
    if (declaration === undefined)
        throw new Error("The actual checked destination field is required.");
    current.descriptors.set("{ items: int32[] }", Object.freeze({ kind: "shape",
        members: Object.freeze([{ name: "items", optional: false, type: array(integer),
                origin: { kind: "declared", declaration } }]), indexes: Object.freeze([]), calls: Object.freeze([]), constructs: Object.freeze([]) }));
    const selected = current.call(current.find("take({ items: xs })"));
    const uses = current.run();
    const use = uses[0];
    const fieldType = use?.kind === "fill" && use.type.kind === "shape" ? use.type.members[0]?.type : undefined;
    assert.equal(uses.length === 1 && fieldType?.kind === "array" && fieldType.element === integer, true, "the field's authored width is kept");
    const annotation = use?.association?.component?.authoredTypeNode;
    const field = current.inventory.find(node => current.source.ast.is.IsPropertySignatureDeclaration(node) && current.source.ast.parent(node) === annotation);
    const authored = field === undefined ? undefined : current.source.ast.typeNode(field);
    assert.equal(authored !== undefined && current.text(authored) === "int32[]", true, "the component retains the actual field annotation");
    assert.equal(use?.variable === aggregate.variable && use.association?.call === selected.source &&
        use.association?.binding === selected.source.sourceArgumentBindings[0] &&
        use.association?.parameter === selected.source.sourceSelectedSignatureParameters[0], true, "one whole shape retains the exact selected call binding and formal");
    assert.equal(current.described.length === 1 && current.described[0]?.node === literal, true, "no raw child context competes with the whole shape");
    assert.equal(current.graph().links[0]?.source === source.variable && current.graph().links[0]?.target === member, true, "the actual child is retained by the aggregate's member projection");
});
test("U10 typed array elements keep the actual annotated element component", () => {
    const current = fixture("function run() { const value = 1; const items: int32[] = [value]; void items; }");
    current.track("value");
    const literal = current.find("[value]");
    const aggregate = current.literalArray(literal);
    const uses = current.run();
    const use = uses[0];
    assert.equal(uses.length === 1 && use?.kind === "fill" && use.type.kind === "array" && use.type.element === integer, true, "the element width comes from the original annotation");
    assert.equal(use?.variable === aggregate.variable && use.association?.component?.declaration === current.named("items"), true, "the same whole array context owns its element projection");
    assert.equal(current.described.length === 1 && current.described[0]?.node === literal, true, "the element has no second descriptor choice");
    assert.equal(aggregate.term?.kind === "array" && current.graph().links[0]?.target === aggregate.term.element, true, "the retained child remains linked to the original array element variable");
});
for (const [label, program] of [
    ["alias", "type Values = float32[]; function run(value: float32): Values { const result: Values = [value, 1]; return result; }"],
    ["argument", "declare function first(values: float32[]): float32; function run(value: float32): float32 { return first([value, 1]); }"],
    ["concise arrow", "function run(value: float32): float32 { const make = (): float32[] => [value, 1]; return make()[0]; }"],
]) {
    test(`U10 ${label} retains one float32 aggregate context without a raw TS child fill`, () => {
        const current = fixture(program);
        current.descriptors.set("Values", array(single));
        const literal = current.find("[value, 1]");
        const child = current.source.ast.elements(literal)[0];
        current.add(child, current.named("value"), "fixed", Object.freeze({ node: child, path: Object.freeze([]) }));
        const aggregate = current.literalArray(literal);
        const call = label === "argument" ? current.call(current.find("first([value, 1])")) : undefined;
        const original = current.graph();
        const arrow = label === "concise arrow" ? current.source.ast.parent(literal) : undefined;
        if (arrow !== undefined)
            assert.equal(current.source.ast.is.IsArrowFunction(arrow), true, "the declared concise body keeps its actual inference root");
        const graph = arrow === undefined ? original : Object.freeze({ ...original, roots: Object.freeze([current.root, arrow]),
            nodes: Object.freeze(original.nodes.map(node => Object.freeze({ ...node, root: arrow }))) });
        const uses = collectSourceTypeFlowUses(current.context, graph);
        const use = uses[0];
        assert.equal(uses.length === 1 && use?.kind === "fill" && use.type.kind === "array" && use.type.element === single, true, "the exact authored float32 whole-array demand is retained");
        assert.equal(use?.variable === aggregate.variable && use.variable.path.length === 0, true, "no scalar or nested-array demand is invented for an element");
        assert.equal(current.described.length === 1 && current.described[0]?.node === literal &&
            current.described[0]?.component === use?.association?.component, true, "the original aggregate component is described exactly once");
        assert.equal(use?.association?.sourceFile === current.source.ast.getSourceFile(literal), true, "the actual consumer remains the Source query owner");
        const element = aggregate.term?.kind === "array" ? aggregate.term.element : undefined;
        assert.equal(element !== undefined && graph.links.length === 2 && graph.links.every(link => link.target === element), true, "both original children stay in the same production-shaped array element projection");
        if (call !== undefined) {
            const parameter = call.source.sourceSelectedSignatureParameters[0];
            const annotation = parameter.parameterDeclaration === undefined ? undefined : current.source.ast.typeNode(parameter.parameterDeclaration);
            assert.equal(annotation !== undefined && use?.association?.call === call.source &&
                use.association?.binding === call.source.sourceArgumentBindings[0] &&
                use.association?.parameter === parameter && use.association?.component?.authoredTypeNode === annotation, true, "the declared demand is the exact retained call binding and formal, not the raw contextual Type");
        }
    });
}
test("U11 concrete assertions fill; interface assertions and U12 satisfies only check", () => {
    const current = fixture("interface View { n: number } function run() { const n = 1; const value = { n: 1 }; void (n as int32); void (value as View); void (value satisfies View); }");
    current.track("n");
    current.track("value");
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill", "check", "check"]);
    assert.equal(uses.filter(use => use.kind === "check").every(use => use.kind === "check" && use.check === "interface"), true, "interface checks do not fill storage");
});
test("U13 comparisons, arithmetic U16, conditions, templates and typeof never flow a demand backwards", () => {
    const current = fixture("function run(limit: number) { const n = 1; void (n + limit); void (n < limit); void (n === limit); if (n) { void `${n}`; } void typeof n; }");
    current.track("n");
    assert.equal(current.run().length, 0, "typed partners and observations place no demand");
});
test("U14 B9 accepts only declared compound right-side types", () => {
    const current = fixture("declare function price(): number; class Holder { amount: float32 = 1; } function run(parameter: number, holder: Holder) { let total = 0; const annotated: int64 = 1; total += parameter; total += holder.amount; total += annotated; total += price(); }");
    current.track("total");
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill", "fill", "fill", "fill"]);
    assert.deepEqual(uses.map(use => use.kind === "fill" && use.type.kind === "primitive" ? use.type.primitive : "missing"), ["float64", "float32", "int64", "float64"]);
});
test("B9 excluded declared right operands keep their original caller queries and declaration", () => {
    const current = fixture('import { foreignDeclaredNumber } from "./excluded.js"; function run() { let value = 1; value += foreignDeclaredNumber; }', {
        onlyConsumer: true, files: { "/src/excluded.ts": "export const foreignDeclaredNumber: number = 3;" },
    });
    current.track("value");
    const operand = current.find("foreignDeclaredNumber");
    const declaration = current.source.navigation.sourceReferenceFor(operand)?.declaration;
    assert.equal(declaration !== undefined, true, "the real selected foreign declaration is retained");
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill"]);
    assert.equal(uses[0]?.kind === "fill" && uses[0].type === double, true, "the declared right operand supplies its own type");
    assert.equal(uses[0]?.association?.component?.declaration === declaration, true, "no declaration is reconstructed in the consumer");
    const file = declaration === undefined ? undefined : current.source.ast.getSourceFile(declaration);
    assert.equal(file !== undefined && !current.source.semantics.includes(file), true, "no foreign declaration-file semantics are requested");
});
test("U15 and C20 updates, literal compounds, derived and open right sides are writes only", () => {
    const current = fixture("function run() { let total = 0; const open = 1; total += 1; total++; --total; total += open; total += open + 1; }");
    current.track("total");
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["write", "write", "write", "write", "write"]);
    assert.equal(uses.every(use => use.kind === "write" && use.required !== undefined && use.value !== undefined), true, "each checked write keeps its real operand");
});
test("D-A fixed plain assignments retain their exact RHS and projected destination without filling", () => {
    for (const mode of ["node", "term"])
        for (const [name, program, expression] of [
            ["local", "declare function take(value: number): void; function run() { let storage: int32 = 1; storage = 0.5; take(storage); }", "storage = 0.5"],
            ["member", "declare function take(value: number): void; class Box { value: int32 = 1; } function run(storage: Box) { storage.value = 0.5; take(storage.value); }", "storage.value = 0.5"],
            ["element", "declare function take(value: number): void; function run(storage: int32[]) { storage[0] = 0.5; take(storage[0]); }", "storage[0] = 0.5"],
        ]) {
            const current = fixture(program);
            const { ast } = current.source;
            const assignment = current.find(expression);
            const binary = ast.as.AsBinaryExpression(assignment);
            assert.equal(binary?.Left !== undefined && binary.Right !== undefined, true, `${mode}/${name}: real assignment operands`);
            if (binary?.Left === undefined || binary.Right === undefined)
                throw new Error("The checked assignment operands are required.");
            const declaration = current.named("storage");
            const variable = Object.freeze({ node: declaration, path: Object.freeze(name === "member"
                    ? [{ kind: "member", name: "value" }] : name === "element" ? [{ kind: "element" }] : []) });
            const kind = mode === "node" ? "fixed" : "read";
            const term = mode === "term"
                ? Object.freeze({ kind: "fixed", site: binary.Left, type: integer }) : undefined;
            const storage = current.add(binary.Left, declaration, kind, variable, term);
            const read = ast.arguments(current.find(`take(${current.text(binary.Left)})`))[0];
            assert.equal(read !== undefined, true, `${mode}/${name}: an ordinary fixed read is retained`);
            if (read === undefined)
                throw new Error("The checked fixed read is required.");
            current.add(read, declaration, kind, variable, mode === "term"
                ? Object.freeze({ kind: "fixed", site: read, type: integer }) : undefined);
            const uses = current.run();
            assert.equal(uses.length, 1, `${mode}/${name}: only the assignment is a use`);
            const write = uses[0];
            assert.equal(write?.kind === "write" && write.site === assignment && write.variable === storage.variable &&
                write.required === binary.Left && write.value === binary.Right, true, `${mode}/${name}: the existing write-fit path receives the exact destination and RHS`);
        }
});
test("D-A a fixed assignment never fills its fixed RHS or reclassifies an ordinary fixed read", () => {
    for (const mode of ["node", "term"]) {
        const current = fixture("declare function take(value: number): void; function run() { let storage: number = 0; const replacement: int32 = 1; storage = replacement; take(storage); }");
        const { ast } = current.source;
        const assignment = current.find("storage = replacement");
        const binary = ast.as.AsBinaryExpression(assignment);
        assert.equal(binary?.Left !== undefined && binary.Right !== undefined, true, `${mode}: real assignment operands`);
        if (binary?.Left === undefined || binary.Right === undefined)
            throw new Error("The checked assignment operands are required.");
        const kind = mode === "node" ? "fixed" : "read";
        const storageVariable = Object.freeze({ node: current.named("storage"), path: Object.freeze([]) });
        const storageTerm = mode === "term"
            ? Object.freeze({ kind: "fixed", site: binary.Left, type: double }) : undefined;
        const storage = current.add(binary.Left, storageVariable.node, kind, storageVariable, storageTerm);
        current.add(binary.Right, current.named("replacement"), kind, undefined, mode === "term"
            ? Object.freeze({ kind: "fixed", site: binary.Right, type: integer }) : undefined);
        const read = ast.arguments(current.find("take(storage)"))[0];
        assert.equal(read !== undefined, true, `${mode}: ordinary fixed read`);
        if (read === undefined)
            throw new Error("The checked fixed read is required.");
        current.add(read, storageVariable.node, kind, storageVariable, mode === "term"
            ? Object.freeze({ kind: "fixed", site: read, type: double }) : undefined);
        const uses = current.run();
        assert.equal(uses.length, 1, `${mode}: fixed RHS and ordinary reads do not create fills`);
        assert.equal(uses[0]?.kind === "write" && uses[0].site === assignment && uses[0].variable === storage.variable &&
            uses[0].value === binary.Right && uses[0].required === binary.Left, true, `${mode}: exact write-only assignment`);
    }
});
test("U17 typed right-side reassignment is still a write, not a fill or alias", () => {
    const current = fixture("function run(parameter: number[]) { let xs = [1]; xs = parameter; }");
    current.track("xs");
    assert.deepEqual(kinds(current.run()), ["write"]);
});
test("U18 member and element writes retain exact destination paths with no right-side join", () => {
    const current = fixture("function run() { const object = { n: 1 }; const values = [1]; object.n += 2; values[0] = 3; }");
    const object = current.named("object"), values = current.named("values");
    const member = current.find("object.n"), element = current.find("values[0]");
    const memberRecord = current.add(member, object, "read", { node: object, path: [{ kind: "member", name: "n" }] });
    const elementRecord = current.add(element, values, "read", { node: values, path: [{ kind: "element" }] });
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["write", "write"]);
    assert.equal(uses[0]?.variable === memberRecord.variable && uses[1]?.variable === elementRecord.variable, true, "the actual destination projections are unchanged");
});
test("U19 reads and U22 creation containment are not additional use-side links or fills", () => {
    const current = fixture("function run() { const xs = [1]; const object = { xs }; const copy = [...xs]; const [head] = xs; for (const item of xs) { void item; } void head; void object; void copy; }");
    current.track("xs");
    assert.equal(current.run().length, 0, "T3 alone owns read and containment relations");
});
test("U20 an inline argument closure belongs to the same inference root", () => {
    const current = fixture("declare function apply(callback: () => void): void; declare function take(value: int32): void; function run() { const n = 1; apply(() => { take(n); }); }");
    const declaration = current.track("n");
    const captured = current.source.navigation.declarationUses(declaration).find(use => use.captured);
    current.add(captured.reference, declaration);
    assert.deepEqual(kinds(current.run()), ["fill"]);
});
for (const invocation of ["consume", "new construct"]) {
    for (const wrapper of [
        { name: "parenthesized", wrap: (body) => `((${body}))` },
        { name: "as", wrap: (body) => `((${body}) as ((value: unknown) => void))` },
        { name: "satisfies", wrap: (body) => `((${body}) satisfies ((value: unknown) => void))` },
    ]) {
        test(`U20 ${invocation} keeps ${wrapper.name} inline roots and the original checked argument slot`, () => {
            const original = `${invocation}(${wrapper.wrap("(value: unknown): void => {}")})`;
            const captured = `${invocation}(${wrapper.wrap("(value: unknown): void => { take(n); }")})`;
            const current = fixture(`declare function consume(callback: (value: unknown) => void): void;
declare const construct: new (callback: (value: unknown) => void) => object;
declare function take(value: int32): void;
function run() { const n = 1; ${original}; ${captured}; }`);
            const declaration = current.track("n");
            const reference = current.source.navigation.declarationUses(declaration).find(use => use.captured);
            if (reference === undefined)
                throw new Error("The original checked closure capture is required.");
            current.add(reference.reference, declaration);
            const closures = current.inventory.filter(node => current.source.ast.is.IsArrowFunction(node));
            assert.equal(closures.length, 2, "both real closures remain published finite graph records");
            for (const closure of closures)
                current.add(closure, undefined, "value");
            const direct = current.call(current.find(original));
            current.call(current.find(captured));
            const uses = current.run();
            assert.deepEqual(kinds(uses), ["fill"]);
            assert.equal(uses[0]?.kind === "fill" && uses[0].type === integer, true, "the captured use keeps the original declared demand");
            const argument = current.source.ast.arguments(direct.node)[0];
            assert.equal(direct.source.sourceArguments[0]?.expression === argument, true, "the authored outer wrapper is the checked argument");
            assert.equal(current.context.input.at(direct.node).call(direct.node) === direct.source, true, "the original checked call is not reconstructed");
            const foreignArguments = { ...current.context, source: { ...current.source,
                    ast: { ...current.source.ast, arguments(node) {
                            return node === direct.node ? [] : current.source.ast.arguments(node);
                        } },
                } };
            assert.throws(() => collectSourceTypeFlowUses(foreignArguments, current.graph()), /original inference root/u);
        });
    }
}
test("U20 root validation rejects stored, named and non-inline wrapper boundaries", () => {
    for (const body of [
        "const stored = (() => n) satisfies (() => number); void stored;",
        "function nested() { return n; } void nested;",
        "consume(<((value: unknown) => void)>((value: unknown): void => { take(n); }));",
        "consume(((value: unknown): void => { take(n); })!);",
    ]) {
        const current = fixture(`declare function consume(callback: (value: unknown) => void): void;
declare function take(value: int32): void; function run() { const n = 1; ${body} }`);
        const declaration = current.track("n");
        const reference = current.source.navigation.declarationUses(declaration).find(use => use.captured);
        if (reference === undefined)
            throw new Error("The checked non-inline capture is required.");
        current.add(reference.reference, declaration);
        assert.throws(() => current.run(), /original inference root/u, "a separate callable root cannot be substituted by an outer graph root");
    }
});
test("U21 a stored closure cannot transport an open group's inference across roots", () => {
    const current = fixture("function run() { const n = 1; const callback = () => n; void callback; }");
    current.track("n");
    const uses = current.run();
    assert.equal(uses.length === 1 && uses[0]?.kind === "refused" && uses[0].refusal.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE", true, "the stored capture is reported from actual use evidence");
});
test("U23 wrappers keep the final argument occurrence without duplicating a fill", () => {
    const current = fixture("declare function take(value: number[]): void; function run() { const xs = [1]; take(((xs!))); }");
    const declaration = current.track("xs");
    current.add(current.find("((xs!))"), declaration);
    const uses = current.run();
    assert.deepEqual(kinds(uses), ["fill"]);
    assert.equal(uses[0]?.association?.binding !== undefined, true, "the wrapped argument keeps the actual native binding");
});
test("U24 a fixed declaration stays fixed and is not reclassified from a later use", () => {
    const current = fixture("declare function take(value: number): void; function run() { const n: int32 = 1; take(n); }");
    const declaration = current.named("n");
    const reference = current.source.navigation.declarationUses(declaration)[0].reference;
    current.add(reference, declaration, "fixed");
    assert.equal(current.run().length, 0, "fixed declarations are target conversion inputs, not inference groups");
});
test("U26 genuine typed conditionals fill both arms but never their condition", () => {
    const current = fixture("declare function take(value: int32[]): void; function run(flag: boolean) { const left = [1]; const right = [2]; take(flag ? left : right); }");
    current.track("left");
    current.track("right");
    current.track("flag");
    const uses = current.run();
    assert.equal(uses.length === 2 && uses.every(use => use.kind === "fill"), true, "only the value arms receive the chosen parameter type");
});
test("U27 delete and a type-query use retain Host refusal ownership", () => {
    const current = fixture("function run() { const object: { n?: number } = { n: 1 }; delete object.n; const n = 1; type Selected = typeof n; void (null as unknown as Selected); }");
    current.add(current.find("object.n"), current.named("object"));
    current.track("n");
    const uses = current.run();
    assert.equal(uses.length === 2 && uses.every(use => use.kind === "refused" && use.refusal.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED"), true, "neither operation invents a source type");
});
test("U29 readonly parameters are checks rather than fills", () => {
    const current = fixture("declare function inspect(value: readonly number[]): void; function run() { const xs = [1]; inspect(xs); }");
    current.track("xs");
    const use = current.run()[0];
    assert.equal(use?.kind === "check" && use.check === "read-only", true, "the view never chooses the group's storage type");
});
test("U30 a union demand is refused instead of picking a convenient member", () => {
    const current = fixture("declare function inspect(value: number[] | string[]): void; function run() { const xs = [1]; inspect(xs); }");
    current.track("xs");
    const use = current.run()[0];
    assert.equal(use?.kind === "refused" && use.refusal.code === "TSONIC_LOCAL_TYPE_UNION", true, "a chosen union is not a concrete fill");
});
test("C25 sorting is stable under reversed graph visitation and follows actual source sites", () => {
    const current = fixture("declare function first(value: int32): void; declare function second(value: int64): void; function run() { const n = 1; first(n); second(n); }");
    current.track("n");
    const graph = current.graph();
    const forward = collectSourceTypeFlowUses(current.context, graph);
    const reverse = collectSourceTypeFlowUses(current.context, { ...graph, nodes: [...graph.nodes].reverse() });
    assert.equal(forward.length === 2 && reverse.length === 2 && forward.every((use, index) => use.site === reverse[index]?.site), true, "source order, not collection order, anchors first use");
    assert.deepEqual(forward.map(use => use.kind === "fill" && use.type.kind === "primitive" ? use.type.primitive : "missing"), ["int32", "int64"]);
    const ties = collectSourceTypeFlowUses({ ...current.context,
        order: node => ({ start: 0, preorder: current.inventory.indexOf(node) }) }, { ...graph, nodes: [...graph.nodes].reverse() });
    assert.equal(ties.every((use, index) => use.site === forward[index]?.site), true, "AST preorder breaks equal-start ties");
});
test("foreign call and parameter associations fail before descriptor children", () => {
    const current = fixture("declare function take(value: number): void; function run() { const n = 1; take(n); take(2); }");
    current.track("n");
    const original = current.call(current.find("take(n)"));
    const other = current.context.input.at(current.find("take(2)")).call(current.find("take(2)"));
    let children = 0;
    const context = { ...current.context, describe() { children += 1; return double; } };
    assert.throws(() => collectSourceTypeFlowUses(context, { ...current.graph(), calls: [{ ...original, source: other }] }), /exact retained selected call/u);
    assert.equal(children, 0, "a foreign call never reaches a descriptor child");
    const binding = original.source.sourceArgumentBindings[0];
    const malformed = { ...original, source: { ...original.source, sourceArgumentBindings: [{ ...binding, sourceParameterIndex: 100 }] } };
    assert.throws(() => collectSourceTypeFlowUses(context, { ...current.graph(), calls: [malformed] }), /exact retained call argument/u);
    assert.equal(children, 0, "a missing parameter never reaches a descriptor child");
});
test("an unavailable selected component refuses instead of using a previous or default descriptor", () => {
    const current = fixture("declare function take(value: int32): void; function run() { const n = 1; take(n); }");
    current.track("n");
    const uses = collectSourceTypeFlowUses({ ...current.context, describe: () => undefined }, current.graph());
    assert.equal(uses[0]?.kind === "refused" && uses[0].refusal.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, "unavailable chosen evidence is not a fallback type");
});
test("C28 a receiver-binder argument is checked by its declared owner, regardless of method name", () => {
    const current = fixture("class Receiver<T> { arbitraryName(value: T): void { void value; } } function run() { const receiver = new Receiver<number>(); const n = 1; receiver.arbitraryName(n); }");
    current.track("receiver");
    current.track("n");
    const call = current.call(current.find("receiver.arbitraryName(n)"));
    const binding = call.source.sourceArgumentBindings[0];
    const parameter = call.source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
    const value = Object.freeze({ node: call.source.sourceArguments[0].expression, path: Object.freeze([]) });
    const binder = call.receiver[0];
    const place = Object.freeze({ binding, parameter, binder: binder.declaration, value });
    const uses = collectSourceTypeFlowUses(current.context, { ...current.graph(), calls: [{ ...call, argumentPlaces: [place] }] });
    const writes = uses.filter(use => use.kind === "write");
    assert.equal(writes.length, 1, "the receiver gets one write-fit, not a fill or equality edge");
    assert.equal(writes[0]?.variable === binder.variable, true, "the receiver's actual declared binder is authoritative");
    assert.equal(writes[0]?.kind === "write" && writes[0].valueVariable === value, true, "the actual projected source value survives");
    assert.equal(writes[0]?.association?.binding === binding && writes[0].association.parameter === parameter, true, "the original selected parameter relation survives");
    assert.equal(uses.some(use => use.kind === "fill"), false, "an argument never fills the receiver's binder");
});
test("C28 structured receiver checks keep separate pair projections, never one collapsed K/V type", () => {
    const current = fixture("class Receiver<K, V> { inspect(pair: readonly [K, V]): void { void pair; } } function run() { const receiver = new Receiver<number, string>(); const pair = [1, 'x'] as const; receiver.inspect(pair); }");
    current.track("receiver");
    current.track("pair");
    const call = current.call(current.find("receiver.inspect(pair)"));
    const binding = call.source.sourceArgumentBindings[0];
    const parameter = call.source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
    const argument = call.source.sourceArguments[0].expression;
    const first = Object.freeze({ node: argument, path: Object.freeze([{ kind: "tuple", index: 0 }]) });
    const second = Object.freeze({ node: argument, path: Object.freeze([{ kind: "tuple", index: 1 }]) });
    const places = [first, second].map((value, index) => Object.freeze({ binding, parameter, binder: call.receiver[index].declaration, value }));
    const uses = collectSourceTypeFlowUses(current.context, { ...current.graph(), calls: [{ ...call, argumentPlaces: places }] });
    const writes = uses.filter(use => use.kind === "write");
    assert.equal(writes.length === 2 && writes[0]?.variable !== writes[1]?.variable, true, "K and V remain separate receiver variables");
    assert.equal(writes[0]?.kind === "write" && writes[0].valueVariable === first &&
        writes[1]?.kind === "write" && writes[1].valueVariable === second, true, "each exact pair projection is retained");
});
test("C28 spread checks keep the real operand and projection beside the original authored wrapper binding", () => {
    const current = fixture("class Receiver<T> { inspect(...values: T[]): void { void values; } } function run() { const receiver = new Receiver<number>(); const values = [1]; receiver.inspect(...values); }");
    current.track("receiver");
    current.track("values");
    const call = current.call(current.find("receiver.inspect(...values)"));
    const binding = call.source.sourceArgumentBindings[0];
    const parameter = call.source.sourceSelectedSignatureParameters[0];
    const wrapper = call.source.sourceArguments[0].expression;
    const operand = current.source.ast.as.AsSpreadElement(wrapper)?.Expression;
    if (operand === undefined)
        throw new Error("The actual spread operand is required.");
    const value = { node: operand, path: [{ kind: "element" }] };
    const place = { binding, parameter, binder: call.receiver[0].declaration, value };
    const uses = collectSourceTypeFlowUses({ ...current.context, describe(node, component) {
            assert.equal(current.source.ast.is.IsSpreadElement(node), false, "a wrapper is never queried as a checked value");
            return current.context.describe(node, component);
        } }, { ...current.graph(), calls: [{ ...call, argumentPlaces: [place] }] });
    const write = uses.find(use => use.kind === "write");
    assert.equal(binding.sourceForm, "spread-sequence", "the checked sequence binding is unchanged");
    assert.equal(write?.kind === "write" && write.value === operand && write.valueVariable === value, true, "the native check receives the actual operand projection");
    assert.equal(write?.association?.call?.sourceArguments[0]?.expression === wrapper && write.association.binding === binding, true, "source association keeps the authored wrapper and same binding");
});
test("C28 method-binder places still join and a same-named free function is not an insertion", () => {
    const current = fixture("declare function push<T>(value: T): T; function run() { const n = 1; push(n); }");
    current.track("n");
    const call = current.call(current.find("push(n)"));
    const binding = call.source.sourceArgumentBindings[0];
    const parameter = call.source.sourceSelectedSignatureParameters[0];
    const place = { binding, parameter, binder: call.method[0].declaration,
        value: { node: call.source.sourceArguments[0].expression, path: [] } };
    const uses = collectSourceTypeFlowUses(current.context, { ...current.graph(), calls: [{ ...call, argumentPlaces: [place] }] });
    assert.equal(uses.every(use => use.kind === "none"), true, "only actual receiver-binder ownership can create C28 checks");
});
test("C28 foreign argument-place parameters are rejected before descriptor completion", () => {
    const current = fixture("class Receiver<T> { inspect(value: T, other: T): void {} } function run() { const receiver = new Receiver<number>(); const n = 1; receiver.inspect(n, 2); }");
    current.track("receiver");
    current.track("n");
    const call = current.call(current.find("receiver.inspect(n, 2)"));
    const place = { binding: call.source.sourceArgumentBindings[0], parameter: call.source.sourceSelectedSignatureParameters[1],
        binder: call.receiver[0].declaration, value: { node: call.source.sourceArguments[0].expression, path: [] } };
    let children = 0;
    const context = { ...current.context, describe() { children += 1; return double; } };
    assert.throws(() => collectSourceTypeFlowUses(context, { ...current.graph(), calls: [{ ...call, argumentPlaces: [place] }] }), /same retained argument-place parameter/u);
    assert.equal(children, 0, "foreign selected parameters cannot reach a descriptor child");
});
test("construction-position records never shadow a real use occurrence", () => {
    const current = fixture("declare function take(value: int32): void; function run() { const n = 1; take(n); }");
    current.track("n");
    const graph = current.graph();
    const read = graph.nodes.find(node => node.kind === "read");
    const position = { ...read, publish: false, variable: { node: read.node, path: [{ kind: "element" }] } };
    const uses = collectSourceTypeFlowUses(current.context, { ...graph, nodes: [...graph.nodes, position] });
    assert.equal(uses.length === 1 && uses[0]?.variable === read.variable, true, "an internal structural term is not a second occurrence");
});
test("U28 the actual Source pointer marker refuses an open address before generic children", () => {
    const extension = createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "./pointer.js", exports: [
                    { kind: "call-marker", exportName: "addressOf", marker: "address-of" },
                    { kind: "type-marker", exportName: "Pointer", marker: "pointer" },
                ] }] });
    const current = fixture("import { addressOf } from './pointer.js'; function run() { let n = 1; addressOf(n); }", {
        files: { "/src/pointer.ts": "export type Pointer<T> = { value: T }; export declare function addressOf<T>(value: T): Pointer<T>;" },
        extensions: [extension],
    });
    current.track("n");
    const call = current.find("addressOf(n)");
    assert.equal(current.source.sourceFacts.getFact(call, pointerOperationFactKey)?.operation, "address-of", "the real configured Source marker produced the address fact");
    const uses = current.run();
    assert.equal(uses[0]?.kind === "refused" && uses[0].refusal.code === "TSONIC_LOCAL_TYPE_ADDRESS", true, "the source storage address is not a use-derived type");
});
test("C16 the first over-limit real reference refuses the exact local with no widened budget", () => {
    const current = fixture(`function run() { const n = 1; ${"void n; ".repeat(1025)} }`);
    current.track("n");
    const uses = current.run();
    const reference = current.source.navigation.declarationUses(current.named("n"))[1024].reference;
    assert.equal(uses.length === 1 && uses[0]?.kind === "refused" && uses[0].refusal.code === "TSONIC_LOCAL_TYPE_LIMIT", true, "the 1024-use limit is not raised");
    assert.equal(uses[0]?.site === reference, true, "the first rejected occurrence anchors the refusal");
});
//# sourceMappingURL=uses.test.js.map
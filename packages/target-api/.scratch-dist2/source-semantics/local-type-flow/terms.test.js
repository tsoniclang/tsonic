import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createSourceClosedSumQuery, createSourceTypeDescriptorNormalizer, createSourceTypeFlowTerms, freezeSourceTypeDescriptor, createSourceTypeDescriptorUnions, sealSourceTypeDescriptorUnions, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual, sourceTypeDescriptorSum, sourceTypeDescriptorUnion, substituteSourceTypeDescriptor } from "./terms.js";
// Owner for descriptor-only freezing tests; production freezing is always per program (I5).
const snapshotOwner = createSourceTypeDescriptorUnions(undefined, []);
function fixture() {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "function run() { const first = 1; const second = 2; const third = 3; } class Left { value = 1; } class Right {}",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const unions = createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles);
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The original checked file is required.");
    const nodes = [];
    const visit = (node) => {
        if (checked.ast.is.IsVariableDeclaration(node) || checked.ast.is.IsClassDeclaration(node))
            nodes.push(node);
        checked.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(file);
    const variable = (index) => ({ node: nodes[index], path: [] });
    const entry = (value, term) => ({
        node: value.node, root: file, variable: value, kind: "value", publish: true, ...(term === undefined ? {} : { term }),
    });
    const graph = (values, links = []) => ({
        roots: [file], nodes: values, links, inferenceInputs: [], derived: [], calls: [], refusals: [],
    });
    return { ast: checked.ast, unions, file, nodes, variable, entry, graph };
}
test("G4 winning inputs activate only directed dependencies without copying producer terms or destinations", () => {
    const current = fixture();
    const source = current.variable(0);
    const binder = current.variable(1);
    const next = current.variable(2);
    const type = { kind: "primitive", primitive: "int64" };
    const destination = { kind: "union", types: [{ kind: "string" }, type] };
    const term = { kind: "fixed", site: source.node, type };
    const original = { ...current.entry(source, term), kind: "open-local", declaredType: destination };
    const graph = { ...current.graph([original, current.entry(binder), current.entry(next)]),
        inferenceInputs: [{ source, target: binder, site: source.node }, { source: binder, target: next, site: binder.node }] };
    const terms = createSourceTypeFlowTerms(current.ast, graph);
    const producer = terms.group(source);
    const selected = terms.group(binder);
    const forwarded = terms.group(next);
    assert.equal(producer !== selected && selected !== forwarded && producer !== forwarded, true);
    assert.equal(selected.terms.length === 0 && forwarded.terms.length === 0 && producer.terms[0] === term &&
        terms.isInference(source) && terms.isInference(binder) && terms.isInference(next), true, "the original producer solves once before its directed consumers, without a copied numeric/default path");
    assert.equal(selected.nodes.every(node => node.declaredType === undefined) &&
        producer.nodes[0]?.declaredType === destination && original.declaredType === destination, true, "later logical destination provenance stays on its original group");
});
test("C2533 void closure retains the canonical absence role without changing a whole void descriptor", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "type Family<T> = T | void; function inferred<T>(value:T,flag:boolean){return flag?value:undefined;}",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The original void union family is required.");
    const owner = ast.statements(file)[0];
    const binder = ast.typeParameters(owner)[0];
    const family = ast.typeNode(owner);
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const parameter = { kind: "declared", declaration: binder, typeArguments: [] };
    const completion = { kind: "intrinsic", intrinsic: "void" };
    const text = { kind: "string" };
    assert.equal(sourceTypeDescriptorUnion(unions, [completion]) === completion, true);
    const open = sourceTypeDescriptorUnion(unions, [parameter, completion], { kind: "authored", node: family });
    assert.equal(open?.kind === "optional" && open.value === parameter, true);
    if (open === undefined)
        throw new Error("The exact original optional family is required.");
    const projected = substituteSourceTypeDescriptor(unions, open, new Map([[binder, completion]]));
    assert.equal(projected?.kind === "intrinsic" && projected.intrinsic === "absence", true, "a bound void union role uses the same absence as the explicit void arm");
    const inferredOwner = ast.statements(file)[1];
    const inferred = sourceTypeDescriptorUnion(unions, [text, completion], { kind: "inferred", node: inferredOwner });
    assert.equal(inferred?.kind === "optional" && inferred.value === text, true, "inferred and authored union arms use the same canonical admission");
    sealSourceTypeDescriptorUnions(unions);
    const normalizer = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalize = (type) => {
        const value = normalizer(type);
        if (value === undefined)
            throw new Error("The exact void application must normalize.");
        return freezeSourceTypeDescriptor(unions, value);
    };
    const query = createSourceClosedSumQuery(unions, normalize);
    const record = query({ family, application: [completion] });
    assert.equal(record?.arms.length === 1 && record.arms[0]?.type.kind === "intrinsic" &&
        record.arms[0].type.intrinsic === "absence" && record.roles.length === 2 &&
        record.roles.every(role => role.arms.length === 1 && role.arms[0] === 0), true, "coincident original roles point to one absence arm, never a void payload or a second nullish state");
    assert.equal(normalize(completion).kind === "intrinsic" && normalize(completion) !== projected, true);
});
test("C2529 inferred families preserve authored preference, original binders and independent coincident applications", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": 'function first<T>(value:T,flag:boolean){return flag?value:"s";} function second<T>(value:T,flag:boolean){return flag?value:"s";} type Later = number | string;',
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The exact original family file is required.");
    const [first, second, later] = ast.statements(file);
    if (first === undefined || second === undefined || later === undefined)
        throw new Error("All original family owners are required.");
    const conditional = (owner) => {
        const body = ast.body(owner);
        const returned = body === undefined ? undefined : ast.statements(body)[0];
        const selected = returned === undefined ? undefined : ast.as.AsReturnStatement(returned)?.Expression;
        if (selected === undefined)
            throw new Error("The original conditional producer is required.");
        return selected;
    };
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const text = { kind: "string" };
    const floating = { kind: "primitive", primitive: "float64" };
    const open = (owner) => {
        const binder = ast.typeParameters(owner)[0];
        if (binder === undefined)
            throw new Error("The exact original free binder is required.");
        const value = sourceTypeDescriptorUnion(unions, [text, { kind: "declared", declaration: binder, typeArguments: [] }], { kind: "inferred", node: conditional(owner) });
        if (value === undefined)
            throw new Error("The original inferred family is required.");
        return value;
    };
    const firstOpen = open(first);
    const secondOpen = open(second);
    const firstBinder = ast.typeParameters(first)[0];
    const secondBinder = ast.typeParameters(second)[0];
    const firstClosed = substituteSourceTypeDescriptor(unions, firstOpen, new Map([[firstBinder, floating]]));
    assert.equal(firstClosed?.kind === "union" && firstClosed.types[0] === text && firstClosed.types[1] === floating, true);
    const authored = ast.typeNode(later);
    if (authored === undefined)
        throw new Error("The later authored declaration is required.");
    sourceTypeDescriptorUnion(unions, [floating, text], { kind: "authored", node: authored });
    const firstCoincident = substituteSourceTypeDescriptor(unions, firstOpen, new Map([[firstBinder, text]]));
    const secondCoincident = substituteSourceTypeDescriptor(unions, secondOpen, new Map([[secondBinder, text]]));
    assert.equal(firstCoincident === text && secondCoincident === text, true, "metadata never clones a scalar merely to distinguish coincident families");
    sealSourceTypeDescriptorUnions(unions);
    const normalizer = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalize = (type) => {
        const selected = normalizer(type);
        if (selected === undefined)
            throw new Error("The existing sealed application must normalize.");
        return freezeSourceTypeDescriptor(unions, selected);
    };
    const query = createSourceClosedSumQuery(unions, normalize);
    const firstRecord = query({ family: conditional(first), application: [floating] });
    assert.equal(firstRecord?.arms[0]?.type.kind === "primitive" && firstRecord.arms[0].type.primitive === "float64" &&
        firstRecord.arms[1]?.type.kind === "string", true, "the later authored order supersedes encounter order; inferred metadata never registers authored preference");
    const firstCollapsed = query({ family: conditional(first), application: [text] });
    const secondCollapsed = query({ family: conditional(second), application: [text] });
    assert.equal(firstCollapsed !== undefined && secondCollapsed !== undefined && firstCollapsed !== secondCollapsed &&
        firstCollapsed.roles.every(role => role.arms.length === 1 && role.arms[0] === 0) &&
        secondCollapsed.roles.every(role => role.arms.length === 1 && role.arms[0] === 0), true);
    const frozen = normalize(firstOpen);
    assert.equal(substituteSourceTypeDescriptor(unions, frozen, new Map([[firstBinder, { kind: "primitive", primitive: "uint32" }]])) === undefined, true, "an unseen inferred application remains unavailable after seal");
    assert.equal(substituteSourceTypeDescriptor(unions, frozen, new Map([[secondBinder, floating]])) === frozen, true, "a distinct original binder cannot bind the first family");
    assert.equal(sourceTypeDescriptorSum(unions, text) === undefined, true, "coincident scalar lookup cannot choose either family");
});
test("C2501 nested open family roles are the canonical irreducible Source arm vector before application", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "type Family<T> = string | (T | number);",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const file = checked.getSourceFile("/src/index.ts");
    const declaration = ast.statements(file)[0];
    const family = ast.typeNode(declaration);
    const binder = ast.typeParameters(declaration)[0];
    const inner = ast.as.AsParenthesizedTypeNode(ast.children(family)[1]).Type;
    const text = { kind: "string" };
    const numeric = { kind: "primitive", primitive: "float64" };
    const integer = { kind: "primitive", primitive: "int32" };
    const parameter = { kind: "declared", declaration: binder, typeArguments: [] };
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const nested = sourceTypeDescriptorUnion(unions, [parameter, numeric], { kind: "authored", node: inner });
    const open = sourceTypeDescriptorUnion(unions, [text, nested], { kind: "authored", node: family });
    const closed = substituteSourceTypeDescriptor(unions, open, new Map([[binder, integer]]));
    const coincident = substituteSourceTypeDescriptor(unions, open, new Map([[binder, text]]));
    sealSourceTypeDescriptorUnions(unions);
    const normalizer = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalize = (type) => {
        const selected = normalizer(type);
        if (selected === undefined)
            throw new Error("The exact sealed role application is required.");
        return freezeSourceTypeDescriptor(unions, selected);
    };
    const sum = createSourceClosedSumQuery(unions, normalize);
    const original = sourceTypeDescriptorSum(unions, normalize(open));
    assert.equal(original?.arms.length === 3 && original.roles.length === 3 &&
        original.arms.every((arm, index) => arm.role === index) &&
        original.roles.every((role, index) => role.role === index && role.arms.length === 1 && role.arms[0] === index), true, "nested syntax cannot group the opaque T role and the independent fixed number role");
    const applied = sourceTypeDescriptorSum(unions, normalize(closed));
    assert.equal(applied?.roles.length === 3 && applied.arms.length === 3 && applied.roles[1]?.arms.length === 1 &&
        applied.arms[applied.roles[1].arms[0]].type.kind === "primitive" &&
        sum(applied.identity) === applied, true);
    const merged = sourceTypeDescriptorSum(unions, normalize(coincident));
    assert.equal(merged?.roles.length === 3 && merged.arms.length === 2 &&
        merged.roles[0]?.arms[0] === merged.roles[1]?.arms[0] &&
        merged.roles[2]?.arms[0] !== merged.roles[1]?.arms[0], true, "a coincident opaque T maps to string without consuming the independent fixed number role");
});
test("C2501 initial duplicate roles deduplicate once and generic coincidence retains one canonical absence", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "type Family<T> = string | T | string | undefined;",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const declaration = ast.statements(checked.getSourceFile("/src/index.ts"))[0];
    const family = ast.typeNode(declaration);
    const binder = ast.typeParameters(declaration)[0];
    const text = { kind: "string" };
    const absence = { kind: "intrinsic", intrinsic: "absence" };
    const parameter = { kind: "declared", declaration: binder, typeArguments: [] };
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const open = sourceTypeDescriptorUnion(unions, [text, parameter, text, absence], { kind: "authored", node: family });
    const coincident = substituteSourceTypeDescriptor(unions, open, new Map([[binder, text]]));
    sealSourceTypeDescriptorUnions(unions);
    const normalizer = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalize = (type) => {
        const selected = normalizer(type);
        if (selected === undefined)
            throw new Error("The observed duplicate family requires its sealed closure.");
        return freezeSourceTypeDescriptor(unions, selected);
    };
    const sum = createSourceClosedSumQuery(unions, normalize);
    const original = sourceTypeDescriptorSum(unions, normalize(open));
    const applied = sourceTypeDescriptorSum(unions, normalize(coincident));
    assert.equal(original?.arms.length === 3 && original.roles.length === 3 &&
        original.arms.filter(arm => arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence").length === 1, true, "an initial repeated fixed string is one role while the opaque original T remains independent");
    assert.equal(applied?.arms.length === 2 && applied.roles.length === 3 &&
        applied.roles[0]?.arms[0] === applied.roles[1]?.arms[0] &&
        applied.roles[2]?.arms[0] !== applied.roles[0]?.arms[0] && sum(applied.identity) === applied, true);
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[binder, { kind: "primitive", primitive: "int64" }]])) === undefined, true, "an unobserved multi-arm application cannot register a preference after the seal");
});
test("C2501 sealed Source sums retain two coincident families and partial original roles without scalar inference", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "type First<T> = string | T; type Second<T> = string | T; type RolePartial<U> = number | U; type Closed = string | number;",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The original sum declarations are required.");
    const [first, second, partial, concrete] = ast.statements(file);
    if (first === undefined || second === undefined || partial === undefined || concrete === undefined)
        throw new Error("Four original families are required.");
    const firstFamily = ast.typeNode(first);
    const secondFamily = ast.typeNode(second);
    const partialFamily = ast.typeNode(partial);
    const concreteFamily = ast.typeNode(concrete);
    const firstParameter = ast.typeParameters(first)[0];
    const secondParameter = ast.typeParameters(second)[0];
    const partialParameter = ast.typeParameters(partial)[0];
    const parameter = (declaration) => ({ kind: "declared", declaration, typeArguments: [] });
    const text = { kind: "string" };
    const numeric = { kind: "primitive", primitive: "float64" };
    const integer = { kind: "primitive", primitive: "int32" };
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const firstOpen = sourceTypeDescriptorUnion(unions, [text, parameter(firstParameter)], { kind: "authored", node: firstFamily });
    const secondOpen = sourceTypeDescriptorUnion(unions, [text, parameter(secondParameter)], { kind: "authored", node: secondFamily });
    const partialOpen = sourceTypeDescriptorUnion(unions, [numeric, parameter(partialParameter)], { kind: "authored", node: partialFamily });
    const concreteOpen = sourceTypeDescriptorUnion(unions, [text, numeric], { kind: "authored", node: concreteFamily });
    const firstScalar = substituteSourceTypeDescriptor(unions, firstOpen, new Map([[firstParameter, text]]));
    const secondScalar = substituteSourceTypeDescriptor(unions, secondOpen, new Map([[secondParameter, text]]));
    const firstClosed = substituteSourceTypeDescriptor(unions, firstOpen, new Map([[firstParameter, numeric]]));
    const firstPartial = substituteSourceTypeDescriptor(unions, firstOpen, new Map([[firstParameter, partialOpen]]));
    const partialClosed = substituteSourceTypeDescriptor(unions, firstPartial, new Map([[partialParameter, integer]]));
    sealSourceTypeDescriptorUnions(unions);
    const normalizer = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalize = (type) => {
        const selected = normalizer(type);
        if (selected === undefined)
            throw new Error("The known sealed family is required.");
        return freezeSourceTypeDescriptor(unions, selected);
    };
    const sum = createSourceClosedSumQuery(unions, normalize);
    const originalRecord = sourceTypeDescriptorSum(unions, normalize(firstOpen));
    assert.equal(originalRecord?.identity.family === firstFamily && originalRecord.identity.application.length === 1 &&
        originalRecord.identity.application[0]?.kind === "declared" &&
        originalRecord.identity.application[0].declaration === firstParameter, true, "an inline generic union retains its original binder application without requiring an alias owner");
    const firstRecord = sum({ family: firstFamily, application: [normalize(text)] });
    const secondRecord = sum({ family: secondFamily, application: [normalize(text)] });
    assert.equal(firstScalar === text && secondScalar === text, true, "coincidence preserves the original scalar identity");
    assert.equal(firstRecord !== undefined && secondRecord !== undefined && firstRecord !== secondRecord &&
        firstRecord.identity.family === firstFamily && secondRecord.identity.family === secondFamily, true, "two original families never become one fact merely because both close to string");
    assert.equal(firstRecord !== undefined && sum(firstRecord.identity) === firstRecord &&
        firstRecord.arms.length === 1 && firstRecord.roles.length === 2 &&
        firstRecord.roles.every(role => role.arms.length === 1 && role.arms[0] === 0), true, "coincident original roles map to the exact same frozen closed arm");
    assert.equal(sourceTypeDescriptorSum(unions, text) === undefined && sourceTypeDescriptorSum(unions, normalize(text)) === undefined, true, "a shared scalar cannot choose between original family applications");
    const closed = sourceTypeDescriptorSum(unions, normalize(firstClosed));
    assert.equal(closed?.arms.length === 2 && closed.arms[0]?.type.kind === "string" &&
        closed.arms[1]?.type.kind === "primitive" && closed.arms[1].type.primitive === "float64", true);
    const concreteRecord = sourceTypeDescriptorSum(unions, normalize(concreteOpen));
    assert.equal(concreteRecord !== undefined && closed !== undefined && concreteRecord !== closed &&
        concreteRecord.identity.family === concreteFamily && concreteRecord.identity.application.length === 0 &&
        closed.identity.family === firstFamily && closed.identity.application.length === 1, true, "the same logical armset does not erase a distinct original family or application");
    const expanded = sourceTypeDescriptorSum(unions, normalize(partialClosed));
    assert.equal(expanded?.identity.family === firstFamily && expanded.arms.length === 3 &&
        expanded.roles[0]?.arms.length === 1 && expanded.roles[1]?.arms.length === 2, true, "an actual partial original role expands to its two closed arms");
    assert.equal(firstRecord !== undefined && Object.isFrozen(firstRecord) && Object.isFrozen(firstRecord.identity) &&
        Object.isFrozen(firstRecord.roles) && firstRecord.roles.every(role => Object.isFrozen(role.arms)), true);
    assert.equal(sourceTypeDescriptorSum(unions, { kind: "union", types: [text, numeric] }) === undefined, true, "an equal newly fabricated descriptor is not the published association");
});
test("C2459 sealed sum identities reject a different program's same-span original binder across calls", () => {
    const original = () => {
        const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
                "/src/index.ts": "export function run<Value>(value: string | Value): void {}",
            }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
        assert.equal(checked.diagnostics.length, 0);
        const file = checked.getSourceFile("/src/index.ts");
        if (file === undefined)
            throw new Error("The original source file is required.");
        const declaration = checked.ast.statements(file)[0];
        const binder = checked.ast.typeParameters(declaration)[0];
        const authored = checked.ast.typeNode(checked.ast.parameters(declaration)[0]);
        return { checked, binder, authored };
    };
    const current = original();
    const foreign = original();
    const { ast } = current.checked;
    assert.equal(current.binder !== foreign.binder && ast.pos(current.binder) === foreign.checked.ast.pos(foreign.binder), true);
    const parameter = { kind: "declared", declaration: current.binder, typeArguments: [] };
    const other = { kind: "declared", declaration: foreign.binder, typeArguments: [] };
    assert.equal(sourceTypeDescriptorsEqual(parameter, other), false);
    const unions = createSourceTypeDescriptorUnions(ast, current.checked.programSourceFiles);
    const open = sourceTypeDescriptorUnion(unions, [{ kind: "string" }, parameter], { kind: "authored", node: current.authored });
    if (open === undefined)
        throw new Error("The original authored sum is required.");
    sealSourceTypeDescriptorUnions(unions);
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[current.binder, other]])) === undefined, true, "a new call cannot equate another program's binder by its path and source span");
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[foreign.binder, parameter]])) === open, true, "a foreign map key cannot replace the original binder");
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[current.binder, { kind: "string" }]]))?.kind === "string", true, "a deterministic scalar coincidence remains available after sealing");
});
test("C2459 shared tuple DAG identities preserve deduplication and encounter order with bounded distinct nodes", () => {
    const current = fixture();
    const text = { kind: "string" };
    const integer = { kind: "primitive", primitive: "int64" };
    for (const depth of [8, 12, 16, 18]) {
        let first = text;
        let second = text;
        for (let level = 0; level < depth; level += 1) {
            first = { kind: "tuple", readonly: true, elements: [{ kind: "required", type: first }, { kind: "required", type: first }] };
            second = { kind: "tuple", readonly: true, elements: [{ kind: "required", type: second }, { kind: "required", type: second }] };
        }
        const forward = sourceTypeDescriptorUnion(current.unions, [first, integer, second]);
        const reverse = sourceTypeDescriptorUnion(current.unions, [integer, second]);
        assert.equal(forward?.kind === "union" && forward.types.length === 2 && forward.types[0] === first && forward.types[1] === integer, true, `depth ${depth}: two shared graphs with the same structure are one arm`);
        assert.equal(reverse?.kind === "union" && reverse.types.length === 2 && reverse.types[0] === second && reverse.types[1] === integer, true, `depth ${depth}: reordering keeps the program preference and the current original members`);
        assert.equal(sourceTypeDescriptorUnion(current.unions, [first, second]) === first, true);
    }
});
test("canonical variable paths use original nodes and structural positions", () => {
    const current = fixture();
    const first = { node: current.nodes[0], path: [{ kind: "member", name: "value" }] };
    const same = { node: current.nodes[0], path: [{ kind: "member", name: "value" }] };
    const other = { node: current.nodes[1], path: [{ kind: "member", name: "value" }] };
    const terms = createSourceTypeFlowTerms(current.ast, current.graph([current.entry(first), current.entry(other)]));
    assert.equal(terms.group(first).variable === terms.group(same).variable, true);
    assert.equal(terms.group(first).variable === terms.group(other).variable, false);
});
test("array aliases unify their exact element positions", () => {
    const current = fixture();
    const first = current.variable(0);
    const second = current.variable(1);
    const firstElement = { node: first.node, path: [{ kind: "element" }] };
    const secondElement = { node: second.node, path: [{ kind: "element" }] };
    const terms = createSourceTypeFlowTerms(current.ast, current.graph([
        current.entry(first, { kind: "array", site: first.node, readonly: false, element: firstElement }),
        current.entry(second, { kind: "array", site: second.node, readonly: false, element: secondElement }),
    ], [{ source: first, target: second, site: second.node }]));
    assert.equal(terms.group(firstElement).variable === terms.group(secondElement).variable, true);
    assert.equal(terms.group(first).refusals.length, 0);
});
test("occurs checks refuse self-containment without a second type answer", () => {
    const current = fixture();
    const first = current.variable(0);
    const second = current.variable(1);
    const terms = createSourceTypeFlowTerms(current.ast, current.graph([
        current.entry(first, { kind: "array", site: first.node, readonly: false, element: second }), current.entry(second),
    ], [{ source: first, target: second, site: second.node }]));
    assert.equal(terms.group(first).refusals[0]?.code, "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
    assert.equal(terms.group(first).variable === terms.group(second).variable, false);
});
test("incompatible structures refuse at the actual later link", () => {
    const current = fixture();
    const first = current.variable(0);
    const second = current.variable(1);
    const element = current.variable(2);
    const terms = createSourceTypeFlowTerms(current.ast, current.graph([
        current.entry(first, { kind: "array", site: first.node, readonly: false, element }),
        current.entry(second, { kind: "shape", site: second.node, members: [] }),
    ], [{ source: first, target: second, site: second.node }]));
    assert.equal(terms.group(first).refusals[0]?.code, "TSONIC_LOCAL_TYPE_CONFLICT");
    assert.equal(terms.group(first).refusals[0]?.site === second.node, true);
});
test("two tuple positions never collapse to a single array element", () => {
    const current = fixture();
    const first = current.variable(0);
    const left = { node: first.node, path: [{ kind: "tuple", index: 0 }] };
    const right = { node: first.node, path: [{ kind: "tuple", index: 1 }] };
    const terms = createSourceTypeFlowTerms(current.ast, current.graph([
        current.entry(first, { kind: "tuple", site: first.node, readonly: true,
            elements: [{ kind: "required", variable: left }, { kind: "required", variable: right }] }),
    ]));
    assert.equal(terms.group(left).variable === terms.group(right).variable, false);
});
test("nominal identity includes the original declaration and ordered arguments", () => {
    const current = fixture();
    const integer = { kind: "primitive", primitive: "int32" };
    const floating = { kind: "primitive", primitive: "float64" };
    const first = { kind: "declared", declaration: current.nodes[3], typeArguments: [integer, floating] };
    assert.equal(sourceTypeDescriptorsEqual(first, { ...first, declaration: current.nodes[4] }), false);
    assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [floating, integer] }), false);
    assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [integer, floating] }), true);
});
test("C2459 inferred sums retain the first encounter vector and one absence state", () => {
    const current = fixture();
    const floating = { kind: "primitive", primitive: "float64" };
    const text = { kind: "string" };
    const absence = { kind: "intrinsic", intrinsic: "absence" };
    const forward = sourceTypeDescriptorUnion(current.unions, [text, floating]);
    const reverse = sourceTypeDescriptorUnion(current.unions, [floating, text]);
    assert.deepEqual(forward, reverse);
    assert.equal(forward?.kind === "union" && forward.types[0] === text && forward.types[1] === floating, true);
    assert.equal(forward?.kind === "union" && forward.types.length === 2, true);
    const nested = sourceTypeDescriptorUnion(current.unions, [absence, { kind: "optional", value: text },
        { kind: "union", types: [text, floating] }, floating, absence]);
    assert.equal(nested?.kind === "optional" && nested.value.kind === "union" && nested.value.types.length === 2, true);
    assert.deepEqual(nested, sourceTypeDescriptorUnion(current.unions, [reverse, absence]));
    assert.equal(sourceTypeDescriptorUnion(current.unions, [text, { kind: "string" }]) === text, true);
    assert.deepEqual(sourceTypeDescriptorUnion(current.unions, [absence, absence]), absence);
    assert.equal(sourceTypeDescriptorUnion(current.unions, []) === undefined, true);
});
test("C2459 symbolic sums retain authored order through exact original binder substitution", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/generics.ts": "function first<Item>(value: string | Item): void {} function second<Item>(): void {}",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const file = checked.getSourceFile("/src/generics.ts");
    if (file === undefined)
        throw new Error("The original generic source is required.");
    const declarations = checked.ast.statements(file);
    const [first, second] = declarations.map(declaration => checked.ast.typeParameters(declaration)[0]);
    if (first === undefined || second === undefined)
        throw new Error("Both original generic binders are required.");
    const parameter = { kind: "declared", declaration: first, typeArguments: [] };
    const other = { kind: "declared", declaration: second, typeArguments: [] };
    const text = { kind: "string" };
    const floating = { kind: "primitive", primitive: "float64" };
    const unions = createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles);
    const authored = checked.ast.typeNode(checked.ast.parameters(declarations[0])[0]);
    assert.equal(authored !== undefined && checked.ast.is.IsUnionTypeNode(authored), true);
    const open = sourceTypeDescriptorUnion(unions, [text, parameter], authored === undefined ? undefined : { kind: "authored", node: authored });
    assert.equal(open?.kind === "union" && open.types[0] === text && open.types[1] === parameter, true);
    if (open === undefined)
        throw new Error("The original symbolic sum is required.");
    const closed = substituteSourceTypeDescriptor(unions, open, new Map([[first, floating]]));
    assert.equal(closed?.kind === "union" && closed.types[0] === text && closed.types[1] === floating, true);
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[first, text]])) === text, true);
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[second, floating]])) === open, true);
    const distinct = sourceTypeDescriptorUnion(unions, [other, parameter]);
    const reversed = sourceTypeDescriptorUnion(unions, [parameter, other]);
    assert.equal(distinct?.kind === "union" && reversed?.kind === "union" && distinct.types.length === 2 &&
        distinct.types.every((type, index) => type === reversed.types[index]), true);
    assert.equal(distinct?.kind === "union" && distinct.types.every(type => type.kind === "declared" &&
        (type.declaration === first || type.declaration === second)), true);
});
test("C2459 structural arm identities retain first encounter without reopening declared bodies", () => {
    const current = fixture();
    const integer = { kind: "primitive", primitive: "int32" };
    const text = { kind: "string" };
    const declared = { kind: "declared", declaration: current.nodes[3], typeArguments: [integer] };
    const members = ["left", "right"].map(name => ({ name, optional: false, type: text,
        origin: { kind: "declared", declaration: current.nodes[0] } }));
    const shape = { kind: "shape", members, indexes: [], calls: [], constructs: [] };
    const reverse = { ...shape, members: [...members].reverse() };
    const first = sourceTypeDescriptorUnion(current.unions, [shape, declared]);
    const second = sourceTypeDescriptorUnion(current.unions, [declared, reverse]);
    assert.equal(first?.kind === "union" && second?.kind === "union" && first.types.length === 2 &&
        first.types.every((type, index) => sourceTypeDescriptorsEqual(type, second.types[index])), true);
    assert.equal(first?.kind === "union" && first.types[0] === shape && declared.definition === undefined, true);
    assert.equal(sourceTypeDescriptorUnion(createSourceTypeDescriptorUnions({ ...current.ast, getSourceFile: () => undefined }, [current.file]), [declared, integer]) === undefined, true);
});
test("C2459 deep declared arm identities retain linear keys without expanding definitions", () => {
    const current = fixture();
    let nested = { kind: "string" };
    for (let depth = 0; depth < 64; depth += 1)
        nested = { kind: "array", readonly: true, element: nested };
    const declared = { kind: "declared", declaration: current.nodes[3], typeArguments: [nested] };
    const integer = { kind: "primitive", primitive: "int64" };
    const first = sourceTypeDescriptorUnion(current.unions, [declared, integer]);
    const second = sourceTypeDescriptorUnion(current.unions, [integer, declared]);
    assert.equal(first?.kind === "union" && second?.kind === "union" && first.types[0] === declared &&
        first.types[1] === integer && first.types.every((type, index) => type === second.types[index]), true);
    assert.equal(declared.typeArguments[0] === nested && declared.definition === undefined, true);
});
test("C2459 sealing normalizes late earlier families across shared graphs without mutating snapshots", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/first.ts": "export type Earlier<Item> = string | Item;",
            "/src/second.ts": "export type Later = number | string;",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const firstFile = checked.getSourceFile("/src/first.ts");
    const secondFile = checked.getSourceFile("/src/second.ts");
    if (firstFile === undefined || secondFile === undefined)
        throw new Error("Both original source files are required.");
    const earlier = checked.ast.statements(firstFile)[0];
    const later = checked.ast.statements(secondFile)[0];
    const earlierNode = checked.ast.typeNode(earlier);
    const laterNode = checked.ast.typeNode(later);
    const binder = checked.ast.typeParameters(earlier)[0];
    if (earlierNode === undefined || laterNode === undefined)
        throw new Error("Both authored sum families are required.");
    const text = { kind: "string" };
    const floating = { kind: "primitive", primitive: "float64" };
    const parameter = { kind: "declared", declaration: binder, typeArguments: [] };
    const unions = createSourceTypeDescriptorUnions(checked.ast, checked.programSourceFiles);
    const late = sourceTypeDescriptorUnion(unions, [floating, text], { kind: "authored", node: laterNode });
    if (late === undefined)
        throw new Error("The later authored union is required.");
    const before = freezeSourceTypeDescriptor(unions, late);
    const open = sourceTypeDescriptorUnion(unions, [text, parameter], { kind: "authored", node: earlierNode });
    if (open === undefined)
        throw new Error("The original earlier symbolic family is required.");
    const bound = substituteSourceTypeDescriptor(unions, open, new Map([[binder, floating]]));
    assert.equal(bound?.kind === "union" && bound.types[0] === text && bound.types[1] === floating, true);
    const graph = { kind: "callable", calls: [{ typeParameters: [],
                parameters: [{ kind: "optional", type: before }], result: { kind: "array", readonly: true, element: before } }], constructs: [] };
    sealSourceTypeDescriptorUnions(unions);
    const normalize = createSourceTypeDescriptorNormalizer(unions, new Map());
    const normalized = normalize(before);
    const normalizedGraph = normalize(graph);
    assert.equal(before.kind === "union" && before.types[0]?.kind === "primitive" &&
        before.types[1]?.kind === "string" && Object.isFrozen(before.types), true, "the already frozen beforeimage never changes");
    assert.equal(normalized?.kind === "union" && normalized !== before && normalized.types[0]?.kind === "string" &&
        normalized.types[1]?.kind === "primitive", true, "the sealed earlier authored family produces a new snapshot");
    assert.equal(normalizedGraph?.kind === "callable" && normalizedGraph.calls[0]?.parameters[0]?.type === normalized &&
        normalizedGraph.calls[0]?.result.kind === "array" && normalizedGraph.calls[0].result.element === normalized, true, "one memo replaces every shared descriptor without a stale nested subset");
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[binder, text]])) === text, true);
    assert.equal(substituteSourceTypeDescriptor(unions, open, new Map([[binder, { kind: "primitive", primitive: "int32" }]])) === undefined, true, "an unobserved closed family remains unavailable after sealing");
    assert.equal(normalize(before) === normalized, true);
});
test("descriptor freezing owns vectors but never freezes checked source nodes", () => {
    const current = fixture();
    const declaration = current.nodes[3];
    const source = { kind: "declared", declaration, typeArguments: [{ kind: "primitive", primitive: "int32" }] };
    const frozen = freezeSourceTypeDescriptor(snapshotOwner, source);
    assert.equal(Object.isFrozen(frozen), true);
    assert.equal(frozen.kind === "declared" && Object.isFrozen(frozen.typeArguments), true);
    assert.equal(frozen.kind === "declared" && frozen.declaration === declaration, true);
    assert.equal(Object.isFrozen(source), false);
});
test("descriptor publication freezes each exact object once across every descriptor kind", () => {
    const current = fixture();
    const integer = { kind: "primitive", primitive: "int32" };
    const signature = { typeParameters: [], parameters: [{ kind: "required", type: integer }], result: integer };
    const descriptors = [
        integer, { kind: "string" }, { kind: "intrinsic", intrinsic: "absence" },
        { kind: "union", types: [integer, { kind: "string" }] },
        { kind: "callable", calls: [signature], constructs: [] },
        { kind: "array", readonly: false, element: integer },
        { kind: "optional", value: integer },
        { kind: "tuple", readonly: true, elements: [{ kind: "required", type: integer }] },
        { kind: "declared", declaration: current.nodes[3], typeArguments: [integer], definition: integer },
        { kind: "shape", members: [{ name: "value", optional: false, type: integer,
                    origin: { kind: "declared", declaration: current.ast.members(current.nodes[3])[0] } }],
            indexes: [], calls: [signature], constructs: [] },
    ];
    for (const descriptor of descriptors) {
        const frozen = freezeSourceTypeDescriptor(snapshotOwner, descriptor);
        assert.equal(freezeSourceTypeDescriptor(snapshotOwner, descriptor) === frozen, true, `${descriptor.kind}: repeated input identity`);
        assert.equal(freezeSourceTypeDescriptor(snapshotOwner, frozen) === frozen, true, `${descriptor.kind}: repeated publication identity`);
        assert.equal(Object.isFrozen(frozen), true, `${descriptor.kind}: immutable publication`);
        assert.equal(Object.isFrozen(descriptor), false, `${descriptor.kind}: caller's input remains separate`);
    }
});
test("shared declared definitions retain identity without merging distinct bodies or recursion cuts", () => {
    const current = fixture();
    const definition = { kind: "primitive", primitive: "int32" };
    const first = { kind: "declared", declaration: current.nodes[3],
        typeArguments: [{ kind: "string" }], definition };
    const second = { ...first, definition: { kind: "primitive", primitive: "int64" } };
    const frozen = freezeSourceTypeDescriptor(snapshotOwner, first);
    const shared = freezeSourceTypeDescriptor(snapshotOwner, { ...first });
    const distinct = freezeSourceTypeDescriptor(snapshotOwner, second);
    const cut = freezeSourceTypeDescriptor(snapshotOwner, { kind: "declared", declaration: current.nodes[3],
        typeArguments: first.typeArguments, cut: "recursion" });
    assert.equal(frozen.kind === "declared" && shared.kind === "declared" &&
        frozen.definition === shared.definition && frozen.definition === freezeSourceTypeDescriptor(snapshotOwner, definition), true);
    assert.equal(frozen.kind === "declared" && distinct.kind === "declared" &&
        frozen.definition !== distinct.definition && distinct.definition?.kind === "primitive" &&
        distinct.definition.primitive === "int64", true, "represented arguments cannot merge different published bodies");
    assert.equal(cut.kind === "declared" && cut.definition === undefined && cut.cut === "recursion", true, "freezing an identity-only cut never borrows another definition");
});
test("member presence survives freezing and is not inferred from its optional value type", () => {
    const current = fixture();
    const declaration = current.ast.members(current.nodes[3])[0];
    const value = { kind: "optional", value: { kind: "primitive", primitive: "int32" } };
    const required = { kind: "shape", members: [{ name: "value", optional: false, type: value,
                origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
    const optional = { kind: "shape", members: [{ name: "value", optional: true, type: value,
                origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
    assert.equal(sourceTypeDescriptorsEqual(required, optional), false);
    const frozen = freezeSourceTypeDescriptor(snapshotOwner, required);
    assert.equal(sourceTypeDescriptorsEqual(required, frozen), true);
    assert.equal(frozen.kind === "shape" && frozen.members[0]?.optional === false &&
        frozen.members[0].type.kind === "optional" && Object.isFrozen(frozen.members[0]), true);
});
test("term depth and declared optional descriptors use the same bounded algebra", () => {
    let type = { kind: "primitive", primitive: "int32" };
    for (let depth = 0; depth < 4; depth += 1)
        type = { kind: "array", readonly: false, element: type };
    assert.equal(sourceTypeDescriptorDepth(type), 4);
    assert.equal(sourceTypeDescriptorDepth({ kind: "optional", value: type }), 5);
    assert.equal(sourceTypeDescriptorsEqual({ kind: "optional", value: type }, type), false);
});
test("C29 eligibility follows canonical aliases and containment but not syntax alone", () => {
    const current = fixture();
    const container = current.variable(0), alias = current.variable(1), unrelated = current.variable(2);
    const element = { node: container.node, path: [{ kind: "element" }] };
    const graph = current.graph([
        { ...current.entry(container, { kind: "array", site: container.node, readonly: false, element }), kind: "open-local" },
        current.entry(alias), current.entry(unrelated),
    ], [{ source: container, target: alias, site: alias.node }]);
    const terms = createSourceTypeFlowTerms(current.ast, graph);
    assert.equal(terms.isInference(container), true);
    assert.equal(terms.isInference(alias), true);
    assert.equal(terms.isInference(element), true);
    assert.equal(terms.isInference(unrelated), false);
});
test("C29 derived eligibility is directional and does not open fixed operands", () => {
    const current = fixture();
    const operand = current.variable(0), result = current.variable(1), fixed = current.variable(2);
    const graph = current.graph([
        { ...current.entry(result), kind: "derived-local" }, current.entry(operand), current.entry(fixed),
    ]);
    const terms = createSourceTypeFlowTerms(current.ast, { ...graph,
        derived: [{ node: result.node, result, operator: "add", operands: [operand, fixed], required: true }] });
    assert.equal(terms.isInference(result), true);
    assert.equal(terms.isInference(operand), false);
    assert.equal(terms.isInference(fixed), false);
    const downstream = createSourceTypeFlowTerms(current.ast, { ...graph,
        nodes: [{ ...current.entry(operand), kind: "open-local" }, current.entry(result), current.entry(fixed)],
        derived: [{ node: result.node, result, operator: "add", operands: [operand, fixed], required: true }] });
    assert.equal(downstream.isInference(operand), true);
    assert.equal(downstream.isInference(result), true);
    assert.equal(downstream.isInference(fixed), false);
});
for (const kind of ["array", "shape"]) {
    test(`C30 declared ${kind} construction positions do not unite or inherit operand inference`, () => {
        const current = fixture();
        const container = current.variable(0), first = current.variable(1), second = current.variable(2);
        const firstPosition = { node: container.node, path: kind === "array"
                ? [{ kind: "element" }] : [{ kind: "member", name: "first" }] };
        const secondPosition = kind === "array" ? firstPosition
            : { node: container.node, path: [{ kind: "member", name: "second" }] };
        const term = kind === "array"
            ? { kind, site: container.node, readonly: false, element: firstPosition }
            : { kind, site: container.node, members: [
                    { name: "first", optional: false, variable: firstPosition }, { name: "second", optional: false, variable: secondPosition },
                ] };
        const entries = [
            { ...current.entry(container, term), kind: "fixed" },
            { ...current.entry(first, { kind: "fixed", site: first.node, type: { kind: "primitive", primitive: "float32" } }), kind: "open-local" },
            { ...current.entry(second, { kind: "fixed", site: second.node, type: { kind: "primitive", primitive: "int32" } }), kind: "fixed" },
        ];
        const links = [
            { source: first, target: firstPosition, site: first.node },
            { source: second, target: secondPosition, site: second.node },
        ];
        const terms = createSourceTypeFlowTerms(current.ast, current.graph(entries, links));
        assert.equal(terms.group(first).variable === terms.group(firstPosition).variable, false);
        assert.equal(terms.group(second).variable === terms.group(secondPosition).variable, false);
        assert.equal(terms.group(first).variable === terms.group(second).variable, false);
        assert.equal(terms.isInference(first), true);
        for (const variable of [container, firstPosition, secondPosition, second]) {
            assert.equal(terms.isInference(variable), false);
        }
        assert.equal(terms.group(container).terms[0] === term, true);
        const open = createSourceTypeFlowTerms(current.ast, current.graph([
            { ...entries[0], kind: "open-local" }, ...entries.slice(1),
        ], links));
        assert.equal(open.group(first).variable === open.group(firstPosition).variable, true);
        assert.equal(open.group(second).variable === open.group(secondPosition).variable, true);
        assert.equal(open.isInference(container), true);
    });
}
test("member literals keep otherwise-equal shapes apart through equality, union dedup, freezing and substitution (D-2, R6)", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "type Step<V> = { kind: \"done\"; value: V };",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const { ast } = checked;
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The original generic family is required.");
    const owner = ast.statements(file)[0];
    const binder = ast.typeParameters(owner)[0];
    const unions = createSourceTypeDescriptorUnions(ast, checked.programSourceFiles);
    const shape = (literals, value = { kind: "primitive", primitive: "int32" }) => ({
        kind: "shape", indexes: [], calls: [], constructs: [], members: [
            { name: "kind", optional: false, type: { kind: "string" }, origin: { kind: "declared", declaration: owner },
                ...(literals === undefined ? {} : { literals: literals.map(text => ({ kind: "string", value: text })) }) },
            { name: "value", optional: false, type: value, origin: { kind: "declared", declaration: owner } }
        ]
    });
    const left = shape(["left"]), right = shape(["right"]), again = shape(["left"]), erased = shape(undefined);
    assert.equal(sourceTypeDescriptorsEqual(left, right), false, "different discriminator literals");
    assert.equal(sourceTypeDescriptorsEqual(left, erased), false, "a literal member is not its erased base");
    assert.equal(sourceTypeDescriptorsEqual(left, again), true);
    assert.equal(sourceTypeDescriptorsEqual(shape(["a", "b"]), shape(["b", "a"])), true, "a literal set, not a sequence");
    const union = sourceTypeDescriptorUnion(unions, [left, right, again]);
    assert.equal(union?.kind === "union" && union.types.length === 2 && union.types[0] === left && union.types[1] === right, true, "the canonical dedup keeps both literal arms in encounter order and folds the genuine duplicate");
    const frozen = freezeSourceTypeDescriptor(unions, left);
    const member = frozen.kind === "shape" ? frozen.members[0] : undefined;
    assert.equal(Object.isFrozen(member?.literals) && member?.literals?.[0]?.value === "left", true);
    const generic = shape(["done"], { kind: "declared", declaration: binder, typeArguments: [] });
    const applied = createSourceTypeDescriptorNormalizer(unions, new Map([[binder, { kind: "primitive", primitive: "int32" }]]))(generic);
    assert.equal(applied !== undefined && sourceTypeDescriptorsEqual(applied, shape(["done"])), true, "substitution keeps the literal");
    assert.equal(applied !== undefined && sourceTypeDescriptorsEqual(applied, shape(["more"])), false);
});
//# sourceMappingURL=terms.test.js.map
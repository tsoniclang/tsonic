import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { SymbolFlagsPrototype, createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { collectSourceTypeFlowEdges, sourceTypeFlowObjectLiteralReceiver } from "./edges.js";
import { analyzeSourceEffectiveTypes } from "./solver.js";
import type { SourceEffectiveTypeOutcome, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeFlowObligation } from "./types.js";
import type { SourceLiteralMemberCorrespondence } from "./types.js";
import type { SourceStructuralMemberPair } from "../structural-members.js";
import { createSourceTypeFlowTerms, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "../../public/source.js";
import { sourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import { sourceTypeFlowDiscardedSelection } from "./value-syntax.js";
import { sourceTypeFlowScalarCalculationArm } from "./construction-slots.js";
import { decideSourcePrimitiveBinaryOperator, sourcePrimitiveOperatorKinds, sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";

function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int8 = number; export type int32 = number; export type uint32 = number; export type int64 = bigint; export type float32 = number;",
    "/src/index.ts": `import type { int8, int32, uint32, int64, float32 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int8", "int8", "number", true, 8), sourcePrimitive("int32", "int32", "number", true, 32),
      sourcePrimitive("uint32", "uint32", "number", false, 32), sourcePrimitive("int64", "int64", "bigint", true, 64),
      sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original source file is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!; nodes.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]!);
  }
  const declaration = (name: string): Node => {
    const found = nodes.find(node => {
      if (!source.ast.is.IsVariableDeclaration(node)) return false;
      const selected = source.ast.name(node);
      return selected !== undefined && source.ast.is.IsIdentifier(selected) && source.ast.text(selected) === name;
    });
    if (found === undefined) throw new Error(`The original declaration ${name} is required.`);
    return found;
  };
  const type = (name: string): SourceTypeDescriptor => {
    const outcome = source.effectiveTypes.get(declaration(name));
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, `resolved ${name}`);
    if (outcome === undefined || outcome.kind === "refused") throw new Error(`The resolved ${name} is required.`);
    return outcome.type;
  };
  return { source, nodes, declaration, type };
}

for (const [expression, code, reason] of [
  ["{}", "TSONIC_UNTYPED_OBJECT_LITERAL", "This object literal has no target type. Declare one, e.g. 'function baseOptions(): MakeDirectoryOptions'."],
  ["[]", "TSONIC_UNTYPED_ARRAY_LITERAL", "This empty array has no element type. Declare one, e.g. 'function emptyBuffer(): number[]'."],
] as const) {
  test(`C32 unbound ${expression} return keeps its original annotation refusal`, () => {
    const current = fixture(`function make() { return ${expression}; }`);
    const literal = current.nodes.find(node => expression === "{}"
      ? current.source.ast.is.IsObjectLiteralExpression(node) : current.source.ast.is.IsArrayLiteralExpression(node));
    const refusal = current.source.effectiveTypes.refusals().find(issue => issue.site === literal);
    assert.equal(literal !== undefined && refusal?.code === code && refusal.reason === reason, true,
      "the canonical Terms group owns the unchanged original code, message and construction occurrence");
    assert.equal(literal !== undefined && current.source.effectiveTypes.get(literal)?.kind === "refused", true);
  });
}

test("C32 unbound constructions retain ordinary exact call fills and C24 signature closure", () => {
  const current = fixture(`declare function arrays(value: number[]): void;
    declare function fields(value: { count: number }): void;
    function run(): void { arrays([]); fields({ count: 1 }); }
    function make() { return [1, 2]; }`);
  const outcomes = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node) ||
    current.source.ast.is.IsObjectLiteralExpression(node)).map(node => current.source.effectiveTypes.get(node));
  assert.equal(outcomes.length, 3);
  assert.equal(outcomes[0]?.kind !== "refused" && outcomes[0]?.type.kind === "array" &&
    outcomes[0].type.element.kind === "primitive" && outcomes[0].type.element.primitive === "float64", true);
  assert.equal(outcomes[1]?.kind !== "refused" && outcomes[1]?.type.kind === "shape" &&
    outcomes[1].type.members[0]?.type.kind === "primitive" && outcomes[1].type.members[0].type.primitive === "float64", true);
  assert.equal(outcomes[2]?.kind !== "refused" && outcomes[2]?.type.kind === "array" &&
    outcomes[2].type.element.kind === "primitive" && outcomes[2].type.element.primitive === "int64", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2404 generic array binders project the same solved aggregate used by every argument", () => {
  const current = fixture(`function accept<T>(value: T[]): T[] { return value; }
    function pair<T>(first: T[], second: T[]): T[] { void second; return first; }
    function callbacks<T>(first: () => T[], second: () => T[]): T[] { void second; return first(); }
    function plain(): void { const plainValue = ["text", 9007199254740993]; void accept(plainValue); }
    function aliased(): void { const original = ["text", 9007199254740993]; const alias = original; void pair(original, alias); }
    function captured(): void { const shared = ["text", 9007199254740993]; void callbacks(() => shared, () => shared); }`);
  const { ast } = current.source;
  const arrays = current.nodes.filter(node => ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 3);
  for (const literal of arrays) {
    const outcome = current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array", true);
    if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "array") {
      throw new Error("The actual array allocation must have its solved element descriptor.");
    }
    let owner = ast.parent(literal);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const call = current.nodes.find(node => {
      if (!ast.is.IsCallExpression(node)) return false;
      let callable = ast.parent(node);
      while (callable !== undefined && !ast.is.IsFunctionDeclaration(callable)) callable = ast.parent(callable);
      return callable === owner;
    });
    const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
    assert.equal(instance !== undefined && instance.method.length === 1 && instance.method[0]?.type === outcome.type.element &&
      instance.result?.kind === "array" && instance.result.element === outcome.type.element, true,
      "the canonical element object is shared by the allocation, method binder and call result");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2417 broad contextual callback returns do not replace their body's own result", () => {
  const current = fixture(`class Datum { value: int32 = 1; }
    declare function opaque(callback: (value: int32, index: int32) => unknown): void;
    declare function dynamic(callback: (value: int32, index: int32) => any): void;
    declare function reference(callback: () => object): void;
    declare function concrete(callback: () => float32): void;
    declare function union(callback: () => string | float32): void;
    function run(): void {
      opaque((value, index) => value > index);
      dynamic((value, index) => value > index);
      reference(() => new Datum());
      concrete(() => 7);
      union(() => 7);
    }`);
  const { ast } = current.source;
  const reader = createSourceTypeFlowDeclaredSlotReader(createSourceTypeFlowAnalysisContext(current.source).context);
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 5);
  for (const [index, arrow] of arrows.entries()) {
    const body = ast.body(arrow);
    const returned = current.source.effectiveTypes.callableReturn(arrow);
    const outcome = current.source.effectiveTypes.get(arrow);
    assert.equal(body !== undefined && returned !== undefined && returned.kind !== "refused" && outcome !== undefined &&
      outcome.kind !== "refused" && outcome.type.kind === "callable" && outcome.type.calls[0]?.result === returned.type, true,
      `callback ${index}: the canonical callable result retains its solved original descriptor`);
    if (body === undefined || returned === undefined || returned.kind === "refused") throw new Error("The original callback result is required.");
    if (index < 3) {
      assert.equal(reader.returned(arrow, current.source.semantics.forNode(arrow)) === undefined && reader.get(body) === undefined, true,
        `callback ${index}: a broad contract is a check, never a creation destination`);
      assert.equal(index < 2 ? returned.type.kind === "primitive" && returned.type.primitive === "bool" : returned.type.kind === "declared", true,
        `callback ${index}: the exact bool or class creation is preserved`);
    } else {
      const selected = current.source.effectiveTypes.get(body);
      const physical = selected === undefined || selected.kind === "refused" ? undefined : selected.construction ?? selected.type;
      assert.equal(reader.get(body)?.authority === "declared" && physical?.kind === "primitive" && physical.primitive === "float32", true,
        `callback ${index}: primitive and union destinations still own the literal's exact native arm`);
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2417 inactive concrete callbacks publish every original parameter through the selected invocation", () => {
  const current = fixture(`interface Request { readonly value: int32; }
    interface Response { send(value: int32): void; }
    declare function connect(callback: (request: Request, response: Response) => void): void;
    function run(): void { connect((request, response) => {}); }`);
  const { ast } = current.source;
  const arrow = current.nodes.find(node => ast.is.IsArrowFunction(node));
  if (arrow === undefined) throw new Error("The original inline callback is required.");
  const selected = current.source.effectiveTypes.get(arrow);
  const signature = selected === undefined || selected.kind === "refused" || selected.type.kind !== "callable" ? undefined : selected.type.calls[0];
  const parameters = ast.parameters(arrow);
  assert.equal(parameters.length, 2);
  for (const [index, parameter] of parameters.entries()) {
    if (parameter === undefined) throw new Error("Each original callback parameter is required.");
    const outcome = current.source.effectiveTypes.get(parameter);
    const name = ast.name(parameter);
    const named = name === undefined ? undefined : current.source.effectiveTypes.get(name);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared" &&
      named !== undefined && named.kind !== "refused" && named.type === outcome.type && signature?.parameters[index]?.type === outcome.type, true,
      `parameter ${index}: the declaration, name and callable retain one concrete originating descriptor`);
  }
  assert.equal(signature?.result.kind === "intrinsic" && signature.result.intrinsic === "void", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2417 callback parameter enrollment retains concrete authored binders without retargeting fixed annotations", () => {
  const current = fixture(`declare function receive<Value>(callback: (value: Value) => void): void;
    function run(): void {
      receive<string>(value => {});
      receive<int32>((value: float32) => {});
    }`);
  const { ast } = current.source;
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const [index, arrow] of arrows.entries()) {
    const parameter = ast.parameters(arrow)[0];
    if (parameter === undefined) throw new Error("The original callback parameter is required.");
    const selected = current.source.effectiveTypes.get(parameter);
    const call = ast.parent(arrow);
    const method = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call)?.method[0];
    assert.equal(selected !== undefined && selected.kind !== "refused" && (index === 0 ? selected.type.kind === "string"
      : selected.type.kind === "primitive" && selected.type.primitive === "float32"), true,
      `callback ${index}: the concrete contextual parameter is published, but an authored annotation is never retargeted`);
    assert.equal(index === 0 ? method?.type.kind === "string"
      : method?.type.kind === "primitive" && method.type.primitive === "int32", true,
      `callback ${index}: the exact original declared method binder remains independent`);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2418 inherited authored callback heads do not borrow a self-inferred result default", () => {
  const current = fixture(`declare class Base<Element> {
      order<Result extends number | bigint = number>(compare?: (left: Element, right: Element) => Result): this;
    }
    declare class Middle<Element> extends Base<Element> {}
    declare class Single extends Middle<float32> {}
    interface Unsigned extends Base<uint32> {}
    declare class Signed extends Base<int32> {}
    type SignedAlias = Signed;
    function single(values: Single): void { values.order((left, right) => left - right); }
    function unsigned(values: Unsigned): void { values.order((left, right) => left - right); }
    function signed(values: SignedAlias): void { values.order((left, right) => left - right); }
    function generic(values: Middle<float32>): void { values.order((left, right) => left - right); }`);
  const { ast } = current.source;
  const slots = createSourceTypeFlowDeclaredSlotReader(createSourceTypeFlowAnalysisContext(current.source).context);
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 4);
  for (const [index, arrow] of arrows.entries()) {
    const primitive = (["float32", "uint32", "int32", "float32"] as const)[index]!;
    const parameters = ast.parameters(arrow);
    for (const parameter of parameters) {
      if (parameter === undefined) throw new Error("Each original callback parameter is required.");
      const projected = slots.parameter(parameter, current.source.semantics.forNode(parameter));
      const selected = current.source.effectiveTypes.get(parameter);
      const actual = selected === undefined ? "absent" : selected.kind === "refused" ? "refused"
        : selected.type.kind === "primitive" ? selected.type.primitive : selected.type.kind;
      assert.equal(projected?.kind === "primitive" && projected.primitive === primitive && selected !== undefined &&
        selected.kind !== "refused" && selected.type.kind === "primitive" && selected.type.primitive === primitive, true,
        `callback ${index}: actual ${actual}, expected the authored ${primitive} head independently of Result`);
    }
    const body = ast.body(arrow);
    const selected = body === undefined ? undefined : current.source.effectiveTypes.get(body);
    const decision = decideSourcePrimitiveBinaryOperator("subtract", { kind: "fixed", primitive }, { kind: "fixed", primitive });
    const instance = current.source.effectiveTypes.callInstantiation(ast.parent(arrow)!);
    const required = instance?.parameters[0];
    const callable = required?.kind === "optional" ? required.value : required;
    assert.equal(callable?.kind === "callable" && callable.calls[0]?.parameters.length === 2 &&
      callable.calls[0].parameters.every(parameter => parameter.type.kind === "primitive" && parameter.type.primitive === primitive), true,
      `callback ${index}: the same invocation's declared heads agree with its actual parameters`);
    assert.equal(decision.kind === "resolved" && selected !== undefined && selected.kind !== "refused" &&
      selected.type.kind === "primitive" && selected.type.primitive === decision.result &&
      instance?.method[0]?.type.kind === "primitive" && instance.method[0].type.primitive === decision.result, true,
      `callback ${index}: the one arithmetic table, body and method result retain the same native kind`);
    assert.equal(body !== undefined && slots.get(body) === undefined, true,
      `callback ${index}: an inferred Result default is not an authored return destination`);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2418 checked inherited arguments and defaults never authorize a callback head or retarget an annotation", () => {
  const current = fixture(`declare class Base<Element> {
      order<Result extends number | bigint = number>(compare?: (left: Element, right: Element) => Result): this;
    }
    declare class Open<Element> extends Base<Element> { constructor(value: Element); }
    function inferred(): void { const values = new Open(0.5); values.order((left, right) => 1); }
    function fixed(values: Open<int32>): void { values.order((left: float32, right: float32) => left - right); }`);
  const { ast } = current.source;
  const slots = createSourceTypeFlowDeclaredSlotReader(createSourceTypeFlowAnalysisContext(current.source).context);
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const [index, arrow] of arrows.entries()) {
    for (const parameter of ast.parameters(arrow)) {
      if (parameter === undefined) throw new Error("Each original callback head is required.");
      assert.equal(slots.parameter(parameter, current.source.semantics.forNode(parameter)) === undefined, true,
        `callback ${index}: neither a checked inherited argument nor a fixed annotation is a contextual destination`);
      if (index === 1) {
        const selected = current.source.effectiveTypes.get(parameter);
        assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type.kind === "primitive" &&
          selected.type.primitive === "float32", true, "the original authored float32 is not retargeted to the receiver's int32");
      }
    }
    const body = ast.body(arrow);
    const selected = body === undefined ? undefined : current.source.effectiveTypes.get(body);
    assert.equal(body !== undefined && slots.get(body) === undefined && selected !== undefined && selected.kind !== "refused" &&
      selected.type.kind === "primitive" && selected.type.primitive === (index === 0 ? "int64" : "float32"), true,
      `callback ${index}: the body retains its own integer or exact authored arithmetic result`);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2408 every formal shape retains authored binding provenance and exact native aliases", () => {
  const forms = [
    { name: "array", type: "(string | T)[]", value: '["text", 9007199254740993]' },
    { name: "union", type: "string | T", value: "9007199254740993" },
    { name: "optional", type: "T | undefined", value: "9007199254740993" },
    { name: "tuple", type: "[string, T]", value: '["text", 9007199254740993]' },
    { name: "callback_return", type: "() => T", value: "() => 9007199254740993" },
    { name: "callback_parameter", type: "(value: T) => T", value: "value => 9007199254740993" },
  ];
  const current = fixture(`${forms.map(form => `declare function take_${form.name}<T>(sample: T, value: ${form.type}): void;`).join("\n")}
    class Context<T> { ${forms.map(form => `${form.name}(value: ${form.type}): void { void value; }`).join("\n")} }
    ${forms.flatMap(form => [
      `function explicit_${form.name}(): void { take_${form.name}<float32>(0.5, ${form.value}); }`,
      `function receiver_${form.name}(): void { const receiver = new Context<float32>(); receiver.${form.name}(${form.value}); }`,
      `function other_${form.name}(sample: float32): void { take_${form.name}(sample, ${form.value}); }`,
      `function inferred_${form.name}(): void { take_${form.name}(0.5, ${form.value}); }`,
    ]).join("\n")}`);
  const { ast } = current.source;
  const slots = createSourceTypeFlowDeclaredSlotReader(createSourceTypeFlowAnalysisContext(current.source).context);
  const integers = current.nodes.filter(node => {
    const range = ast.is.IsNumericLiteral(node) ? ast.authoredRange(node) : undefined;
    const file = range?.kind === "authored" ? ast.getSourceFile(node) : undefined;
    return range?.kind === "authored" && file !== undefined &&
      ast.getSourceText(file).slice(range.start, range.end) === "9007199254740993";
  });
  assert.equal(integers.length, 24);
  for (const literal of integers) {
    let owner = ast.parent(literal);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const name = owner === undefined ? undefined : ast.name(owner);
    const label = name === undefined ? "missing" : ast.text(name);
    const call = current.nodes.find(node => {
      if (!ast.is.IsCallExpression(node)) return false;
      let parent = ast.parent(node);
      while (parent !== undefined && !ast.is.IsFunctionDeclaration(parent)) parent = ast.parent(parent);
      return parent === owner;
    });
    const query = call === undefined ? undefined : current.source.semantics.forNode(call);
    const selected = call === undefined ? undefined : query?.operations.call(call);
    const declaration = selected === undefined ? undefined : query?.declarations.signatureDeclaration(selected.selectedSignature);
    const binderOwner = declaration !== undefined && ast.is.IsMethodDeclaration(declaration) ? ast.parent(declaration) : declaration;
    const binder = binderOwner === undefined ? undefined : ast.typeParameters(binderOwner)[0];
    const bindings = binder === undefined ? undefined : slots.authoredBinding(call, new Set([binder]));
    const authored = !label.startsWith("inferred_");
    assert.equal(bindings !== undefined, authored, label + ": only an actual authored binder creates a destination");
    if (authored) {
      const outcome = current.source.effectiveTypes.get(literal);
      const physical = outcome === undefined || outcome.kind === "refused" ? undefined : outcome.construction ?? outcome.type;
      assert.equal(physical?.kind === "primitive" && physical.primitive === "float32", true,
        label + ": the original authored float32 survives the checker's number erasure");
    }
  }
});

test("C2412 homomorphic results retain their wrapper separately from the authored input binder", () => {
  const current = fixture(`type Locked<Input> = { readonly [Key in keyof Input]: Input[Key] };
    type Box<Input> = { item: Input }; type Row = { value: int32 };
    declare function direct<Input>(value: Input): Locked<Input>;
    declare function forwarded<Input>(value: Input): Locked<Input>;
    declare function boxed<Input>(value: Input): Box<Input>;
    function first(value: int32): void { const input = { value }; const result: Locked<Row> = direct(input); void result; }
    function second(value: int32): void { const original = { value }; const alias = original;
      const result: Locked<Row> = forwarded(alias); void result; }`);
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const terms = createSourceTypeFlowTerms(ast, graph);
  const box = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "boxed");
  const boxQuery = box === undefined ? undefined : current.source.semantics.forNode(box);
  const boxSignature = box === undefined ? undefined : boxQuery?.types.declarationSignatureInfo(box);
  assert.equal(box !== undefined && boxQuery !== undefined && boxSignature?.returnType !== undefined &&
    sourceTypeFlowHomomorphicInput(current.source, boxQuery, boxSignature.returnType, ast.typeNode(box)) === undefined, true,
    "an arbitrary Box<Input> has no homomorphic input relation");
  assert.equal(graph.calls.length, 2);
  for (const call of graph.calls) {
    const binder = call.method[0];
    const wrapper = call.result === undefined ? undefined : terms.group(call.result).terms.find(term => term.kind === "declared");
    const query = current.source.semantics.forNode(call.node);
    const retainedInput = wrapper?.source === undefined ? undefined : sourceTypeFlowHomomorphicInput(current.source, query,
      wrapper.source.selectedType, wrapper.source.authoredTypeNode);
    const selectedParameter = call.source.sourceSelectedMethodTypeArguments?.[0]?.typeParameter;
    assert.equal(call.result !== undefined && binder !== undefined &&
      terms.group(call.result).variable !== terms.group(binder.variable).variable &&
      wrapper?.typeArguments.length === 1 && terms.group(wrapper.typeArguments[0]!).variable === terms.group(binder.variable).variable &&
      wrapper.source?.authoredTypeNode !== undefined &&
      query.declarations.authoredTypeDeclaration(wrapper.source.authoredTypeNode) === wrapper.declaration &&
      retainedInput !== undefined && selectedParameter !== undefined && query.types.isIdentical(retainedInput, selectedParameter), true,
      "a mapped result is the existing declared wrapper term, never equality with its untransformed input");
    const instance = current.source.effectiveTypes.callInstantiation(call.node);
    const input = instance?.method[0]?.type;
    const result = instance?.result;
    const inputShape = input === undefined ? undefined : sourceTypeDescriptorStructure(input);
    const resultShape = result === undefined ? undefined : sourceTypeDescriptorStructure(result);
    const outcome = current.source.effectiveTypes.get(call.node);
    assert.equal(inputShape?.kind === "shape" && inputShape.members.length === 1 &&
      !inputShape.members[0]?.readonly && inputShape.members[0]?.type.kind === "primitive" &&
      inputShape.members[0].type.primitive === "int32", true, "the original authored input keeps its exact mutable native member");
    assert.equal(result?.kind === "declared" && resultShape?.kind === "shape" && resultShape.members.length === 1 &&
      resultShape.members[0]?.readonly === true && resultShape.members[0].type.kind === "primitive" &&
      resultShape.members[0].type.primitive === "int32" && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type === result, true, "the separately solved result preserves its readonly wrapper and one publication object");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C32 never opens an annotated or module construction or a scalar literal", () => {
  const current = fixture(`export const moduleValue: {} = {};
    function run(): number[] { const declared: {} = {}; return []; }
    function scalar(): number { return 1; }`);
  const constructions = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node) ||
    current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assert.equal(constructions.every(node => current.source.effectiveTypes.get(node)?.kind !== "refused"), true);
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const scalar = current.nodes.find(node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(constructions.every(node => {
    const matching = admissions.filter(row => row.site === node);
    const published = current.source.effectiveTypes.get(node);
    return matching.length === 1 && matching[0]?.kind === "literal-admission" && matching[0].authority === "declared" &&
      published !== undefined && published.kind !== "refused" && sourceTypeDescriptorsEqual(matching[0].type, published.type);
  }) && scalar !== undefined && !admissions.some(row => row.site === scalar), true,
  "declared constructions carry one canonical D2 admission obligation; admission stays target-owned");
});

test("declared readonly array returns and their conditional branches retain the same floating element", () => {
  const current = fixture("function direct(): readonly number[] { return [1, 2]; } function choose(flag: boolean): readonly number[] { return flag ? [1] : [2, 3]; }");
  const arrays = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 3);
  for (const node of arrays) {
    const outcome = current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
      outcome.type.element.kind === "primitive" && outcome.type.element.primitive === "float64", true,
      "actual declared slots or ordinary C32 return demand select the same element without an array-copy conversion");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});


test("C2396 awaited finite nominal unions retain their own payload objects and one absence state", () => {
  const current = fixture(`async function forward(pending: Promise<int32> | Promise<float32>): Promise<int32 | float32> {
      const forwardResult = await pending; return forwardResult;
    }
    async function reverse(pending: Promise<float32> | Promise<int32>): Promise<int32 | float32> {
      const reverseResult = await pending; return reverseResult;
    }
    async function optional(pending: Promise<int32> | undefined): Promise<int32 | undefined> {
      return await pending;
    }
    async function unchanged(value: int32 | float32): Promise<int32 | float32> {
      const unchangedResult = await value; return unchangedResult;
    }`);
  const { ast } = current.source;
  const awaits = current.nodes.filter(node => ast.is.IsAwaitExpression(node));
  assert.equal(awaits.length, 4);
  for (const node of awaits) {
    const operand = ast.as.AsAwaitExpression(node)?.Expression;
    const input = operand === undefined ? undefined : current.source.effectiveTypes.get(operand);
    const output = current.source.effectiveTypes.get(node);
    assert.equal(input !== undefined && input.kind !== "refused" && output !== undefined && output.kind !== "refused", true,
      `the same await operand and result are published at ${ast.pos(node)}: input ${input?.kind}, output ${output?.kind}${
        output?.kind === "refused" ? ` ${output.code}: ${output.reason}` : ""}`);
    if (input === undefined || input.kind === "refused" || output === undefined || output.kind === "refused") continue;
    const original = input.type.kind === "optional" ? [input.type.value]
      : input.type.kind === "union" ? input.type.types : [input.type];
    const payloads = original.map(member => member.kind === "declared" ? member.typeArguments[0] : member);
    const present = output.type.kind === "optional" ? output.type.value : output.type;
    const results = present.kind === "union" ? present.types : [present];
    assert.equal(payloads.length === results.length && payloads.every(payload => results.includes(payload!)), true,
      "union order and checked numeric collapse cannot replace a solved payload object or its authored width");
    assert.equal((input.type.kind === "optional") === (output.type.kind === "optional"), true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const unbound = fixture(`async function optional(pending: Promise<int32> | undefined): Promise<int32 | undefined> {
    const selected = await pending; return selected;
  }`);
  assert.equal(unbound.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_UNION"), true,
    "a newly inferred optional local keeps the original union-fill refusal rather than borrowing await's payload relation");
});
test("C2392 a retained nominal receiver publishes its original optional member result", () => {
  const current = fixture(`class Store<Value> { value: Value;
      constructor(value: Value) { this.value = value; } get(): Value | undefined { return this.value; } }
    function run(): boolean { const selected = new Store("a"); return selected.get() === "a"; }
    function openArray(): void { const values = [1, 2]; const found = values.find(value => value > 0); void found; }`);
  const { ast } = current.source;
  const stored = current.type("selected");
  const call = current.nodes.find(node => ast.is.IsCallExpression(node) && (() => {
    const callee = ast.as.AsCallExpression(node)?.Expression;
    return callee !== undefined && ast.is.IsPropertyAccessExpression(callee) && ast.text(ast.name(callee)!) === "get";
  })());
  const result = call === undefined ? undefined : current.source.effectiveTypes.get(call);
  const comparison = current.nodes.find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsEqualsEqualsToken");
  const selected = comparison === undefined ? undefined : current.source.effectiveTypes.get(comparison);
  assert.equal(stored.kind === "declared" && stored.typeArguments.length === 1 && stored.typeArguments[0]?.kind === "string", true);
  assert.equal(stored.kind === "declared" && result !== undefined && result.kind !== "refused" && result.type.kind === "optional" &&
    result.type.value === stored.typeArguments[0], true, "the original receiver binder supplies the exact present member object");
  assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type.kind === "primitive" && selected.type.primitive === "bool", true);
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length === 1 && issues[0]?.code === "TSONIC_LOCAL_TYPE_UNION" && ast.is.IsCallExpression(issues[0].site), true,
    "an open array result retains its original union-inference refusal independently of the completed nominal receiver");
});

test("C2392 authored global primitive aliases retain their exact declaration through containers", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number;",
    "/src/node_modules/@test/plain/package.json": JSON.stringify({ name: "@test/plain", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/plain/index.d.ts": "export type int32 = number;",
    "/src/globals.d.ts": `type NativeWord = import("@test/words").int32;
      type WordArray = NativeWord[]; type WordBox = { value: NativeWord }; type ForeignWord = import("@test/plain").int32;`,
    "/src/index.ts": `function run(input: NativeWord, values: WordArray, box: WordBox, foreign: ForeignWord): void {
      const direct = input; const element = values[0]; const member = box.value; void direct; void element; void member; void foreign;
    }
    function shadow(): number { type NativeWord = number; const local: NativeWord = 1.5; return local; }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original alias-reference source is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) { const node = pending.pop()!; nodes.push(node); pending.push(...source.ast.children(node).filter((child): child is Node => child !== undefined)); }
  for (const [name, expected] of [["direct", "int32"], ["element", "int32"], ["member", "int32"], ["foreign", "float64"], ["local", "float64"]]) {
    const declaration = nodes.find(node => (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node)) &&
      source.ast.name(node) !== undefined && source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)!) === name);
    const outcome = declaration === undefined ? undefined : source.effectiveTypes.get(declaration);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === expected, true,
      `${name}: only the exact configured declaration supplies primitive width`);
  }
  const parameter = nodes.find(node => source.ast.is.IsParameterDeclaration(node) && source.ast.text(source.ast.name(node)!) === "input");
  const annotation = parameter === undefined ? undefined : source.ast.typeNode(parameter);
  const reference = annotation === undefined ? undefined : source.ast.as.AsTypeReferenceNode(annotation)?.TypeName;
  const declaration = annotation === undefined ? undefined : source.semantics.forNode(parameter!).declarations.authoredTypeDeclaration(annotation);
  const body = declaration === undefined ? undefined : source.ast.typeNode(declaration);
  const qualifier = body === undefined ? undefined : source.ast.as.AsImportTypeNode(body)?.Qualifier;
  assert.equal(reference !== undefined && qualifier !== undefined && source.navigation.sourceReferenceFor(qualifier) === undefined && declaration !== undefined &&
    source.ast.is.IsTypeAliasDeclaration(declaration) && source.ast.getSourceFile(declaration) === checked.getSourceFile("/src/globals.d.ts"), true,
    "semantic declaration evidence reaches the original global alias without expanding project navigation");
  assert.equal(source.effectiveTypes.refusals().length, 0);
});

test("an empty inferred literal consumed through a generic call keeps only its real construction refusal", () => {
  const current = fixture("declare function identity<T>(value: T): T; function run(): void { const value = {}; void identity(value); }");
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_UNTYPED_OBJECT_LITERAL" && issues[0].site === literal, true,
    "synthetic result and binder shape terms do not fabricate additional object-construction sites");
});

test("one eager publication fills numeric locals from the first exact demand", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const value = 1; take(value); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assert.equal(Object.isFrozen(current.source.effectiveTypes), true);
  assert.equal(Object.isFrozen(current.type("value")), true);
});

test("a later conflicting exact demand retains its original checked site", () => {
  const current = fixture("declare function narrow(value: int32): void; declare function broad(value: number): void; function run(): void { const value = 1; narrow(value); broad(value); }");
  const failure = current.source.effectiveTypes.refusals().find(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT");
  const later = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node)?.Expression) === "broad");
  const earlier = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node)?.Expression) === "narrow");
  assert.equal(failure !== undefined, true);
  assert.equal(later !== undefined && failure?.site === current.source.ast.arguments(later)[0], true);
  assert.equal(earlier !== undefined && failure?.related === current.source.ast.arguments(earlier)[0], true);
});

test("signature closure defaults leaves before exact use demands", () => {
  const current = fixture("declare function broad(value: number): void; function run() { const value = 1; broad(value); return value + 1; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_SIGNATURE"), true);
});

test("declared returns are ordinary exact demands rather than signature defaults", () => {
  const current = fixture("function run(): number { const value = 1; return value; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
});

test("array and nested data-member fills decompose before defaults", () => {
  const current = fixture("declare function arrays(value: number[]): void; declare function fields(value: { n: number }): void; function run(): void { const values = [1, 2]; const data = { n: 1 }; arrays(values); fields(data); }");
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
  const data = current.type("data");
  assert.equal(data.kind === "shape" && data.members[0]?.type.kind === "primitive" && data.members[0].type.primitive === "float64", true);
});

test("an alias and its projected read retain the same solved array element", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const values = [1]; const alias = values; take(alias[0]!); }");
  const values = current.type("values"); const alias = current.type("alias");
  assertSameValue(values, alias);
  assert.equal(values.kind === "array" && values.element.kind === "primitive" && values.element.primitive === "float64", true);
});

test("writes and literal compound assignments leave the default unchanged", () => {
  const current = fixture("function run(): void { let value = 1; value += 0.5; const values = [1]; values[0] = 0.5; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int64" });
  assert.equal(current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit").length >= 2, true);
});

test("a declared compound-assignment right side fills the local", () => {
  const current = fixture("function run(input: number): void { let value = 1; value += input; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
});

for (const statement of ["values[0] = value;", "target = value;"]) {
  test(`write-fit retains the already-solved right side of ${statement}`, () => {
    const current = fixture(`declare function broad(value: number): void; function run(): void { const values = [1]; let target = 1; let value = 1; broad(value); ${statement} }`);
    assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
    const write = current.source.effectiveTypes.obligations().find(row => row.kind === "write-fit" &&
      current.source.ast.is.IsBinaryExpression(row.site) && current.source.ast.text(current.source.ast.as.AsBinaryExpression(row.site)?.Right) === "value");
    assert.equal(write !== undefined, true);
    assertSameValue(write?.type, { kind: "primitive", primitive: "int64" });
    assertSameValue(write?.valueType, { kind: "primitive", primitive: "float64" });
    assert.equal(write?.valueVariable?.node === write?.value && write?.valueVariable?.path.length === 0, true);
  });
}

test("ordinary fixed API write values publish their declared read type and a write-fit obligation", () => {
  const current = fixture("function run(input: number[]): void { const values = [1]; values[0] = input.length; }");
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node));
  const write = current.source.effectiveTypes.obligations().find(row => row.kind === "write-fit" && row.value === access);
  assert.equal(access !== undefined && write !== undefined, true);
  const selected = access === undefined ? undefined : current.source.semantics.forNode(access).operations.propertyAccess(access);
  const declaration = selected?.selectedReadDeclaration ?? selected?.selectedDeclaration;
  assert.equal(declaration !== undefined, true);
  const described = declaration === undefined ? undefined : createSourceTypeFlowAnalysisContext(current.source).context.describe(declaration);
  const outcome = access === undefined ? undefined : current.source.effectiveTypes.get(access);
  assert.equal(described !== undefined && outcome !== undefined && outcome.kind !== "refused", true);
  if (outcome === undefined || outcome.kind === "refused") throw new Error("The declared read type must be published.");
  assertSameValue(outcome.type, described);
  assertSameValue(write?.valueType, described);
  assert.equal(write?.valueVariable === undefined, true);
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int64" } });
});

test("derived-local demands never flow back into arithmetic operands", () => {
  const current = fixture("declare function broad(value: number): void; function run(): void { const value = 1; const derived = value * 2; broad(derived); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int64" });
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT"), true);
});

test("derived arithmetic is typed once in dependency order", () => {
  const current = fixture("function run(): void { const first = 1; const second = first * 2; const third = second + 0.5; }");
  assertSameValue(current.type("second"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("third"), { kind: "primitive", primitive: "float64" });
});

test("declared numeric widths cross a generic call without checker erasure", () => {
  const current = fixture("function first<T>(values: T[]): T { return values[0]!; } function run(values: int32[]): void { const value = first(values); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int32" });
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  assert.equal(call !== undefined, true);
  const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  assert.equal(instance?.method[0]?.type.kind === "primitive" && instance.method[0].type.primitive === "int32", true);
});

test("an empty array gets no type from a receiver-binder insertion", () => {
  const current = fixture("function run(): void { const values = []; values.push(1); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("uncontextualized empty object and array declarations are Host refusals", () => {
  const current = fixture("function run(): void { const data = {}; const values = []; }");
  const codes = current.source.effectiveTypes.refusals().map(issue => issue.code);
  assert.equal(codes.includes("TSONIC_UNTYPED_OBJECT_LITERAL"), true);
  assert.equal(codes.includes("TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("Host-fixed counters and every checked read carry the same B8 authority", () => {
  const current = fixture("export const moduleValue = 1; function run(): void { for (let index = 8; index >= 0; index -= 2) { const copy: number = index; } }");
  assertSameValue(current.type("index"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("moduleValue"), { kind: "primitive", primitive: "int64" });
  const declaration = current.declaration("index");
  for (const use of current.source.navigation.declarationUses(declaration)) {
    if (use.kind === "type-only" || use.kind === "source-linkage") continue;
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.fixedRule?.kind === "loop-counter", true);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.fixedRule?.declaration === declaration, true);
  }
});

test("published facts are deterministic and keep exact occurrences", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const alias = values; }");
  const second = analyzeSourceEffectiveTypes(current.source);
  for (const name of ["values", "alias"]) {
    const node = current.declaration(name);
    const first = current.source.effectiveTypes.get(node); const other = second.get(node);
    assert.equal(first !== undefined && other !== undefined && first.kind !== "refused" && other.kind !== "refused", true);
    if (first === undefined || other === undefined || first.kind === "refused" || other.kind === "refused") continue;
    assertSameValue(first.type, other.type);
    assert.equal(first.provenance.occurrence === node && other.provenance.occurrence === node, true);
    assert.equal(Object.isFrozen(first.provenance), true);
  }
  assert.equal(Object.isFrozen(second.obligations()) && Object.isFrozen(second.refusals()), true);
});

test("raw declaration-only syntax stays outside the effective-value domain", () => {
  const current = fixture("interface Marker { readonly name: string } function run(): void { const value = 1; }");
  const declaration = current.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
  assert.equal(declaration !== undefined, true);
  if (declaration === undefined) return;
  // K-2447 domain contract: a declaration publishes at most its own declared identity as metadata, never a value group.
  const outcome = current.source.effectiveTypes.get(declaration);
  assert.equal(outcome === undefined || outcome.kind !== "refused" && outcome.type.kind === "declared" &&
    outcome.type.declaration === declaration && outcome.provenance.group === declaration, true);
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  assert.equal(graph.nodes.some(entry => entry.node === declaration), false);
});

function outcomeCode(outcome: SourceEffectiveTypeOutcome | undefined): string | undefined {
  return outcome?.kind === "refused" ? outcome.code : undefined;
}

test("a different pair of fixed element types refuses at its original array", () => {
  const current = fixture("function run(narrow: float32, signed: int32): void { const values = [narrow, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS"), true);
  assert.equal(outcomeCode(current.source.effectiveTypes.get(current.declaration("values"))), "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS");
});

test("a seeded accumulator is checked once against its non-cyclic type", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const total = values.reduce((sum, value) => sum + value, 0); }");
  assertSameValue(current.type("total"), { kind: "primitive", primitive: "int64" });
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_ACCUMULATOR"), false);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("inline callable construction publishes one callable type consistent with its chosen parameter and result", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const mapped = values.map(value => value * 2); }");
  assertSameValue(current.type("mapped"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int64" } });
  const arrow = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  const parameter = arrow === undefined ? undefined : current.source.ast.parameters(arrow)[0];
  const body = arrow === undefined ? undefined : current.source.ast.body(arrow);
  assert.equal(arrow !== undefined && parameter !== undefined && body !== undefined, true);
  const arrowType = arrow === undefined ? undefined : current.source.effectiveTypes.get(arrow);
  assert.equal(arrowType !== undefined && arrowType.kind !== "refused", true);
  if (arrowType === undefined || arrowType.kind === "refused") throw new Error("The inline callable type must be published.");
  assertSameValue(arrowType.type, { kind: "callable", calls: [{ declaration: arrow, typeParameters: [],
    parameters: [{ declaration: parameter, kind: "required", type: { kind: "primitive", primitive: "int64" } }],
    result: { kind: "primitive", primitive: "int64" } }], constructs: [] });
  for (const node of [parameter, body]) {
    const outcome = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome !== undefined && outcome.kind !== "refused") assertSameValue(outcome.type, { kind: "primitive", primitive: "int64" });
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a fractional accumulator return cannot retype an integer seed", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const total = values.reduce((sum, value) => sum + 0.5, 0); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_ACCUMULATOR"), true);
});

test("declared optional aliases preserve the leaf width and checker narrowing", () => {
  const current = fixture("declare let input: int32 | undefined; function run(): void { if (input !== undefined) { const narrowed = input; } }");
  assertSameValue(current.type("input"), { kind: "optional", value: { kind: "primitive", primitive: "int32" } });
  assertSameValue(current.type("narrowed"), { kind: "primitive", primitive: "int32" });
});

test("two generic occurrences keep separate binder instantiations", () => {
  const current = fixture("function identity<T>(value: T): T { return value; } function run(): void { const integer = identity(1); const fractional = identity(0.5); }");
  assertSameValue(current.type("integer"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("fractional"), { kind: "primitive", primitive: "float64" });
  const calls = current.nodes.filter(node => current.source.ast.is.IsCallExpression(node));
  const first = calls[0] === undefined ? undefined : current.source.effectiveTypes.callInstantiation(calls[0]);
  const second = calls[1] === undefined ? undefined : current.source.effectiveTypes.callInstantiation(calls[1]);
  assert.equal(first !== undefined && second !== undefined && first.call !== second.call, true);
});

test("the use bound is a Host refusal rather than a partial use prefix", () => {
  const uses = Array.from({ length: 1025 }, () => "take(value);").join(" ");
  const current = fixture(`declare function take(value: number): void; function run(): void { const value = 1; ${uses} }`);
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});

test("a depth-five open literal refuses instead of publishing a shallow descriptor", () => {
  const current = fixture("function run(): void { const value = [[[[[1]]]]]; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});

test("a fractional bitwise derived local never publishes a floating bitwise carrier", () => {
  const current = fixture("function run(): void { const value = 0.5; const derived = ~value; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED"), true);
});

test("C29 module declarations keep their own type without signature refusals", () => {
  const current = fixture('const foo = "bar"; export const record: Record<string, string> = { foo }; export const plain = 7 / 2; export const typed: int32 = 7 / 2;');
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const defaults = createSourceTypeFlowAnalysisContext(current.source);
  assertSameValue(current.type("plain"), defaults.context.describe(current.declaration("plain")));
  assertSameValue(current.type("typed"), { kind: "primitive", primitive: "int32" });
  const record = current.source.effectiveTypes.get(current.declaration("record"));
  assert.equal(record !== undefined && record.kind !== "refused" && record.type.kind === "declared" &&
    current.source.ast.is.IsTypeAliasDeclaration(record.type.declaration) &&
    current.source.semantics.forNode(current.declaration("record")).declarations.isDefaultLibraryDeclaration(record.type.declaration) &&
    current.source.ast.text(current.source.ast.name(record.type.declaration)) === "Record", true);
  assert.equal(record !== undefined && record.kind !== "refused" && record.type.kind === "declared" &&
    record.type.typeArguments.length === 2 && record.type.typeArguments.every(type => type.kind === "string"), true);
});

test("declared recursive unions publish their declared reference without expansion or refusal", () => {
  const current = fixture("type Tree = number | readonly Tree[]; declare const input: Tree; function run(value: Tree): Tree { const retained: Tree = value; return retained; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const declaration = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Tree");
  for (const name of ["input", "retained"]) {
    const outcome = current.source.effectiveTypes.get(current.declaration(name));
    assert.equal(declaration !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type.kind === "declared" && outcome.type.declaration === declaration && outcome.type.typeArguments.length === 0, true, name);
  }
});

test("C29 a fixed read keeps its own carrier when an open sibling conflicts", () => {
  const current = fixture("declare function take(values: number[]): void; function run(value: int32): void { const values = [value, 1]; take(values); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT"), true);
  const parameter = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "value");
  if (parameter === undefined) throw new Error("The exact declared parameter is required.");
  for (const use of current.source.navigation.declarationUses(parameter)) {
    if (use.kind === "type-only" || use.kind === "source-linkage") continue;
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The fixed read is not an inference refusal.");
    assertSameValue(outcome.type, { kind: "primitive", primitive: "int32" });
  }
});

test("C29 annotated aggregate construction does not retype its fixed children", () => {
  const current = fixture("function run(narrow: float32, signed: int32): void { const values: float32[] = [narrow, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
  const signed = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "signed");
  if (signed === undefined) throw new Error("The exact signed source parameter is required.");
  for (const use of current.source.navigation.declarationUses(signed)) {
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The original fixed source read is required.");
    assertSameValue(outcome.type, { kind: "primitive", primitive: "int32" });
  }
});

for (const [name, body] of [
  ["annotated alias initializer", "type Values = float32[]; function run(narrow: float32, signed: int32): void { const values: Values = [narrow, signed]; }"],
  ["declared return", "function run(narrow: float32, signed: int32): float32[] { return [narrow, signed]; }"],
  ["declared concise body", "function run(narrow: float32, signed: int32): void { const make = (): float32[] => [narrow, signed]; }"],
  ["declared async return", "async function run(narrow: float32, signed: int32): Promise<float32[]> { return [narrow, signed]; }"],
  ["concrete as position", "function run(narrow: float32, signed: int32): void { const values = ([narrow, signed] as float32[]); }"],
  ["concrete satisfies position", "function run(narrow: float32, signed: int32): void { const values = ([narrow, signed] satisfies float32[]); }"],
] as const) {
  test(`C30 ${name} owns the construction type without joining fixed element carriers`, () => {
    const current = fixture(body);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
    const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
    if (literal === undefined) throw new Error("The original declared array literal is required.");
    const outcome = current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, name);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The declared construction type is required.");
    assertSameValue(outcome.type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
    assert.equal(outcome.provenance.component?.authoredTypeNode !== undefined, true);
    for (const [parameterName, primitive] of [["narrow", "float32"], ["signed", "int32"]] as const) {
      const parameter = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === parameterName);
      if (parameter === undefined) throw new Error("The exact fixed source parameter is required.");
      for (const use of current.source.navigation.declarationUses(parameter)) {
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        const value = current.source.effectiveTypes.get(use.reference);
        assert.equal(value !== undefined && value.kind !== "refused", true, parameterName);
        if (value === undefined || value.kind === "refused") throw new Error("The original fixed operand is required.");
        assertSameValue(value.type, { kind: "primitive", primitive });
      }
    }
    const admissions = current.source.effectiveTypes.obligations().filter(obligation => obligation.kind === "literal-admission" &&
      obligation.site === literal);
    assert.equal(admissions.length, 1, `${name}: the declared construction carries one canonical D2 obligation`);
    assert.equal(admissions[0]?.kind === "literal-admission" && admissions[0].authority === "declared", true, name);
    assert.equal(admissions[0]?.type === outcome.type, true, `${name}: admission retains the exact published descriptor`);
  });
}

test("C30 a declared construction never retypes an independently filled open operand", () => {
  const current = fixture("declare function broad(value: number): void; function run(signed: int32): void { const value = 1; broad(value); const values: float32[] = [value, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
});

test("C30 data-member construction keeps its declared shape and the original operands", () => {
  const current = fixture("declare function broad(value: number): void; function run(signed: int32): void { const value = 1; broad(value); const data: { first: float32; second: number } = { first: value, second: signed }; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape", true);
  if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "shape") {
    throw new Error("The exact declared data-member construction is required.");
  }
  for (const [name, primitive] of [["first", "float32"], ["second", "float64"]] as const) {
    assert.equal(outcome.type.members.some(member => member.name === name && member.type.kind === "primitive" &&
      member.type.primitive === primitive), true, name);
  }
});

test("an index-signature declared construction publishes its declared reference without an initializer retry", () => {
  const current = fixture("type Indexed = { [name: string]: number }; function run(): void { const data: Indexed = { value: 1 }; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(literal !== undefined, true);
  const declaration = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Indexed");
  for (const node of [current.declaration("data"), literal]) {
    const outcome = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(declaration !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type.kind === "declared" && outcome.type.declaration === declaration, true);
  }
  assert.equal(current.nodes.some(node => {
    const outcome = current.source.effectiveTypes.get(node);
    return outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape" &&
      outcome.type.members.some(member => member.name === "value");
  }), false, "the initializer is never inferred into an unrelated structural carrier");
  const admissions = current.source.effectiveTypes.obligations().filter(obligation =>
    obligation.kind === "literal-admission" && obligation.site === literal);
  assert.equal(admissions.length, 1);
});

test("C29 open union demands still produce the original Host refusal", () => {
  const current = fixture("declare function take(value: number | string): void; function run(): void { const value = 1; take(value); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_UNION"), true);
  assert.equal(outcomeCode(current.source.effectiveTypes.get(current.declaration("value"))), "TSONIC_LOCAL_TYPE_UNION");
});

test("synthetic call result terms never request literal construction admission", () => {
  const current = fixture("function run(values: int32[]): void { const mapped = values.map(value => value); const filtered = values.filter(value => value > 0); const actual = [1, 2]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const admissions = current.source.effectiveTypes.obligations().filter(obligation => obligation.kind === "literal-admission");
  const aggregate = admissions.filter(obligation => obligation.type.kind === "array" || obligation.type.kind === "shape");
  assert.equal(aggregate.length > 0, true);
  assert.equal(aggregate.every(obligation => current.source.ast.is.IsArrayLiteralExpression(obligation.site) ||
    current.source.ast.is.IsObjectLiteralExpression(obligation.site)), true);
  assert.equal(admissions.every(obligation => !current.source.ast.is.IsCallExpression(obligation.site)), true);
  assert.equal(admissions.some(obligation => current.source.ast.is.IsNumericLiteral(obligation.site)), true);
});

test("C2224 an array construction owns the mixed-fixed refusal through an asserted numeric peer", () => {
  const current = fixture("function run(narrow: float32): void { const values = [narrow, 0.5 as number]; void values; }");
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS" && issues[0].site === literal, true,
    "the construction, not an alias or later scalar demand, owns the C19 cause");
});

test("C2224 a non-fitting literal retains its fixed peer and exact D2 obligation", () => {
  for (const elements of ["signed, 9007199254740993", "9007199254740993, signed", "signed, -9007199254740993"]) {
    const current = fixture(`function run(signed: int32): void { const values = [${elements}]; void values; }`);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, elements);
    const selected = current.type("values");
    assert.equal(selected.kind === "array" && selected.element.kind === "primitive" &&
      selected.element.primitive === "int32", true, elements);
    const array = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
    const original = array === undefined ? undefined : current.source.ast.elements(array).find(node => node !== undefined &&
      (current.source.ast.is.IsNumericLiteral(node) || current.source.ast.is.IsPrefixUnaryExpression(node)));
    assert.equal(original !== undefined && current.source.effectiveTypes.obligations().some(obligation =>
      obligation.kind === "literal-admission" && obligation.site === original &&
      obligation.type.kind === "primitive" && obligation.type.primitive === "int32"), true,
    "the original retained token reaches Native range admission without a Host fit refusal");
  }
});

test("C2224 a refused empty construction suppresses its dependent projection refusal", () => {
  const current = fixture("function run(): boolean { const values = []; values[0] = 1; return values !== undefined; }");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(issues[0]?.code === "TSONIC_UNTYPED_ARRAY_LITERAL" && issues[0].site === literal, true);
  const access = current.nodes.find(node => current.source.ast.is.IsElementAccessExpression(node));
  assert.equal(access !== undefined && current.source.effectiveTypes.get(access) === issues[0], true,
    "the projection carries the same construction cause, not a textual duplicate");
});

test("C2224 independent empty constructions retain independent causes", () => {
  const current = fixture("function run(): void { const first = {}; const second = {}; void first; void second; }");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 2);
  assert.equal(issues.every(issue => issue.code === "TSONIC_UNTYPED_OBJECT_LITERAL"), true);
  assert.equal(issues[0] !== issues[1] && issues[0]?.site !== issues[1]?.site, true);
});

test("C30 uses the unique kind-matching declared parameter arm and retains its member declaration", () => {
  const current = fixture(`declare function take(value: { count: int32 } | readonly number[]): void;
    function run(): void { take({ count: 1 }); take([1, 2]); }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const array = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const member = current.nodes.find(node => current.source.ast.is.IsPropertySignatureDeclaration(node));
  const objectType = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const arrayType = array === undefined ? undefined : current.source.effectiveTypes.get(array);
  assert.equal(objectType !== undefined && objectType.kind !== "refused" && objectType.type.kind === "shape", true);
  if (objectType === undefined || objectType.kind === "refused" || objectType.type.kind !== "shape") throw new Error("The chosen object arm is required.");
  assert.equal(member !== undefined && objectType.type.members[0]?.origin.kind === "declared" &&
    objectType.type.members[0].origin.declaration === member, true);
  assertSameValue(objectType.type.members[0]?.type, { kind: "primitive", primitive: "int32" });
  assert.equal(arrayType !== undefined && arrayType.kind !== "refused", true);
  if (arrayType === undefined || arrayType.kind === "refused") throw new Error("The chosen array arm is required.");
  assertSameValue(arrayType.type, { kind: "array", readonly: true, element: { kind: "primitive", primitive: "float64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C30 ambiguous declared object arms retain their own structural refusal origin", () => {
  const current = fixture(`declare function take(value: { count: int32 } | { count: float32 }): void;
    function run(): void { take({ count: 1 }); }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const record = graph.nodes.find(node => node.node === literal && node.variable.path.length === 0);
  assert.equal(record?.declaredSlotRefusal !== undefined && graph.refusals.includes(record.declaredSlotRefusal), true);
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_LOCAL_TYPE_UNION" && issues[0].site === literal, true);
  assert.equal(literal !== undefined && current.source.effectiveTypes.get(literal)?.kind === "refused", true);
});

test("C30 carries declared nested element slots through both coalescing return branches", () => {
  const current = fixture(`declare const input: { rows: readonly number[][] } | undefined;
    function run(): { rows: readonly number[][] } { return input ?? { rows: [[1, 2]] }; }`);
  const arrays = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 2);
  const selected = arrays.map(node => current.source.effectiveTypes.get(node));
  assert.equal(selected.every(type => type !== undefined && type.kind !== "refused"), true);
  if (selected[0] === undefined || selected[0].kind === "refused" || selected[1] === undefined || selected[1].kind === "refused") {
    throw new Error("Both declared array construction slots are required.");
  }
  assertSameValue(selected[0].type, { kind: "array", readonly: true, element: {
    kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } } });
  assertSameValue(selected[1].type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

for (const returned of ["Value", "Locked<Value>"]) {
  test(`B2 fills a generic ${returned} result and its original unbound construction structurally`, () => {
    const current = fixture(`type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
      declare function retain<Value>(value: Value): ${returned};
      function run(): void { const selected: object = retain({}); }`);
    const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
    const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
    const selected = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(selected !== undefined && selected.kind !== "refused", true);
    if (selected === undefined || selected.kind === "refused") throw new Error("The filled construction is required.");
    assertSameValue(selected.type, { kind: "intrinsic", intrinsic: "object" });
    assertSameValue(current.type("selected"), { kind: "intrinsic", intrinsic: "object" });
    const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
    assert.equal(instance?.method.length, 1);
    assertSameValue(instance?.method[0]?.type, { kind: "intrinsic", intrinsic: "object" });
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  });
}

test("a merged Map constructor retains the actual type declaration and both source arguments", () => {
  const current = fixture(`function run(): void { const selected = new Map<int32, string>(); }`);
  const selected = current.type("selected");
  assert.equal(selected.kind === "declared", true);
  if (selected.kind !== "declared") throw new Error("The actual Map type declaration is required.");
  assert.equal(current.source.ast.is.IsInterfaceDeclaration(selected.declaration), true);
  assert.equal(current.source.ast.typeParameters(selected.declaration).length, 2);
  assertSameValue(selected.typeArguments, [{ kind: "primitive", primitive: "int32" }, { kind: "string" }]);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("inherited receiver and method binders retain their distinct declarations and chosen widths", () => {
  const current = fixture(`interface Root<Outer> { read<Value extends Outer>(value: Value): Outer; }
    interface View<Body> extends Root<Body> {}
    function run(view: View<int32>, value: int32): void { const selected = view.read(value); }`);
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  const outer = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "Outer");
  const method = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "Value");
  assert.equal(instance?.receiver.length === 1 && instance.receiver[0]?.declaration === outer, true);
  assert.equal(instance?.method.length === 1 && instance.method[0]?.declaration === method && outer !== method, true);
  assertSameValue(instance?.receiver[0]?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(instance?.method[0]?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("selected"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a declared generic binding leaf retains the substituted property and callable member identities", () => {
  const current = fixture(`interface Box<Value> { value: Value; read(): Value; }
    function run(box: Box<int32>): void { const { value, read } = box; }`);
  const leaves = current.nodes.filter(node => current.source.ast.is.IsBindingElement(node));
  const value = leaves.find(node => current.source.ast.text(current.source.ast.name(node)) === "value");
  const read = leaves.find(node => current.source.ast.text(current.source.ast.name(node)) === "read");
  const valueType = value === undefined ? undefined : current.source.effectiveTypes.get(value);
  const readType = read === undefined ? undefined : current.source.effectiveTypes.get(read);
  assert.equal(valueType !== undefined && valueType.kind !== "refused" && readType !== undefined && readType.kind !== "refused", true);
  if (valueType === undefined || valueType.kind === "refused" || readType === undefined || readType.kind === "refused") throw new Error("The declared binding leaves are required.");
  assertSameValue(valueType.type, { kind: "primitive", primitive: "int32" });
  assert.equal(readType.type.kind === "callable", true);
  if (readType.type.kind !== "callable") throw new Error("A selected method value is callable, not its return type.");
  const declaredMethod = current.nodes.find(node => current.source.ast.is.IsMethodSignatureDeclaration(node));
  assert.equal(readType.type.calls[0]?.declaration === declaredMethod, true);
  assertSameValue(readType.type.calls[0]?.result, { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("never-open field arrays publish one int64 default at their declaration, initializer and reads", () => {
  const current = fixture(`class Counter { values = [1, 2]; read() { return this.values; } }`);
  const declaration = current.nodes.find(node => current.source.ast.is.IsPropertyDeclaration(node));
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node));
  for (const node of [declaration, literal, access]) {
    const selected = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(selected !== undefined && selected.kind !== "refused", true);
    if (selected === undefined || selected.kind === "refused") throw new Error("Every field value occurrence is required.");
    assertSameValue(selected.type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int64" } });
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("one callable return publication retains zero-argument declared results and full inferred async carriers", () => {
  const current = fixture(`const exact = (): int32 => 1; const first = exact();
    async function deferred() { return exact(); }`);
  assertSameValue(current.type("first"), { kind: "primitive", primitive: "int32" });
  const arrow = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  const asynchronous = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node));
  const exact = arrow === undefined ? undefined : current.source.effectiveTypes.callableReturn(arrow);
  const deferred = asynchronous === undefined ? undefined : current.source.effectiveTypes.callableReturn(asynchronous);
  assert.equal(exact !== undefined && exact.kind !== "refused" && deferred !== undefined && deferred.kind !== "refused", true);
  if (exact === undefined || exact.kind === "refused" || deferred === undefined || deferred.kind === "refused") throw new Error("Both complete callable returns are required.");
  assert.equal(exact.provenance.occurrence === arrow && deferred.provenance.occurrence === asynchronous, true);
  assertSameValue(exact.type, { kind: "primitive", primitive: "int32" });
  assert.equal(deferred.type.kind === "declared", true);
  if (deferred.type.kind !== "declared") throw new Error("An async return is the full carrier, not its payload.");
  assertSameValue(deferred.type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("an intrinsic object slot preserves separately published physical values, methods and getter returns", () => {
  const current = fixture(`function run(): void { const selected: object = {
    count: 7, read(): int32 { return 1; }, get total(): int32 { return 2; }
  }; }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const property = current.nodes.find(node => current.source.ast.is.IsPropertyAssignment(node));
  const child = property === undefined ? undefined : current.source.ast.as.AsPropertyAssignment(property)?.Initializer;
  const method = current.nodes.find(node => current.source.ast.is.IsMethodDeclaration(node));
  const getter = current.nodes.find(node => current.source.ast.is.IsGetAccessorDeclaration(node));
  const object = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const count = child === undefined ? undefined : current.source.effectiveTypes.get(child);
  const callable = method === undefined ? undefined : current.source.effectiveTypes.get(method);
  const returned = getter === undefined ? undefined : current.source.effectiveTypes.callableReturn(getter);
  assert.equal(object !== undefined && object.kind !== "refused" && count !== undefined && count.kind !== "refused", true);
  if (object === undefined || object.kind === "refused" || count === undefined || count.kind === "refused") throw new Error("The slot and its original child publication are required.");
  assertSameValue(object.type, { kind: "intrinsic", intrinsic: "object" });
  assertSameValue(count.type, { kind: "primitive", primitive: "int64" });
  assert.equal(callable !== undefined && callable.kind !== "refused" && callable.type.kind === "callable", true);
  if (callable === undefined || callable.kind === "refused" || callable.type.kind !== "callable") throw new Error("The real method publication is required.");
  assert.equal(callable.type.calls[0]?.declaration === method, true);
  assertSameValue(callable.type.calls[0]?.result, { kind: "primitive", primitive: "int32" });
  assert.equal(returned !== undefined && returned.kind !== "refused" && returned.provenance.occurrence === getter, true);
  if (returned === undefined || returned.kind === "refused") throw new Error("The getter's actual value return is required.");
  assertSameValue(returned.type, { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a C8 fixed heterogeneous construction keeps its scalar child at the complete closed source element type", () => {
  const current = fixture(`function run(): void { const values = ["text", 9007199254740993]; }`);
  const number = current.nodes.find(node => current.source.ast.is.IsNumericLiteral(node));
  const selected = number === undefined ? undefined : current.source.effectiveTypes.get(number);
  assert.equal(selected !== undefined && selected.kind !== "refused", true);
  if (selected === undefined || selected.kind === "refused") throw new Error("The original numeric value publication is required.");
  assert.equal(sourceTypeDescriptorsEqual(selected.type, { kind: "union", types: [{ kind: "string" }, { kind: "primitive", primitive: "int64" }] }), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2232 scalar tokens retain the entire declared union instead of selecting a physical arm", () => {
  const current = fixture(`declare function take(value: string | int32): void;
    function run(narrow: float32, signed: int32): void {
      take(1); const values: (float32 | int32 | number)[] = [narrow, signed, 9007199254740992];
    }`);
  const tokens = current.nodes.filter(node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(tokens.length, 2);
  const first = tokens[0] === undefined ? undefined : current.source.effectiveTypes.get(tokens[0]);
  const second = tokens[1] === undefined ? undefined : current.source.effectiveTypes.get(tokens[1]);
  assert.equal(first !== undefined && first.kind !== "refused" && second !== undefined && second.kind !== "refused", true);
  if (first === undefined || first.kind === "refused" || second === undefined || second.kind === "refused") throw new Error("Both complete scalar slots are required.");
  assert.equal(sourceTypeDescriptorsEqual(first.type, { kind: "union", types: [{ kind: "string" }, { kind: "primitive", primitive: "int32" }] }), true);
  assert.equal(sourceTypeDescriptorsEqual(second.type, { kind: "union", types: [
    { kind: "primitive", primitive: "float32" }, { kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "float64" },
  ] }), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("negative zero publishes the int64 default for an open and an exported binding", () => {
  const current = fixture("function run(): void { const local = -0; const derived = local + 1; } export const exported = -0;");
  for (const name of ["local", "derived", "exported"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "int64" });
});

test("C30 signed literal children retain the same declared scalar and union slot", () => {
  const current = fixture(`function direct(): number { return -2147483649; }
    function values(): (string | number)[] { return ["text", 9007199254740993, -9007199254740993, 1e100]; }
    const signed: number = -2147483649;
    const minimum: int32 = -2147483648;`);
  const { ast } = current.source;
  const negative = current.nodes.filter(node => ast.is.IsPrefixUnaryExpression(node) && ast.operatorKindName(node) === "KindMinusToken");
  assert.equal(negative.length, 4);
  for (const node of negative) {
    const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
    const whole = current.source.effectiveTypes.get(node);
    const child = operand === undefined ? undefined : current.source.effectiveTypes.get(operand);
    assert.equal(whole !== undefined && whole.kind !== "refused" && child !== undefined && child.kind !== "refused", true,
      "the original signed construction and spelling child both have an exact publication");
    if (whole === undefined || whole.kind === "refused" || child === undefined || child.kind === "refused") throw new Error("Both original signed-literal outcomes are required.");
    assert.equal(sourceTypeDescriptorsEqual(whole.type, child.type), true,
      "the spelling child does not acquire an independent int64 default under a declared floating slot");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2377 literal demands precede the own default without changing C8 storage or inferred authority", () => {
  const current = fixture(`declare function take(value: (string | number)[]): void;
    function inferred(): void { const original = ["text", -9007199254740993, 1e100]; void original; }
    function contextual(): void { const filled = ["text", -9007199254740993, 1e100]; take(filled); }
    function scalar(narrow: float32): void { const own = -7; const partnered = -7 + narrow; void own; void partnered; }
    function fixed(peer: int64): void { const retained = [peer, -9223372036854775809]; void retained; }`);
  const { ast } = current.source;
  for (const [name, authority] of [["original", "inferred"], ["filled", "declared"]] as const) {
    const logical: SourceTypeDescriptor = { kind: "union", types: [{ kind: "string" }, { kind: "primitive", primitive: "float64" },
      ...(authority === "inferred" ? [{ kind: "primitive" as const, primitive: "int64" as const }] : [])] };
    const literal = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const whole = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(whole !== undefined && whole.kind !== "refused" && whole.type.kind === "array" &&
      sourceTypeDescriptorsEqual(whole.type.element, logical), true, name + ": the complete C8 logical storage is retained");
    const admission = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(admission.length === 1 && admission[0]?.kind === "literal-admission" && admission[0].authority === authority &&
      whole !== undefined && whole.kind !== "refused" && admission[0].type === whole.type, true, name + ": only the actual destination supplies authority");
    const negative = literal === undefined ? undefined : ast.elements(literal)[1];
    const child = negative === undefined ? undefined : current.source.effectiveTypes.get(negative);
    assert.equal(child !== undefined && child.kind !== "refused" && sourceTypeDescriptorsEqual(child.type, logical), true,
      name + ": a literal's full union storage is not a union-valued operand");
  }
  assertSameValue(current.type("own"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("partnered"), { kind: "primitive", primitive: "float32" });
  assertSameValue(current.type("retained"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0,
    "the original fixed-peer nonfit stays a D2 obligation, not an own-default range refusal");
});

test("C2377 assigned closures use the original callable storage before a numeric body default", () => {
  const current = fixture(`function property(seed: int32): void {
      const value = { count: seed, read(): int32 { return this.count; } }; const alias = value;
      alias.read = () => 11;
    }
    function element(seed: int32): void {
      const value = { count: seed, read(): int32 { return this.count; } }; const alias = value;
      alias["read"] = function() { return 11; };
    }
    function identifier(): void { let read: () => int32; read = () => 11; }
    function optional(box: { read?: () => int32 }): void { box.read = () => 11; }`);
  const { ast } = current.source;
  const closures = current.nodes.filter(node => ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node));
  assert.equal(closures.length, 4);
  for (const closure of closures) {
    const selected = current.source.effectiveTypes.get(closure);
    const returned = current.source.effectiveTypes.callableReturn(closure);
    const signatures = selected !== undefined && selected.kind !== "refused" && selected.type.kind === "callable" ? selected.type.calls : undefined;
    const result = signatures?.[0]?.result;
    assert.equal(signatures?.length === 1 && result?.kind === "primitive" && result.primitive === "int32", true,
      "the retained original callable owns its exact int32 result");
    assert.equal(returned !== undefined && returned.kind !== "refused" && returned.type.kind === "primitive" &&
      returned.type.primitive === "int32", true, "the actual literal body receives that same declared result demand");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("B8 counters keep their int64 rule through checked declaration components and every read", () => {
  const current = fixture(`function run(values: int32[]): int32 {
    let total: int32 = 0;
    for (let index = 0; index < values.length; index++) total += values[index];
    return total;
  }`);
  const { ast } = current.source;
  const declaration = current.declaration("index");
  const occurrences = current.nodes.filter(node => node === declaration || ast.is.IsIdentifier(node) && ast.text(node) === "index" &&
    ast.name(ast.parent(node)) !== node);
  assert.equal(occurrences.length >= 4, true);
  for (const node of occurrences) {
    const result = current.source.effectiveTypes.get(node);
    assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "primitive" &&
      result.type.primitive === "int64" && result.provenance.fixedRule?.kind === "loop-counter" &&
      result.provenance.fixedRule.declaration === declaration, true, "one original counter rule owns the declaration and its reads");
  }
});

test("project class and interface declarations publish their own member identities without a value read", () => {
  const current = fixture(`interface View<T> { value: T; accept?(next: T): T; }
    class Box<T> { value: T; constructor(value: T) { this.value = value; } read(): T { return this.value; } }`);
  const { ast } = current.source;
  const owners = current.nodes.filter(node => ast.is.IsInterfaceDeclaration(node) || ast.is.IsClassDeclaration(node));
  assert.equal(owners.length, 2);
  for (const node of owners) {
    const result = current.source.effectiveTypes.get(node);
    assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "declared" && result.type.declaration === node &&
      result.provenance.occurrence === node, true, "the exact declaration has its instance descriptor, not a constructor-value or an absent outcome");
    if (result === undefined || result.kind === "refused" || result.type.kind !== "declared") throw new Error("The project declaration descriptor is required.");
    const members = result.type.definition?.kind === "shape" ? result.type.definition.members : undefined;
    assert.equal(members !== undefined && members.length === 2, true);
    for (const member of members ?? []) assert.equal(member.origin.kind === "declared" && ast.parent(member.origin.declaration) === node, true,
      "each published member keeps its actual owning source declaration");
    if (ast.is.IsInterfaceDeclaration(node)) assert.equal(members?.find(member => member.name === "accept")?.optional, true);
  }
});

test("class-expression values retain their constructor contract independently of declaration instance shapes", () => {
  const current = fixture("const Make = class { value = 1; }; const item = new Make();");
  const expression = current.nodes.find(node => current.source.ast.is.IsClassExpression(node));
  const chosen = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(chosen !== undefined && chosen.kind !== "refused" && chosen.type.kind === "shape" &&
    chosen.type.constructs.length === 1, true, "a runtime class expression keeps its real constructor value descriptor");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("unused real signature parameters publish the same chosen descriptor as their callable", () => {
  const current = fixture(`export function run(price: number, replacement: int32[], wide: int64): boolean {
    const items = [1, 2]; return items[0] === 1;
  }`);
  const declaration = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node));
  const callable = declaration === undefined ? undefined : current.source.effectiveTypes.get(declaration);
  assert.equal(callable !== undefined && callable.kind !== "refused" && callable.type.kind === "callable", true);
  if (callable === undefined || callable.kind === "refused" || callable.type.kind !== "callable") throw new Error("The actual callable is required.");
  const parameters = callable.type.calls[0]?.parameters ?? [];
  assert.equal(parameters.length, 3);
  for (const parameter of parameters) {
    const outcome = parameter.declaration === undefined ? undefined : current.source.effectiveTypes.get(parameter.declaration);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, "an unused parameter is still a real value declaration");
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The actual parameter outcome is required.");
    assert.equal(sourceTypeDescriptorsEqual(outcome.type, parameter.type), true);
    assert.equal(outcome.provenance.occurrence === parameter.declaration, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("published descriptors and provenance carry identities without checked Type payloads", () => {
  const current = fixture(`interface View<T> { value: T; }
    function run(input: View<int32>): void { const selected: View<int32> = input; }
  `);
  const visit = (type: SourceTypeDescriptor): void => {
    assert.equal("source" in type, false, "a published descriptor never transports internal checked evidence");
    if (type.kind === "declared") {
      for (const argument of type.typeArguments) visit(argument);
      if (type.definition !== undefined) visit(type.definition);
    } else if (type.kind === "shape") {
      for (const member of type.members) visit(member.type);
      for (const index of type.indexes) { visit(index.key); visit(index.value); }
      for (const signature of [...type.calls, ...type.constructs]) {
        for (const parameter of signature.parameters) visit(parameter.type);
        visit(signature.result);
      }
    } else if (type.kind === "array") visit(type.element);
    else if (type.kind === "optional") visit(type.value);
    else if (type.kind === "tuple") for (const element of type.elements) visit(element.type);
    else if (type.kind === "union") for (const member of type.types) visit(member);
    else if (type.kind === "callable") for (const signature of [...type.calls, ...type.constructs]) {
      for (const parameter of signature.parameters) visit(parameter.type);
      visit(signature.result);
    }
  };
  for (const node of current.nodes) {
    const outcome = current.source.effectiveTypes.get(node);
    if (outcome === undefined || outcome.kind === "refused") continue;
    visit(outcome.type);
    const component = outcome.provenance.component;
    assert.equal(component === undefined || !("selectedType" in component) && !("contextualCall" in component), true,
      "provenance retains only original source identities");
  }
});

for (const initializer of ["value => value", "function(value) { const copied = value; return copied; }"]) {
  test(`a declared callable slot owns its actual parameters and return before body solving: ${initializer}`, () => {
    const current = fixture(`export const callback: (value: int32) => int32 = ${initializer};`);
    const { ast } = current.source;
    const callable = ast.as.AsVariableDeclaration(current.declaration("callback"))?.Initializer;
    if (callable === undefined) throw new Error("The actual checked callable is required.");
    const parameter = ast.parameters(callable)[0];
    if (parameter === undefined) throw new Error("The actual checked parameter is required.");
    const isInt32 = (outcome: SourceEffectiveTypeOutcome | undefined): boolean => outcome !== undefined &&
      outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "int32";
    assert.equal(isInt32(current.source.effectiveTypes.get(parameter)), true, "the real parameter inherits its authored slot width");
    const reads = current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.name(parameter) !== node &&
      current.source.navigation.sourceReferenceFor(node)?.declaration === parameter);
    assert.equal(reads.length > 0, true, "the checked body reads the real parameter");
    assert.equal(reads.every(node => isInt32(current.source.effectiveTypes.get(node))), true,
      "the body graph uses the chosen parameter width, not a late callable-only repair");
    const returned = current.source.effectiveTypes.callableReturn(callable);
    assert.equal(isInt32(returned) && returned?.kind !== "refused" && returned?.provenance.occurrence === callable, true);
    const value = current.source.effectiveTypes.get(callable);
    assert.equal(value !== undefined && value.kind !== "refused" && value.type.kind === "callable" &&
      value.type.calls[0]?.declaration === callable && value.type.calls[0].parameters[0]?.declaration === parameter &&
      value.type.calls[0].parameters[0].type.kind === "primitive" && value.type.calls[0].parameters[0].type.primitive === "int32" &&
      value.type.calls[0].result.kind === "primitive" && value.type.calls[0].result.primitive === "int32", true);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit" && row.required === callable);
    assert.equal(admissions.length, 1, "the actual return expression has one native admission against the declared result");
    assert.equal(admissions[0]?.type.kind === "primitive" && admissions[0].type.primitive === "int32" &&
      admissions[0].valueType?.kind === "primitive" && admissions[0].valueType.primitive === "int32", true);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  });
}

test("nested declared callables retain authored union order and async returns retain their full Promise", () => {
  const current = fixture(`const nested: () => () => string | int32 = () => () => 1 as int32;
    const asynchronous: (value: int32) => Promise<int32> = async value => value;`);
  const { ast } = current.source;
  const outer = ast.as.AsVariableDeclaration(current.declaration("nested"))?.Initializer;
  const inner = outer === undefined ? undefined : ast.body(outer);
  const asynchronous = ast.as.AsVariableDeclaration(current.declaration("asynchronous"))?.Initializer;
  if (inner === undefined || asynchronous === undefined) throw new Error("The actual checked callable occurrences are required.");
  const returned = current.source.effectiveTypes.callableReturn(inner);
  assert.equal(returned !== undefined && returned.kind !== "refused" && returned.type.kind === "union" &&
    returned.type.types.length === 2 && returned.type.types[0]?.kind === "string" &&
    returned.type.types[1]?.kind === "primitive" && returned.type.types[1].primitive === "int32", true,
    "declared union order comes from the authored result, never the order of inferred returns");
  const deferred = current.source.effectiveTypes.callableReturn(asynchronous);
  assert.equal(deferred !== undefined && deferred.kind !== "refused" && deferred.provenance.occurrence === asynchronous &&
    deferred.type.kind === "declared" && deferred.type.typeArguments.length === 1 &&
    deferred.type.typeArguments[0]?.kind === "primitive" && deferred.type.typeArguments[0].primitive === "int32", true,
    "the canonical callable return contains the complete Promise, not a target-wrapped payload");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("fixed heterogeneous parents retain inferred admission authority without admissions on reads or assignment patterns", () => {
  const current = fixture(`function run(): void {
    const values = ["text", 9007199254740993]; const alias = values; void alias;
    let first: number = 0; const declared: number[] = [1]; [first] = declared;
  }`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("values"))?.Initializer;
  if (literal === undefined) throw new Error("The actual heterogeneous construction is required.");
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const matching = admissions.filter(row => row.site === literal);
  const outcome = current.source.effectiveTypes.get(literal);
  assert.equal(matching.length, 1);
  assert.equal(matching[0]?.kind === "literal-admission" && matching[0].authority === "inferred" &&
    outcome !== undefined && outcome.kind !== "refused" && sourceTypeDescriptorsEqual(matching[0].type, outcome.type), true,
    "a fixed C8 parent carries its published type and actual inferred origin, never a fabricated declared origin");
  assert.equal(admissions.length, 2, "only the two real aggregate constructions request D2 admission");
  assert.equal(admissions.every(row => ast.is.IsArrayLiteralExpression(row.site)), true);
});

test("broad aggregate slots retain their final authored construction descriptors on the same outcomes", () => {
  const current = fixture(`const broad: object = { count: 1, label: "x", read(): int32 { return 1; }, get total(): int32 { return 2; } };
    const list: unknown = [1, 2]; const exact: { count: number } = { count: 1 };`);
  const { ast } = current.source;
  const initializer = (name: string): Node => {
    const node = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    if (node === undefined) throw new Error("The actual aggregate initializer is required.");
    return node;
  };
  const broad = initializer("broad");
  const outcome = current.source.effectiveTypes.get(broad);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
    outcome.type.intrinsic === "object" && outcome.construction?.kind === "shape", true);
  if (outcome === undefined || outcome.kind === "refused" || outcome.construction?.kind !== "shape") throw new Error("The final object construction is required.");
  const members = outcome.construction.members;
  assert.equal(members.length, 4);
  assert.equal(members.every(member => member.origin.kind === "declared" && ast.properties(broad).includes(member.origin.declaration)), true);
  assert.equal(members.find(member => member.name === "count")?.type.kind === "primitive", true);
  const read = members.find(member => member.name === "read");
  assert.equal(read?.type.kind === "callable" && read.type.calls[0]?.result.kind === "primitive" &&
    read.type.calls[0].result.primitive === "int32", true);
  const total = members.find(member => member.name === "total");
  assert.equal(total?.type.kind === "primitive" && total.type.primitive === "int32", true);
  assert.equal(Object.isFrozen(outcome.construction) && Object.isFrozen(members) && members.every(Object.isFrozen), true);
  assert.equal(outcome.memberCorrespondence === undefined, true, "a broad slot has construction metadata, not a declared-member correspondence");
  const list = current.source.effectiveTypes.get(initializer("list"));
  assert.equal(list !== undefined && list.kind !== "refused" && list.type.kind === "intrinsic" &&
    list.type.intrinsic === "unknown" && list.construction?.kind === "array" && list.construction.element.kind === "primitive" &&
    list.construction.element.primitive === "int64", true);
  const exact = current.source.effectiveTypes.get(initializer("exact"));
  assert.equal(exact !== undefined && exact.kind !== "refused" && exact.construction === undefined, true,
    "construction metadata is absent on every non-broad aggregate slot");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("literal member correspondence keeps real property, method, accessor and nested declaration identities", () => {
  const current = fixture(`const value: { count: int32; read(): int32; readonly total: int32; inner: { child: int32 } } = {
    count: 1, read() { return 1; }, get total(): int32 { return 2; }, inner: { child: 3 }
  }; const base: { count: number } = { count: 1 }; const spread: { count: number } = { ...base };`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  if (literal === undefined) throw new Error("The actual checked object literal is required.");
  const outcome = current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape", true);
  if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "shape") throw new Error("The actual chosen slot shape is required.");
  const pairs = outcome.memberCorrespondence;
  assert.equal(pairs?.length, 4);
  for (const property of ast.properties(literal)) {
    if (property === undefined) throw new Error("The actual authored member is required.");
    const pair: SourceLiteralMemberCorrespondence | undefined = pairs?.find(candidate => candidate.property === property);
    assert.equal(pair !== undefined && outcome.type.members.some(member =>
      sourceTypeDescriptorMemberOriginsEqual(member.origin, pair.origin)), true,
      "each correspondence names the same real destination declaration retained by its slot");
  }
  const nested = current.nodes.find(node => ast.is.IsObjectLiteralExpression(node) && ast.parent(node) !== undefined &&
    ast.is.IsPropertyAssignment(ast.parent(node)));
  const inner = nested === undefined ? undefined : current.source.effectiveTypes.get(nested);
  assert.equal(inner !== undefined && inner.kind !== "refused" && inner.memberCorrespondence?.length === 1 &&
    inner.memberCorrespondence[0]?.property === ast.properties(nested)[0], true, "nested literals own their own unflattened correspondence");
  const spread = ast.as.AsVariableDeclaration(current.declaration("spread"))?.Initializer;
  const spreadOutcome = spread === undefined ? undefined : current.source.effectiveTypes.get(spread);
  assert.equal(spreadOutcome !== undefined && spreadOutcome.kind !== "refused" && spreadOutcome.memberCorrespondence?.length === 0, true,
    "an applicable spread-only literal has an empty correspondence, never a record for its spread");
  assert.equal(pairs !== undefined && Object.isFrozen(pairs) && pairs.every(Object.isFrozen), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a later B2 fill transports the same checked member identity to its original construction", () => {
  const current = fixture(`function run(): void { const value = { count: 1 }; const required: { count: number } = value; }`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  const required = current.type("required");
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(required.kind === "shape" && outcome !== undefined && outcome.kind !== "refused" &&
    outcome.memberCorrespondence?.length === 1 && outcome.memberCorrespondence[0]?.property === ast.properties(literal)[0] &&
    required.members[0] !== undefined && sourceTypeDescriptorMemberOriginsEqual(outcome.memberCorrespondence[0]!.origin,
      required.members[0].origin), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("two later B2 fills cannot publish two different destination declarations for one authored member", () => {
  const current = fixture(`function run(): void { const value = { count: 1 };
    const first: { count: number } = value; const second: { count: number } = value; }`);
  const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_LOCAL_TYPE_CONFLICT" && literal !== undefined &&
    current.source.effectiveTypes.get(literal) === issues[0], true, "different chosen declarations are the same group's C4/C5 conflict");
});

test("literal admission retains its actual inferred or declared Source authority", () => {
  const current = fixture(`type Indexed = { readonly [key: string]: number };
    function run(): void { const inferred = [1, 2]; const declared: Indexed = { value: 1 }; }`);
  const { ast } = current.source;
  const inferred = ast.as.AsVariableDeclaration(current.declaration("inferred"))?.Initializer;
  const declared = ast.as.AsVariableDeclaration(current.declaration("declared"))?.Initializer;
  for (const [literal, authority] of [[inferred, "inferred"], [declared, "declared"]] as const) {
    assert.equal(literal !== undefined, true, "the actual construction exists in the checked source");
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(admissions.length, 1, "one canonical construction admission owns the Source authority");
    assert.equal(admissions[0]?.kind === "literal-admission" && admissions[0].authority === authority, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("contextual methods and accessors take their declared descriptors from checked member identity for every key form", () => {
  const current = fixture(`declare const token: unique symbol; const computed = "read" as const;
    const selected: { read(value: int32): int32; 1(value: int32): int32; "quoted key"(value: int32): int32;
      [token](value: int32): int32; readonly getter: int32; setter: int32 } = {
      [computed](value) { return value + value; }, 1(value) { return value + value; },
      "quoted key"(value) { return value + value; }, [token](value) { return value + value; },
      get getter() { return 1; }, get setter(): int32 { return 1; }, set setter(value) { void (value + value); }
    };`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  if (literal === undefined) throw new Error("The actual checked literal is required.");
  const members = ast.properties(literal).filter((node): node is Node => node !== undefined &&
    (ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node)));
  assert.equal(members.length, 7);
  for (const member of members) {
    const returned = current.source.effectiveTypes.callableReturn(member);
    assert.equal(returned !== undefined && returned.kind !== "refused" && returned.provenance.occurrence === member &&
      returned.type.kind === (ast.is.IsSetAccessorDeclaration(member) ? "intrinsic" : "primitive") &&
      (returned.type.kind === "intrinsic" ? returned.type.intrinsic === "void"
        : returned.type.kind === "primitive" && returned.type.primitive === "int32"), true,
    `member ${ast.pos(member)}: exact declared return`);
    for (const parameter of ast.parameters(member)) {
      const outcome = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
        outcome.type.primitive === "int32" && outcome.provenance.occurrence === parameter, true,
      `member ${ast.pos(member)}: exact declared parameter`);
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

function assertSameValue(actual: unknown, expected: unknown): void {
  assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}

test("an implicit class prototype retains its real binder-flag origin without changing the constructor value", () => {
  const current = fixture("const Make = class { value = 1; }; const item = new Make();");
  const { ast } = current.source;
  const owner = current.nodes.find(node => ast.is.IsClassExpression(node));
  if (owner === undefined) throw new Error("The actual runtime class expression is required.");
  const query = current.source.semantics.forNode(owner);
  const selectedType = query.types.expressionType(owner);
  if (selectedType === undefined) throw new Error("The checked constructor value type is required.");
  const properties = query.types.propertyInfos(selectedType).filter(property => (property.symbol.Flags & SymbolFlagsPrototype) !== 0);
  assert.equal(properties.length, 1);
  const property = properties[0]!;
  const declarations = query.declarations.symbolDeclarations(property.symbol);
  const outcome = current.source.effectiveTypes.get(owner);
  const prototype = outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape"
    ? outcome.type.members.find(member => member.origin.kind === "class-prototype" && member.origin.owner === owner) : undefined;
  console.log(`Source class-prototype tuple: ${JSON.stringify({ flags: property.symbol.Flags, declarationCount: declarations.length,
    origin: prototype?.origin.kind, ownerPosition: prototype?.origin.kind === "class-prototype" ? ast.pos(prototype.origin.owner) : undefined,
    type: prototype?.type.kind })}`);
  assert.equal(declarations.length, 0, "the binder-created property has no fabricated declaration");
  assert.equal(prototype?.origin.kind === "class-prototype" && prototype.origin.owner === owner &&
    prototype.type.kind === "declared" && prototype.type.declaration === owner, true);
  const relation = query.types.structuralMembers(selectedType, selectedType, "correspondence");
  const pair = relation.kind === "available" ? relation.members.find(pair => pair.kind === "present" &&
    pair.destination.property.symbol === property.symbol) : undefined;
  const origin = pair === undefined ? undefined : sourceTypeDescriptorMemberOrigin(current.source, query,
    pair.destination.property, pair.destination.receiverType);
  assert.equal(origin?.kind === "resolved" && prototype !== undefined &&
    sourceTypeDescriptorMemberOriginsEqual(origin.origin, prototype.origin), true,
  "constructor-value correspondence and descriptor inventory use the same real prototype symbol and origin");
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape" &&
    outcome.type.constructs.length === 1 && outcome.type.constructs[0]?.result.kind === "declared" &&
    outcome.type.constructs[0].result.declaration === owner, true, "the class expression remains its single constructor-value form");
  assert.equal(Object.isFrozen(prototype?.origin), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

for (const body of [
  `declare function take(value: (string | number)[]): void; function run(): void {
    const values = ["text", 9007199254740993, -9007199254740993, 1e100]; take(values); }`,
  `function run(): (string | number)[] {
    const values = ["text", 9007199254740993, -9007199254740993, 1e100]; return values; }`,
]) {
  test(`a retained declared group fill owns aggregate admission authority: ${body}`, () => {
    const current = fixture(body);
    const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("values"))?.Initializer;
    if (literal === undefined) throw new Error("The actual filled aggregate construction is required.");
    const outcome = current.source.effectiveTypes.get(literal);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(admissions.length, 1);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && admissions[0]?.kind === "literal-admission" &&
      admissions[0].authority === "declared" && sourceTypeDescriptorsEqual(outcome.type, admissions[0].type), true,
      "B2/C22 retains the chosen declared fill, not the unannotated syntax site's inferred default");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  });
}

test("numeric aggregate elements keep their D2 admissions without admitting unrelated scalar or call sites", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const scalar = 3; void values; void scalar; }");
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("values"))?.Initializer;
  const scalar = ast.as.AsVariableDeclaration(current.declaration("scalar"))?.Initializer;
  if (literal === undefined) throw new Error("The actual numeric aggregate is required.");
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  assert.equal(admissions.filter(row => row.site === literal).length, 1);
  for (const element of ast.elements(literal)) {
    const matching = admissions.filter(row => row.site === element);
    assert.equal(matching.length, 1, "each original numeric element remains a D2 input");
    assert.equal(matching[0]?.kind === "literal-admission" && matching[0].authority === "inferred", true);
  }
  assert.equal(admissions.some(row => row.site === scalar || ast.is.IsCallExpression(row.site)), false);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C14 every derived form preserves declaration-typed operands across the complete Source kind map", () => {
  const arithmetic = ["+", "-", "*", "/", "%", "**"];
  const integral = ["&", "|", "^", "<<", ">>", ">>>"];
  const comparisons = ["<", "<=", ">", ">=", "==", "!=", "===", "!=="];
  const logical = ["&&", "||", "??"];
  const compound = ["+=", "-=", "*=", "/=", "%=", "**=", "&=", "|=", "^=", "<<=", ">>=", ">>>=", "&&=", "||=", "??="];
  const operators = [
    ...[...arithmetic, ...integral, ...logical, ...compound].map(operator => ({
      label: operator, expression: `$left ${operator} $right`, expected: "int32",
    })),
    ...comparisons.map(operator => ({ label: operator, expression: `$left ${operator} $right`, expected: "bool" })),
    ...["+", "-", "~", "!"].map(operator => ({ label: `unary ${operator}`, expression: `${operator}$left`,
      expected: operator === "!" ? "bool" : "int32" })),
    ...["++", "--"].flatMap(operator => [
      { label: `prefix ${operator}`, expression: `${operator}$left`, expected: "int32" },
      { label: `postfix ${operator}`, expression: `$left${operator}`, expected: "int32" },
    ]),
    { label: "conditional", expression: "flag ? $left : $right", expected: "int32" },
    { label: "parenthesized", expression: "($left + $right)", expected: "int32" },
    { label: "comma", expression: "($left += 0, $right)", expected: "int32" },
    { label: "template", expression: "`${$left}:${$right}`", expected: "string" },
    { label: "typeof", expression: "typeof $left", expected: "string" },
    ...arithmetic.map(operator => ({ label: `fractional ${operator}`, expression: `$left ${operator} 0.5`, expected: "float64" })),
  ];
  const sources = [
    { name: "arrow", left: "left", right: "right", wrap: (body: string) =>
      `const arrow: (left: int32, right: int32) => void = (left, right) => { ${body} };` },
    { name: "expression", left: "left", right: "right", wrap: (body: string) =>
      `const expression: (left: int32, right: int32) => void = function(left, right) { ${body} };` },
    { name: "method", left: "left", right: "right", wrap: (body: string) =>
      `const method: { run(left: int32, right: int32): void } = { run(left, right) { ${body} } };` },
    { name: "setter", left: "left", right: "left", wrap: (body: string) =>
      `const setter: { value: int32 } = { set value(left) { ${body} }, get value(): int32 { return 1; } };` },
    { name: "getter", left: "left", right: "right", wrap: (body: string) =>
      `function getterSource(left: int32, right: int32): void { const getter: { readonly value: int32 } = {
        get value() { ${body} return left; } }; void getter; }` },
    { name: "async", left: "left", right: "right", wrap: (body: string) =>
      `const asynchronous: (left: int32, right: int32) => Promise<void> = async (left, right) => { ${body} };` },
    { name: "annotated", left: "left", right: "right", wrap: (body: string) =>
      `function annotated(left: int32, right: int32): void { ${body} }` },
    { name: "object_binding", left: "left", right: "right", wrap: (body: string) =>
      `function objectBinding({ left, right }: { left: int32; right: int32 }): void { ${body} }` },
    { name: "array_binding", left: "left", right: "right", wrap: (body: string) =>
      `function arrayBinding([left, right]: [int32, int32]): void { ${body} }` },
    { name: "rest", left: "values[0]", right: "values[1]", wrap: (body: string) =>
      `function rest(...values: int32[]): void { ${body} }` },
    { name: "default", left: "left", right: "right", wrap: (body: string) =>
      `function defaults(left: int32 = 1, right: int32 = 2): void { ${body} }` },
    { name: "contextual_default", left: "left", right: "right", wrap: (body: string) =>
      `const contextualDefaults: (left?: int32, right?: int32) => void = (left = 1, right = 2) => { ${body} };` },
    { name: "local", left: "left", right: "right", wrap: (body: string) =>
      `function locals(): void { let left: int32 = 1; let right: int32 = 2; ${body} }` },
    { name: "field", left: "this.left", right: "this.right", wrap: (body: string) =>
      `class Fields { left: int32 = 1; right: int32 = 2; run(): void { ${body} } }` },
    { name: "api", left: "input.length", right: "other.length", wrap: (body: string) =>
      `function api(input: { length: int32 }, other: { length: int32 }): void { ${body} }` },
  ];
  const current = fixture(`declare const flag: boolean; ${sources.map(source => source.wrap(operators.map((operator, index) =>
    `const cell_${source.name}_${index} = ${operator.expression.split("$left").join(source.left).split("$right").join(source.right)};`
  ).join("\n"))).join("\n")}`);
  const refusedOperators = new Set([
    "&&", "||", "&&=", "||=", // C2325: Native operator-validation.ts:47-51 rejects numeric logical operands.
    "unary !", // C2325: Native operator-validation.ts:111-114 rejects numeric logical negation.
    "??", "??=", // C2325: Native operator-validation.ts:40-44 rejects a never-absent left operand.
    "**", "**=", "fractional **", // C2325: Native rules.ts:163-172 and :441-480 have no power translation.
  ]);
  for (const source of sources) for (const [index, operator] of operators.entries()) {
    const declaration = current.declaration(`cell_${source.name}_${index}`);
    const expression = current.source.ast.as.AsVariableDeclaration(declaration)?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    if (refusedOperators.has(operator.label)) {
      assert.equal(expression !== undefined && outcome?.kind === "refused" && outcome.site === expression &&
        outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" && outcome.reason.length > 0, true,
      `${source.name}: ${operator.label} has its one precise Host refusal`);
      assert.equal(current.source.effectiveTypes.refusals().filter(issue => issue.site === expression && issue === outcome).length, 1,
        `${source.name}: ${operator.label} has one original-site refusal`);
      continue;
    }
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && (operator.expected === "string"
      ? outcome.type.kind === "string" : outcome.type.kind === "primitive" && outcome.type.primitive === operator.expected), true,
    `${source.name}: ${operator.label}`);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.occurrence === expression, true,
      `${source.name}: ${operator.label} keeps the exact derived occurrence`);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, sources.length * refusedOperators.size,
    "all accepted declaration-typed cells stay unchanged and every signed rejected cell has one Host refusal");
});

test("C24 runtime parameters have groups while bodyless and type-only signatures retain only declared metadata", () => {
  const current = fixture(`declare function external(value: int32): int32;
    function overloaded(value: int32): int32; function overloaded(value: int32): int32 { return value; }
    abstract class Base { abstract run(value: int32): int32; abstract get value(): int32; abstract set value(next: int32); }
    class Concrete extends Base { constructor(value: int32 = 1) { super(); void value; }
      run(value: int32): int32 { return value; } get value(): int32 { return 1; } set value(next: int32) { void next; } }
    interface Invocable { (value: int32): int32; new(value: int32): object; run(value: int32): int32; }
    type Callable = (value: int32) => int32; type Constructable = new(value: int32) => object;
    type Generic = <Value>(genericValue: Value) => Value;
    interface GenericMethod { select<Value>(genericValue: Value): Value; }
    declare function generic<Value>(genericValue: Value): Value;
    const arrow: Callable = value => value; const expression: Callable = function(value) { return value; };
    const asynchronous: (value: int32) => Promise<int32> = async value => value;
    function patterned({ value }: { value: int32 }, ...rest: int32[]): int32 { return value + rest[0]; }`);
  const { ast } = current.source;
  const context = createSourceTypeFlowAnalysisContext(current.source).context;
  const graph = collectSourceTypeFlowEdges(context);
  const parameters = current.nodes.filter(node => ast.is.IsParameterDeclaration(node));
  assert.equal(parameters.length > 15, true, "the fixture spans bodyless, overload, runtime and type-only signatures");
  for (const parameter of parameters) {
    const owner = ast.parent(parameter);
    const runtime = owner !== undefined && ast.body(owner) !== undefined;
    const record = graph.nodes.find(record => record.node === parameter);
    assert.equal(runtime ? record !== undefined && graph.roots.includes(record.root) : record === undefined, true,
      `parameter ${ast.pos(parameter)} has a runtime group if and only if its callable has a body`);
    const outcome = current.source.effectiveTypes.get(parameter);
    if (runtime) assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.occurrence === parameter, true,
      `runtime parameter ${ast.pos(parameter)} is the same checked declaration`);
    const type = runtime ? outcome !== undefined && outcome.kind !== "refused" ? outcome.type : undefined : context.describe(parameter);
    const name = ast.name(parameter);
    if (name !== undefined && ast.is.IsIdentifier(name) && ast.text(name) === "genericValue") {
      const binder = owner === undefined ? undefined : ast.typeParameters(owner)[0];
      assert.equal(type?.kind === "declared" && type.declaration === binder && type.typeArguments.length === 0, true,
      "an actual formal parameter retains its unbound binder identity, never a caller's instantiated value");
      continue;
    }
    if (name !== undefined && ast.is.IsIdentifier(name) && ast.text(name) === "rest") {
      assert.equal(type?.kind === "array" && type.element.kind === "primitive" && type.element.primitive === "int32", true,
      "the actual rest parameter retains its complete declared array descriptor");
    }
    if (name !== undefined && ast.is.IsIdentifier(name) && ast.text(name) !== "rest") {
      assert.equal(type?.kind === "primitive" && type.primitive === "int32", true, `parameter ${ast.pos(parameter)} retains its declared width`);
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("comma value selection keeps only the right operand while retaining left effects and closed derived kinds", () => {
  const cases = [
    ["integer", "int32", "primitive", "int32"], ["single", "float32", "primitive", "float32"],
    ["boolean", "boolean", "primitive", "bool"], ["text", "string", "string", ""],
    ["optional", "int32 | undefined", "optional", ""], ["array", "int32[]", "array", ""],
    ["tuple", "readonly [int32, float32]", "tuple", ""], ["nominal", "Data", "declared", ""],
  ] as const;
  const current = fixture(`class Data { value: int32 = 1; }
    ${cases.map(([name, type]) => `function comma_${name}(left: float32, right: ${type}): void {
      const selected_${name} = (left++, (left++, right)); void selected_${name}; }`).join("\n")}
    export function written(): number { let value = 0; return (value++, value + 1); }
    declare function take(values: number[]): void;
    function unbound(left: float32): void { const selected_unbound = (left++, []); take(selected_unbound); }
    function declared(left: float32): number[] { return (left++, []); }`);
  for (const [name, , kind, primitive] of cases) {
    const type = current.type(`selected_${name}`);
    assert.equal(type.kind === kind && (type.kind !== "primitive" || type.primitive === primitive), true, name);
  }
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  for (const derived of graph.derived.filter(derived => derived.operator === "sequence")) {
    const binary = ast.as.AsBinaryExpression(derived.node);
    assert.equal(derived.operands.length === 1 && derived.operands[0]?.node === binary?.Right, true,
      "a comma has exactly its actual right operand as a value-type dependency, never its left effect");
  }
  const written = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "written");
  const body = written === undefined ? undefined : ast.body(written);
  const returned = body === undefined ? undefined : ast.children(body).find(node => node !== undefined && ast.is.IsReturnStatement(node));
  const expression = returned === undefined ? undefined : ast.as.AsReturnStatement(returned)?.Expression;
  const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "int64", true,
    "the exact written return keeps the right derived kind; declared number conversion remains target admission");
  assertSameValue(current.type("selected_unbound"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("generic binder fills retain declared authority for direct and aliased fixed arrays and objects without certifying inferred calls", () => {
  const cases = ["identity", "freeze"].flatMap(call => ["array", "object"].flatMap(form =>
    [false, true].flatMap(alias => ["declared", "inferred"].map(authority => ({
      call, form, alias, authority, name: `${call}_${form}_${alias ? "alias" : "direct"}_${authority}`,
    })))));
  const current = fixture(`type Values = (string | number)[]; type Data = { marker: string; value: number };
    type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
    declare function identity<Value>(value: Value): Value; declare function freeze<Value>(value: Value): Locked<Value>;
    const key = "value" as const;
    ${cases.map(row => {
      const literal = row.form === "array" ? `[${JSON.stringify(row.name)}, 9007199254740993]`
        : `{ marker: ${JSON.stringify(row.name)}, [key]: 9007199254740993 }`;
      const type = row.form === "array" ? "Values" : "Data";
      const annotation = row.authority === "inferred" ? "" : `: ${row.call === "freeze" ? `Locked<${type}>` : type}`;
      return `function ${row.name}(): void { ${row.alias ? `const source = ${literal};` : ""}
        const selected${annotation} = ${row.call}(${row.alias ? "source" : literal}); void selected; }`;
    }).join("\n")}`);
  const { ast } = current.source;
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const observations = cases.map(row => {
    const token = current.nodes.find(node => ast.is.IsStringLiteral(node) && ast.text(node) === row.name);
    let literal = token === undefined ? undefined : ast.parent(token);
    while (literal !== undefined && !(ast.is.IsArrayLiteralExpression(literal) || ast.is.IsObjectLiteralExpression(literal))) literal = ast.parent(literal);
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const matching = admissions.filter(admission => admission.site === literal);
    return { row, literal, outcome, matching };
  });
  for (const { row, literal, outcome, matching } of observations) {
    console.log("C2288.generic-fill " + JSON.stringify({ name: row.name, expected: row.authority,
      found: literal !== undefined, outcome: outcome?.kind ?? "absent", count: matching.length,
      actual: matching[0]?.authority ?? "absent",
      sameDescriptor: outcome !== undefined && outcome.kind !== "refused" && matching[0]?.type === outcome.type }));
  }
  for (const { row, literal, outcome, matching } of observations) {
    assert.equal(literal !== undefined && outcome !== undefined && outcome.kind !== "refused" && matching.length === 1, true, row.name);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && matching[0]?.authority === row.authority &&
      matching[0].type === outcome.type, true, row.name);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("declared destination records cover normalized kinds without reflecting containers as member shapes", () => {
  const forms = [
    { name: "declared", type: "Face", forms: ["object"], kind: "declared", fill: true },
    { name: "array", type: "(string | number)[]", forms: ["array"], kind: "array", fill: true },
    { name: "readonly_array", type: "readonly (string | number)[]", forms: ["array", "tuple"], kind: "array", fill: true },
    { name: "tuple", type: "readonly [string, number]", forms: ["tuple"], kind: "tuple", fill: true },
    { name: "union", type: "readonly (string | number)[] | { readonly marker: string; readonly value: number }",
      forms: ["array", "object", "tuple"], kind: "union", fill: true },
    { name: "primitive", type: "number", forms: ["scalar"], kind: "primitive", fill: true },
    { name: "optional", type: "readonly (string | number)[] | undefined", forms: ["array", "tuple"], kind: "optional", fill: true },
    { name: "shape", type: "{ marker: string; value: number }", forms: ["object"], kind: "shape", fill: true },
    { name: "callable", type: "(value: number) => number", forms: ["callable"], kind: "callable", fill: true },
  ] as const;
  const cases = forms.flatMap(input => input.forms.flatMap(form => ["identity", "freeze"].flatMap(call =>
    [false, true].map(alias => ({ ...input, form, call, alias,
      name: `destination_${input.name}_${form}_${call}_${alias ? "alias" : "direct"}` })))));
  const current = fixture(`interface Face { marker: string; value: number }
    type Locked<Input> = { readonly [Key in keyof Input]: Input[Key] };
    declare function identity<Input>(value: Input): Input;
    declare function freeze<Input>(value: Input): Locked<Input>;
    ${cases.map(row => {
      const literal = row.form === "array" ? `[${JSON.stringify(row.name)}, 1.5]`
        : row.form === "tuple" ? `[${JSON.stringify(row.name)}, 1.5] as const`
        : row.form === "object" ? `{ marker: ${JSON.stringify(row.name)}, value: 1.5 }`
        : row.form === "scalar" ? "1.5" : "(value: number) => value";
      const target = row.call === "freeze" ? `Locked<${row.type}>` : row.type;
      return `function ${row.name}(): void { ${row.alias ? `const input_${row.name} = ${literal};` : ""}
        const selected_${row.name}: ${target} = ${row.call}(${row.alias ? `input_${row.name}` : literal});
        void selected_${row.name}; }`;
    }).join("\n")}`);
  const { ast } = current.source;
  const defaults = createSourceTypeFlowAnalysisContext(current.source);
  const graph = collectSourceTypeFlowEdges(defaults.context);
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const observations = cases.map(row => {
    const declaration = current.declaration(`selected_${row.name}`);
    const described = defaults.context.describe(declaration);
    const record = graph.nodes.find(record => record.node === declaration);
    const reads = current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.name(declaration) !== node &&
      current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
    const readRecords = reads.map(node => graph.nodes.find(record => record.node === node));
    let normalized = described;
    const visited = new Set<SourceTypeDescriptor>();
    while (normalized?.kind === "declared" && normalized.definition !== undefined && !visited.has(normalized)) {
      visited.add(normalized);
      normalized = normalized.definition;
    }
    const token = current.nodes.find(node => ast.is.IsStringLiteral(node) && ast.text(node) === row.name);
    let literal = token === undefined ? undefined : ast.parent(token);
    while (literal !== undefined && !(ast.is.IsArrayLiteralExpression(literal) || ast.is.IsObjectLiteralExpression(literal))) {
      literal = ast.parent(literal);
    }
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const matching = admissions.filter(admission => admission.site === literal);
    return { row, declaration, described, record, reads, readRecords, normalized, literal, outcome, matching };
  });
  for (const { row, described, record, normalized, matching } of observations) {
    console.log("C2306.destination " + JSON.stringify({ name: row.name, described: described?.kind ?? "absent",
      normalized: normalized?.kind ?? "absent", record: record?.kind ?? "absent",
      count: matching.length, authority: matching[0]?.authority ?? "absent" }));
  }
  for (const { row, described, record, reads, readRecords, normalized, literal, outcome, matching } of observations) {
    assert.equal(described !== undefined && record?.kind === "fixed" && record.term?.kind === "fixed" &&
      sourceTypeDescriptorsEqual(record.term.type, described), true, row.name + ": declared destination record");
    assert.equal(reads.length > 0 && readRecords.every((read, index) => {
      const flow = defaults.context.describe(reads[index]!);
      return read?.kind === "fixed" && read.term?.kind === "fixed" && flow !== undefined &&
        sourceTypeDescriptorsEqual(read.term.type, flow);
    }), true, row.name + ": declared reads");
    const expected = row.kind === "declared" ? row.call === "identity" ? "declared" : "shape"
      : row.call === "freeze" && row.kind === "callable" ? "shape" : row.kind;
    const actual = row.kind === "declared" && row.call === "identity" ? described?.kind : normalized?.kind;
    assert.equal(actual === expected, true, row.name + ": normalized descriptor");
    if (literal !== undefined && row.fill) {
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && matching.length === 1 &&
        matching[0]?.authority === "declared" && matching[0].type === outcome.type, true,
        row.name + ": one declared admission with the identical published descriptor");
    }
  }
});

test("construction-family union and optional demands use the one immediate C30 kind selector", () => {
  const cases = [
    { name: "unique_array_union", declaration: "declare function take(value: { count: int32 } | readonly number[]): void;",
      use: "take(ARGUMENT)", refused: false },
    { name: "ambiguous_arrays", declaration: "declare function take(value: number[] | string[]): void;",
      use: "take(ARGUMENT)", refused: true },
    { name: "unique_optional", declaration: "declare function identity<Value>(value: Value): Value;",
      use: "const selected: int32[] | undefined = identity(ARGUMENT); void selected", refused: false },
    { name: "mapped_result_union", declaration: `type Values = number[];
      type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
      declare function freeze<Value>(value: Value): Locked<Value>;`,
      use: "const selected: Locked<Values> | string = freeze(ARGUMENT); void selected", refused: false },
    { name: "nullable_union", declaration: "declare function take(value: number[] | string | undefined): void;",
      use: "take(ARGUMENT)", refused: false },
    { name: "optional_ambiguous", declaration: "declare function take(value: number[] | string[] | undefined): void;",
      use: "take(ARGUMENT)", refused: true },
    { name: "no_array_arm", declaration: "declare function take(value: {} | string): void;",
      use: "take(ARGUMENT)", refused: true },
  ] as const;
  for (const row of cases) for (const alias of [false, true]) {
    const name = row.name + (alias ? ":alias" : ":direct");
    const argument = alias ? "source" : "[1, 2]";
    const current = fixture(`${row.declaration} function run(): void {
      ${alias ? "const source = [1, 2];" : ""} ${row.use.split("ARGUMENT").join(argument)}; }`);
    const { ast } = current.source;
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const issues = current.source.effectiveTypes.refusals();
    if (row.refused) {
      assert.equal(literal !== undefined && outcome?.kind === "refused" &&
        outcome.site === literal && outcome.code === "TSONIC_LOCAL_TYPE_UNION", true, name);
      assert.equal(issues.length === 1 && issues[0] === outcome, true, name + ": one original construction-site refusal");
    } else {
      const admissions = current.source.effectiveTypes.obligations().filter(obligation =>
        obligation.kind === "literal-admission" && obligation.site === literal);
      assert.equal(literal !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
        admissions.length === 1 && admissions[0]?.kind === "literal-admission" && admissions[0].authority === "declared" && admissions[0].type === outcome.type,
        true, name + ": one declared admission of the identical selected descriptor");
      assert.equal(issues.length, 0, name);
    }
  }
});

test("one homomorphic inversion covers every normalized input and each authored or checked caller source", () => {
  const forms = [
    { name: "object", type: "{ count: int32 }" }, { name: "interface", type: "Face" },
    { name: "class", type: "Value" }, { name: "array", type: "int32[]" },
    { name: "readonly_array", type: "readonly int32[]" },
    { name: "tuple", type: "[int32, string?, ...boolean[]]" },
    { name: "union", type: "{ left: int32 } | { right: string }" },
    { name: "int32", type: "int32" }, { name: "string", type: "string" },
    { name: "boolean", type: "boolean" }, { name: "bigint", type: "bigint" },
    { name: "symbol", type: "symbol" }, { name: "type_parameter", type: "Model" },
    { name: "any", type: "any" }, { name: "unknown", type: "unknown" },
  ];
  const inputs = forms.map(form => ({ ...form, transform: "Locked", invertible: form.name !== "any" && form.name !== "unknown" }))
    .concat([{ name: "alias_of_alias", type: "int32[]", transform: "L2", invertible: true },
      { name: "non_homomorphic", type: "int32[]", transform: "NonHomomorphic", invertible: false }]);
  const cases = inputs.flatMap(input => [false, true].flatMap(alias => [false, true].map(declared => ({
    ...input, alias, declared, name: `${input.name}_${alias ? "alias" : "direct"}_${declared ? "declared" : "inferred"}`,
  }))));
  const current = fixture(`interface Face { count: int32 } class Value { count: int32 = 1; }
    type Locked<Input> = { readonly [Key in keyof Input]: Input[Key] };
    type L2<Input> = Locked<Input>; type NonHomomorphic<Input> = { [Key in "a"]: Input };
    declare function freeze<Input>(value: Input): Locked<Input>;
    declare function indirect<Input>(value: Input): L2<Input>;
    declare function nonHomomorphic<Input>(value: Input): NonHomomorphic<Input>;
    ${cases.map(row => `function ${row.name}<Model>(input: ${row.type}): void {
      ${row.alias ? "const copied = input;" : ""}
      const selected${row.declared ? `: ${row.transform}<${row.type}>` : ""} =
        ${row.transform === "L2" ? "indirect" : row.transform === "NonHomomorphic" ? "nonHomomorphic" : "freeze"}(${row.alias ? "copied" : "input"});
      void selected;
    }`).join("\n")}`);
  const { ast } = current.source;
  const observations = cases.map(row => {
    const owner = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === row.name);
    const parameter = owner === undefined ? undefined : ast.parameters(owner)[0];
    const expectedNode = parameter === undefined ? undefined : ast.typeNode(parameter);
    const selected = current.nodes.find(node => {
      if (!ast.is.IsVariableDeclaration(node) || ast.text(ast.name(node)) !== "selected") return false;
      for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
        if (ast.is.IsFunctionDeclaration(parent)) return parent === owner;
      }
      return false;
    });
    const call = selected === undefined ? undefined : ast.as.AsVariableDeclaration(selected)?.Initializer;
    const authored = selected === undefined ? undefined : ast.typeNode(selected);
    const queries = owner === undefined ? undefined : current.source.semantics.forNode(owner);
    const evidence = call === undefined ? undefined : queries?.operations.call(call);
    const expected = expectedNode === undefined ? undefined : queries?.types.authoredType(expectedNode);
    const application = evidence === undefined ? undefined : queries?.types.aliasApplication(evidence.sourceResultType);
    const input = evidence === undefined || queries === undefined ? undefined :
      sourceTypeFlowHomomorphicInput(current.source, queries, evidence.sourceResultType, authored);
    const shouldInvert = row.invertible && (row.declared || application?.kind === "direct");
    const matches = input !== undefined && expected !== undefined && queries?.types.isIdentical(input, expected) === true;
    console.log("C2299.homomorphic-form " + JSON.stringify({ name: row.name,
      source: row.declared ? "authored-reference" : "checked-application",
      aliasApplication: application?.kind ?? "absent",
      typeKind: evidence === undefined || queries === undefined ? "absent" :
        queries.types.isTuple(evidence.sourceResultType) ? "tuple" :
        queries.types.isArrayLike(evidence.sourceResultType) ? "array" :
        queries.types.isUnion(evidence.sourceResultType) ? "union" :
        queries.types.isAny(evidence.sourceResultType) ? "any" :
        queries.types.isUnknown(evidence.sourceResultType) ? "unknown" :
        queries.types.isNumberLike(evidence.sourceResultType) || queries.types.isStringLike(evidence.sourceResultType) ||
        queries.types.isBooleanLike(evidence.sourceResultType) || queries.types.isBigIntLike(evidence.sourceResultType) ||
        queries.types.isSymbolLike(evidence.sourceResultType) ? "primitive" : "object",
      inverted: input !== undefined, matches, shouldInvert }));
    return { row, selected, call, expected, input, matches, shouldInvert };
  });
  for (const { row, selected, call, expected, input, matches, shouldInvert } of observations) {
    assert.equal(selected !== undefined && call !== undefined && expected !== undefined, true, row.name);
    assert.equal(input !== undefined, shouldInvert, row.name);
    assert.equal(matches, shouldInvert, row.name);
  }
});

test("canonical member-origin equality distinguishes every finite key without display-name matching", () => {
  const current = fixture(`declare const first: unique symbol; declare const second: unique symbol;
    class First {} class Second {}
    type Left = { [Key in "left"]: number }; type Right = { [Key in "right"]: number };`);
  const first = current.declaration("first");
  const second = current.declaration("second");
  const classes = current.nodes.filter(node => current.source.ast.is.IsClassDeclaration(node));
  const mapped = current.nodes.filter(node => current.source.ast.is.IsMappedTypeNode(node));
  if (classes.length !== 2 || mapped.length !== 2) throw new Error("The actual class and mapped declaration identities are required.");
  const firstClass = classes[0]!; const secondClass = classes[1]!;
  const firstMapped = mapped[0]!; const secondMapped = mapped[1]!;
  type Origin = SourceTypeDescriptorMember["origin"];
  const cases: readonly { readonly name: string; readonly left: Origin; readonly right: Origin; readonly equal: boolean }[] = [
    { name: "declared_same", left: { kind: "declared", declaration: first }, right: { kind: "declared", declaration: first }, equal: true },
    { name: "declared_distinct", left: { kind: "declared", declaration: first }, right: { kind: "declared", declaration: second }, equal: false },
    { name: "prototype_same", left: { kind: "class-prototype", owner: firstClass }, right: { kind: "class-prototype", owner: firstClass }, equal: true },
    { name: "prototype_distinct", left: { kind: "class-prototype", owner: firstClass }, right: { kind: "class-prototype", owner: secondClass }, equal: false },
    { name: "origin_kind", left: { kind: "declared", declaration: first }, right: { kind: "class-prototype", owner: firstClass }, equal: false },
    { name: "string_same", left: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "left" } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "left" } }, equal: true },
    { name: "string_distinct", left: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "left" } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "right" } }, equal: false },
    { name: "number_same", left: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 1 } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 1 } }, equal: true },
    { name: "number_distinct", left: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 1 } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 2 } }, equal: false },
    { name: "signed_zero", left: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: -0 } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 0 } }, equal: false },
    { name: "key_kind", left: { kind: "mapped", owner: firstMapped, key: { kind: "number", value: 1 } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "1" } }, equal: false },
    { name: "symbol_same", left: { kind: "mapped", owner: firstMapped, key: { kind: "unique-symbol", declaration: first } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "unique-symbol", declaration: first } }, equal: true },
    { name: "symbol_distinct", left: { kind: "mapped", owner: firstMapped, key: { kind: "unique-symbol", declaration: first } }, right: { kind: "mapped", owner: firstMapped, key: { kind: "unique-symbol", declaration: second } }, equal: false },
    { name: "mapped_owner", left: { kind: "mapped", owner: firstMapped, key: { kind: "string", value: "left" } }, right: { kind: "mapped", owner: secondMapped, key: { kind: "string", value: "left" } }, equal: false },
  ];
  for (const row of cases) {
    assert.equal(sourceTypeDescriptorMemberOriginsEqual(row.left, row.right), row.equal, row.name);
    assert.equal(sourceTypeDescriptorMemberOriginsEqual(row.right, row.left), row.equal, row.name + ": symmetric");
  }
});

test("descriptor inventories and checked literal pairs share one origin producer for every finite mapped key", () => {
  const current = fixture(`declare const first: unique symbol; declare const second: unique symbol;
    type Data = { left: int32; right: int32 };
    type Flags = { [Key in "left" | "right"]: number };
    type Numbers = { [Key in 1 | 2]: number };
    type Symbols = { [Key in typeof first | typeof second]: number };
    type Renamed<Input> = { [Key in keyof Input as \`get_\${Key & string}\`]: Input[Key] };
    const declared: Data = { left: 1, right: 2 };
    const flags: Flags = { left: 1, right: 2 };
    const record: Record<"left" | "right", number> = { left: 1, right: 2 };
    const numbers: Numbers = { 1: 1, 2: 2 };
    const symbols: Symbols = { [first]: 1, [second]: 2 };
    const partial: Partial<Data> = { left: 1, right: 2 };
    const readonly: Readonly<Data> = { left: 1, right: 2 };
    const renamed: Renamed<Data> = { get_left: 1, get_right: 2 };`);
  const { ast } = current.source;
  for (const name of ["declared", "flags", "record", "numbers", "symbols", "partial", "readonly", "renamed"]) {
    const declaration = current.declaration(name);
    const literal = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    const annotation = ast.typeNode(declaration);
    const queries = current.source.semantics.forNode(declaration);
    const destination = annotation === undefined ? undefined : queries.types.authoredType(annotation);
    const source = literal === undefined ? undefined : queries.types.expressionType(literal);
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && source !== undefined && destination !== undefined, true, name);
    if (outcome === undefined || outcome.kind === "refused" || source === undefined || destination === undefined) continue;
    let descriptor = outcome.type;
    while (descriptor.kind === "declared" && descriptor.definition !== undefined) descriptor = descriptor.definition;
    assert.equal(descriptor.kind === "shape", true, name);
    if (descriptor.kind !== "shape") continue;
    const correspondence = queries.types.structuralMembers(source, destination, "correspondence");
    assert.equal(correspondence.kind === "available", true, name);
    if (correspondence.kind !== "available") continue;
    const properties = queries.types.propertyInfos(destination);
    assert.equal(properties.length, 2, name);
    for (const property of properties) {
      const pair: SourceStructuralMemberPair | undefined = correspondence.members.find(candidate => candidate.kind === "present" && candidate.destination.property.symbol === property.symbol);
      assert.equal(pair !== undefined, true, name + ": same destination inventory symbol");
      if (pair === undefined) continue;
      const origin = sourceTypeDescriptorMemberOrigin(current.source, queries, pair.destination.property, pair.destination.receiverType);
      assert.equal(origin?.kind === "resolved", true, name);
      if (origin?.kind !== "resolved") continue;
      const matches: readonly SourceTypeDescriptorMember[] = descriptor.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
      assert.equal(matches.length, 1, name + ": one inventory origin");
      const published: readonly SourceLiteralMemberCorrespondence[] | undefined = outcome.memberCorrespondence?.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
      assert.equal(published?.length, 1, name + ": one authored correspondence");
      assert.equal(origin.origin.kind, ["declared", "partial", "readonly"].includes(name) ? "declared" : "mapped", name);
      assert.equal(Object.isFrozen(matches[0]?.origin), true, name);
      if (origin.origin.kind === "mapped") assert.equal(Object.isFrozen(matches[0]?.origin.kind === "mapped" ? matches[0].origin.key : undefined), true, name);
    }
  }
});

test("non-single mapped keys refuse complete used, unused and nested value descriptors at the original value", () => {
  const forms = [
    { name: "equal_enum_values", source: 'enum A { X = "x" } enum B { Y = "x" } type Collision = { [Key in A | B]: number };', key: "x" },
    { name: "many_to_one_rename", source: 'type Rename<Input> = { [Key in keyof Input as "same"]: Input[Key] }; type Collision = Rename<{ a: number; b: number }>;', key: "same" },
    { name: "numeric_string_collision", source: 'type Collision = { [Key in 1 | "1"]: number };', key: "1" },
  ];
  for (const form of forms) for (const used of [false, true]) for (const nested of [false, true]) {
    const name = `${form.name}_${used ? "used" : "unused"}_${nested ? "nested" : "direct"}`;
    const current = fixture(`${form.source} declare const value: ${nested ? "{ inner: Collision }" : "Collision"};
      ${used ? `const read = value${nested ? ".inner" : ""}[${JSON.stringify(form.key)}];` : ""}`);
    const declaration = current.declaration("value");
    const mapped = current.nodes.find(node => current.source.ast.is.IsMappedTypeNode(node));
    const outcome = current.source.effectiveTypes.get(declaration);
    const issues = current.source.effectiveTypes.refusals().filter(issue => issue.site === declaration);
    assert.equal(outcome?.kind === "refused" && outcome.code === "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE" &&
      outcome.site === declaration && outcome.related === mapped, true, name);
    assert.equal(issues.length, 1, name + ": one value refusal");
    assert.equal(outcome?.kind === "refused" && outcome.reason.includes(form.key) && !("type" in outcome), true, name + ": no partial descriptor");
    assert.equal(current.nodes.filter(node => current.source.ast.is.IsElementAccessExpression(node)).every(node =>
      !current.source.effectiveTypes.refusals().some(issue => issue.site === node && issue.code === "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE")), true,
    name + ": receiver refusal is not recreated at the member use");
  }
});

test("a retained B2 correspondence does not invent a destination for an unmatched authored property", () => {
  const current = fixture("function run(): void { const value = { count: 1, extra: 2 }; const required: { count: number } = value; }");
  const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.memberCorrespondence?.length === 1 &&
    current.source.ast.text(current.source.ast.name(outcome.memberCorrespondence[0]?.property)) === "count", true);
});

test("broad array constructions consume the checked spread element projection for every iterable form", () => {
  const forms = [
    { name: "array", type: "number[]", element: "number" },
    { name: "readonly_array", type: "readonly number[]", element: "number" },
    { name: "tuple", type: "readonly [number, string]", element: "union" },
    { name: "string", type: "string", element: "string" },
    { name: "iterable", type: "Iterable<number>", element: "number" },
    { name: "set", type: "Set<number>", element: "number" },
    { name: "map_keys", type: "IterableIterator<number>", element: "number" },
    { name: "map_values", type: "IterableIterator<string>", element: "string" },
    { name: "map_entries", type: "IterableIterator<[number, string]>", element: "tuple" },
    { name: "generator", type: "Generator<number, void, unknown>", element: "number" },
  ];
  for (const form of forms) {
    const current = fixture(`function run(input: ${form.type}): object { const value: object = [...input]; return value; }`);
    const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
    const spread = literal === undefined ? undefined : current.source.ast.elements(literal)[0];
    const queries = spread === undefined ? undefined : current.source.semantics.forNode(spread);
    const iteration = spread === undefined ? undefined : queries?.operations.iteration(spread);
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(iteration?.subject.kind === "spread" && iteration.subject.node === spread &&
      !("iterationKind" in iteration) && !("mechanism" in iteration), true, form.name);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
      outcome.type.intrinsic === "object" && outcome.construction?.kind === "array", true, form.name);
    if (outcome === undefined || outcome.kind === "refused" || outcome.construction?.kind !== "array") continue;
    const element = outcome.construction.element;
    assert.equal(form.element === "number" ? element.kind === "primitive" && element.primitive === "float64"
      : element.kind === form.element, true, form.name);
    if (element.kind === "tuple") assert.equal(element.elements.length === 2 &&
      element.elements.every(element => element.kind === "required"), true, form.name);
    if (element.kind === "union") assert.equal(element.types.length, 2, form.name);
  }
});

test("C30 and B2 authority uses the declared slot while every B4 or inferred slot stays inferred", () => {
  const cases: readonly { readonly name: string; readonly authority: "declared" | "inferred";
    readonly program: (literal: string) => string }[] = [
    { name: "typed_parameter", authority: "declared", program: literal => `function typed(): void { take(${literal}); }` },
    { name: "later_parameter", authority: "declared", program: literal => `function later(): void { const values = ${literal}; take(values); }` },
    { name: "annotated_variable", authority: "declared", program: literal => `function variable(): void { const values: Values = ${literal}; void values; }` },
    { name: "annotated_field", authority: "declared", program: literal => `class AnnotatedField { value: Values = ${literal}; }` },
    { name: "annotated_property", authority: "declared", program: literal => `const property: { value: Values } = { value: ${literal} };` },
    { name: "declared_return", authority: "declared", program: literal => `function returned(): Values { return ${literal}; }` },
    { name: "later_return", authority: "declared", program: literal => `function laterReturn(): Values { const values = ${literal}; return values; }` },
    { name: "concise", authority: "declared", program: literal => `const concise = (): Values => ${literal};` },
    { name: "contextual_concise", authority: "declared", program: literal => `const context: () => Values = () => ${literal};` },
    { name: "conditional_true", authority: "declared", program: literal => `function trueBranch(flag: boolean): Values { return flag ? ${literal} : []; }` },
    { name: "conditional_false", authority: "declared", program: literal => `function falseBranch(flag: boolean): Values { return flag ? [] : ${literal}; }` },
    { name: "nullish", authority: "declared", program: literal => `function nullish(input: Values | undefined): Values { return input ?? ${literal}; }` },
    { name: "async_return", authority: "declared", program: literal => `async function asynchronous(): Promise<Values> { return ${literal}; }` },
    { name: "as", authority: "declared", program: literal => `function assertion(): void { const values = ${literal} as Values; void values; }` },
    { name: "satisfies", authority: "declared", program: literal => `function satisfaction(): void { const values = ${literal} satisfies Values; void values; }` },
    { name: "api_argument", authority: "declared", program: literal => `function apiArgument(): void { api.take(${literal}); }` },
    { name: "declared_element", authority: "declared", program: literal => `const nested: Values[] = [${literal}];` },
    { name: "default_declared", authority: "declared", program: literal => `function declaredDefault(values: Values = ${literal}): void { void values; }` },
    { name: "generic_identity", authority: "declared", program: literal => `function genericIdentity(): void { const values: Values = identity(${literal}); void values; }` },
    { name: "generic_readonly", authority: "declared", program: literal => `function genericReadonly(): void { const values: readonly (string | number)[] = freeze(${literal}); void values; }` },
    { name: "b4_return", authority: "inferred", program: literal => `function inferredReturn() { const values = ${literal}; return values; }` },
    { name: "b4_concise", authority: "inferred", program: literal => `const inferredConcise = () => ${literal};` },
    { name: "b4_yield", authority: "inferred", program: literal => `function* inferredYield() { yield ${literal}; }` },
    { name: "export", authority: "inferred", program: literal => `export const exported = ${literal};` },
    { name: "field", authority: "inferred", program: literal => `class InferredField { value = ${literal}; }` },
    { name: "default", authority: "inferred", program: literal => `function inferredDefault(values = ${literal}): void { void values; }` },
    { name: "open_local", authority: "inferred", program: literal => `function local(): void { const values = ${literal}; void values; }` },
    { name: "derived", authority: "inferred", program: literal => `function derived(flag: boolean): void { const values = ${literal}; const selected = flag ? values : values; void selected; }` },
    { name: "read_alias", authority: "inferred", program: literal => `function aliases(): void { const values = ${literal}; const alias = values; void alias; }` },
    { name: "assignment_pattern", authority: "inferred", program: literal => `function pattern(): void { let first: string | number; [first] = ${literal}; void first; }` },
  ];
  const current = fixture(`type Values = (string | number)[]; type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
    declare function take(value: Values): void; declare const api: { take(value: Values): void };
    declare function identity<Value>(value: Value): Value; declare function freeze<Value>(value: Value): Locked<Value>;
    ${cases.map(row => row.program(`[${JSON.stringify(row.name)}, 9007199254740993, -9007199254740993, 1e100]`)).join("\n")}`);
  const { ast } = current.source;
  const failures: string[] = [];
  const observed: { name: string; found: boolean; count: number; expected: string; actual: string; sameDescriptor: boolean }[] = [];
  for (const row of cases) {
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node) &&
      ast.elements(node)[0] !== undefined && ast.is.IsStringLiteral(ast.elements(node)[0]) &&
      ast.text(ast.elements(node)[0]) === row.name);
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const admissions = current.source.effectiveTypes.obligations().filter(obligation => obligation.kind === "literal-admission" &&
      obligation.site === literal);
    const actual = admissions[0]?.kind === "literal-admission" ? admissions[0].authority : "missing";
    const sameDescriptor = outcome !== undefined && outcome.kind !== "refused" && admissions[0]?.type === outcome.type;
    observed.push({ name: row.name, found: literal !== undefined, count: admissions.length, expected: row.authority, actual, sameDescriptor });
    if (literal === undefined) failures.push(`${row.name}: actual aggregate construction`);
    if (admissions.length !== 1) failures.push(`${row.name}: expected one admission, actual ${admissions.length}`);
    if (actual !== row.authority) failures.push(`${row.name}: expected ${row.authority}, actual ${actual}`);
    if (!sameDescriptor) failures.push(`${row.name}: identical published descriptor`);
  }
  console.log(`Source authority case map: ${JSON.stringify(observed)}`);
  assert.equal(failures.length, 0, failures.join("; "));
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("R1 totality: every domain value has exactly one outcome and an inexpressible declared value is one precise refusal", () => {
  const current = fixture(`interface Local { read<T>(value: T): Awaited<T>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; const count: int32 = 1; void count; }`);
  const { ast } = current.source;
  const values = createSourceTypeFlowAnalysisContext(current.source).values;
  assert.equal(values.every(node => current.source.effectiveTypes.get(node) !== undefined), true,
    "no value node of the domain is left without a Host outcome");
  const read = values.find(node => ast.is.IsIdentifier(node) && ast.text(node) === "local");
  const outcome = read === undefined ? undefined : current.source.effectiveTypes.get(read);
  assert.equal(outcome?.kind === "refused" && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" && outcome.site === read, true,
    "the inexpressible project interface is one refusal at its own value node");
  assert.equal(current.source.effectiveTypes.refusals().filter(issue => issue.site === read).length, 1);
  assert.equal(current.type("count").kind === "primitive", true, "an expressible sibling still publishes");
});

for (const [name, program] of [
  ["object", `type C = { a: { b: { c: { d: { e: { f: int32 } } } } } }; export function run(): int32 { const value: C = { a: { b: { c: { d: { e: { f: 1 } } } } } }; return value.a.b.c.d.e.f; }`],
  ["array", `export function run(): int32 { const value: int32[][][][][][] = [[[[[[1]]]]]]; return value[0]![0]![0]![0]![0]![0]!; }`],
] as const) test(`R3 a declared ${name} literal deeper than four levels publishes its full declared structure`, () => {
  const current = fixture(program);
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), false,
    "declared structure is bounded only by the shared expansion budget, never by the open-literal depth four");
  const value = current.source.effectiveTypes.get(current.declaration("value"));
  assert.equal(value !== undefined && value.kind !== "refused", true);
});

test("R3 an open literal deeper than four levels still refuses (B6)", () => {
  const current = fixture("export function run(): void { const value = [[[[[[1]]]]]]; void value; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});

test("C-2263 a recursive aliased union publishes its alias at every level with the recursion cut as a reference", () => {
  const current = fixture(`export type Tree = int32 | readonly Tree[] | undefined;
    export function sum(tree: Tree): int32 { if (tree === undefined) return 0; if (typeof tree === "number") return tree;
      let result: int32 = 0; for (const child of tree) { const visited = child; result += sum(visited); } return result; }`);
  const { ast } = current.source;
  const alias = current.nodes.find(node => ast.is.IsTypeAliasDeclaration(node));
  const visited = current.source.effectiveTypes.get(current.declaration("visited"));
  assert.equal(visited !== undefined && visited.kind !== "refused", true, "the checked recursive element is published, not exhausted");
  if (visited === undefined || visited.kind === "refused") return;
  let selected = visited.type;
  while (selected.kind === "optional") selected = selected.value;
  assert.equal(selected.kind === "declared" && selected.declaration === alias && selected.definition !== undefined, true,
    "the checked aliased union is the alias with its definition, as an authored alias reference is");
  let definition = selected.kind === "declared" ? selected.definition : undefined;
  while (definition?.kind === "optional") definition = definition.value;
  const arms = definition?.kind === "union" ? definition.types : [];
  const array = arms.find(arm => arm.kind === "array");
  assert.equal(array?.kind === "array" && array.element.kind === "declared" && array.element.declaration === alias &&
    array.element.definition === undefined, true, "the recursive occurrence is the cut: a reference without definition");
});

test("C-2263 an aliased union of arrays stays its alias, never an array of the union of elements", () => {
  const current = fixture(`type Values = string[] | int32[]; declare function make(): Values; export function run(): void { const value = make(); void value; }`);
  let selected = current.type("value");
  while (selected.kind === "optional") selected = selected.value;
  assert.equal(selected.kind === "declared" && selected.definition?.kind === "union" && selected.definition.types.length === 2 &&
    selected.definition.types.every(arm => arm.kind === "array"), true);
});

test("C-2297 a literal published as its own shape corresponds each authored member to its own origin", () => {
  const current = fixture(`interface Box { value: int32; }
    function create() { const value: int32 = 7; return { value, extra: true }; }
    function change(factory: () => Box): int32 { return factory().value; }
    export function run(): int32 { return change(create); }`);
  const { ast } = current.source;
  const literal = current.nodes.find(node => ast.is.IsObjectLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
  if (outcome === undefined || outcome.kind === "refused" || literal === undefined) return;
  const properties = ast.properties(literal).filter(property => property !== undefined);
  assert.equal(outcome.memberCorrespondence?.length, properties.length);
  assert.equal(outcome.memberCorrespondence?.every(entry => entry.origin.kind === "declared" && entry.origin.declaration === entry.property), true,
    "the destination of an own-shape publication is the literal's own member, not a separately selected type");
});

test("C30 authority follows the destination's authored type through authored type arguments and contextual closure returns", () => {
  const union = "(string | number)";
  const paths: readonly { readonly name: string; readonly authority: "declared" | "inferred"; readonly text: (name: string) => string }[] = [
    { name: "alias", authority: "declared", text: n => `type ${n}Values = ${union}[]; export function ${n}(): ${n}Values { const values: ${n}Values = ["t", 1]; return values; }` },
    { name: "argument", authority: "declared", text: n => `function ${n}Accept(values: ${union}[]): ${union}[] { return values; } export function ${n}(): ${union}[] { const values = ["t", 1]; return ${n}Accept(values); }` },
    { name: "nested", authority: "declared", text: n => `function ${n}Call(make: () => ${union}[]): ${union}[] { return make(); } export function ${n}(): ${union}[] { return ${n}Call(() => { const values = ["t", 1]; return values; }); }` },
    { name: "explicit_argument", authority: "declared", text: n => `function ${n}Accept<T>(values: T[]): T[] { return values; } export function ${n}(): ${union}[] { const values = ["t", 1]; return ${n}Accept<${union}>(values); }` },
    { name: "explicit_direct", authority: "declared", text: n => `function ${n}Accept<T>(values: T[]): T[] { return values; } export function ${n}(): ${union}[] { return ${n}Accept<${union}>(["t", 1]); }` },
    { name: "explicit_callback", authority: "declared", text: n => `function ${n}Call<T>(make: () => T[]): T[] { return make(); } export function ${n}(): ${union}[] { return ${n}Call<${union}>(() => { const values = ["t", 1]; return values; }); }` },
    { name: "authored_receiver", authority: "declared", text: n => `class ${n}Receiver<T> { accept(values: T[]): T[] { return values; } } export function ${n}(): ${union}[] { const receiver = new ${n}Receiver<${union}>(); const values = ["t", 1]; return receiver.accept(values); }` },
    { name: "typed_callback", authority: "declared", text: n => `export function ${n}(): ${union}[] { const make: () => ${union}[] = () => { const values = ["t", 1]; return values; }; return make(); }` },
    { name: "inferred_argument", authority: "inferred", text: n => `function ${n}Accept<T>(values: T[]): T[] { return values; } export function ${n}() { const values = ["t", 1]; return ${n}Accept(values); }` },
    { name: "inferred_direct", authority: "inferred", text: n => `function ${n}Accept<T>(values: T[]): T[] { return values; } export function ${n}() { return ${n}Accept(["t", 1]); }` },
    { name: "untyped_callback", authority: "inferred", text: n => `function ${n}Call<T>(make: () => T[]): T[] { return make(); } export function ${n}() { return ${n}Call(() => { const values = ["t", 1]; return values; }); }` },
  ];
  for (const path of paths) {
    const current = fixture(path.text(path.name));
    const { ast } = current.source;
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(literal !== undefined && outcome !== undefined && outcome.kind !== "refused", true, path.name);
    assert.equal(admissions.length === 1 && admissions[0]?.kind === "literal-admission" && admissions[0].authority === path.authority, true,
      `${path.name}: authority is the destination slot's own authored type`);
  }
});

test("E4 index reads take the matching index signature value of the receiver's published structure", () => {
  const current = fixture(`declare const record: Record<number, int32>; declare const words: Record<string, int32>;
    function run(): boolean { const byNumber = record[1.5]; const byName = words.alpha; const byKey = words["beta"];
      return byNumber === 7 && byName === 1 && byKey === 2; }`);
  for (const name of ["byNumber", "byName", "byKey"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "int32" });
});

test("E4 every resolved call with method type arguments publishes its instantiation outside the local graph", () => {
  const current = fixture(`declare const receiver: { member<T>(): void; pair<A, B>(): void };
    function run(): void { receiver.member<int32>(); receiver.pair<float32, string>(); }`);
  const { ast } = current.source;
  const calls = current.nodes.filter(node => ast.is.IsCallExpression(node));
  assert.equal(calls.length, 2);
  const [member, pair] = calls.map(call => current.source.effectiveTypes.callInstantiation(call));
  assert.equal(member !== undefined && member.method.length === 1, true, "member<int32> publishes one method binder");
  assertSameValue(member!.method[0]!.type, { kind: "primitive", primitive: "int32" });
  assert.equal(pair !== undefined && pair.method.length === 2, true, "pair<float32, string> publishes both binders in order");
  assertSameValue(pair!.method[0]!.type, { kind: "primitive", primitive: "float32" });
  assertSameValue(pair!.method[1]!.type, { kind: "string" });
});

test("K-2449 a read-only parameter view never fills an aliased group's width on any generic or alias route", () => {
  const cases = [
    ["explicit_array", "function inspect<T>(value: readonly T[]): void { void value; }", "inspect<number>(values)"],
    ["explicit_tuple", "function inspect<T>(value: readonly [T]): void { void value; }", "inspect<number>(values)"],
    ["alias_view", "type View = readonly number[]; function inspect(value: View): void { void value; }", "inspect(values)"],
    ["generic_alias_view", "type View<T> = readonly T[]; function inspect<T>(value: View<T>): void { void value; }", "inspect<number>(values)"],
    ["inferred_array", "function inspect<T>(value: readonly T[]): void { void value; }", "inspect(values)"],
  ] as const;
  for (const [name, declarations, call] of cases) {
    const initializer = name === "explicit_tuple" ? "[1] as [int32]" : "[1]";
    const current = fixture(`${declarations} function run(): void { const values = ${initializer}; ${call}; }`);
    const type = current.type("values");
    // The view never fills or retypes the aliased group: a mutable local stays mutable (no readonly copied from the view).
    assert.equal((type.kind === "array" || type.kind === "tuple") && type.readonly === false, true,
      `${name}: the read-only view checks the group and never fills it`);
    // Without an explicit type argument, the group keeps its own B3 width.
    if (!call.includes("<number>")) {
      const element = type.kind === "array" ? type.element : type.kind === "tuple" ? type.elements[0]?.type : undefined;
      assert.equal(element?.kind === "primitive" && element.primitive === "int64", true, `${name}: the group keeps its int64 width`);
    }
  }
});

test("K-2449 a construction placed directly in a read-only parameter still takes its declared slot", () => {
  const current = fixture(`function inspect<T>(value: readonly T[]): void { void value; }
    function run(): void { inspect<number>([1]); }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
    outcome.type.element.kind === "primitive" && outcome.type.element.primitive === "float64", true,
    "the direct construction takes the instantiated declared slot (C30)");
});

test("LM solved literal receivers retain declared widths, signature identities and exact occurrence provenance", () => {
  const cases = [
    { name: "inferred_int32", width: "int32", countWidth: "int64", parameter: "", count: "1", annotation: "", destination: "" },
    { name: "declared_float32", width: "float32", countWidth: "float32", parameter: "", count: "1", annotation: "",
      destination: "const required: { count: float32; read(input: float32): float32; current: float32; writeOnly: float32 } = value; void required;" },
    { name: "own_declared_float32", width: "float32", countWidth: "float32", parameter: "", count: "1",
      annotation: ": { count: float32; read(input: float32): float32; current: float32; writeOnly: float32 }", destination: "" },
    { name: "native_int64", width: "int64", countWidth: "int64", parameter: "seed: int64", count: "seed", annotation: "", destination: "" },
  ] as const;
  for (const sample of cases) {
    const current = fixture(`function run(${sample.parameter}): void { const value${sample.annotation} = {
      count: ${sample.count}, read(input: ${sample.width}): ${sample.width} { return this.count + input; },
      get current(): ${sample.width} { return this.count; },
      set current(next: ${sample.width}) { this.count = next; },
      set writeOnly(next: ${sample.width}) { this.count = next; }
    }; ${sample.destination} void value; }`);
    const { ast } = current.source;
    const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, sample.name);
    if (literal === undefined || outcome === undefined || outcome.kind === "refused") throw new Error("The solved literal is required.");
    const shape = sourceTypeDescriptorStructure(outcome.type);
    assert.equal(shape.kind === "shape", true, sample.name);
    if (shape.kind !== "shape") throw new Error("The literal's canonical shape is required.");
    const count = shape.members.find(member => member.name === "count");
    assert.equal(count?.type.kind === "primitive" && count.type.primitive === sample.countWidth, true, sample.name);
    const receivers = current.nodes.filter(node => sourceTypeFlowObjectLiteralReceiver(ast, node) === literal);
    assert.equal(receivers.length, 4, sample.name);
    for (const receiver of receivers) {
      const published = current.source.effectiveTypes.get(receiver);
      assert.equal(published !== undefined && published.kind !== "refused" && published.type === outcome.type &&
        published.provenance.group === literal && published.provenance.occurrence === receiver &&
        published.provenance.sourceFile === ast.getSourceFile(receiver), true, `${sample.name}: receiver identity`);
      const access = ast.parent(receiver);
      const selected = access === undefined ? undefined : current.source.effectiveTypes.get(access);
      assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type.kind === "primitive" &&
        selected.type.primitive === sample.countWidth && selected.provenance.occurrence === access, true,
      `${sample.name}: exact solved data read or write`);
    }
    const method = ast.properties(literal).find(node => node !== undefined && ast.is.IsMethodDeclaration(node));
    const callable = method === undefined ? undefined : current.source.effectiveTypes.get(method);
    assert.equal(callable !== undefined && callable.kind !== "refused" && callable.type.kind === "callable" &&
      callable.type.calls[0]?.declaration === method && callable.type.calls[0]?.result.kind === "primitive" &&
      callable.type.calls[0].result.primitive === sample.width, true, `${sample.name}: method identity and result`);
    for (const member of ast.properties(literal)) {
      if (member === undefined || !(ast.is.IsMethodDeclaration(member) || ast.is.IsGetAccessorDeclaration(member) ||
        ast.is.IsSetAccessorDeclaration(member))) continue;
      for (const parameter of ast.parameters(member)) {
        const published = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
        assert.equal(published !== undefined && published.kind !== "refused" && published.type.kind === "primitive" &&
          published.type.primitive === sample.width && published.provenance.occurrence === parameter, true,
        `${sample.name}: parameter identity and width`);
      }
      const returned = current.source.effectiveTypes.callableReturn(member);
      assert.equal(returned !== undefined && returned.kind !== "refused" && returned.provenance.occurrence === member &&
        (ast.is.IsSetAccessorDeclaration(member) ? returned.type.kind === "intrinsic" && returned.type.intrinsic === "void"
          : returned.type.kind === "primitive" && returned.type.primitive === sample.width), true,
      `${sample.name}: declared method/accessor return`);
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0, sample.name);
  }
});

test("LM checked computed, numeric, quoted and symbol members keep their actual declaration identities", () => {
  const current = fixture(`const computed = "computed" as const; declare const methodKey: unique symbol; declare const accessorKey: unique symbol;
    function run(): void { const value = { count: 1,
      [computed](next: int32): int32 { return this.count + next; },
      1(next: int32): int32 { return this.count + next; },
      "quoted key"(next: int32): int32 { return this.count + next; },
      [methodKey](next: int32): int32 { return this.count + next; },
      get "quoted accessor"(): int32 { return this.count; }, set "quoted accessor"(next: int32) { this.count = next; },
      get [accessorKey](): int32 { return this.count; }, set [accessorKey](next: int32) { this.count = next; }
    }; void value; }`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  const published = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(published !== undefined && published.kind !== "refused", true);
  if (literal === undefined || published === undefined || published.kind === "refused") throw new Error("The solved literal is required.");
  const shape = sourceTypeDescriptorStructure(published.type);
  if (shape.kind !== "shape") throw new Error("The literal's complete shape is required.");
  assert.equal(shape.members.length, 7);
  for (const property of ast.properties(literal)) {
    if (property === undefined || ast.is.IsPropertyAssignment(property) || ast.is.IsSetAccessorDeclaration(property)) continue;
    const member: SourceTypeDescriptorMember | undefined = shape.members.find(member =>
      member.origin.kind === "declared" && member.origin.declaration === property);
    assert.equal(member !== undefined, true, `member ${ast.pos(property)}: actual origin`);
    if (ast.is.IsMethodDeclaration(property)) {
      assert.equal(member?.type.kind === "callable" && member.type.calls[0]?.declaration === property &&
        member.type.calls[0]?.result.kind === "primitive" && member.type.calls[0].result.primitive === "int32", true,
      `method ${ast.pos(property)}: signature identity and width`);
    } else {
      assert.equal(member?.type.kind === "primitive" && member.type.primitive === "int32" && member.readonly === undefined, true,
        `accessor ${ast.pos(property)}: one readable paired member`);
    }
  }
  const receivers = current.nodes.filter(node => sourceTypeFlowObjectLiteralReceiver(ast, node) === literal);
  assert.equal(receivers.length, 8);
  for (const receiver of receivers) {
    const selected = current.source.effectiveTypes.get(receiver);
    assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type === published.type, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("LM receiver aliases and nested projections use the solved literal without merging callable roots", () => {
  const current = fixture(`function run(): void { const value = { nested: { count: 1 }, values: [1],
    read(): int32 { const captured = this; const inner = captured.nested; const copy = inner.count;
      const arrow = () => this.values[0]; return copy + arrow(); }
  }; void value; }`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  const holder = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const captured = current.source.effectiveTypes.get(current.declaration("captured"));
  assert.equal(holder !== undefined && holder.kind !== "refused" && captured !== undefined && captured.kind !== "refused" &&
    captured.type === holder.type && captured.provenance.group === literal, true);
  assertSameValue(current.type("copy"), { kind: "primitive", primitive: "int64" });
  const access = current.nodes.find(node => ast.is.IsElementAccessExpression(node));
  const selected = access === undefined ? undefined : current.source.effectiveTypes.get(access);
  assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type.kind === "primitive" &&
    selected.type.primitive === "int64", true);
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  for (const link of graph.links) {
    const first = graph.nodes.find(record => record.node === link.source.node);
    const second = graph.nodes.find(record => record.node === link.target.node);
    assert.equal(first !== undefined && second !== undefined && first.root === second.root, true,
      "a solved receiver dependency is not a cross-root equality link");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("D-A graph decisions include inactive fixed operands and preserve exact primitive operand publications", () => {
  const current = fixture(`function run(left: number, right: number, flag: boolean, other: boolean, nullable: number | undefined): void {
    const sum = left + right; const negative = -left; const before = ++left; const after = right--;
    const both = flag && other; const either = flag || other; const inverse = !flag;
    const comparison = left < right; const present = nullable ?? 0;
    const numericLogical = left && right; const neverAbsent = left ?? right;
    const powered = left ** right; const numericNegation = !left;
    void sum; void negative; void before; void after; void both; void either; void inverse; void comparison; void present;
  }`);
  for (const name of ["sum", "negative", "before", "after", "present"]) {
    assertSameValue(current.type(name), { kind: "primitive", primitive: "float64" });
  }
  for (const name of ["both", "either", "inverse", "comparison"]) {
    assertSameValue(current.type(name), { kind: "primitive", primitive: "bool" });
  }
  for (const name of ["numericLogical", "neverAbsent", "powered", "numericNegation"]) {
    const expression = current.source.ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome?.kind === "refused" && outcome.site === expression && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
      outcome.reason.length > 0, true, name);
    assert.equal(current.source.effectiveTypes.refusals().filter(issue => issue === outcome).length, 1, name);
  }
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  for (const name of ["sum", "negative", "before", "after", "both", "either", "inverse", "comparison", "present"]) {
    const expression = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    assert.equal(graph.derived.some(derived => derived.node === expression), true, `${name}: no inactive fixed-node escape`);
    if (expression === undefined) throw new Error("The actual operator expression is required.");
    const produced = current.source.effectiveTypes.get(expression);
    assert.equal(produced !== undefined && produced.kind !== "refused" && produced.provenance.occurrence === expression, true, name);
  }
  for (const reference of current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.text(node) === "left" &&
    ast.name(ast.parent(node)!) !== node)) {
    const outcome = current.source.effectiveTypes.get(reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === "float64" && outcome.provenance.occurrence === reference, true, "fixed operand width and occurrence");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 4);
});

test("D-A constant folding retains operator admission and canonical signed default bounds", () => {
  const current = fixture(`function run(): void { const summed = 1 + 2; const shifted = 1 << 2;
    const minimum = -2147483648; const overflow = -2147483649; const negativeZero = -0; const foldedOverflow = 2147483647 + 1;
    const powered = 2 ** 3; void summed; void shifted; void minimum; void overflow; void negativeZero; void foldedOverflow; }`);
  for (const name of ["summed", "shifted", "minimum", "overflow", "negativeZero", "foldedOverflow"])
    assertSameValue(current.type(name), { kind: "primitive", primitive: "int64" });
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  for (const name of ["summed", "shifted", "minimum", "overflow", "negativeZero", "foldedOverflow", "powered"]) {
    const expression = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    assert.equal(graph.derived.some(derived => derived.node === expression), true, `${name}: folding does not skip the operator table`);
  }
  const power = ast.as.AsVariableDeclaration(current.declaration("powered"))?.Initializer;
  const refused = power === undefined ? undefined : current.source.effectiveTypes.get(power);
  assert.equal(refused?.kind === "refused" && refused.site === power && refused.reason.includes("Exponentiation"), true);
  assert.equal(current.source.effectiveTypes.refusals().length === 1 && current.source.effectiveTypes.refusals()[0] === refused, true);
});

test("C14 admitted all-literal arithmetic retains the authored int8 result after operator admission", () => {
  const current = fixture("const b: int8 = 1 + 2;");
  const { ast } = current.source;
  const expression = ast.as.AsVariableDeclaration(current.declaration("b"))?.Initializer;
  const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assertSameValue(current.type("b"), { kind: "primitive", primitive: "int8" });
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
    outcome.type.primitive === "int8" && outcome.provenance.occurrence === expression, true,
  "the folded value keeps its exact authored int8 slot instead of the promoted calculation kind");
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  assert.equal(graph.derived.some(derived => derived.node === expression && derived.operator === "add"), true,
    "the all-literal expression still passes through the same operator admission");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("D-A only actual unbound literal groups adapt while fixed casts and module widths remain fixed", () => {
  const current = fixture(`const moduleFixed: int32 = 1;
    function run(right: uint32): void {
      const cast = (1 as int32) + right; const moduleValue = moduleFixed + right;
      const open = 1 + right; const wrapped = (1) + right;
      void cast; void moduleValue; void open; void wrapped;
    }`);
  for (const name of ["cast", "moduleValue"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "int64" });
  for (const name of ["open", "wrapped"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "uint32" });
  assertSameValue(current.type("moduleFixed"), { kind: "primitive", primitive: "int32" });
  const { ast } = current.source;
  const cast = current.nodes.find(node => ast.is.IsAsExpression(node));
  const operand = cast === undefined ? undefined : current.source.effectiveTypes.get(cast);
  assert.equal(operand !== undefined && operand.kind !== "refused" && operand.type.kind === "primitive" &&
    operand.type.primitive === "int32", true, "retained syntax cannot reopen a fixed operand width");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("D-A a bare bigint literal may adapt but declared and asserted bigint values remain in their own domain", () => {
  const current = fixture(`function run(native: int64): void {
    const declared: bigint = 1n; const bare = 1n + native;
    const asserted = (1n as bigint) + native; const retained = declared + native;
    void bare; void asserted; void retained;
  }`);
  assertSameValue(current.type("bare"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("declared"), { kind: "intrinsic", intrinsic: "bigint" });
  for (const name of ["asserted", "retained"]) {
    const expression = current.source.ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome?.kind === "refused" && outcome.site === expression && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, name);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 2);
});

test("D-A compound results retain left storage and preserve the independent promoted write-fit", () => {
  const current = fixture("function run(): void { let value: int32 = 1; const result = (value += 0.5); void result; }");
  const { ast } = current.source;
  const compound = current.nodes.find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindPlusEqualsToken");
  const outcome = compound === undefined ? undefined : current.source.effectiveTypes.get(compound);
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("result"), { kind: "primitive", primitive: "int32" });
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
    outcome.type.primitive === "int32" && outcome.provenance.occurrence === compound, true);
  const writes = current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit" && row.site === compound);
  assert.equal(writes.length, 1);
  const write = writes[0];
  assert.equal(write?.kind === "write-fit" && write.value === compound && write.type.kind === "primitive" &&
    write.type.primitive === "int32" && write.valueType?.kind === "primitive" && write.valueType.primitive === "float64", true,
  "the unchanged D2 write-fit still receives float64 calculation into int32 storage; it is not waived by the int32 expression result");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("D-A a declared result slot never hides its operator refusal", () => {
  const current = fixture("const forbidden: int8 = 2 ** 3;");
  const { ast } = current.source;
  const expression = ast.as.AsVariableDeclaration(current.declaration("forbidden"))?.Initializer;
  const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(outcome?.kind === "refused" && outcome.site === expression && outcome.reason.includes("Exponentiation"), true);
  assert.equal(current.source.effectiveTypes.refusals().length === 1 && current.source.effectiveTypes.refusals()[0] === outcome, true);
});

test("D-A all accepted binary families publish their own exact closed result", () => {
  const current = fixture(`type Flag = boolean; type Choice = int32 | string; declare function touch(): void;
    function run(left: Choice, right: Choice, flag: Flag, other: Flag, text: string, maybe: int32 | undefined): void {
      const both = flag && other; const either = flag || other; const appended = text + "tail";
      const equal = left === right; const present = maybe !== undefined; const selected = maybe ?? 0;
      const last = (touch(), left); void both; void either; void appended; void equal; void present; void selected; void last;
    }`);
  const { ast } = current.source;
  for (const [name, kind] of [["both", "bool"], ["either", "bool"], ["appended", "string"], ["equal", "bool"],
    ["present", "bool"], ["selected", "int32"]] as const) {
    const expression = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.occurrence === expression &&
      (kind === "string" ? outcome.type.kind === "string" : outcome.type.kind === "primitive" && outcome.type.primitive === kind), true, name);
  }
  const sequence = current.nodes.find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindCommaToken");
  const operand = sequence === undefined ? undefined : ast.as.AsBinaryExpression(sequence)?.Right;
  const result = sequence === undefined ? undefined : current.source.effectiveTypes.get(sequence);
  const right = operand === undefined ? undefined : current.source.effectiveTypes.get(operand);
  assert.equal(result !== undefined && result.kind !== "refused" && right !== undefined && right.kind !== "refused" &&
    sourceTypeDescriptorsEqual(result.type, right.type) && result.provenance.occurrence === sequence, true,
  "comma owns a publication of the exact right-value descriptor, not a target fallback");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("D-A intrinsic bigint keeps its existing operation domain without becoming a primitive or admitting mixed domains", () => {
  const current = fixture(`function run(left: bigint, right: bigint, native: int64): void {
    const sum = left + right; const difference = left - right; const product = left * right;
    const divided = left / right; const remainder = left % right; const and = left & right; const or = left | right; const xor = left ^ right;
    const negative = -left; const complemented = ~left; const incremented = ++left; const decremented = right--;
    const comparison = left < right; const equality = left === right; const assigned = (left /= right); const adapted = 1n + native;
    const mixed = left + native; const mixedComparison = left < native; const powered = left ** right; const shifted = left << right;
    void sum; void difference; void product; void divided; void remainder; void and; void or; void xor;
    void negative; void complemented; void incremented; void decremented; void comparison; void equality; void assigned; void adapted;
  }`);
  for (const name of ["sum", "difference", "product", "divided", "remainder", "and", "or", "xor", "negative", "complemented",
    "incremented", "decremented", "assigned"]) assertSameValue(current.type(name), { kind: "intrinsic", intrinsic: "bigint" });
  for (const name of ["comparison", "equality"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "bool" });
  assertSameValue(current.type("adapted"), { kind: "primitive", primitive: "int64" });
  const { ast } = current.source;
  for (const name of ["mixed", "mixedComparison", "powered", "shifted"]) {
    const expression = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome?.kind === "refused" && outcome.site === expression && outcome.reason.length > 0, true, name);
    assert.equal(current.source.effectiveTypes.refusals().filter(issue => issue === outcome).length, 1, name);
  }
  const assignment = current.nodes.find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindSlashEqualsToken");
  const writes = current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit" && row.site === assignment);
  assert.equal(writes.length === 1 && writes[0]?.value === assignment && writes[0]?.type.kind === "intrinsic" &&
    writes[0].type.intrinsic === "bigint" && writes[0]?.valueType?.kind === "intrinsic" && writes[0].valueType.intrinsic === "bigint", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 4);
});

test("C14 an open linked coalescing left and an aliased optional preserve their produced widths", () => {
  const current = fixture(`declare function narrow(): float32; type Maybe = float32 | undefined;
    function run(flag: boolean, declared: Maybe): void {
      const maybe = flag ? narrow() : undefined; const linked = maybe ?? 0; const aliased = declared ?? 0;
      const ordinary = [1, 2]; const dense = ordinary[0] ?? 0;
      void linked; void aliased; void dense;
    }`);
  assertSameValue(current.type("linked"), { kind: "primitive", primitive: "float32" });
  assertSameValue(current.type("aliased"), { kind: "primitive", primitive: "float32" });
  const expression = current.source.ast.as.AsVariableDeclaration(current.declaration("dense"))?.Initializer;
  const refused = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(refused?.kind === "refused" && refused.site === expression && refused.reason.includes("nullable"), true);
  assert.equal(current.source.effectiveTypes.refusals().length === 1 && current.source.effectiveTypes.refusals()[0] === refused, true);
});

test("OWN read-only checks retain declared construction authority without filling width or merging array and tuple storage", () => {
  const cases = [
    { name: "array_direct", declaration: "declare function read(value: readonly number[]): void;", before: "", use: "read([1, 2]);" },
    { name: "array_alias", declaration: "declare function read(value: readonly number[]): void;", before: "const input = [1, 2];", use: "read(input);" },
    { name: "union_alias", declaration: "declare function read(value: { count: int32 } | readonly number[]): void;",
      before: "const input = [1, 2];", use: "read(input);" },
    { name: "tuple_direct", declaration: "declare function identity<Value>(value: Value): Value;", before: "",
      use: "const selected: readonly (string | number)[] = identity([\"tag\", 1.5] as const); void selected;" },
    { name: "tuple_alias", declaration: "declare function identity<Value>(value: Value): Value;", before: "const input = [\"tag\", 1.5] as const;",
      use: "const selected: readonly (string | number)[] = identity(input); void selected;" },
  ];
  for (const sample of cases) {
    const current = fixture(`${sample.declaration} function run(): void { ${sample.before} ${sample.use} }`);
    const { ast } = current.source;
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && admissions.length === 1 && admissions[0]?.type === outcome.type &&
      admissions[0]?.kind === "literal-admission" && admissions[0].authority === "declared", true, sample.name);
    if (sample.name === "array_alias" || sample.name === "union_alias") {
      const type = current.type("input");
      assert.equal(type.kind === "array" && !type.readonly && type.element.kind === "primitive" && type.element.primitive === "int64", true,
        `${sample.name}: the view does not fill the mutable storage width`);
    } else if (sample.name === "tuple_direct" || sample.name === "tuple_alias") {
      const asserted = literal === undefined ? undefined : ast.parent(literal);
      const storage = asserted === undefined ? undefined : current.source.effectiveTypes.get(asserted);
      assert.equal(storage !== undefined && storage.kind !== "refused" && storage.type.kind === "tuple" && storage.type.readonly &&
        storage.type.elements.length === 2 && storage.type.elements[0]?.type.kind === "string" &&
        storage.type.elements[1]?.type.kind === "primitive" && storage.type.elements[1].type.primitive === "float64", true,
      `${sample.name}: declared array admission does not merge the separately retained tuple storage`);
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0, sample.name);
  }
});

test("C2330 signed whole literals retain the fixed array peer while range failure remains an exact D2 obligation", () => {
  for (const [width, token] of [["int8", "-129"], ["int32", "-9007199254740993"], ["int64", "-9223372036854775809"]] as const) {
    const current = fixture(`function run(peer: ${width}): void { const values = [peer, ${token}]; void values; }`);
    const { ast } = current.source;
    const literal = current.nodes.find(node => ast.is.IsPrefixUnaryExpression(node) && ast.operatorKindName(node) === "KindMinusToken");
    const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const values = current.type("values");
    assert.equal(values.kind === "array" && values.element.kind === "primitive" && values.element.primitive === width, true, width);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === width && outcome.provenance.occurrence === literal, true, `${width}: whole-prefix carrier`);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(admissions.length === 1 && admissions[0]?.type.kind === "primitive" && admissions[0].type.primitive === width, true,
      `${width}: the original non-fitting whole token still reaches Native D2`);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, width);
  }
});

test("C2330 bigint equality retains absence and native-integral comparisons without admitting mixed arithmetic or relational operators", () => {
  const current = fixture(`function run(value: bigint, native: int64, optional: bigint | undefined, floating: number, text: string, object: object): void {
    const equal = value === native; const absent = value === undefined; const present = optional !== undefined;
    const optionalEqual = optional === native;
    const mixed = value + native; const ordered = value < native;
    const floatEqual = value == (floating as unknown); const textEqual = value == (text as unknown); const objectEqual = value == (object as unknown);
    void equal; void absent; void present;
  }`);
  for (const name of ["equal", "absent", "present", "optionalEqual"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "bool" });
  const { ast } = current.source;
  for (const name of ["mixed", "ordered", "floatEqual", "textEqual", "objectEqual"]) {
    const expression = ast.as.AsVariableDeclaration(current.declaration(name))?.Initializer;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome?.kind === "refused" && outcome.site === expression, true, name);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 5);
});

test("C2330 an unavailable operation operand retains its one original-site Source refusal", () => {
  const current = fixture("function run(): void { const outer = 1; const saved = () => outer + 1; void saved; }");
  const { ast } = current.source;
  const expression = current.nodes.find(node => ast.is.IsBinaryExpression(node));
  const reference = expression === undefined ? undefined : ast.as.AsBinaryExpression(expression)?.Left;
  const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(outcome?.kind === "refused" && outcome.site === reference && outcome.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE" &&
    outcome.related === current.declaration("outer"), true);
  assert.equal(current.source.effectiveTypes.refusals().length === 1 && current.source.effectiveTypes.refusals()[0] === outcome, true);
});

test("C2332 discarded selectors publish no result while conditions and effects keep their own outcomes", () => {
  const current = fixture(`declare function effect(): int32;
    function run(flag: boolean, optional: (() => int32) | undefined): void {
      flag && (() => 1); flag || (() => 1); optional ?? (() => 1); flag ? (() => 1) : (() => 2);
      void (flag && effect()); (flag || effect(), effect());
      for (let index = 0; index < 1; flag && effect()) { index++; }
    }`);
  const defaults = createSourceTypeFlowAnalysisContext(current.source);
  const discarded = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(discarded.length, 7);
  for (const node of discarded) {
    assert.equal(defaults.values.includes(node), false);
    assert.equal(current.source.effectiveTypes.get(node) === undefined, true);
  }
  const effects = current.nodes.filter(node => current.source.ast.is.IsCallExpression(node));
  assert.equal(effects.length, 4);
  for (const node of effects) {
    const outcome = current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === "int32" && outcome.provenance.occurrence === node, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2332 discarded numeric conditions still refuse without inventing a result descriptor", () => {
  const current = fixture(`declare function effect(): void;
    function run(value: int32): void { value && effect(); value || effect(); value ? effect() : effect(); value ?? effect();
      const selected = value ? [1] : [2]; void selected;
    }`);
  const selectors = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(selectors.length, 4);
  for (const node of selectors) {
    assert.equal(current.source.effectiveTypes.get(node) === undefined, true);
    const issues = current.source.effectiveTypes.refusals().filter(issue => issue.site === node);
    assert.equal(issues.length === 1 && issues[0]?.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
      issues[0].reason.includes(current.source.ast.operatorKindName(node) === "KindQuestionQuestionToken" ? "nullable" : "bool"), true);
  }
  const consumed = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  const outcome = consumed === undefined ? undefined : current.source.effectiveTypes.get(consumed);
  assert.equal(outcome?.kind === "refused" && outcome.site === consumed && outcome.reason.includes("bool"), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 5);
});

test("C2332 primitive union operands refuse at the original operator with the exact published arm names", () => {
  for (const [annotation, arms] of [["int32 | uint32", "int32 | uint32"],
    ["int32 | uint32 | number", "int32 | uint32 | float64"]] as const) {
    const current = fixture(`function run(left: ${annotation}, right: ${annotation}): void { const result = left + right; void result; }`);
    const expression = current.nodes.find(node => current.source.ast.is.IsBinaryExpression(node));
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    const reason = `Operator '+' has no admitted result for the union operand '(${arms})'; narrow the operand to one primitive kind first.`;
    assert.equal(outcome?.kind === "refused" && outcome.site === expression && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
      outcome.reason === reason, true, annotation);
    assert.equal(current.source.effectiveTypes.refusals().length === 1 && current.source.effectiveTypes.refusals()[0] === outcome, true, annotation);
  }
});

test("C2330 in and instanceof produce bool and plain assignment produces its right value without merging storage", () => {
  const current = fixture(`class Failure {}
    function run(input: object, error: unknown): void {
      const owns = "key" in input; const caught = error instanceof Failure;
      let flag: boolean = false; const assigned = (flag = true); const selected = owns && caught && assigned;
      let wide: number = 0; const narrow = (wide = 1 as int32); void selected; void narrow;
    }`);
  for (const name of ["owns", "caught", "assigned", "selected"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "bool" });
  assertSameValue(current.type("wide"), { kind: "primitive", primitive: "float64" });
  assertSameValue(current.type("narrow"), { kind: "primitive", primitive: "int32" });
  const { ast } = current.source;
  const assignment = current.nodes.find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken" &&
    ast.text(ast.as.AsBinaryExpression(node)?.Left) === "wide");
  const right = assignment === undefined ? undefined : ast.as.AsBinaryExpression(assignment)?.Right;
  const result = assignment === undefined ? undefined : current.source.effectiveTypes.get(assignment);
  const value = right === undefined ? undefined : current.source.effectiveTypes.get(right);
  assert.equal(result !== undefined && result.kind !== "refused" && value !== undefined && value.kind !== "refused" &&
    result.type === value.type && result.provenance.occurrence === assignment, true);
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const storage = graph.nodes.find(node => node.node === current.declaration("wide"));
  const output = graph.nodes.find(node => node.node === assignment);
  assert.equal(storage !== undefined && output !== undefined && storage.variable !== output.variable, true);
  assert.equal(current.source.effectiveTypes.obligations().some(row => row.kind === "write-fit" && row.site === assignment &&
    row.type.kind === "primitive" && row.type.primitive === "float64" && row.valueType?.kind === "primitive" &&
    row.valueType.primitive === "int32"), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2330 named function captures read the solved outer scalar and aggregate without cross-root equality", () => {
  const current = fixture(`function run(): int32 { let total = 0; const values = [1]; const record = { count: 1 };
    function add(index: int32): void { total += index; total += values[0] + record.count; }
    add(1); return total;
  }`);
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const captures = graph.nodes.filter(record => record.kind === "read" && ast.is.IsFunctionDeclaration(record.root) &&
    record.declaration !== undefined && graph.nodes.some(owner => owner.node === record.declaration && owner.root !== record.root));
  assert.equal(captures.length, 4);
  for (const record of captures) {
    const outcome = current.source.effectiveTypes.get(record.node);
    const owner = record.declaration === undefined ? undefined : current.source.effectiveTypes.get(record.declaration);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && owner !== undefined && owner.kind !== "refused" &&
      outcome.type === owner.type && outcome.provenance.group === record.declaration, true);
  }
  for (const link of graph.links) {
    const first = graph.nodes.find(record => record.node === link.source.node);
    const second = graph.nodes.find(record => record.node === link.target.node);
    assert.equal(first !== undefined && second !== undefined && first.root === second.root, true);
  }
  assertSameValue(current.type("total"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2330 declared optional pattern slots retain absence unless their own binding default removes it", () => {
  const current = fixture(`function run(): number { const { value }: { value?: number } = { value: 4 };
    const { other = 1 }: { other?: number } = {}; const selected = value ?? 0; return selected + other; }`);
  const { ast } = current.source;
  const bindings = current.nodes.filter(node => ast.is.IsBindingElement(node));
  for (const binding of bindings) {
    const outcome = current.source.effectiveTypes.get(binding);
    const name = ast.text(ast.name(binding));
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && (name === "value"
      ? outcome.type.kind === "optional" && outcome.type.value.kind === "primitive" && outcome.type.value.primitive === "float64"
      : outcome.type.kind === "primitive" && outcome.type.primitive === "float64"), true, name);
  }
  const coalesce = current.nodes.find(node => ast.operatorKindName(node) === "KindQuestionQuestionToken");
  const issues = current.source.effectiveTypes.refusals();
  const refusal = issues[0];
  assert.equal(coalesce !== undefined && issues.length === 1 && refusal !== undefined && refusal.site === coalesce &&
    refusal.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
    refusal.reason === "A coalescing operator requires a nullable or runtime-union left operand.", true);
  assert.equal(refusal !== undefined && current.source.effectiveTypes.get(current.declaration("selected")) === refusal &&
    coalesce !== undefined && current.source.effectiveTypes.get(coalesce) === refusal, true);
});

test("C2330 numeric and string index reads use the canonical receiver index descriptor before operators", () => {
  const current = fixture(`function run(values: Record<number, int32>, words: Record<string, float32>): boolean {
    const numeric = values[1.0000000000000002]; const textual = words.alpha; const keyed = words["beta"];
    return numeric === 7 && textual === keyed;
  }`);
  assertSameValue(current.type("numeric"), { kind: "primitive", primitive: "int32" });
  for (const name of ["textual", "keyed"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "float32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2330 direct callable interfaces publish their exact enclosing bindings and call result", () => {
  for (const [annotation, expected] of [["int32", { kind: "primitive", primitive: "int32" }],
    ["float32", { kind: "primitive", primitive: "float32" }], ["number", { kind: "primitive", primitive: "float64" }],
    ["boolean", { kind: "primitive", primitive: "bool" }], ["string", { kind: "string" }]] as const) {
    const current = fixture(`interface Transform<Value> { (value: Value): Value; }
      function run(callback: Transform<${annotation}>, value: ${annotation}): ${annotation} { return callback(value); }`);
    const { ast } = current.source;
    const call = current.nodes.find(node => ast.is.IsCallExpression(node));
    const binder = current.nodes.find(node => ast.is.IsTypeParameterDeclaration(node));
    const selected = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
    const outcome = call === undefined ? undefined : current.source.effectiveTypes.get(call);
    const receiver = selected?.receiver[0];
    assert.equal(selected !== undefined && selected.receiver.length === 1 && receiver !== undefined && receiver.declaration === binder &&
      sourceTypeDescriptorsEqual(receiver.type, expected) && selected.method.length === 0, true, annotation);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && sourceTypeDescriptorsEqual(outcome.type, expected) &&
      outcome.provenance.occurrence === call, true, annotation);
    const formal = current.nodes.find(node => ast.is.IsParameterDeclaration(node) && ast.is.IsCallSignatureDeclaration(ast.parent(node)!));
    const metadata = formal === undefined ? undefined : current.source.effectiveTypes.get(formal);
    assert.equal(metadata !== undefined && metadata.kind !== "refused" && metadata.type.kind === "declared" && metadata.type.declaration === binder, true, annotation);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, annotation);
  }
});

test("C2351 ordinary declared member projections consume the solved descriptor without cycling its binders", () => {
  const current = fixture(`interface Published<Word> { readonly size: number; readonly value: Word; readonly nested: { word: Word }; }
    declare function make<Word>(value: Word): Published<Word>;
    function run(narrow: float32): void { const selected = make(narrow); const count = selected.size;
      const payload = selected.value; const nested = selected.nested.word; const agrees = selected.size === 1;
      void payload; void nested; void agrees; }`);
  const { ast } = current.source;
  const selected = current.type("selected");
  const call = current.nodes.find(node => ast.is.IsCallExpression(node));
  const invocation = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  const argument = selected.kind === "declared" ? selected.typeArguments[0] : undefined;
  const binder = invocation?.method[0];
  const structure = sourceTypeDescriptorStructure(selected);
  const member = structure.kind === "shape" ? structure.members.find(member => member.name === "value") : undefined;
  assert.equal(selected.kind === "declared" && selected.typeArguments.length === 1 && invocation?.method.length === 1 &&
    binder !== undefined && binder.type === argument && argument?.kind === "primitive" && argument.primitive === "float32", true);
  assertSameValue(current.type("count"), { kind: "primitive", primitive: "float64" });
  assertSameValue(current.type("nested"), { kind: "primitive", primitive: "float32" });
  assertSameValue(current.type("agrees"), { kind: "primitive", primitive: "bool" });
  assert.equal(member !== undefined && current.type("payload") === member.type, true,
    "the field is the same solved Source member, not its independently checked number carrier");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2351 discarded captures retain a declared primitive demand through eligible conditional literal arms", () => {
  const widths = [["double", "number", "float64"], ["single", "float32", "float32"], ["integer", "int32", "int32"]] as const;
  const forms = [["direct", "flag ? 1 : 2"], ["nested", "flag ? (other ? 1 : 2) : 3"],
    ["signed", "flag ? -1 : 2"], ["folded", "flag ? 8 / 2 + 1 : 3"]] as const;
  const rows = widths.flatMap(([name, annotation, primitive]) => forms.map(([form, expression]) => ({
    name: `${name}_${form}`, annotation, primitive, expression,
  })));
  const current = fixture(rows.map(row => `function allocate_${row.name}(flag: boolean, other: boolean): ${row.annotation} {
    const captured_${row.name} = ${row.expression};
    (flag ? (() => captured_${row.name}) : undefined) ?? (() => captured_${row.name} + 1);
    return captured_${row.name};
  }`).join("\n"));
  for (const row of rows) {
    const declaration = current.declaration(`captured_${row.name}`);
    const owner = current.source.effectiveTypes.get(declaration);
    assert.equal(owner !== undefined && owner.kind !== "refused" && owner.type.kind === "primitive" &&
      owner.type.primitive === row.primitive, true, row.name);
    const references = current.nodes.filter(node => current.source.ast.is.IsIdentifier(node) &&
      current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
    assert.equal(references.length >= 3 && references.every(node => {
      const outcome = current.source.effectiveTypes.get(node);
      return owner !== undefined && owner.kind !== "refused" && outcome !== undefined && outcome.kind !== "refused" &&
        outcome.type === owner.type;
    }), true, row.name);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const fixed = fixture(`function run(flag: boolean, value: int32): int32 { const selected = flag ? value : 1; return selected; }`);
  assertSameValue(fixed.type("selected"), { kind: "primitive", primitive: "int32" });
  assert.equal(fixed.source.effectiveTypes.refusals().length, 0);
});

test("C2351 closed declared member contracts do not demand an unrelated refused receiver binder", () => {
  const current = fixture(`interface Readable<Element> { read(): Element; }
    interface Published<Element> { readonly size: number; readonly value: Element; has(value: Element): boolean; }
    interface Factory { new<Choice>(values?: readonly Choice[] | Readable<Choice>): Published<Choice>; }
    declare const factory: Factory;
    function accepted(narrow: float32): void { const values = [narrow]; const selected = new factory(values);
      const count = selected.size; const payload = selected.value; const agrees = selected.size === 1;
      void count; void payload; void agrees; }
    function refused(signed: int32, unsigned: uint32): boolean {
      const mixed = [signed, unsigned]; const rejected = new factory(mixed);
      return rejected.has(mixed[1]) && rejected.size === 1;
    }`);
  const { ast } = current.source;
  const selected = current.type("selected");
  const structure = sourceTypeDescriptorStructure(selected);
  const member = structure.kind === "shape" ? structure.members.find(member => member.name === "value") : undefined;
  assert.equal(member !== undefined && current.type("payload") === member.type && member.type.kind === "primitive" &&
    member.type.primitive === "float32", true, "a dependent field remains the same member of the solved nominal definition");
  assertSameValue(current.type("count"), { kind: "primitive", primitive: "float64" });
  assertSameValue(current.type("agrees"), { kind: "primitive", primitive: "bool" });
  const issues = current.source.effectiveTypes.refusals();
  const literal = ast.as.AsVariableDeclaration(current.declaration("mixed"))?.Initializer;
  assert.equal(issues.length === 1 && issues[0]?.code === "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS" && issues[0].site === literal, true);
  const sizes = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "size");
  assert.equal(sizes.length, 3);
  for (const node of sizes) {
    const outcome = current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === "float64", true, "the original closed property contract has no receiver-type-variable dependency");
  }
  const rejectedSize = sizes.find(node => {
    const receiver = ast.as.AsPropertyAccessExpression(node)?.Expression;
    return receiver !== undefined && ast.is.IsIdentifier(receiver) && ast.text(receiver) === "rejected";
  });
  const comparison = current.nodes.find(node => ast.is.IsBinaryExpression(node) &&
    ast.operatorKindName(node) === "KindEqualsEqualsEqualsToken" && ast.as.AsBinaryExpression(node)?.Left === rejectedSize);
  const compared = comparison === undefined ? undefined : current.source.effectiveTypes.get(comparison);
  assert.equal(compared !== undefined && compared.kind !== "refused" && compared.type.kind === "primitive" &&
    compared.type.primitive === "bool", true);
  const has = current.nodes.find(node => {
    const expression = ast.is.IsCallExpression(node) ? ast.as.AsCallExpression(node)?.Expression : undefined;
    const property = expression !== undefined && ast.is.IsPropertyAccessExpression(expression)
      ? ast.as.AsPropertyAccessExpression(expression) : undefined;
    const receiver = property?.Expression;
    return expression !== undefined && receiver !== undefined && ast.is.IsIdentifier(receiver) && ast.text(receiver) === "rejected" &&
      ast.text(ast.name(expression)) === "has";
  });
  const called = has === undefined ? undefined : current.source.effectiveTypes.get(has);
  assert.equal(called !== undefined && called.kind !== "refused" && called.type.kind === "primitive" &&
    called.type.primitive === "bool", true, "the declared bool result does not need the method's receiver-dependent input binder");
});

test("C2357 annotated array constructor arguments retain union elements and exact dependent member identity", () => {
  const rows = [
    { name: "bare", annotation: "(int32 | uint32)[]", value: "[signed, unsigned]" },
    { name: "last", annotation: "(int32 | uint32 | number)[]", value: "[signed, unsigned, 1]" },
    { name: "middle", annotation: "readonly (int32 | uint32 | number)[]", value: "[signed, 1, unsigned]" },
    { name: "first", annotation: "Input", value: "[1, signed, unsigned]" },
    { name: "narrow", annotation: "readonly float32[]", value: "[narrow]" },
  ];
  const current = fixture(`interface Readable<Element> { read(): Element; }
    interface Published<Element> { readonly size: number; readonly value: Element; has(value: Element): boolean; }
    interface Factory { new<Choice>(values?: readonly Choice[] | Readable<Choice>): Published<Choice>; }
    type Input = readonly (int32 | uint32 | number)[];
    declare const factory: Factory;
    function run(signed: int32, unsigned: uint32, narrow: float32): void {
      ${rows.map(row => `const input_${row.name}: ${row.annotation} = ${row.value};
        const selected_${row.name} = new factory(input_${row.name});
        const payload_${row.name} = selected_${row.name}.value;
        const count_${row.name} = selected_${row.name}.size;
        const agrees_${row.name} = selected_${row.name}.has(input_${row.name}[0]) && selected_${row.name}.size === 1;
        void payload_${row.name}; void count_${row.name}; void agrees_${row.name};`).join("\n")}
    }`);
  for (const row of rows) {
    const input = sourceTypeDescriptorStructure(current.type(`input_${row.name}`));
    const selected = current.type(`selected_${row.name}`);
    const structure = sourceTypeDescriptorStructure(selected);
    const member = structure.kind === "shape" ? structure.members.find(candidate => candidate.name === "value") : undefined;
    assert.equal(input.kind === "array" && selected.kind === "declared" && selected.typeArguments.length === 1 &&
      sourceTypeDescriptorsEqual(selected.typeArguments[0]!, input.element), true,
    row.name + ": the existing authored element contract binds the exact constructor parameter");
    assert.equal(member !== undefined && current.type(`payload_${row.name}`) === member.type, true,
      row.name + ": dependent reads retain the same solved member object");
    assertSameValue(current.type(`count_${row.name}`), { kind: "primitive", primitive: "float64" });
    assertSameValue(current.type(`agrees_${row.name}`), { kind: "primitive", primitive: "bool" });
    if (row.name === "narrow") assertSameValue(current.type(`payload_${row.name}`), { kind: "primitive", primitive: "float32" });
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2351 closed declared union members retain occurrence narrowing and leave optional chains on their original path", () => {
  const current = fixture(`interface Published<Element> { value: int32 | undefined; readonly exact: int32; }
    function run(selected: Published<float32>): void {
      const before = selected.value;
      if (selected.value !== undefined) { const narrowed = selected.value; void narrowed; }
      const after = selected.value; const chained = selected?.exact;
      void before; void after; void chained;
    }
    function optional(selected?: Published<float32>): void { const absent = selected?.exact; void absent; }`);
  const { ast } = current.source;
  const optional: SourceTypeDescriptor = { kind: "optional", value: { kind: "primitive", primitive: "int32" } };
  assertSameValue(current.type("before"), optional);
  assertSameValue(current.type("after"), optional);
  assertSameValue(current.type("absent"), optional);
  assertSameValue(current.type("narrowed"), { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("chained"), { kind: "primitive", primitive: "int32" });
  const parameter = current.nodes.find(node => ast.is.IsParameterDeclaration(node) && ast.questionToken(node) === undefined &&
    ast.text(ast.name(node)) === "selected");
  const owner = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
  const structure = owner === undefined || owner.kind === "refused" ? undefined : sourceTypeDescriptorStructure(owner.type);
  const member = structure?.kind === "shape" ? structure.members.find(member => member.name === "value") : undefined;
  assert.equal(member !== undefined && sourceTypeDescriptorsEqual(member.type, optional), true,
    "narrowing one read never replaces the original required optional-valued storage contract");
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const chains = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.propertyAccess(node)?.optionalChain === true);
  assert.equal(chains.length, 2);
  for (const node of chains) {
    const record = graph.nodes.find(record => record.node === node);
    assert.equal(record !== undefined && record.association?.component === undefined, true,
      "a checked optional chain does not use the new closed original-declaration component producer");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2330 recursive alias calls retain nominal argument widths without selecting a union arm", () => {
  const current = fixture(`type Tree<Value> = Value | readonly Tree<Value>[];
    function keep<Value>(tree: Tree<Value>): Tree<Value> { return tree; }
    function run(tree: Tree<int32>): Tree<int32> { return keep<int32>(tree); }`);
  const { ast } = current.source;
  const call = current.nodes.find(node => ast.is.IsCallExpression(node));
  const selected = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  assert.equal(selected !== undefined && selected.method.length === 1 && selected.method[0]?.type.kind === "primitive" &&
    selected.method[0].type.primitive === "int32", true);
  const outcome = call === undefined ? undefined : current.source.effectiveTypes.get(call);
  const alias = current.nodes.find(node => ast.is.IsTypeAliasDeclaration(node));
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared" &&
    outcome.type.declaration === alias && outcome.type.typeArguments.length === 1 && outcome.type.typeArguments[0]?.kind === "primitive" &&
    outcome.type.typeArguments[0].primitive === "int32", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2330 nested callback array returns preserve the same float32 parameter and literal carrier", () => {
  const current = fixture(`function call(make: () => float32[]): float32[] { return make(); }
    function run(value: float32): float32 { return call(() => [value, 1])[0]; }`);
  const { ast } = current.source;
  const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
    outcome.type.element.kind === "primitive" && outcome.type.element.primitive === "float32", true);
  if (literal === undefined || outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "array") {
    throw new Error("The exact returned array is required.");
  }
  for (const element of ast.elements(literal)) {
    const selected = element === undefined ? undefined : current.source.effectiveTypes.get(element);
    assert.equal(selected !== undefined && selected.kind !== "refused" && sourceTypeDescriptorsEqual(selected.type, outcome.type.element), true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2335 reference coalescing retains its produced descriptors and discarded form stays outside the result domain", () => {
  for (const annotation of ["int32[]", "readonly [int32, string]", "{ readonly count: int32 }", "() => int32",
    "string", "Named", "object", "unknown"]) {
    const current = fixture(`class Named { count: int32 = 1; }
      function run(left: ${annotation}, right: ${annotation}): void {
        const before = left; const result = left ?? right; left ?? right; void before; void result;
      }`);
    assert.equal(sourceTypeDescriptorsEqual(current.type("result"), current.type("before")), true, annotation);
    const discarded = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
    assert.equal(discarded.length, 1, annotation);
    assert.equal(discarded.every(node => current.source.effectiveTypes.get(node) === undefined), true, annotation);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, annotation);
  }
});

test("C2337 assignment-pattern RHS retains every heterogeneous checked tuple element and its inferred admission", () => {
  const current = fixture(`function run(): void { let first: string | number;
    [first] = ["marker", 9007199254740993, -9007199254740993, 1e100]; void first; }`);
  const { ast } = current.source;
  const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node) &&
    ast.elements(node)[0] !== undefined && ast.is.IsStringLiteral(ast.elements(node)[0]));
  const selected = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const admissions = current.source.effectiveTypes.obligations().filter(
    (row): row is Extract<SourceTypeFlowObligation, { readonly kind: "literal-admission" }> => row.kind === "literal-admission" && row.site === literal,
  );
  assert.equal(selected !== undefined && selected.kind !== "refused" && selected.type.kind === "tuple" &&
    selected.type.elements.length === 4 && selected.type.elements[0]?.type.kind === "string" &&
    selected.type.elements.slice(1).every((element, index) => element.type.kind === "primitive" &&
      element.type.primitive === (index < 2 ? "int64" : "float64")), true);
  assert.equal(selected !== undefined && selected.kind !== "refused" && admissions.length === 1 &&
    admissions[0]?.authority === "inferred" && admissions[0].type === selected.type, true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2337 conditional dependencies retain boolean and optional call terms even when the call has no public graph value", () => {
  const current = fixture(`declare function condition(value: int32): boolean; declare function maybe(): (() => int32) | undefined;
    declare function effect(): int32;
    function run(): void { const selected = condition(1) ? 1 : 2;
      condition(1) ? effect() : effect(); condition(1) && effect(); condition(1) || effect(); maybe() ?? effect(); void selected; }`);
  assertSameValue(current.type("selected"), { kind: "primitive", primitive: "int64" });
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const conditions = graph.nodes.filter(record => {
    const expression = current.source.ast.as.AsCallExpression(record.node)?.Expression;
    return expression !== undefined && current.source.ast.is.IsIdentifier(expression) &&
      ["condition", "maybe"].includes(current.source.ast.text(expression));
  });
  assert.equal(conditions.length, 5);
  const booleanConditions = conditions.filter(record =>
    current.source.ast.text(current.source.ast.as.AsCallExpression(record.node)?.Expression) === "condition");
  assert.equal(booleanConditions.length === 4 && booleanConditions.every(record => !record.publish && record.term?.kind === "fixed"), true);
  const optionalCall = conditions.find(record => !booleanConditions.includes(record));
  const callable = optionalCall?.term?.kind === "fixed" && optionalCall.term.type.kind === "optional"
    ? sourceTypeDescriptorStructure(optionalCall.term.type.value) : undefined;
  const result = callable?.kind === "callable" ? callable.calls[0]?.result : undefined;
  assert.equal(optionalCall?.publish === true && result?.kind === "primitive" && result.primitive === "int32", true);
  const discarded = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(discarded.length, 4);
  assert.equal(discarded.every(node => current.source.effectiveTypes.get(node) === undefined), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2337 the canonical scalar calculation-arm reader preserves fixed nonfits and orders fitting primitive identities", () => {
  const current = fixture(`function run(fixed: int8, unique: string | float32, multiple: int32 | float32,
    unfitted: string | boolean): void { const value = -129; void value; }`);
  const { ast } = current.source;
  const literal = current.nodes.find(node => ast.is.IsPrefixUnaryExpression(node));
  const defaults = createSourceTypeFlowAnalysisContext(current.source);
  const receipt = literal === undefined ? undefined : defaults.context.literal(literal);
  if (receipt === undefined) throw new Error("The actual whole signed literal receipt is required.");
  for (const [name, kind, primitive] of [["fixed", "resolved", "int8"], ["unique", "resolved", "float32"],
    ["multiple", "resolved", "int32"], ["unfitted", "unfitted", undefined]] as const) {
    const parameter = current.nodes.find(node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === name);
    const outcome = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
    if (outcome === undefined || outcome.kind === "refused") throw new Error(`The actual ${name} slot is required.`);
    const selected = sourceTypeFlowScalarCalculationArm(outcome.type, receipt);
    assert.equal(selected.kind === kind && (selected.kind !== "resolved" || selected.primitive === primitive), true, name);
  }
});

test("C2421 scalar constructions retain strings and unique numeric kinds before native range validation", () => {
  const current = fixture(`function text(): string | undefined { return "text"; }
    function small(): int8 | boolean { return 128; }
    function floating(): float32 | boolean { return 1e39; }
    function wide(): int64 | boolean { return 9223372036854775808n; }`);
  const { ast } = current.source;
  const values = current.nodes.filter(node => {
    const parent = ast.parent(node);
    return parent !== undefined && ast.is.IsReturnStatement(parent) &&
      (ast.is.IsStringLiteral(node) || ast.is.IsNumericLiteral(node) || ast.is.IsBigIntLiteral(node));
  });
  assert.equal(values.length, 4);
  for (const [index, value] of values.entries()) {
    const outcome = current.source.effectiveTypes.get(value);
    const physical = outcome === undefined || outcome.kind === "refused" ? undefined : outcome.construction;
    assert.equal(index === 0 ? physical?.kind === "string" : physical?.kind === "primitive" &&
      physical.primitive === (["string", "int8", "float32", "int64"] as const)[index], true,
      `construction ${index}: exact kind publication does not suppress the target's range check`);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2337 signed literal calculation arms do not replace the published scalar union or its spelling child", () => {
  for (const [width, token] of [["int32", "-2147483648"], ["float32", "-1.5"], ["number", "-9007199254740993"]] as const) {
    const current = fixture(`function run(): (string | ${width})[] { return ["marker", ${token}]; }`);
    const { ast } = current.source;
    const expression = current.nodes.find(node => ast.is.IsPrefixUnaryExpression(node));
    const child = expression === undefined ? undefined : ast.as.AsPrefixUnaryExpression(expression)?.Operand;
    const whole = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    const spelling = child === undefined ? undefined : current.source.effectiveTypes.get(child);
    assert.equal(whole !== undefined && whole.kind !== "refused" && whole.type.kind === "union" &&
      spelling !== undefined && spelling.kind !== "refused" && sourceTypeDescriptorsEqual(whole.type, spelling.type), true, width);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, width);
  }
});

test("C2337 a stored capture keeps one canonical refusal per original owner through repeated reads and compound writes", () => {
  const current = fixture(`function run(): void { let visits = 0; let other = 0;
    const read = () => { visits += 1; return visits + visits; };
    const second = () => { other += 1; return other; }; void read; void second; }`);
  const { ast } = current.source;
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 2);
  for (const name of ["visits", "other"]) {
    const declaration = current.declaration(name);
    const matching = issues.filter(issue => issue.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE" && issue.related === declaration);
    assert.equal(matching.length, 1, name);
    const captured = current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.text(node) === name && ast.name(declaration) !== node);
    for (const node of captured) {
      const outcome = current.source.effectiveTypes.get(node);
      assert.equal(outcome === matching[0], true, name);
    }
  }
});

test("C2337 nested discarded coalescing validates only retained branch dependencies and preserves false as present", () => {
  const current = fixture(`declare function condition(value: boolean): boolean; declare function effect(): int32;
    function run(flag: boolean): void {
      (condition(flag) ? (() => 1) : undefined) ?? (() => 2);
      (condition(false) && (() => 1)) ?? (() => 2);
      (condition(flag) || (() => 1)) ?? (() => 2);
      (condition(flag) ? (effect(), () => 1) : (effect(), undefined)) ?? (effect(), () => 2);
    }`);
  const selectors = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(selectors.length, 8);
  assert.equal(selectors.every(node => current.source.effectiveTypes.get(node) === undefined), true);
  const absent = current.nodes.filter(node => current.source.ast.is.IsIdentifier(node) && current.source.ast.text(node) === "undefined");
  assert.equal(absent.length === 2 && absent.every(node => {
    const outcome = current.source.effectiveTypes.get(node);
    return outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" && outcome.type.intrinsic === "absence";
  }), true, "the two retained absence leaves have their own canonical value, not a selector result");
  assert.equal(current.source.effectiveTypes.refusals().length, 0, JSON.stringify(current.source.effectiveTypes.refusals().map(issue => {
    const range = current.source.ast.authoredRange(issue.site);
    const file = current.source.ast.getSourceFile(issue.site);
    return { code: issue.code, kind: current.source.ast.kindName(issue.site), reason: issue.reason.slice(0, 160),
      site: range?.kind === "authored" && file !== undefined
        ? current.source.ast.getSourceText(file).slice(range.start, Math.min(range.end, range.start + 100)) : "unavailable" };
  })).slice(0, 2048));
});

test("C2337 nested discarded primitive selection does not bypass a coalescing refusal", () => {
  const current = fixture(`declare function effect(): void;
    function run(flag: boolean): void { const first = 1; const second = 2; (flag ? first : second) ?? effect(); }`);
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length === 1 && current.source.ast.operatorKindName(issues[0]?.site) === "KindQuestionQuestionToken" &&
    issues[0]?.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" && issues[0].reason.includes("nullable"), true);
});

test("C2338 multiple fitting literal arms use stable primitive identity priority in both authored union orders", () => {
  for (const annotation of ["int32 | number", "number | int32"]) {
    const current = fixture(`function run(value: ${annotation}): (${annotation})[] { return [-1, 1 + 2, (8 / 2 + 1)]; }`);
    const { ast } = current.source;
    const defaults = createSourceTypeFlowAnalysisContext(current.source);
    const parameter = current.nodes.find(node => ast.is.IsParameterDeclaration(node));
    const destination = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
    if (destination === undefined || destination.kind === "refused") throw new Error("The original union slot is required.");
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
    const expressions = literal === undefined ? [] : ast.elements(literal).filter((node): node is Node => node !== undefined);
    assert.equal(expressions.length, 3, annotation);
    for (const expression of expressions) {
      const receipt = defaults.context.literal(expression);
      if (receipt === undefined) throw new Error("Each actual folded or signed receipt is required.");
      const selected = sourceTypeFlowScalarCalculationArm(destination.type, receipt);
      assert.equal(selected.kind === "resolved" && selected.primitive === "int32", true, annotation);
      const outcome = current.source.effectiveTypes.get(expression);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" &&
        sourceTypeDescriptorsEqual(outcome.type, destination.type), true, annotation);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.construction?.kind === "primitive" &&
        outcome.construction.primitive === "int32", true, annotation);
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0, annotation);
  }
});

test("C2338 folded literal union slots reuse the same fit decision without admitting a refused power operation", () => {
  for (const [annotation, primitive] of [["string | float32", "float32"], ["string | number", "float64"]] as const) {
    const current = fixture(`function run(value: ${annotation}): (${annotation})[] { return [1 + 2, (8 / 2 + 1)]; }`);
    const { ast } = current.source;
    const defaults = createSourceTypeFlowAnalysisContext(current.source);
    const parameter = current.nodes.find(node => ast.is.IsParameterDeclaration(node));
    const destination = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
    if (destination === undefined || destination.kind === "refused") throw new Error("The original folded destination is required.");
    const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
    const expressions = literal === undefined ? [] : ast.elements(literal).filter((node): node is Node => node !== undefined);
    assert.equal(expressions.length, 2, annotation);
    for (const expression of expressions) {
      const receipt = defaults.context.literal(expression);
      if (receipt === undefined) throw new Error("The actual whole folded receipt is required.");
      const selected = sourceTypeFlowScalarCalculationArm(destination.type, receipt);
      assert.equal(selected.kind === "resolved" && selected.primitive === primitive, true, annotation);
      const outcome = current.source.effectiveTypes.get(expression);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" &&
        sourceTypeDescriptorsEqual(outcome.type, destination.type), true, annotation);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.construction?.kind === "primitive" &&
        outcome.construction.primitive === primitive, true, annotation);
    }
    assert.equal(current.source.effectiveTypes.refusals().length, 0, annotation);
  }
  const power = fixture("function run(): (int32 | number)[] { return [2 ** 2]; }");
  const expression = power.nodes.find(node => power.source.ast.is.IsBinaryExpression(node));
  const outcome = expression === undefined ? undefined : power.source.effectiveTypes.get(expression);
  assert.equal(outcome !== undefined && outcome.kind === "refused" && outcome.reason.includes("Exponentiation"), true);
});

test("C2338 declared and bound numeric operands cannot retarget as open literals under a union destination", () => {
  const current = fixture(`const moduleFixed: uint32 = 1;
    function run(value: uint32): (int32 | number)[] {
      const declared: uint32 = 1;
      return [moduleFixed + 1, value + 1, declared + 1, (1 as uint32) + 1];
    }`);
  const expressions = current.nodes.filter(node => current.source.ast.is.IsBinaryExpression(node));
  assert.equal(expressions.length, 4);
  for (const expression of expressions) {
    const left = current.source.ast.as.AsBinaryExpression(expression)?.Left;
    const outcome = left === undefined ? undefined : current.source.effectiveTypes.get(left);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === "uint32", true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const selected = fixture("function run(value: int32 | number): void { const result = -value; void result; }");
  const expression = selected.nodes.find(node => selected.source.ast.is.IsPrefixUnaryExpression(node));
  const outcome = expression === undefined ? undefined : selected.source.effectiveTypes.get(expression);
  assert.equal(outcome !== undefined && outcome.kind === "refused" && outcome.reason.includes("union operand"), true);
});

test("C2339 all co-fitting numeric pairs use the explicit whole-literal priority in both authored orders", () => {
  const primitives = [
    ["int64", "int64", "bigint", true, 64], ["int8", "int8", "number", true, 8],
    ["uint8", "uint8", "number", false, 8], ["int16", "int16", "number", true, 16],
    ["uint16", "uint16", "number", false, 16], ["int32", "int32", "number", true, 32],
    ["uint32", "uint32", "number", false, 32], ["uint64", "uint64", "bigint", false, 64],
    ["int128", "int128", "bigint", true, 128], ["uint128", "uint128", "bigint", false, 128],
    ["nativeInt", "native-int", "number", true, undefined], ["nativeUint", "native-uint", "number", false, undefined],
    ["decimal", "decimal", "number", true, 128], ["float16", "float16", "number", true, 16],
    ["float32", "float32", "number", true, 32], ["float64", "float64", "number", true, 64],
  ] as const;
  const pairs = primitives.flatMap((first, index) => primitives.slice(index + 1).flatMap(second =>
    [[first, second], [second, first]].map(([left, right], order) => ({
      name: `pair_${index}_${primitives.indexOf(second)}_${order}`, left: left!, right: right!, expected: first[1],
    }))));
  const constructions = [
    { name: "equal8", members: ["int8", "uint8"], elements: ["1"], expected: ["int8"] },
    { name: "narrowest", members: ["int8", "int16"], elements: ["1", "300", "1 + 2"], expected: ["int8", "int16", "int8"] },
    { name: "equal32", members: ["int32", "uint32"], elements: ["1"], expected: ["int32"] },
    { name: "platform", members: ["int32", "nativeInt"], elements: ["1"], expected: ["int32"] },
    { name: "fixedUnsigned32", members: ["uint32", "nativeInt"], elements: ["1"], expected: ["uint32"] },
    { name: "fixedUnsigned64", members: ["uint64", "nativeUint"], elements: ["1n"], expected: ["uint64"] },
    { name: "fixed128", members: ["int128", "nativeInt"], elements: ["1n"], expected: ["int128"] },
    { name: "default64", members: ["int64", "uint64"], elements: ["5n"], expected: ["int64"] },
    { name: "default32", members: ["int32", "int64"], elements: ["1"], expected: ["int64"] },
    { name: "integerFloat", members: ["int32", "float64"], elements: ["-1", "(8 / 2 + 1)"], expected: ["int32", "int32"] },
    { name: "unique", members: ["uint8", "uint16"], elements: ["300"], expected: ["uint16"] },
  ].flatMap(row => [false, true].map(reverse => ({ ...row, name: row.name + (reverse ? "_reverse" : "_forward"),
    annotation: (reverse ? [...row.members].reverse() : row.members).join(" | ") })));
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/widths/package.json": JSON.stringify({ name: "@test/widths", version: "1.0.0", type: "module",
      exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/widths/index.d.ts": primitives.map(([name, , base]) => `export type ${name} = ${base};`).join("\n"),
    "/src/index.ts": `import type { ${primitives.map(([name]) => name).join(", ")} } from "@test/widths";
      const positive = 1; const negative = -1;
      ${pairs.map(pair => `function accept_${pair.name}(${pair.name}: ${pair.left[0]} | ${pair.right[0]}): void {}`).join("\n")}
      ${constructions.map(row => `function construct_${row.name}(): (${row.annotation})[] { return [${row.elements.join(", ")}]; }`).join("\n")}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/widths",
    packageName: "@test/widths", exports: primitives.map(([name, kind, base, signed, width]) =>
      sourcePrimitive(name, kind, base, signed, width)) }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The actual all-pairs Source file is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push(node);
    pending.push(...source.ast.children(node).filter((child): child is Node => child !== undefined));
  }
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const positiveDeclaration = nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.name(node) !== undefined && source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)) === "positive");
  const positive = positiveDeclaration === undefined ? undefined : source.ast.as.AsVariableDeclaration(positiveDeclaration)?.Initializer;
  const negative = nodes.find(node => source.ast.is.IsPrefixUnaryExpression(node));
  const positiveReceipt = positive === undefined ? undefined : defaults.context.literal(positive);
  const negativeReceipt = negative === undefined ? undefined : defaults.context.literal(negative);
  if (positiveReceipt === undefined || negativeReceipt === undefined) throw new Error("Both original whole literal receipts are required.");
  assert.equal(primitives.length, 16);
  assert.equal(new Set(primitives.map(([, kind]) => kind)).size, 16);
  assert.equal(sourcePrimitiveOperatorKinds.filter(kind => kind !== "bool" && kind !== "char").every(kind =>
    primitives.some(([, selected]) => kind === selected)), true);
  assert.equal(pairs.length, 240);
  assert.equal(sourcePrimitiveOperatorLiteralFits(positiveReceipt, "bool") || sourcePrimitiveOperatorLiteralFits(positiveReceipt, "char"), false);
  const parameters = new Map(nodes.filter(node => source.ast.is.IsParameterDeclaration(node))
    .map(node => [source.ast.text(source.ast.name(node)), node] as const));
  for (const pair of pairs) {
    const parameter = parameters.get(pair.name);
    const destination = parameter === undefined ? undefined : source.effectiveTypes.get(parameter);
    if (destination === undefined || destination.kind === "refused") throw new Error(`The original ${pair.name} union slot is required.`);
    const structure = sourceTypeDescriptorStructure(destination.type);
    assert.equal(structure.kind === "union" && structure.types.length === 2 &&
      structure.types.every(type => type.kind === "primitive" && [pair.left[1], pair.right[1]].some(kind => kind === type.primitive)), true, pair.name);
    assert.equal(sourcePrimitiveOperatorLiteralFits(positiveReceipt, pair.left[1]) &&
      sourcePrimitiveOperatorLiteralFits(positiveReceipt, pair.right[1]), true, pair.name);
    const selected = sourceTypeFlowScalarCalculationArm(destination.type, positiveReceipt);
    assert.equal(selected.kind === "resolved" && selected.primitive === pair.expected, true, pair.name);
    if ([pair.left[1], pair.right[1]].includes("int32") && [pair.left[1], pair.right[1]].includes("float64")) {
      const signed = sourceTypeFlowScalarCalculationArm(destination.type, negativeReceipt);
      assert.equal(signed.kind === "resolved" && signed.primitive === "int32", true, pair.name);
    }
  }
  for (const row of constructions) {
    const declaration = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === `construct_${row.name}`);
    const body = declaration === undefined ? undefined : source.ast.body(declaration);
    const statement = body === undefined ? undefined : source.ast.statements(body)[0];
    const literal = statement === undefined ? undefined : source.ast.as.AsReturnStatement(statement)?.Expression;
    const array = literal === undefined ? undefined : source.effectiveTypes.get(literal);
    assert.equal(literal !== undefined && source.ast.is.IsArrayLiteralExpression(literal) && array !== undefined && array.kind !== "refused" &&
      array.type.kind === "array" && array.type.element.kind === "union", true, row.name);
    if (literal === undefined || array === undefined || array.kind === "refused" || array.type.kind !== "array") throw new Error("The original union array is required.");
    const elements = source.ast.elements(literal);
    assert.equal(elements.length, row.expected.length, row.name);
    for (const [index, element] of elements.entries()) {
      const outcome = element === undefined ? undefined : source.effectiveTypes.get(element);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && sourceTypeDescriptorsEqual(outcome.type, array.type.element) &&
        outcome.construction?.kind === "primitive" && outcome.construction.primitive === row.expected[index], true,
      row.name + ": each actual literal retains full storage and its independently solved arm");
    }
  }
  assert.equal(source.effectiveTypes.refusals().length, 0);
});

test("C2342 folded scalar construction publishes its solved arm without replacing optional or union storage", () => {
  const slots = [["direct", "int32"], ["optional", "int32 | undefined"], ["union", "int32 | string"],
    ["nested", "NestedScalar"], ["optional_union", "NestedScalar | undefined"]] as const;
  const forms = [["binary", "1 + 2"], ["parenthesized", "(8 / 2 + 1)"], ["signed", "-1"]] as const;
  const rows = slots.flatMap(([name, annotation]) => forms.map(([form, expression]) => ({
    name: `${name}_${form}`, annotation, expression,
  })));
  const current = fixture(`type NestedScalar = string | (int32 | boolean);
    ${rows.map(row => `function ${row.name}(slot: ${row.annotation}): ${row.annotation} { return ${row.expression}; }`).join("\n")}
    function broad(): unknown { return 1 + 2; }`);
  const { ast } = current.source;
  for (const row of rows) {
    const owner = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === row.name);
    const parameter = owner === undefined ? undefined : ast.parameters(owner)[0];
    const destination = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
    const body = owner === undefined ? undefined : ast.body(owner);
    const statement = body === undefined ? undefined : ast.statements(body)[0];
    const expression = statement === undefined ? undefined : ast.as.AsReturnStatement(statement)?.Expression;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(destination !== undefined && destination.kind !== "refused" && outcome !== undefined && outcome.kind !== "refused" &&
      sourceTypeDescriptorsEqual(outcome.type, destination.type), true, row.name + ": logical declared slot");
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The actual scalar construction is required.");
    const physical = outcome.construction ?? outcome.type;
    assert.equal(physical.kind === "primitive" && physical.primitive === "int32" && Object.isFrozen(physical), true,
      row.name + ": solved admitted scalar arm");
    if (ast.is.IsParenthesizedExpression(expression!)) {
      const child = ast.as.AsParenthesizedExpression(expression!)?.Expression;
      const inner = child === undefined ? undefined : current.source.effectiveTypes.get(child);
      assert.equal(inner !== undefined && inner.kind !== "refused" &&
        sourceTypeDescriptorsEqual(inner.type, outcome.type) && (inner.construction ?? inner.type) === physical, true,
        row.name + ": wrapper keeps the same completed arm object");
    }
  }
  const broad = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "broad");
  const body = broad === undefined ? undefined : ast.body(broad);
  const statement = body === undefined ? undefined : ast.statements(body)[0];
  const expression = statement === undefined ? undefined : ast.as.AsReturnStatement(statement)?.Expression;
  const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
    outcome.type.intrinsic === "unknown" && outcome.construction?.kind === "primitive" &&
    outcome.construction.primitive === "int64", true,
    "C2360 Q1 retains unknown storage while publishing the same solved int64 construction");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2360 own integer defaults retain int64 bounds, native division and the original range owner", () => {
  const positive = fixture(`const moduleMinimum = -(9223372036854775808);
    const moduleSignedDivision = -(7 / 2);
    export const exportedMaximum = 9223372036854775807;
    class Holder { value = -(9223372036854775808); }
    function run(): void { const localMinimum = -9223372036854775808; const wrappedMinimum = -((9223372036854775808));
      const quotient = 7 / 2; const fractional = 7 / 2.0; const exponent = 7e0 / 2;
      void localMinimum; void wrappedMinimum; void quotient; void fractional; void exponent; }
    function accumulate(values: number[]): number { let total = 0; for (const entry of values) total += entry; return total; }
    function shift(left: int32): int32 { const count = 1; const shifted = left << count; return shifted; }`);
  for (const name of ["moduleMinimum", "moduleSignedDivision", "exportedMaximum", "localMinimum", "wrappedMinimum", "quotient"])
    assertSameValue(positive.type(name), { kind: "primitive", primitive: "int64" });
  for (const name of ["fractional", "exponent", "total"])
    assertSameValue(positive.type(name), { kind: "primitive", primitive: "float64" });
  assertSameValue(positive.type("count"), { kind: "primitive", primitive: "int64" });
  assertSameValue(positive.type("shifted"), { kind: "primitive", primitive: "int32" });
  const field = positive.nodes.find(node => positive.source.ast.is.IsPropertyDeclaration(node));
  const fieldOutcome = field === undefined ? undefined : positive.source.effectiveTypes.get(field);
  assert.equal(fieldOutcome !== undefined && fieldOutcome.kind !== "refused" && fieldOutcome.type.kind === "primitive" &&
    fieldOutcome.type.primitive === "int64", true, "the field uses the same signed-whole default");
  assert.equal(positive.source.effectiveTypes.refusals().length, 0);
  const negative = fixture(`const moduleOverflow = 9223372036854775808;
    export const exportedOverflow = -9223372036854775809;
    class Holder { value = (9223372036854775808); }
    function run(): void { const localOverflow = -9223372036854775809;
      const foldedOverflow = 9223372036854775807 + 1; void localOverflow; void foldedOverflow; }
    function read(): void { void moduleOverflow; void exportedOverflow; }`);
  const issues = negative.source.effectiveTypes.refusals();
  assert.equal(issues.length, 5, "one precise own-creation range refusal per actual initializer");
  assert.equal(issues.every(issue => issue.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
    issue.reason === "An unbound integer literal is outside the exact 'int64' range. Annotate it with an exact native type or use bigint."), true);
  for (const name of ["moduleOverflow", "exportedOverflow", "localOverflow", "foldedOverflow"]) {
    const outcome = negative.source.effectiveTypes.get(negative.declaration(name));
    assert.equal(outcome !== undefined && outcome.kind === "refused" && issues.includes(outcome), true, name);
  }
  const rejectedField = negative.nodes.find(node => negative.source.ast.is.IsPropertyDeclaration(node));
  const rejectedFieldOutcome = rejectedField === undefined ? undefined : negative.source.effectiveTypes.get(rejectedField);
  assert.equal(rejectedFieldOutcome !== undefined && rejectedFieldOutcome.kind === "refused" && issues.includes(rejectedFieldOutcome), true,
    "the field retains its original own-creation range owner");
});

test("C2360 literal selection partners use the same admission fit without retargeting bound values", () => {
  const current = fixture(`function run(flag: boolean, small: int8, narrow: float32): void {
    const selectedSmall = flag ? small : 1; const selectedNarrow = flag ? narrow : 1;
    const bound: int64 = 1n; const retained = flag ? bound : small;
    void selectedSmall; void selectedNarrow; void retained; }`);
  assertSameValue(current.type("selectedSmall"), { kind: "primitive", primitive: "int8" });
  assertSameValue(current.type("selectedNarrow"), { kind: "primitive", primitive: "float32" });
  assertSameValue(current.type("bound"), { kind: "primitive", primitive: "int64" });
  const retained = current.type("retained");
  assert.equal(retained.kind === "union" && retained.types.length === 2 && retained.types.every(type =>
    type.kind === "primitive" && (type.primitive === "int8" || type.primitive === "int64")), true,
  "a bound producer is not reopened as a literal under its partner");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2358 broad scalar storage publishes the solved own primitive without choosing another width", () => {
  const rows = [
    { name: "integer", expression: "17", primitive: "int64" },
    { name: "fraction", expression: "17.5", primitive: "float64" },
    { name: "exponent", expression: "17e0", primitive: "float64" },
    { name: "signed", expression: "-17", primitive: "int64" },
    { name: "folded", expression: "(8 / 2 + 1)", primitive: "int64" },
    { name: "boolean", expression: "true", primitive: "bool" },
  ] as const;
  const current = fixture(`declare function same(left: unknown, right: unknown): boolean;
    ${rows.map(row => `function ${row.name}(): unknown { return ${row.expression}; }`).join("\n")}
    function declared(): unknown { const value: unknown = 17; return value; }
    function fixed(value: float32): boolean { return same(value, 17); }
    function paired(): boolean { return same(17, 17); }
    function mixed(): unknown[] { return [1, 17.5, 1 + 2, true]; }`);
  const { ast } = current.source;
  for (const row of rows) {
    const declaration = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === row.name);
    const body = declaration === undefined ? undefined : ast.body(declaration);
    const statement = body === undefined ? undefined : ast.statements(body)[0];
    const expression = statement === undefined ? undefined : ast.as.AsReturnStatement(statement)?.Expression;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
      outcome.type.intrinsic === "unknown" && outcome.construction?.kind === "primitive" &&
      outcome.construction.primitive === row.primitive && Object.isFrozen(outcome.construction), true, row.name);
  }
  const declaration = current.declaration("value");
  const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
  const outcome = initializer === undefined ? undefined : current.source.effectiveTypes.get(initializer);
  const storage = current.source.effectiveTypes.get(declaration);
  assert.equal(storage !== undefined && storage.kind !== "refused" && storage.type.kind === "intrinsic" &&
    storage.type.intrinsic === "unknown" && outcome !== undefined && outcome.kind !== "refused" &&
    outcome.type.kind === "intrinsic" && outcome.type.intrinsic === "unknown" && outcome.construction?.kind === "primitive" &&
    outcome.construction.primitive === "int64", true, "the declaration remains broad while the literal carries its own int64 default");
  const calls = current.nodes.filter(node => ast.is.IsCallExpression(node));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    for (const argument of ast.arguments(call)) {
      if (argument === undefined) throw new Error("The original argument is required.");
      const value = current.source.effectiveTypes.get(argument);
      assert.equal(value !== undefined && value.kind !== "refused", true);
      if (value === undefined || value.kind === "refused") throw new Error("The published argument is required.");
      if (ast.is.IsIdentifier(argument)) {
        assert.equal(value.type.kind === "primitive" && value.type.primitive === "float32", true,
          "an existing fixed producer retains its width through broad parameter storage");
      } else {
        assert.equal(value.type.kind === "intrinsic" && value.type.intrinsic === "unknown" &&
          value.construction?.kind === "primitive" && value.construction.primitive === "int64", true,
        "unknown parameters never make a second literal-width choice");
      }
    }
  }
  const literal = current.nodes.find(node => ast.is.IsArrayLiteralExpression(node));
  const elements = literal === undefined ? [] : ast.elements(literal);
  assert.equal(elements.length, 4);
  for (const [index, element] of elements.entries()) {
    const value = element === undefined ? undefined : current.source.effectiveTypes.get(element);
    assert.equal(value !== undefined && value.kind !== "refused" && value.type.kind === "intrinsic" && value.type.intrinsic === "unknown" &&
      value.construction?.kind === "primitive" && value.construction.primitive === ["int64", "float64", "int64", "bool"][index], true,
    "unknown element storage does not merge distinct scalar construction widths");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2360 exact primitive context precedes the own-default range without retargeting fixed peers", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/wide/package.json": JSON.stringify({ name: "@test/wide", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/wide/index.d.ts": "export type uint64 = number; export type int128 = number; export type int64 = number;",
    "/src/index.ts": `import type { uint64, int128, int64 } from "@test/wide";
      function run(unsigned: uint64, wide: int128): void {
        const direct64 = 9223372036854775808 + unsigned;
        const wrapped64 = (9223372036854775808) + unsigned;
        const folded64 = (9223372036854775808 + 1) + unsigned;
        const target64: uint64 = 9223372036854775808 + 1;
        const direct128 = 18446744073709551616 + wide;
        const signed128 = -18446744073709551616 + wide;
        const foldedSigned128 = -(18446744073709551616 + 1) + wide;
        const target128: int128 = 18446744073709551616 + 1;
        void direct64; void wrapped64; void folded64; void target64; void direct128; void signed128; void foldedSigned128; void target128;
      }
      function fixed(peer: int64): void { const values = [peer, -9223372036854775809]; void values; }
      function own(): void { const outside = 9223372036854775808; void outside; }
      function broad(): unknown { return 9223372036854775808; }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/wide", packageName: "@test/wide",
    exports: [sourcePrimitive("uint64", "uint64", "number", false, 64), sourcePrimitive("int128", "int128", "number", true, 128),
      sourcePrimitive("int64", "int64", "number", true, 64)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original wide-context file is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push(node);
    pending.push(...source.ast.children(node).filter((child): child is Node => child !== undefined));
  }
  for (const [name, primitive] of [["direct64", "uint64"], ["wrapped64", "uint64"], ["folded64", "uint64"], ["target64", "uint64"],
    ["direct128", "int128"], ["signed128", "int128"], ["foldedSigned128", "int128"], ["target128", "int128"]] as const) {
    const declaration = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    const outcome = declaration === undefined ? undefined : source.effectiveTypes.get(declaration);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === primitive, true, name);
  }
  const values = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "values");
  const stored = values === undefined ? undefined : source.effectiveTypes.get(values);
  assert.equal(stored !== undefined && stored.kind !== "refused" && stored.type.kind === "array" && stored.type.element.kind === "primitive" &&
    stored.type.element.primitive === "int64", true, "the non-fitting signed whole retains its actual fixed peer for D2");
  const issues = source.effectiveTypes.refusals();
  assert.equal(issues.length, 2, "only the local and broad own-creation defaults are outside int64");
  assert.equal(issues.every(issue => issue.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
    issue.reason === "An unbound integer literal is outside the exact 'int64' range. Annotate it with an exact native type or use bigint."), true);
});

test("C2357 direct declared primitive wrappers publish the same solved scalar object", () => {
  const rows = ["int8", "int32", "float32"].flatMap((annotation, index) => [
    { name: `sum_${index}`, annotation, expression: "((1 + 2))" },
    { name: `signed_${index}`, annotation, expression: "((-1))" },
  ]);
  const current = fixture(rows.map(row => `function ${row.name}(): ${row.annotation} { return ${row.expression}; }`).join("\n"));
  const { ast } = current.source;
  for (const row of rows) {
    const declaration = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === row.name);
    const body = declaration === undefined ? undefined : ast.body(declaration);
    const statement = body === undefined ? undefined : ast.statements(body)[0];
    let expression = statement === undefined ? undefined : ast.as.AsReturnStatement(statement)?.Expression;
    const outcome = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === row.annotation && outcome.construction === undefined, true, row.name);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The solved direct primitive is required.");
    while (expression !== undefined && ast.is.IsParenthesizedExpression(expression)) {
      expression = ast.as.AsParenthesizedExpression(expression)?.Expression;
      const inner = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
      assert.equal(inner !== undefined && inner.kind !== "refused" && inner.type === outcome.type && Object.isFrozen(inner.type), true,
        row.name + ": every transparent occurrence retains the same completed primitive");
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2344 a narrowed optional read does not widen the coalescing admission of its produced primitive", () => {
  const current = fixture(`declare function effect(): void; function run(): number { let optional: number | undefined = 4;
    const observed = optional; const direct = optional ?? 0; const sequenced = (effect(), optional) ?? 0;
    return observed + direct + sequenced; }`);
  const { ast } = current.source;
  const declaration = current.declaration("optional");
  const storage = current.source.effectiveTypes.get(declaration);
  assert.equal(storage !== undefined && storage.kind !== "refused" && storage.type.kind === "optional", true);
  const reads = current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.name(declaration) !== node &&
    current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
  assert.equal(reads.length, 3);
  assert.equal(reads.every(node => {
    const outcome = current.source.effectiveTypes.get(node);
    return outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "float64";
  }), true, "real checker flow narrowing remains on each read");
  for (const name of ["direct", "sequenced"]) {
    const outcome = current.source.effectiveTypes.get(current.declaration(name));
    assert.equal(outcome?.kind === "refused" && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
      ast.operatorKindName(outcome.site) === "KindQuestionQuestionToken", true, name);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 2);
  const fixed = fixture(`function run(): number { const value: number = 4; return value ?? 0; }`);
  const issues = fixed.source.effectiveTypes.refusals();
  assert.equal(issues.length === 1 && issues[0]?.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED" &&
    issues[0].reason === "A coalescing operator requires a nullable or runtime-union left operand.", true);
});

test("C2342 discarded closures project captures from the retained owner without joining inference roots", () => {
  const current = fixture(`function run(flag: boolean): void { const value = flag ? 1 : 2;
    (flag ? (() => value) : (() => value + 1));
    (flag ? function () { return value + 2; } : function () { return value; });
  }`);
  const declaration = current.declaration("value");
  const owner = current.source.effectiveTypes.get(declaration);
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const record = graph.nodes.find(record => record.node === declaration);
  const captured = graph.nodes.filter(read => read.kind === "read" && read.declaration === declaration && read.root !== record?.root);
  assert.equal(captured.length, 4);
  assert.equal(captured.every(read => {
    const outcome = current.source.effectiveTypes.get(read.node);
    return owner !== undefined && owner.kind !== "refused" && outcome !== undefined && outcome.kind !== "refused" &&
      sourceTypeDescriptorsEqual(outcome.type, owner.type) && read.variable !== record?.variable;
  }), true, "each discarded root consumes the same solved parent type through a distinct read");
  const roots = new Map(graph.nodes.map(record => [record.variable.node, record.root]));
  assert.equal(graph.links.every(link => roots.get(link.source.node) === roots.get(link.target.node)), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const retained = fixture(`function run(flag: boolean): void { const value = flag ? 1 : 2;
    const read = () => value + 1; void read; }`);
  const issues = retained.source.effectiveTypes.refusals();
  assert.equal(issues.length === 1 && issues[0]?.code === "TSONIC_LOCAL_TYPE_SELF_REFERENCE", true);
});

test("C2344 discarded comma selection consumes never completion without admitting a normal numeric coalesce", () => {
  const current = fixture(`declare function fail(): never; declare function ready(): number; declare function effect(): void;
    function abrupt(): void { (fail(), ready()) ?? effect(); }
    function normal(): void { (ready(), ready()) ?? effect(); }`);
  const { ast } = current.source;
  const selectors = current.nodes.filter(node => sourceTypeFlowDiscardedSelection(current.source, node));
  assert.equal(selectors.length, 2);
  assert.equal(selectors.every(node => current.source.effectiveTypes.get(node) === undefined), true);
  const fail = current.nodes.find(node => ast.is.IsCallExpression(node) &&
    ast.text(ast.as.AsCallExpression(node)?.Expression) === "fail");
  const never = fail === undefined ? undefined : current.source.effectiveTypes.get(fail);
  assert.equal(never !== undefined && never.kind !== "refused" && never.type.kind === "intrinsic" && never.type.intrinsic === "never", true);
  const normal = selectors.find(node => {
    const left = ast.as.AsBinaryExpression(node)?.Left;
    const sequence = left === undefined ? undefined : ast.as.AsParenthesizedExpression(left)?.Expression;
    const effect = sequence === undefined ? undefined : ast.as.AsBinaryExpression(sequence)?.Left;
    const callee = effect === undefined ? undefined : ast.as.AsCallExpression(effect)?.Expression;
    return callee !== undefined && ast.is.IsIdentifier(callee) && ast.text(callee) === "ready";
  });
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(normal !== undefined && issues.length === 1 && issues[0]?.site === normal &&
    issues[0].reason === "A coalescing operator requires a nullable or runtime-union left operand.", true);
});

test("C2373 fixed scalar data keeps its producer while an aliased literal retains optional member admission", () => {
  const current = fixture(`interface Options { recursive?: boolean; value?: float32; }
    function run(bound: int32): void {
      const base = { recursive: true }; const tuned = base; const final = tuned; const options: Options = final;
      const marked: Options = { recursive: false, value: bound }; void options; void marked;
    }`);
  const { ast } = current.source;
  const literals = current.nodes.filter(node => ast.is.IsObjectLiteralExpression(node));
  assert.equal(literals.length, 2);
  for (const literal of literals) {
    const outcome = current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "declared", true,
      "the aggregate retains the complete authored destination");
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && admissions.length === 1 &&
      admissions[0]?.type === outcome.type, true, "the real member conversion remains an independent aggregate admission");
    for (const property of ast.properties(literal)) {
      const value = property === undefined ? undefined : ast.as.AsPropertyAssignment(property)?.Initializer;
      const selected = value === undefined ? undefined : current.source.effectiveTypes.get(value);
      const expected = value !== undefined && ast.is.IsIdentifier(value) ? "int32" : "bool";
      const produced = selected === undefined || selected.kind === "refused" ? undefined : selected.construction ?? selected.type;
      assert.equal(produced?.kind === "primitive" && produced.primitive === expected, true,
        "a declared optional slot cannot change the actual fixed producer's width");
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2373 signed spelling operands publish their actual contextual kind without an own-default retry", () => {
  for (const [primitive, token] of [["int8", "-129"], ["int32", "-9007199254740993"],
    ["int64", "-9223372036854775809"]] as const) {
    const current = fixture(`function run(peer: ${primitive}): void { const values = [peer, (${token})]; void values; }`);
    const ast = current.source.ast;
    const expression = current.nodes.find(node => ast.is.IsPrefixUnaryExpression(node));
    const tokenNode = expression === undefined ? undefined : ast.as.AsPrefixUnaryExpression(expression)?.Operand;
    for (const node of [expression, tokenNode]) {
      const outcome = node === undefined ? undefined : current.source.effectiveTypes.get(node);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
        outcome.type.primitive === primitive, true, primitive + ": original whole and spelling operand use the actual fixed peer");
    }
    assert.equal(current.source.effectiveTypes.obligations().some(row => row.kind === "literal-admission" &&
      row.site === expression && row.type.kind === "primitive" && row.type.primitive === primitive), true,
    primitive + ": the nonfit stays the original Native D2 obligation");
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  }
});

test("C2373 every broad scalar default and string argument carries its original produced construction", () => {
  const current = fixture(`declare function same(left: unknown, right: unknown): boolean;
    function numericDefault(value: unknown = 0): unknown { return value; }
    function stringDefault(value: unknown = "native"): unknown { return value; }
    function boolDefault(value: unknown = false): unknown { return value; }
    function returned(): unknown { return "filled"; }
    function run(): boolean { return same("kept", "kept") && same(false, 0); }`);
  const { ast } = current.source;
  const expected = new Map<string, SourceTypeDescriptor>([
    ["numericDefault", { kind: "primitive", primitive: "int64" }],
    ["stringDefault", { kind: "string" }],
    ["boolDefault", { kind: "primitive", primitive: "bool" }],
  ]);
  for (const [name, physical] of expected) {
    const declaration = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === name);
    const parameter = declaration === undefined ? undefined : ast.parameters(declaration)[0];
    const initializer = parameter === undefined ? undefined : ast.as.AsParameterDeclaration(parameter)?.Initializer;
    const outcome = initializer === undefined ? undefined : current.source.effectiveTypes.get(initializer);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
      outcome.type.intrinsic === "unknown" && outcome.construction !== undefined &&
      sourceTypeDescriptorsEqual(outcome.construction, physical), true, name + ": storage and the actual creator are distinct facts");
  }
  const calls = current.nodes.filter(node => ast.is.IsCallExpression(node));
  assert.equal(calls.length, 2);
  for (const call of calls) for (const argument of ast.arguments(call)) {
    const outcome = argument === undefined ? undefined : current.source.effectiveTypes.get(argument);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "intrinsic" &&
      outcome.type.intrinsic === "unknown" && outcome.construction !== undefined &&
      (argument !== undefined && ast.is.IsStringLiteral(argument) ? outcome.construction.kind === "string"
        : outcome.construction.kind === "primitive" && (outcome.construction.primitive === "bool" || outcome.construction.primitive === "int64")), true,
    "the existing Source construction carries strings, booleans and integers without a Native choice");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2373 await payloads are solved before dependent integral equality and retain the same descriptor", () => {
  const current = fixture(`function narrow(): int32 { return 3; }
    function wide(): int64 { return 9007199254740993n; }
    async function completed(): Promise<int64> { return wide(); }
    async function mixed(flag: boolean) { if (flag) return narrow(); return wide(); }
    async function optional(flag: boolean) { if (flag) return wide(); }
    async function run(): Promise<boolean> {
      const selected = await completed();
      return selected === 9007199254740993n && await mixed(true) === 3n &&
        await mixed(false) === 9007199254740993n && await optional(false) === undefined &&
        await optional(true) === 9007199254740993n;
    }`);
  assertSameValue(current.type("selected"), { kind: "primitive", primitive: "int64" });
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const awaited = current.nodes.filter(node => ast.is.IsAwaitExpression(node));
  assert.equal(awaited.length, 5);
  for (const node of awaited) {
    const operand = ast.as.AsAwaitExpression(node)?.Expression;
    const carrier = operand === undefined ? undefined : current.source.effectiveTypes.get(operand);
    const value = current.source.effectiveTypes.get(node);
    const dependency = graph.derived.find(derived => derived.node === node);
    assert.equal(dependency?.operator === "await" && dependency.operands.length === 1 &&
      dependency.operands[0]?.node === operand, true, "an await is its own payload dependency, not a transparent read");
    assert.equal(carrier !== undefined && carrier.kind !== "refused" && carrier.type.kind === "declared" &&
      value !== undefined && value.kind !== "refused" && carrier.type.typeArguments[0] === value.type, true,
    "the dependent operation sees the same actual solved task payload");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const rejected = fixture(`function reject(mixed: int64 | number, right: bigint): boolean { return mixed === right; }`);
  assert.equal(rejected.source.effectiveTypes.refusals().length, 1);
  assert.equal(rejected.source.effectiveTypes.refusals()[0]?.reason,
    "Bigint equality requires bigint, absence or a native-integral operand.");
});

test("C2373 explicit call binders do not unify callback or argument producers with their storage", () => {
  const current = fixture(`type Maybe<Value> = Value | null | undefined;
    interface Point { count: int64; }
    function keep<Value>(value: Value): Value { return value; }
    function callback<Value>(read: () => Maybe<Value>, fallback: Value): Value { return read() ?? fallback; }
    function pick<Value>(value: Maybe<Value>, fallback: Value): Value { return value ?? fallback; }
    class Holder<Value> {
      value: Maybe<Value>;
      constructor(value: Maybe<Value>) { this.value = value; }
      get current(): Maybe<Value> { return this.value; }
      set current(value: Maybe<Value>) { this.value = value; }
    }
    function point(useNull: boolean, present: boolean): Maybe<Point> {
      return present ? { count: 0n } : useNull ? null : undefined;
    }
    function run(original: Point, fixed: int32): void {
      const widened = keep<number>(fixed);
      const held = new Holder<Point>(original);
      const selected = callback<Point>(() => null, original);
      const optional = pick<int64 | undefined>(undefined, 0n);
      held.current = null; held.current = undefined; void widened; void selected; void optional; void point;
    }`);
  assertSameValue(current.type("widened"), { kind: "primitive", primitive: "float64" });
  const selected = current.type("selected");
  assert.equal(selected.kind === "declared" && current.source.ast.text(current.source.ast.name(selected.declaration)) === "Point", true);
  const optional = sourceTypeDescriptorStructure(current.type("optional"));
  assert.equal(optional.kind === "optional" && optional.value.kind === "primitive" && optional.value.primitive === "int64", true);
  const { ast } = current.source;
  const call = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "keep");
  const input = call === undefined ? undefined : ast.arguments(call)[0];
  const argument = input === undefined ? undefined : current.source.effectiveTypes.get(input);
  const instantiation = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  assert.equal(argument !== undefined && argument.kind !== "refused" && argument.type.kind === "primitive" &&
    argument.type.primitive === "int32" && instantiation?.method.length === 1 && instantiation.method[0]?.type.kind === "primitive" &&
    instantiation.method[0].type.primitive === "float64", true,
  "the authored binder and the original input keep distinct widths until the independent native conversion");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 0, issues.map(issue => `${issue.code}@${ast.pos(issue.site)}:${issue.reason}`).join("; "));
});

test("C2373 Source-any addition publishes its original nonprimitive result beside primitive operators", () => {
  const current = fixture(`function run(value: any, left: number, right: number): unknown {
    const sum = value + 1; const symmetric = 1 + value; const text = value + "tail";
    const less = left < right; return [sum, symmetric, text, less, -left];
  }`);
  for (const name of ["sum", "symmetric", "text"]) assertSameValue(current.type(name), { kind: "intrinsic", intrinsic: "any" });
  assertSameValue(current.type("less"), { kind: "primitive", primitive: "bool" });
  const { ast } = current.source;
  const operators = current.nodes.filter(node => ast.is.IsBinaryExpression(node) || ast.is.IsPrefixUnaryExpression(node));
  assert.equal(operators.length, 5);
  assert.equal(operators.every(node => {
    const outcome = current.source.effectiveTypes.get(node);
    return outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.occurrence === node;
  }), true, "every operator owns its actual Source publication without a target retyper");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2373 closed global member declarations retain native aliases on arrays and generic receivers", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/globals.d.ts": `type int32 = import("@test/words").int32; type float32 = import("@test/words").float32;
      interface Object {} interface Function {} interface CallableFunction extends Function {} interface NewableFunction extends Function {}
      interface Boolean {} interface Number {} interface String {} interface RegExp {}
      interface IArguments { length: number; [index: number]: unknown; }
      interface Array<Value> { readonly Length: int32; length: int32; [index: number]: Value; }
      interface ReadonlyArray<Value> { readonly Length: int32; readonly length: int32; readonly [index: number]: Value; }
      interface Set<Value> { readonly size: int32; has(value: Value): boolean; }
      interface SetConstructor { new <Value>(): Set<Value>; }
      declare var Set: SetConstructor;`,
    "/src/index.ts": `function run(readonlyValues: readonly float32[]): void {
      const values = [1, 2]; const keys = new Set<float32>();
      const direct = values.Length; const readonlyCount = readonlyValues.Length; const size = keys.size;
      const comparison = keys.size === 1; void direct; void readonlyCount; void size; void comparison;
    }`,
  }, compilerOptions: { strict: true, noLib: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original member-read source is required.");
  const pending: Node[] = [file];
  const reads: Node[] = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsPropertyAccessExpression(node)) reads.push(node);
    pending.push(...source.ast.children(node).filter((child): child is Node => child !== undefined));
  }
  assert.equal(reads.length, 4);
  for (const node of reads) {
    const access = source.semantics.forNode(node).operations.propertyAccess(node);
    const declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
    const outcome = source.effectiveTypes.get(node);
    assert.equal(declaration !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type.kind === "primitive" && outcome.type.primitive === "int32" && outcome.provenance.occurrence === node, true,
    "the actual selected declaration retains its int32 alias without completing unrelated receiver binders");
  }
  assert.equal(source.effectiveTypes.refusals().length, 0);
});

test("C2373 a property initializer publishes its exact contextual callable parameter and result", () => {
  const current = fixture(`class HandlerBox { run: (value: int32) => int32 = value => value; }
    function make(): HandlerBox { return { run(value: int32): int32 { return value + 1; } }; }`);
  const { ast } = current.source;
  const arrow = current.nodes.find(node => ast.is.IsArrowFunction(node));
  const parameter = arrow === undefined ? undefined : ast.parameters(arrow)[0];
  const input = parameter === undefined ? undefined : current.source.effectiveTypes.get(parameter);
  const result = arrow === undefined ? undefined : current.source.effectiveTypes.callableReturn(arrow);
  assert.equal(input !== undefined && input.kind !== "refused" && input.type.kind === "primitive" && input.type.primitive === "int32", true);
  assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "primitive" && result.type.primitive === "int32", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2373 an optional invocation retains whole-call absence without changing the present callable return", () => {
  const current = fixture(`function narrow(): int32 { return 1; }
    function body() { return narrow(); }
    function run(flag: boolean, invoke: ((value: int32) => int32) | undefined): void {
      const selected = invoke?.(1); const maybe = flag ? body : undefined; const inferred = maybe?.();
      void selected; void inferred;
    }
    function dynamic(invoke: any): unknown { return invoke?.(1); }`);
  for (const name of ["selected", "inferred"]) {
    const type = current.type(name);
    assert.equal(type.kind === "optional" && type.value.kind === "primitive" && type.value.primitive === "int32", true,
      name + ": absence belongs to the entire optional invocation");
  }
  const { ast } = current.source;
  const body = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "body");
  const returned = body === undefined ? undefined : current.source.effectiveTypes.callableReturn(body);
  assert.equal(returned !== undefined && returned.kind !== "refused" && returned.type.kind === "primitive" && returned.type.primitive === "int32", true,
    "the same callable's present return is still int32");
  const calls = current.nodes.filter(node => ast.is.IsCallExpression(node) &&
    current.source.semantics.forNode(node).operations.call(node)?.optionalChain === true);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    const outcome = current.source.effectiveTypes.get(call);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The original optional call is required.");
    if (outcome.type.kind === "intrinsic") {
      assert.equal(outcome.type.intrinsic === "any", true, "an any invocation retains its broad Source domain");
    } else {
      const selected = current.source.effectiveTypes.callInstantiation(call);
      assert.equal(outcome.type.kind === "optional" && selected?.result === outcome.type, true,
        "pre-solve call publication and the invocation result retain the same absence-capable descriptor");
    }
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2373 bodyless signature patterns publish the same authored binding slots without runtime groups", () => {
  const current = fixture(`interface Contract {
      accept([value]: [number]): void;
      copy({ field }: { field: float32 }): void;
      deep([{ nested: [payload] }]: [{ nested: [float32] }]): void;
    }
    declare function external([declared]: [int32]): void;
    abstract class Base { abstract take([abstractValue]: [float32]): void; }`);
  const { ast } = current.source;
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const expected = new Map([["value", "float64"], ["field", "float32"], ["payload", "float32"],
    ["declared", "int32"], ["abstractValue", "float32"]]);
  const bindings = current.nodes.filter(node => ast.is.IsBindingElement(node) && ast.is.IsIdentifier(ast.name(node)));
  assert.equal(bindings.length, expected.size);
  for (const binding of bindings) {
    const name = ast.text(ast.name(binding));
    const outcome = current.source.effectiveTypes.get(binding);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "primitive" &&
      outcome.type.primitive === expected.get(name) && outcome.provenance.occurrence === binding, true, name);
    assert.equal(graph.nodes.some(record => record.node === binding), false, name + ": declared metadata does not create an inference group");
  }
  for (const parameter of current.nodes.filter(node => ast.is.IsParameterDeclaration(node))) {
    assert.equal(graph.nodes.some(record => record.node === parameter), false, "bodyless parameter heads remain outside the runtime graph");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2384 later declared aggregate demands select the scalar arm before the numeric own default", () => {
  const destinations = [
    { name: "union", annotation: "(string | number)", element: { kind: "union", types: [
      { kind: "string" }, { kind: "primitive", primitive: "float64" },
    ] } },
    { name: "optional", annotation: "(number | undefined)", element: {
      kind: "optional", value: { kind: "primitive", primitive: "float64" },
    } },
    { name: "primitive", annotation: "number", element: { kind: "primitive", primitive: "float64" } },
  ] as const;
  const literals = [
    { name: "small", expression: "7" },
    { name: "wide", expression: "9007199254740993" },
    { name: "negativeWide", expression: "-9007199254740993" },
    { name: "floating", expression: "1.5" },
  ] as const;
  const uses = ["argument", "return", "async", "nested", "genericArgument", "genericCallback", "receiver", "typedCallback"] as const;
  const rows = uses.flatMap(use => destinations.flatMap(destination => literals.map(literal => {
    const name = `${use}_${destination.name}_${literal.name}`;
    const values = `values_${name}`;
    const alias = `alias_${name}`;
    const type = `${destination.annotation}[]`;
    const expression = `[${destination.name === "union" ? '"text", ' : destination.name === "optional" ? "undefined, " : ""}${literal.expression}]`;
    const local = `const ${values} = ${expression};`;
    const programs = {
      argument: `function accept_${name}(input: ${type}): ${type} { return input; }
        function run_${name}(): ${type} { ${local} return accept_${name}(${values}); }`,
      return: `function run_${name}(): ${type} { ${local} const ${alias} = ${values}; return ${alias}; }`,
      async: `async function run_${name}(): Promise<${type}> { ${local} return ${values}; }`,
      nested: `function invoke_${name}(read: () => ${type}): ${type} { return read(); }
        function run_${name}(): ${type} { return invoke_${name}(() => { ${local} return ${values}; }); }`,
      genericArgument: `function accept_${name}<Value>(input: Value[]): Value[] { return input; }
        function run_${name}(): ${type} { ${local} return accept_${name}<${destination.annotation}>(${values}); }`,
      genericCallback: `function invoke_${name}<Value>(read: () => Value[]): Value[] { return read(); }
        function run_${name}(): ${type} { return invoke_${name}<${destination.annotation}>(() => { ${local} return ${values}; }); }`,
      receiver: `class Receiver_${name}<Value> { accept(input: Value[]): Value[] { return input; } }
        function run_${name}(): ${type} { const receiver = new Receiver_${name}<${destination.annotation}>();
          ${local} return receiver.accept(${values}); }`,
      typedCallback: `function run_${name}(): ${type} { const read: () => ${type} = () => {
        ${local} return ${values}; }; return read(); }`,
    };
    return { name, values, alias, use, destination, program: programs[use] };
  })));
  const objects = uses.map(use => {
    const name = `object_${use}`;
    const values = `values_${name}`;
    const alias = `alias_${name}`;
    const type = "{ n: string | number }";
    const local = `const ${values} = { n: 9007199254740993 };`;
    const programs = {
      argument: `function accept_${name}(input: ${type}): ${type} { return input; }
        function run_${name}(): ${type} { ${local} return accept_${name}(${values}); }`,
      return: `function run_${name}(): ${type} { ${local} const ${alias} = ${values}; return ${alias}; }`,
      async: `async function run_${name}(): Promise<${type}> { ${local} return ${values}; }`,
      nested: `function invoke_${name}(read: () => ${type}): ${type} { return read(); }
        function run_${name}(): ${type} { return invoke_${name}(() => { ${local} return ${values}; }); }`,
      genericArgument: `function accept_${name}<Value>(input: { n: Value }): { n: Value } { return input; }
        function run_${name}(): ${type} { ${local} return accept_${name}<string | number>(${values}); }`,
      genericCallback: `function invoke_${name}<Value>(read: () => { n: Value }): { n: Value } { return read(); }
        function run_${name}(): ${type} { return invoke_${name}<string | number>(() => { ${local} return ${values}; }); }`,
      receiver: `class Receiver_${name}<Value> { accept(input: { n: Value }): { n: Value } { return input; } }
        function run_${name}(): ${type} { const receiver = new Receiver_${name}<string | number>();
          ${local} return receiver.accept(${values}); }`,
      typedCallback: `function run_${name}(): ${type} { const read: () => ${type} = () => {
        ${local} return ${values}; }; return read(); }`,
    };
    return { name, values, alias, use, program: programs[use] };
  });
  const original = `function originalAccept(values: (string | number)[]): (string | number)[] { return values; }
    function originalRun(): (string | number)[] {
      const originalValues = ["text", 9007199254740993, -9007199254740993, 1e100]; return originalAccept(originalValues);
    }`;
  const current = fixture([...rows.map(row => row.program), ...objects.map(row => row.program), original].join("\n"));
  const { ast } = current.source;
  const admissions = current.source.effectiveTypes.obligations().filter(
    (row): row is Extract<SourceTypeFlowObligation, { readonly kind: "literal-admission" }> => row.kind === "literal-admission",
  );
  assert.equal(rows.length, 96);
  assert.equal(objects.length, uses.length);
  assert.equal(current.nodes.filter(node => ast.is.IsArrayLiteralExpression(node)).length, rows.length + 1);
  assert.equal(current.nodes.filter(node => ast.is.IsObjectLiteralExpression(node)).length, objects.length);
  for (const row of rows) {
    const declaration = current.declaration(row.values);
    const literal = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    const whole = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(literal !== undefined && ast.is.IsArrayLiteralExpression(literal) && whole !== undefined &&
      whole.kind !== "refused" && whole.type.kind === "array", true, row.name + ": original allocation");
    if (literal === undefined || whole === undefined || whole.kind === "refused" || whole.type.kind !== "array") {
      throw new Error(row.name + ": the original solved array is required.");
    }
    assert.equal(sourceTypeDescriptorsEqual(whole.type.element, row.destination.element), true,
      row.name + ": complete declared element storage, including every union arm or absence");
    assert.equal(current.type(row.values) === whole.type, true, row.name + ": the local retains the allocation descriptor");
    if (row.use === "return") assert.equal(current.type(row.alias) === whole.type, true, row.name + ": exact alias identity");
    for (const read of current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.text(node) === row.values && ast.name(declaration) !== node)) {
      const outcome = current.source.effectiveTypes.get(read);
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type === whole.type, true,
        row.name + ": each same-root read retains the solved storage descriptor");
    }
    const elements = ast.elements(literal).filter((node): node is Node => node !== undefined);
    const numeric = elements[elements.length - 1];
    const selected = numeric === undefined ? undefined : current.source.effectiveTypes.get(numeric);
    assert.equal(selected !== undefined && selected.kind !== "refused" &&
      sourceTypeDescriptorsEqual(selected.type, whole.type.element), true, row.name + ": the literal retains full logical storage");
    const physical = selected === undefined || selected.kind === "refused" ? undefined : selected.construction ?? selected.type;
    assert.equal(physical?.kind === "primitive" && physical.primitive === "float64", true,
      row.name + ": the one declared float arm precedes int64 creation");
    const matching = admissions.filter(admission => admission.site === literal);
    assert.equal(matching.length === 1 && matching[0]?.authority === "declared" && matching[0].type === whole.type, true,
      row.name + ": one admission retains the exact declared destination and allocation");
  }
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const terms = createSourceTypeFlowTerms(ast, graph);
  const logical = destinations[0].element;
  for (const row of objects) {
    const declaration = current.declaration(row.values);
    const literal = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    const whole = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    const structure = whole === undefined || whole.kind === "refused" ? undefined : sourceTypeDescriptorStructure(whole.type);
    const member = structure?.kind === "shape" ? structure.members.find(member => member.name === "n") : undefined;
    assert.equal(member !== undefined && sourceTypeDescriptorsEqual(member.type, logical), true,
      row.name + ": the ordinary shape producer retains the full declared member storage");
    if (literal === undefined || whole === undefined || whole.kind === "refused") throw new Error(row.name + ": the original object is required.");
    assert.equal(current.type(row.values) === whole.type, true, row.name + ": original object/local identity");
    if (row.use === "return") assert.equal(current.type(row.alias) === whole.type, true, row.name + ": original object alias identity");
    const record = graph.nodes.find(record => record.node === literal);
    assert.equal(record?.term?.kind === "shape" && record.term.members.length === 1, true,
      row.name + ": an object already uses its canonical structural producer, not an array's fixed copy");
    const property = ast.properties(literal)[0];
    const numeric = property === undefined ? undefined : ast.as.AsPropertyAssignment(property)?.Initializer;
    const selected = numeric === undefined ? undefined : current.source.effectiveTypes.get(numeric);
    assert.equal(selected !== undefined && selected.kind !== "refused" && sourceTypeDescriptorsEqual(selected.type, logical) &&
      selected.construction?.kind === "primitive" && selected.construction.primitive === "float64", true,
      row.name + ": the existing member dependency selects the declared scalar arm");
    const matching = admissions.filter(admission => admission.site === literal);
    assert.equal(matching.length === 1 && matching[0]?.authority === "declared" && matching[0].type === whole.type, true,
      row.name + ": one object admission retains the declared destination identity");
  }
  const originalLiteral = ast.as.AsVariableDeclaration(current.declaration("originalValues"))?.Initializer;
  const originalType = current.type("originalValues");
  assert.equal(originalLiteral !== undefined && originalType.kind === "array" &&
    sourceTypeDescriptorsEqual(originalType.element, logical), true, "the original four-element array retains only its declared two-arm storage");
  const numericGroups = originalLiteral === undefined ? [] : ast.elements(originalLiteral).slice(1).map(element => {
    const record = graph.nodes.find(record => record.node === element);
    if (record === undefined) throw new Error("Each original numeric occurrence must retain its actual graph variable.");
    const selected = terms.group(record.variable);
    assert.equal(selected.terms.length > 0 && selected.terms.every(term => term.kind === "numeric"), true,
      "the mixed array does not merge a numeric literal group with its string or fixed aggregate");
    const outcome = current.source.effectiveTypes.get(record.node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && sourceTypeDescriptorsEqual(outcome.type, logical) &&
      outcome.construction?.kind === "primitive" && outcome.construction.primitive === "float64", true,
      "each original numeric child, including the whole prefix, retains the declared scalar construction");
    return selected.variable;
  });
  assert.equal(numericGroups.length === 3 && new Set(numericGroups).size === 3, true,
    "the three original numeric children retain distinct canonical groups");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 0, issues.map(issue => `${issue.code}@${ast.pos(issue.site)}:${issue.reason}`).join("; ").slice(0, 2048));
});

test("C2421 contextual callback heads retain optional absence and defaulted heads retain their present value", () => {
  const current = fixture(`declare function consume(callback: (required: string, optional?: string) => void): void;
    class Base<Value> { consume(callback: (required: Value, optional?: Value) => void): void { void callback; } }
    class Inherited extends Base<string> {}
    const direct: (required: string, optional?: string) => void = (required, optional) => { void required; void optional; };
    const defaulted: (value?: int32) => void = (value = 1) => { const plus = value + 1; void plus; };
    const absentDefault: (absent?: string) => void = (absent = undefined) => { void absent; };
    const unionDefault: (mixed?: string | int32) => void = (mixed = "text") => { void mixed; };
    function run(): void { consume((required, optional) => { void required; void optional; });
      new Inherited().consume((required, optional) => { void required; void optional; }); }
    void direct; void defaulted; void absentDefault; void unionDefault;`);
  const { ast } = current.source;
  const reader = createSourceTypeFlowDeclaredSlotReader(createSourceTypeFlowAnalysisContext(current.source).context);
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 6);
  for (const arrow of arrows) {
    for (const parameter of ast.parameters(arrow)) {
      if (parameter === undefined) throw new Error("The original callback parameter is required.");
      const name = ast.text(ast.name(parameter)!);
      const selected = reader.parameter(parameter, current.source.semantics.forNode(parameter));
      const outcome = current.source.effectiveTypes.get(parameter);
      const descriptor = selected === undefined ? undefined : sourceTypeDescriptorStructure(selected);
      assert.equal(name === "optional" || name === "absent" ? descriptor?.kind === "optional" && descriptor.value.kind === "string"
        : name === "value" ? descriptor?.kind === "primitive" && descriptor.primitive === "int32"
        : name === "mixed" ? descriptor?.kind === "union" && descriptor.types.length === 2 &&
          descriptor.types.some(type => type.kind === "string") && descriptor.types.some(type => type.kind === "primitive" && type.primitive === "int32")
        : descriptor?.kind === "string", true, name + ": the contextual head retains its exact presence and authored width");
      assert.equal(outcome !== undefined && outcome.kind !== "refused" && selected !== undefined &&
        sourceTypeDescriptorsEqual(outcome.type, selected), true, name + ": the publication consumes the same projected contract");
    }
  }
  assert.equal(reader.parameter(current.declaration("direct"), current.source.semantics.forNode(current.declaration("direct"))) === undefined, true,
    "a missing parameter head never fabricates a callable parameter");
  const plus = current.type("plus");
  assert.equal(plus.kind === "primitive" && plus.primitive === "int32", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2388 receiver writes keep the retained fixed argument's binder path", () => {
  const current = fixture(`class Box<Value> { value: Value; constructor(value: Value) { this.value = value; } }
    class Receiver<Value> { accept(value: Box<Value>): void { void value; } }
    function run(): boolean {
      const receiver = new Receiver<int32>(); const original = new Box<int32>(7 as int32);
      receiver.accept(original); return original.value === 7;
    }`);
  const { ast } = current.source;
  const writes = current.source.effectiveTypes.obligations().filter(row => {
    const call = row.association?.call?.call;
    const callee = call === undefined ? undefined : ast.as.AsCallExpression(call)?.Expression;
    return row.kind === "write-fit" && callee !== undefined && ast.is.IsPropertyAccessExpression(callee) &&
      ast.text(ast.name(callee)!) === "accept";
  });
  assert.equal(writes.length, 1);
  const write = writes[0];
  assert.equal(write?.kind === "write-fit" && write.valueVariable !== undefined && write.valueVariable.node === write.value &&
    write.valueVariable.path.some(part => part.kind === "binder" && ast.is.IsTypeParameterDeclaration(part.declaration)) &&
    write.valueType?.kind === "primitive" && write.valueType.primitive === "int32", true,
    "the original fixed Box argument keeps its exact projected binder, independently of inference eligibility");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2388 parameter names publish their already solved declaration descriptor", () => {
  const current = fixture(`declare function map(values: number[], callback: (value: number, index: int32) => number): number[];
    function run(offset: number): number[] { return map([1, 2], (value, index) => index + offset); }`);
  const { ast } = current.source;
  const parameters = current.nodes.filter(node => ast.is.IsParameterDeclaration(node) &&
    ast.parent(node) !== undefined && ast.body(ast.parent(node)!) !== undefined &&
    ast.name(node) !== undefined && ast.is.IsIdentifier(ast.name(node)) && ["index", "offset"].includes(ast.text(ast.name(node)!)));
  assert.equal(parameters.length, 2);
  for (const parameter of parameters) {
    const name = ast.name(parameter)!;
    const declaration = current.source.effectiveTypes.get(parameter);
    const selected = current.source.effectiveTypes.get(name);
    assert.equal(declaration !== undefined && declaration.kind !== "refused" && selected !== undefined &&
      selected.kind !== "refused" && selected.type === declaration.type && selected.provenance.occurrence === name, true,
      "the identifier name retains its canonical declaration fact without a second type query");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

import assert from "node:assert/strict";
import { readyModuleRoot, readyModuleStatements } from "./chapter-syntax.mjs";
import { analysisInput } from "./front/analysis-input.mjs";
import { loadFrontFixture } from "./front/checked-module.mjs";

export async function checkComputedDeclarationNames() {
  const front = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { resourceLimitDiagnostic } = await import("../../../packages/host/dist/diag/index.js");
  const program = await import("../../../packages/host/dist/ir-program/index.js");
  const source = 'export interface Shape { ["label"]: boolean; [7](): boolean; [key]: boolean; [names.key](): boolean; }';
  const ambient = 'declare const key: "named"; declare const names: { readonly key: "qualified" };';
  const snapshot = front.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent + "\n" + ambient }] });
  const input = { ...analysisInput(front, "sdk-minimal", source), snapshot };
  const exactKeyWork = 64 + 3 + 1;
  const withArithmetic = maximumArithmeticWork => ({ ...input, limits: { ...input.limits,
    evaluation: { ...input.limits.evaluation, maximumArithmeticWork } } });
  const outcome = analyzeHostProgram(withArithmetic(exactKeyWork));
  assert.equal(outcome.kind, "ok");
  const { index, modules } = outcome.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  assert.ok(module);
  const [shape] = readyModuleStatements(readyModuleRoot(module.tree));
  assert.equal(shape.kind, "InterfaceDeclaration");
  const [property, method, named, qualified] = shape.members.nodes;
  const expected = [{ kind: "text", value: "label" },
    { kind: "number", value: { numerator: 7n, denominator: 1n, negativeZero: false } },
    { kind: "text", value: "named" }, { kind: "text", value: "qualified" }];
  assert.equal(shape.members.nodes.length, expected.length);
  for (const [position, member] of shape.members.nodes.entries()) {
    assert.equal(member.name.kind, "ComputedPropertyName");
    assert.deepEqual(member.name.tsonic, { kind: "declaration", key: { kind: "available", value: expected[position] } });
    assert.deepEqual(member.name.expression.tsonic, { role: "declaration-name-expression" });
    assert.equal(member.name.expression.parent, member.name.id);
  }
  assert.equal(property.name.expression.kind, "StringLiteral");
  assert.equal(method.name.expression.kind, "NumericLiteral");
  assert.equal(method.name.expression.text, "7");
  assert.equal(named.name.expression.kind, "Identifier");
  assert.equal(qualified.name.expression.kind, "PropertyAccessExpression");
  for (const child of front.hir.childrenOfSyntax(qualified.name.expression)) {
    assert.equal(child.parent, qualified.name.expression.id);
    assert.deepEqual(child.tsonic, { role: "declaration-name-expression" });
  }
  const refused = analyzeHostProgram(withArithmetic(exactKeyWork - 1));
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics, [resourceLimitDiagnostic({ owner: "front", limit: "front.literalCapture.maximumArithmeticWork",
    maximum: exactKeyWork - 1, site: { kind: "source", origin: method.name.expression.origin },
    unit: { request: { query: "lowerModule", key: input.snapshot.entryPoint }, position: { kind: "result" } } })]);
  for (const declaration of [method, qualified]) {
    assert.equal(declaration.tsonic.template, null);
    assert.equal(declaration.tsonic.signatures.every(endpoint => endpoint.body === null), true);
  }
  assert.equal(module.bodies.length, 2);
  const template = module.bodies.find(body => body.kind === "template");
  const selected = module.bodies.find(body => body.kind === "selected");
  assert.ok(template && selected);
  assert.equal(selected.mir.constants.length, 0);
  assert.equal(selected.mir.blocks.every(block => block.statements.length === 0), true);
  assert.deepEqual(index.dependencyInventory.operations, [{ kind: "body", execution: { instance: selected.instance, provided: 0 } }]);
  const text = program.printModuleBodies(index, module);
  assert.deepEqual(program.parseModuleBodies(index, text), { kind: "parsed", value: module });
  const projected = program.instantiate(index, { ...module, bodies: [template] }, { kind: "tir", body: template.instance.body },
    selected.instance.bindings.bindings, input.limits.instantiation);
  assert.equal(projected.kind, "instantiated");
  assert.equal(projected.artifact.kind, "tir");
  assert.deepEqual(projected.artifact.body, selected.tir);
}

export async function checkNestedComputedDeclarationNames() {
  const front = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { printModuleBodies, parseModuleBodies, instantiate } = await import("../../../packages/host/dist/ir-program/index.js");
  const source = 'export type Alias = { ["literal"]: boolean; [names.key](): boolean; }; '
    + 'export interface Box { nested: { [key]: boolean; ["inner"](): boolean; [`co\\u006Fk`]: boolean; }; }';
  const ambient = 'declare const key: "named"; declare const names: { readonly key: "qualified" };';
  const snapshot = front.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent + "\n" + ambient }] });
  const input = { ...analysisInput(front, "sdk-minimal", source), snapshot };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const { index, modules } = result.value;
  const module = modules.find(entry => entry.module === input.snapshot.entryPoint);
  assert.ok(module);
  const [alias, box] = readyModuleStatements(readyModuleRoot(module.tree));
  assert.equal(alias.kind, "TypeAliasDeclaration");
  assert.equal(box.kind, "InterfaceDeclaration");
  const [nested] = box.members.nodes;
  assert.equal(nested.kind, "PropertySignature");
  const names = [
    [alias.type, ["literal", "qualified"], ["StringLiteral", "PropertyAccessExpression"]],
    [nested.type, ["named", "inner", "cook"], ["Identifier", "StringLiteral", "NoSubstitutionTemplateLiteral"]],
  ];
  for (const [literal, keys, kinds] of names) {
    assert.equal(literal.kind, "TypeLiteral");
    assert.deepEqual(literal.members.nodes.map(member => member.name.expression.kind), kinds);
    assert.deepEqual(literal.members.nodes.map(member => member.name.tsonic), keys.map(value => ({
      kind: "declaration", key: { kind: "available", value: { kind: "text", value } },
    })));
    for (const member of literal.members.nodes) {
      assert.equal(member.name.parent, member.id);
      const pending = [member.name.expression];
      assert.equal(pending[0].parent, member.name.id);
      while (pending.length !== 0) {
        const child = pending.pop();
        assert.deepEqual(child.tsonic, { role: "declaration-name-expression" });
        const children = front.hir.childrenOfSyntax(child);
        assert.equal(children.every(node => node.parent === child.id), true);
        pending.push(...children);
      }
    }
  }
  const templateName = nested.type.members.nodes[2].name.expression;
  assert.equal(templateName.text, "cook");
  assert.equal(source.slice(templateName.origin.start, templateName.origin.start + templateName.origin.length), '`co\\u006Fk`');
  assert.equal(module.bodies.length, 2);
  const template = module.bodies.find(body => body.kind === "template");
  const selected = module.bodies.find(body => body.kind === "selected");
  assert.ok(template && selected);
  assert.deepEqual(index.dependencyInventory.operations, [{ kind: "body", execution: { instance: selected.instance, provided: 0 } }]);
  assert.equal(selected.mir.constants.length, 0);
  assert.equal(selected.mir.blocks.every(block => block.statements.length === 0), true);
  assert.deepEqual(parseModuleBodies(index, printModuleBodies(index, module)), { kind: "parsed", value: module });
  const reified = instantiate(index, { ...module, bodies: [template] }, { kind: "tir", body: template.instance.body },
    selected.instance.bindings.bindings, input.limits.instantiation);
  assert.equal(reified.kind, "instantiated");
  assert.equal(reified.artifact.kind, "tir");
  assert.deepEqual(reified.artifact.body, selected.tir);
}

export async function checkParenthesizedComputedDeclarationNames() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { printModuleBodies, parseModuleBodies, instantiate } = await import("../../../packages/host/dist/ir-program/index.js");
  const { verifyDeclarationNames } = await import("../../../packages/host/dist/ir-tir/verify-instances.js");
  const { printTir, parseTir } = await import("../../../packages/host/dist/ir-tir/index.js");
  const source = 'export interface Shape { [( ("packed") )]: boolean; }'
    + 'export function echo(value: boolean): boolean { return ((value)); }';
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [shape, echo] = readyModuleStatements(readyModuleRoot(module.tree));
  const [property] = shape.members.nodes;
  const name = property.name;
  assert.equal(name.kind, "ComputedPropertyName");
  assert.deepEqual(name.tsonic, { kind: "declaration", key: { kind: "available", value: { kind: "text", value: "packed" } } });
  const role = { role: "declaration-name-expression" };
  const outer = name.expression;
  const inner = outer.expression;
  const literal = inner.expression;
  assert.equal(outer.kind, "ParenthesizedExpression");
  assert.equal(inner.kind, "ParenthesizedExpression");
  assert.equal(literal.kind, "StringLiteral");
  assert.equal(literal.text, "packed");
  for (const [node, parent, spelling] of [[outer, name, '( ("packed") )'], [inner, outer, '("packed")'], [literal, inner, '"packed"']]) {
    assert.equal(node.parent, parent.id);
    assert.deepEqual(node.tsonic, role);
    assert.equal(source.slice(node.origin.start, node.origin.start + node.origin.length), spelling);
  }
  const executing = echo.body.statements.nodes[0].expression;
  assert.equal(executing.kind, "ParenthesizedExpression");
  assert.equal(executing.expression.kind, "ParenthesizedExpression");
  assert.equal(executing.tsonic.type, echo.type.tsonic.type);
  assert.equal(executing.expression.tsonic.type, echo.type.tsonic.type);
  assert.equal("role" in executing.tsonic, false);
  assert.equal(echo.tsonic.signatures.length, 1);
  const body = module.bodies.find(row => row.kind === "selected" && row.instance.body === echo.tsonic.signatures[0].body);
  assert.ok(body);
  assert.equal(body.mir.constants.length, 0);
  const moduleBody = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const template = module.bodies.find(row => row.kind === "template" && row.instance.body === moduleBody.instance.body);
  assert.ok(template);
  assert.deepEqual(moduleBody.mir.constants, []);
  assert.equal(moduleBody.mir.blocks.every(block => block.statements.length === 0), true);
  assert.deepEqual(parseTir(printTir(moduleBody.tir)), { kind: "parsed", value: moduleBody.tir });
  assert.deepEqual(parseModuleBodies(index, printModuleBodies(index, module)), { kind: "parsed", value: module });
  const projected = instantiate(index, { ...module, bodies: module.bodies.filter(row => row !== moduleBody) },
    { kind: "tir", body: template.instance.body }, moduleBody.instance.bindings.bindings, input.limits.instantiation);
  assert.equal(projected.kind, "instantiated");
  assert.equal(projected.artifact.kind, "tir");
  assert.deepEqual(projected.artifact.body, moduleBody.tir);

  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const [checkedShape] = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const checkedProperty = checkedShape.members.nodes[0];
  const checkedName = checkedProperty.name;
  const original = new Map([[checkedProperty.id, checkedProperty], [checkedName.id, checkedName]]);
  const diagnostics = [];
  const emit = (rule, node) => diagnostics.push([rule, node.id]);
  const falseExecution = { ...outer, tsonic: executing.tsonic };
  const falseName = { ...name, expression: falseExecution };
  verifyDeclarationNames([{ ...property, name: falseName }, falseName, { ...executing, tsonic: role }], original, emit);
  assert.deepEqual(diagnostics, [["occurrence-role", outer.id], ["occurrence-role", executing.id]]);
}

export async function checkCallShapedComputedDeclarationName() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { parseModuleBodies, printModuleBodies, instantiate } = await import("../../../packages/host/dist/ir-program/index.js");
  const { parseTir, printTir } = await import("../../../packages/host/dist/ir-tir/index.js");
  const source = 'export interface Box { [(pick("field"))]: boolean; }'
    + 'export function identity(value: boolean): boolean { return value; }'
    + 'export function invoke(value: boolean): boolean { return identity(value); }';
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent + '\ndeclare function pick(name: string): "picked";' }] });
  const input = { ...analysisInput(fixture, "sdk-minimal", source), snapshot };
  const { deps, program } = fixture.openAndCapture(snapshot);
  const captured = fixture.front.captureModule(deps, program, snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const [rawBox, , rawInvoke] = captured.value.tree.statements.nodes;
  const rawName = rawBox.members.nodes[0].name;
  const rawCall = rawName.expression.expression;
  const rawExecution = rawInvoke.body.statements.nodes[0].expression;
  assert.equal(rawCall.kind, "CallExpression");
  assert.deepEqual(captured.value.calls.map(row => row.invocation), [{ module: snapshot.entryPoint, node: rawExecution.id }]);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const checkedModule = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
  const [checkedBox, , checkedInvoke] = checkedModule.tree.statements.nodes;
  assert.deepEqual(checkedBox.members.nodes[0].name.expression.expression.tsonic.application,
    { kind: "unavailable", reason: "not-provided", causes: [] });
  assert.equal(checkedInvoke.body.statements.nodes[0].expression.tsonic.application.kind, "available");

  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  const [box, identity, invoke] = readyModuleStatements(readyModuleRoot(module.tree));
  const { name } = box.members.nodes[0];
  const wrapper = name.expression;
  const call = wrapper.expression;
  assert.equal(call.id, rawCall.id);
  assert.deepEqual(name.tsonic, { kind: "declaration", key: { kind: "available", value: { kind: "text", value: "picked" } } });
  const [argument] = call.arguments.nodes;
  assert.equal(call.expression.text, "pick");
  assert.equal(argument.text, "field");
  assert.equal(call.typeArguments, null);
  assert.equal(call.questionDotToken, null);
  for (const [node, parent, written] of [[wrapper, name, '(pick("field"))'], [call, wrapper, 'pick("field")'],
    [call.expression, call, "pick"], [argument, call, '"field"']]) {
    assert.equal(node.parent, parent.id);
    assert.deepEqual(node.tsonic, { role: "declaration-name-expression" });
    assert.equal(source.slice(node.origin.start, node.origin.start + node.origin.length), written);
  }
  const selected = node => module.bodies.find(row => row.kind === "selected" && row.instance.body === node.tsonic.signatures[0].body);
  const called = selected(identity);
  const caller = selected(invoke);
  assert.equal(caller.tir.root.statements.nodes[0].expression.tsonic.application.kind, "decided");
  assert.equal(caller.mir.blocks.filter(block => block.terminator.kind === "call").length, 1);
  const moduleBody = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  assert.deepEqual(index.dependencyInventory.operations.map(row => row.kind), ["body", "body", "body"]);
  assert.deepEqual(new Set(index.dependencyInventory.operations.map(row => row.execution.instance.body)),
    new Set([called.instance.body, caller.instance.body, moduleBody.instance.body]));
  assert.deepEqual(moduleBody.mir.constants, []);
  assert.equal(moduleBody.mir.blocks.every(block => block.statements.length === 0 && block.terminator.kind !== "call"), true);
  assert.deepEqual(parseTir(printTir(moduleBody.tir)), { kind: "parsed", value: moduleBody.tir });
  assert.deepEqual(parseModuleBodies(index, printModuleBodies(index, module)), { kind: "parsed", value: module });
  const template = module.bodies.find(row => row.kind === "template" && row.instance.body === moduleBody.instance.body);
  assert.ok(template);
  const activationOf = body => readyModuleStatements(body.root)[2].body.statements.nodes[0].expression.tsonic.application.decision.callee.activation;
  const templateActivation = activationOf(template.tir);
  assert.equal(templateActivation.body, called.instance.body);
  assert.equal(templateActivation.bindings.kind, "parametric");
  const expected = structuredClone(moduleBody.tir);
  assert.equal(activationOf(expected).bindings.kind, "instantiated");
  activationOf(expected).bindings = templateActivation.bindings;
  const projected = instantiate(index, { ...module, bodies: module.bodies.filter(row => row !== moduleBody) },
    { kind: "tir", body: moduleBody.instance.body }, moduleBody.instance.bindings.bindings, input.limits.instantiation);
  assert.equal(projected.kind, "instantiated");
  assert.equal(projected.artifact.kind, "tir");
  assert.deepEqual(projected.artifact.body, expected);
}

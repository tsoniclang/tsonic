import { encodeDefId } from "../../../packages/host/dist/ids/index.js";
import { encodeContextKey } from "../ir-program-fixtures.mjs";
import { publicationFixture } from "./program-publication.mjs";

export function declaredInvocationFixture() {
  const fixture = publicationFixture();
  const { index, module, bodyId, answers, scope, selected, template, tirInput } = fixture;
  const source = tirInput.source;
  const checkedRoot = source.tree;
  const root = module.tree;
  const path = { module: module.module, segments: [{ name: "external", ordinal: 0 }] };
  const definition = encodeDefId(path);
  const signature = index.types.signatures.length;
  const callable = index.types.terms.length;
  const endpoint = { declaration: definition, role: "api-signature", signature, body: null };
  const bindings = selected.tir.lexicalBindings;
  const { origin, loc } = root;
  const available = value => ({ kind: "available", value });
  const header = (id, parent) => ({ id, parent, origin, loc, flags: [] });
  const list = nodes => ({ loc, nodes });
  const checkedValue = type => ({ views: { read: available(type), declared: available(null), contextual: available(null) },
    place: available(null), memory: available(null), observation: available(null) });
  const typedValue = type => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" } });
  const selection = { kind: "definition", definition, aliases: [] };
  const core = checkedRoot.tsonic.core;
  const declaration = { kind: "definition", definition };
  const name = { ...header(3, 1), kind: "Identifier", text: "external" };
  const checkedName = { ...name, tsonic: { core, role: "declaration-name", declaration } };
  const typedName = { ...name, tsonic: { role: "declaration-name", declaration, storage: null } };
  const declaredReturn = { ...header(4, 1), kind: "VoidKeyword" };
  const checkedReturn = { ...declaredReturn, tsonic: { core, type: available(0), referencedDefinitions: [] } };
  const typedReturn = { ...declaredReturn, tsonic: { type: 0, declarations: [] } };
  const modifier = { ...header(2, 1), kind: "DeclareKeyword", tsonic: null };
  const fn = { ...header(1, 0), kind: "FunctionDeclaration", modifiers: list([modifier]), typeParameters: null,
    parameters: list([]), fullSignature: null, asteriskToken: null, body: null };
  const callableDeclaration = { definition, parameters: [], signatures: [endpoint], attributes: [] };
  const checkedFn = { ...fn, name: checkedName, type: checkedReturn,
    tsonic: { ...callableDeclaration, parent: fixture.definition, body: null, memory: available(null), core } };
  const typedFn = { ...fn, name: typedName, type: typedReturn, tsonic: { ...callableDeclaration, template: null } };
  const calleeName = { ...header(7, 6), kind: "Identifier", text: "external" };
  const checkedCallee = { ...calleeName, tsonic: { role: "value", core, value: checkedValue(callable), resolution: selection } };
  const typedCallee = { ...calleeName, tsonic: { ...typedValue(callable), role: "value", resolution: selection } };
  const call = { ...header(6, 5), kind: "CallExpression", questionDotToken: null, typeArguments: null, arguments: list([]) };
  const sourceApplication = { kind: "call", receiver: null, arguments: [], typeArguments: [], candidates: available(0),
    resolvedSignature: available(signature) };
  const checkedCall = { ...call, expression: checkedCallee,
    tsonic: { core, ...checkedValue(0), application: available(sourceApplication) } };
  const resolution = { decision: { candidate: 0, advertised: endpoint, api: endpoint, bindings, implementationBindings: bindings,
    parameters: [], completion: { signature, completion: 0, yielded: null, sent: null }, result: 0, activation: null }, activation: null };
  const typedCall = { ...call, expression: typedCallee, tsonic: { ...typedValue(0), operation: null,
    application: { kind: "decided", decision: { callee: resolution, receiver: null, arguments: [] } } } };
  const statement = { ...header(5, 0), kind: "ExpressionStatement", tsonic: null };
  const checkedStatement = { ...statement, expression: checkedCall };
  const typedStatement = { ...statement, expression: typedCall };
  checkedRoot.statements = list([checkedFn, checkedStatement]);
  root.statements = list([typedFn, typedStatement]);
  root.endOfFileToken.id = 8;
  source.items.unshift({ definition, node: checkedFn.id });
  index.modules[0].items.unshift({ definition, node: checkedFn.id });
  source.bodies[0].candidateLists.push({ id: 0, candidates: [{ ordinal: 0, declaration: definition,
    appliedSignature: available(signature), bindings: available(bindings), conditionalFailure: available(null), contributions: [] }] });
  index.types.terms.push({ kind: "callable", calls: [signature], constructs: [] });
  index.types.signatures.push({ id: signature, declaration: definition, owner: null, composition: null, kind: "call",
    typeParameters: [], receiver: null, parameters: [], result: 0 });
  const key = { kind: "declared", execution: { request: { definition, endpoint: "api-signature", ordinal: 0,
    bindings: { kind: "parametric" } }, provided: 0 } };
  index.signatures.push({ kind: endpoint.role, definition, ordinal: 0, signature, bindings: key.execution.request.bindings });
  const dependency = index.dependencyInventory;
  dependency.operations.push(key);
  dependency.dependencies.push({ dependent: selected.facts[0].execution, at: { body: bodyId, node: call.id },
    reason: "call", target: key });
  dependency.components = [{ kind: "declared", operation: 1 },
    { kind: "body", members: [0], rows: [0], dependencies: [0] }];
  for (const [reader, request, value] of [
    ["definitionPathOf", definition, path], ["definitionExists", definition, true], ["bindingScopeOf", definition, scope],
    ["bindingDependentOf", definition, false], ["declarationSourceOf", definition, { kind: "item", value: { owner: definition, node: 1 } }],
    ["declarationOf", definition, { scope, parameterCount: 0, endpoints: [endpoint] }],
    ["signatureIdOf", [definition, endpoint.role, 0, key.execution.request.bindings], signature],
    ["captureCount", key, 0],
    ["tirBindingScopesOf", { kind: "body", instance: template.instance }, new Array(4).fill(scope)],
    ["tirBindingScopesOf", { kind: "body", instance: selected.instance }, new Array(5).fill(scope)],
  ]) answers.set(encodeContextKey([reader, request]), value);
  for (const node of [checkedFn, checkedName, checkedReturn, modifier, checkedStatement, checkedCall, checkedCallee, checkedRoot.endOfFileToken]) {
    const reference = { kind: "body", value: { body: bodyId, node: node.id } };
    answers.set(encodeContextKey(["nodeOf", reference]), node);
    answers.set(encodeContextKey(["nodeExists", reference]), true);
  }
  for (const node of [checkedFn, checkedName, checkedReturn, modifier]) {
    const reference = { kind: "item", value: { owner: definition, node: node.id } };
    answers.set(encodeContextKey(["nodeOf", reference]), node);
    answers.set(encodeContextKey(["nodeExists", reference]), true);
  }
  const block = selected.mir.blocks[0];
  const at = { origin, tir: { body: bodyId, node: call.id } };
  selected.mir.blocks.push({ ...block, id: 1 });
  block.terminator = { ...at, kind: "call", callee: { kind: "direct", resolution }, receiver: null, arguments: [],
    destination: null, next: 1, unwind: { kind: "escape" }, step: null };
  index.bodies.find(row => row.kind === "selected").mirBlockCount = selected.mir.blocks.length;
  const facts = selected.facts[0];
  const alternative = { resolution, context: 0, arguments: [], result: 0, thrown: 0, summary: key };
  facts.refinements.integers.push(...[typedCall, typedCallee].map(node => ({ node: node.id, range: null, nonnegative: false })));
  facts.arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [] });
  facts.arena.origins.push({ id: 0, kind: "complete", producers: [], includesAbsence: false });
  facts.origins.invocations.push({ node: call.id, point: { block: block.id, statement: null },
    kind: "call", boundaries: [], alternatives: [alternative] });
  const summary = { ...structuredClone(index.summaries[0]), key, signature };
  answers.set(encodeContextKey(["arenaOf", { kind: "summary", key }]), summary.arena);
  return { fixture, definition, key, alternative, summary };
}

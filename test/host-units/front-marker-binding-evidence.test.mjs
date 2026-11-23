import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenedProgram } from "../../packages/host/dist/front/handles.js";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

for (const fixed of [false, true]) test(`declared extent retains the actual ${fixed ? "fixed-array" : "unrelated call"} marker producer boundary`, async () => {
  const fixture = await loadFrontFixture();
  const root = "/project/node_modules/extent-markers";
  const registration = { package: fixture.packageOf("/source-semantics"), version: "1", moduleSpecifier: "./plugin.js", exportId: "semantics" };
  const marker = fixed ? { kind: "type-marker", exportName: "Buffer", marker: "fixed-array" }
    : { kind: "call-marker", exportName: "struct", marker: "struct" };
  const manifest = { moduleSpecifier: "extent-markers", packageName: "extent-markers", packageVersion: "1.0.0",
    capabilities: [marker.kind], exports: [marker] };
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": 'import type { Buffer } from "extent-markers"; export type Example = Buffer<boolean>;' },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    providerPackages: [{ root: "/source-semantics", name: "source-semantics" }], semanticModules: [registration],
    extraFiles: { [root + "/package.json"]: '{"name":"extent-markers","version":"1.0.0","types":"index.d.ts"}' },
    otherPackages: [{ root, name: "extent-markers", modules: {
      "index.d.ts": ["declaration", "export interface Buffer<T> { readonly item: T; } export declare function struct<T>(value: T): T;", true],
    } }] });
  const opened = fixture.openAndCapture(snapshot, [{ reference: registration, value: { kind: "semantics-module", value: manifest } }]);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  assert.deepEqual(captured.value.checkerDiagnostics, []);
  const alias = captured.value.tree.statements.nodes.find(statement => statement.kind === "TypeAliasDeclaration");
  const authored = captured.value.types.types.find(type => type.authoredTypeNode?.node === alias.type.id && type.authoredTypeNode.module === module);
  assert.equal(authored.form.kind, "available");
  assert.equal(authored.form.value.kind, "declared");
  assert.deepEqual(authored.form.value.extent, fixed ? { kind: "unavailable", reason: "not-provided", causes: [] }
    : { kind: "available", value: null });
});

test("actual marker calls retain the declared binder, instantiated signature and authored type arguments", async () => {
  assert.ok(process.env.TSONIC_TEST_ADMISSION);
  const fixture = await loadFrontFixture();
  const source = `import { struct as mark, field as slot } from "binding-markers";
import type { Flag as RenamedFlag } from "./model.js";
import type * as model from "./model.js";
export const Constructed: { direct: boolean; renamed: boolean; qualified: boolean; label: string } =
  mark({ direct: slot<boolean>(), renamed: slot<RenamedFlag>(), qualified: slot<model.Flag>(), label: slot<model.Label>() });
`;
  const markerRoot = "/project/node_modules/binding-markers";
  const registration = { package: fixture.packageOf("/source-semantics"), version: "1", moduleSpecifier: "./plugin.js", exportId: "semantics" };
  const manifest = { moduleSpecifier: "binding-markers", packageName: "binding-markers", packageVersion: "1.0.0",
    capabilities: ["call-marker"], exports: [
      { kind: "call-marker", exportName: "struct", marker: "struct" },
      { kind: "call-marker", exportName: "field", marker: "field" },
    ] };
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": source,
    "model.ts": "export type Flag = boolean; export type Label = string;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  providerPackages: [{ root: "/source-semantics", name: "source-semantics" }],
  semanticModules: [registration],
  extraFiles: { [markerRoot + "/package.json"]: '{"name":"binding-markers","version":"1.0.0","types":"index.d.ts"}' },
  otherPackages: [{ root: markerRoot, name: "binding-markers", modules: {
    "index.d.ts": ["declaration", "export declare function struct<T>(value:T):T; export declare function field<T>():T;", true],
  } }] });
  const opened = fixture.openAndCapture(snapshot, [{ reference: registration, value: { kind: "semantics-module", value: manifest } }]);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const modelModule = fixture.moduleOf(fixture.packageOf("/project"), "src/model.ts");
  const provider = fixture.moduleOf(fixture.packageOf(markerRoot), "index.d.ts");
  const checked = OpenedProgram.checked(opened.program);
  const { ast, sourceFacts } = checked;
  const file = identity => OpenedProgram.file(opened.program, identity).file;
  const { checker } = checked.getSourceFileQueries(file(module));
  const statement = ast.statements(file(module)).find(node => ast.kindName(node) === "KindVariableStatement");
  const declarationList = ast.as.AsVariableStatement(statement).DeclarationList;
  const owner = ast.children(declarationList).find(node => ast.kindName(node) === "KindVariableDeclaration");
  const structCall = ast.as.AsVariableDeclaration(owner).Initializer;
  const [object] = ast.arguments(structCall);
  const properties = ast.properties(object);
  const [declaredStruct, declaredField] = ast.statements(file(provider));
  const [declaredFlag, declaredLabel] = ast.statements(file(modelModule));
  assert.equal(checked.diagnostics.filter(diagnostic => diagnostic.file === file(module) || diagnostic.file === file(modelModule)
    || diagnostic.file === file(provider)).length, 0);
  assert.equal(properties.length, 4);
  const marker = sourceFacts.getFact(owner, fixture.sdk.structFactKey);
  assert.equal(marker?.valueType, true);
  assert.equal(marker.fields.length, properties.length);

  const selected = (call, declaration) => {
    const info = checker.getResolvedCallInfo(call);
    assert.equal(info?.kind, "applicable");
    assert.equal(info.call === call, true);
    assert.equal(info.declarationOrder.kind, "available");
    assert.equal(info.declarationOrder.signatures.length, 1);
    const { application, inferenceContributions } = info.selection;
    const { signature, instantiatedSignature } = application;
    assert.equal(signature === info.declarationOrder.signatures[0], true);
    assert.equal(application.signatureShape.declaration === declaration, true);
    assert.equal(application.callee.selectedDeclaration === declaration, true);
    assert.equal(instantiatedSignature !== signature && instantiatedSignature.target === signature, true);
    assert.equal(signature.typeParameters.length, 1);
    assert.equal(instantiatedSignature.typeParameters.length, 0);
    assert.equal(instantiatedSignature === checker.getResolvedSignature(call), true);
    assert.equal(checker.getSignatureDeclaration(instantiatedSignature) === declaration, true);
    assert.equal(application.invocation === call, true);
    assert.equal(application.signatureTypeArguments.length, 1);
    const [binding] = application.signatureTypeArguments;
    assert.equal(binding.declaration === ast.typeParameters(declaration)[0], true);
    assert.equal(ast.parent(binding.declaration) === declaration, true);
    assert.equal(binding.typeParameter === signature.typeParameters[0], true);
    assert.equal(binding.checkedArgument !== undefined && binding.checkedArgument !== binding.typeParameter, true);
    assert.equal(binding.defaultTypeNode === undefined, true);
    assert.equal(checker.getReturnTypeOfSignature(signature)?.type === binding.typeParameter, true);
    assert.equal(checker.getReturnTypeOfSignature(instantiatedSignature)?.type === binding.checkedArgument, true);
    assert.equal(inferenceContributions.kind, "available");
    return { binding, contributions: inferenceContributions.contributions, selection: info.selection };
  };

  const inferred = selected(structCall, declaredStruct);
  assert.equal(inferred.binding.explicitTypeNode === undefined && ast.typeArguments(structCall).length === 0, true);
  assert.equal(inferred.selection.parameters.length, 1);
  const [parameter] = inferred.selection.parameters;
  const formal = ast.parameters(declaredStruct)[0];
  assert.equal(parameter.parameterDeclaration === formal && parameter.selectedType === inferred.binding.checkedArgument, true);
  assert.equal(inferred.selection.application.signatureShape.parameters[0].declaration === formal, true);
  const [argument] = inferred.selection.arguments.values;
  assert.equal(argument.sourceArgument === object && argument.effectiveArgument === object, true);
  assert.equal(argument.selectedParameterType === parameter.selectedType, true);
  assert.equal(argument.parameterIndex, 0);
  assert.equal(inferred.contributions.length, 2);
  assert.equal(inferred.contributions.every(contribution => contribution.typeParameter === inferred.binding.typeParameter
    && contribution.formalRootType === inferred.binding.typeParameter && contribution.sourcePath.length === 0
    && contribution.formalPath.length === 0), true);
  assert.equal(inferred.contributions.some(contribution => contribution.origin.kind === "argument"
    && contribution.origin.subject === object && contribution.origin.parameterIndex === 0), true);
  assert.equal(inferred.contributions.some(contribution => contribution.origin.kind === "contextual-result"
    && contribution.origin.subject === structCall), true);

  const explicit = properties.map((property, index) => {
    const call = ast.as.AsPropertyAssignment(property).Initializer;
    const actual = selected(call, declaredField);
    const typeNode = ast.typeArguments(call)[0];
    assert.equal(actual.binding.explicitTypeNode === typeNode, true);
    assert.equal(ast.parent(typeNode) === call, true);
    assert.equal(actual.binding.declaration !== inferred.binding.declaration, true);
    assert.equal(actual.contributions.length, 0);
    assert.equal(sourceFacts.getFact(property, fixture.sdk.fieldFactKey).type === typeNode, true);
    if (index === 0) {
      assert.equal(ast.kindName(typeNode), "KindBooleanKeyword");
    } else {
      const typeName = ast.as.AsTypeReferenceNode(typeNode).TypeName;
      let selectedSymbol;
      if (index === 1) {
        const alias = checker.getSymbolAtLocation(typeName);
        selectedSymbol = checker.getAliasedSymbol(alias);
        assert.equal(alias !== selectedSymbol, true);
      } else {
        assert.equal(ast.kindName(typeName), "KindQualifiedName");
        selectedSymbol = checker.getSymbolAtLocation(ast.as.AsQualifiedName(typeName).Right);
      }
      assert.equal(checker.getSymbolDeclarations(selectedSymbol).includes(index === 3 ? declaredLabel : declaredFlag), true);
    }
    assert.equal(actual.binding.checkedArgument === checker.getTypeFromTypeNode(typeNode).type, true);
    return { typeNode, binding: actual.binding };
  });
  assert.equal(new Set(explicit.map(argument => argument.typeNode)).size, explicit.length);
  assert.equal(explicit[0].binding.checkedArgument === explicit[1].binding.checkedArgument, true);
  assert.equal(explicit[1].binding.checkedArgument === explicit[2].binding.checkedArgument, true);
  assert.equal(explicit[3].binding.checkedArgument !== explicit[2].binding.checkedArgument, true);

  const raw = fixture.front.captureModule(opened.deps, opened.program, provider);
  assert.equal(raw.kind, "ok");
  const identities = fixture.front.lowerModuleDefinitions({ module: raw.value, componentRoots: [] });
  assert.equal(identities.kind, "ok");
  const parameterRows = raw.value.tree.statements.nodes.map((declaration, index) => {
    const parameter = declaration.typeParameters.nodes[0];
    const actual = index === 0 ? inferred.binding.declaration : explicit[0].binding.declaration;
    const range = ast.authoredRange(actual);
    assert.equal(range.kind, "authored");
    assert.equal(ast.getSourceFile(actual) === file(provider), true);
    assert.equal(parameter.origin.module, provider);
    assert.equal(parameter.origin.start, range.start);
    assert.equal(parameter.origin.length, range.end - range.start);
    return identities.value.rows.find(row => row.node === parameter.id);
  });
  assert.equal(parameterRows.every(row => row !== undefined), true);
  assert.notEqual(parameterRows[0].definition, parameterRows[1].definition);

  const consumerCapture = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(consumerCapture.kind, "ok");
  const consumer = consumerCapture.value;
  const variable = consumer.tree.statements.nodes.find(statement => statement.kind === "VariableStatement").declarationList.declarations.nodes[0];
  const rawStruct = variable.initializer;
  const rawObject = rawStruct.arguments.nodes[0];
  const rawFields = rawObject.properties.nodes.map(property => property.initializer);
  const fieldMarkers = rawObject.properties.nodes.map((property, index) => ({ name: property.name.text,
    typeNode: { module, node: rawFields[index].typeArguments.nodes[0].id }, readonly: false }));
  const markersAt = node => consumer.core.find(row => row.node.module === module && row.node.node === node.id).markers;
  const originalDeclaration = index => ({ module: provider, node: raw.value.tree.statements.nodes[index].id });
  const application = (role, index) => ({ kind: "available", value: { role, declaration: originalDeclaration(index) } });
  const absent = { kind: "available", value: null };
  const selectedStruct = { struct: { valueType: true, fields: { kind: "available", value: fieldMarkers } },
    field: null, defaultValue: null, jsString: false, application: application("struct", 0) };
  assert.deepEqual(markersAt(rawStruct), { kind: "available", value: selectedStruct });
  assert.deepEqual(markersAt(variable), { kind: "available", value: { ...selectedStruct, application: absent } });
  assert.equal(markersAt(rawObject).kind, "unavailable", "ordinary shape is not extension evidence");
  for (const [index, field] of rawFields.entries()) {
    const expected = { kind: "available", value: { struct: null, field: fieldMarkers[index], defaultValue: null, jsString: false,
      application: application("field", 1) } };
    assert.deepEqual(markersAt(field), expected);
    assert.deepEqual(markersAt(rawObject.properties.nodes[index]), { ...expected, value: { ...expected.value, application: absent } });
  }
  const originalParameter = index => ({ module: provider, node: parameterRows[index].node });

  const capturedCall = (call, index) => {
    const selection = consumer.calls.find(row => row.invocation.node === call.id);
    assert.equal(selection.kind, "applicable");
    assert.equal(selection.declarationOrder.kind, "available");
    const [declaredId] = selection.declarationOrder.value;
    const [candidate] = consumer.types.candidates[selection.candidates].candidates;
    const declared = consumer.types.signatures[declaredId];
    const applied = consumer.types.signatures[candidate.application.signature];
    assert.notEqual(applied.id, declared.id);
    assert.equal(applied.target, declared.id);
    assert.deepEqual([declared.declaration, applied.declaration], [originalDeclaration(index), originalDeclaration(index)]);
    assert.deepEqual(declared.typeParameters.value.map(id => consumer.types.types[id].form.value.parameter), [originalParameter(index)]);
    assert.deepEqual(applied.typeParameters.value, []);
    assert.deepEqual(applied.parameters.map(parameter => parameter.passing), index === 0 ? [{ kind: "available", value: "by-value" }] : []);
    const [binding] = candidate.application.signatureArguments;
    assert.deepEqual(binding.parameter, originalParameter(index));
    assert.equal(binding.argument.kind, "available");
    assert.equal(binding.defaultTypeNode, null);
    assert.equal(candidate.inferenceContributions.kind, "available");
    const result = signature => consumer.types.types[signature.result.value];
    assert.deepEqual(result(declared).form.value.parameter, originalParameter(index));
    return { binding, contributions: candidate.inferenceContributions.value, appliedResult: result(applied), declaredId };
  };
  const inferredCapture = capturedCall(rawStruct, 0);
  assert.equal(inferredCapture.binding.explicitTypeNode, null);
  const checkedBinding = consumer.types.types[inferredCapture.binding.argument.value];
  assert.equal(checkedBinding.form.value.kind, "structure");
  assert.equal(inferredCapture.appliedResult.form.value.kind, "structure");
  assert.equal(inferredCapture.contributions.length, 2);
  assert.deepEqual(inferredCapture.contributions.map(contribution => contribution.origin.kind),
    inferred.contributions.map(contribution => contribution.origin.kind));
  for (const contribution of inferredCapture.contributions) {
    assert.deepEqual(contribution.declaration, originalParameter(0));
    const sourceType = consumer.types.types[contribution.source];
    const formalType = consumer.types.types[contribution.formal];
    const source = consumer.types.components[sourceType.component];
    const formal = consumer.types.components[formalType.component];
    assert.deepEqual(formal.root, originalDeclaration(0));
    const descriptor = contribution.origin.kind === "argument" ? { kind: "parameter", signature: inferredCapture.declaredId, index: 0 }
      : { kind: "result", signature: inferredCapture.declaredId };
    assert.deepEqual(formal.path, { prefix: null, step: descriptor });
    assert.deepEqual(source.root, contribution.origin.subject);
    assert.equal(source.root.node, contribution.origin.kind === "argument" ? rawObject.id : rawStruct.id);
    assert.equal(sourceType.form.value.kind, "structure");
    assert.equal(formalType.form.value.kind, "parameter");
    assert.deepEqual(formalType.form.value.parameter, originalParameter(0));
  }
  for (const [index, rawField] of rawFields.entries()) {
    const captured = capturedCall(rawField, 1);
    assert.deepEqual(captured.binding.explicitTypeNode, { module, node: rawField.typeArguments.nodes[0].id });
    assert.deepEqual(captured.contributions, []);
    const form = { kind: "available", value: { kind: "scalar", scalar: index === 3 ? "string" : "boolean" } };
    const argument = consumer.types.types[captured.binding.argument.value];
    assert.deepEqual(argument.authoredTypeNode, captured.binding.explicitTypeNode);
    assert.deepEqual(argument.form, form);
    assert.deepEqual(captured.appliedResult.form, form);
  }

  const captureWith = (adapt, navigationCapture = opened.deps.navigationCapture) => {
    const program = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
      const queries = checked.getSourceFileQueries(sourceFile);
      if (sourceFile !== file(module)) return queries;
      return { ...queries, checker: { ...queries.checker,
        getResolvedCallInfo: call => adapt(call, queries.checker.getResolvedCallInfo(call)) } };
    } }, OpenedProgram.table(opened.program), OpenedProgram.modules(opened.program).modules.map(entry =>
      fileEntry(entry.kind === "snapshot" ? entry.module : entry.document.module)),
    OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
    return fixture.front.captureModule({ ...opened.deps, navigationCapture }, program, module);
  };
  const fileEntry = identity => OpenedProgram.file(opened.program, identity);
  const fieldCall = ast.as.AsPropertyAssignment(properties[1]).Initializer;
  for (const crossed of [{ declaration: inferred.binding.declaration }, { explicitTypeNode: explicit[2].typeNode }]) {
    assert.throws(() => captureWith((call, info) => {
      if (call !== fieldCall) return info;
      const { selection } = info;
      return { ...info, selection: { ...selection, application: { ...selection.application,
        signatureTypeArguments: [{ ...selection.application.signatureTypeArguments[0], ...crossed }],
      } } };
    }), /selected signature binding must retain its actual original parameter and argument/);
  }

  const readBindingsAt = (dimension, maximum, originalStop) => {
    let reads = 0;
    const capture = captureWith((call, info) => {
      if (call !== structCall) return info;
      const { selection } = info;
      const native = selection.application.signatureTypeArguments;
      return { ...info, selection: { ...selection, application: { ...selection.application,
        signatureTypeArguments: new Proxy(native, { get(target, key, receiver) {
          if (key === "0") {
            reads += 1;
            if (originalStop !== undefined) throw originalStop;
          }
          return Reflect.get(target, key, receiver);
        } }),
      } } };
    }, { ...opened.deps.navigationCapture, [dimension]: maximum });
    return { reads, capture };
  };
  for (const [dimension, firstRead] of [["maximumCapturedFactsPerModule", 219], ["maximumCapturedEdgesPerModule", 147]]) {
    const originalStop = new Error("the first actual checked binding read");
    const unread = readBindingsAt(dimension, firstRead - 1, originalStop);
    assert.equal(unread.reads, 0);
    assert.equal(unread.capture.kind, "refused");
    assert.deepEqual(unread.capture.diagnostics[0].arguments, [
      { kind: "text", value: `front.${dimension}` }, { kind: "number", value: firstRead - 1 },
    ]);
    assert.throws(() => readBindingsAt(dimension, firstRead, originalStop), error => error === originalStop);
  }
});

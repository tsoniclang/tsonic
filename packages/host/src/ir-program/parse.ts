import type { TextParseResult } from "../diag/contract.js";
import type { ParseModuleBodies, ModuleBodies, PublishedBody } from "./contract.js";
import type { ModuleId } from "../ids/contract.js";
import type { SourceFile } from "../ir-hir/contract.js";
import type { TirBody, TypedPhase } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { BodyFacts, BodyObservations } from "../ir-facts/contract.js";
import type { BodyInstance } from "../ir-types/contract.js";
import type { BodyRecord, ConstantRecord, DefinitionNode, ModuleExport, ModuleRecord, PackageExport, PackageRecord, ParseProgramIndex, ProgramIndex, SignatureRecord } from "./contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import { expansionId, localId, nodeId, sigId, tyId } from "../ids/index.js";
import { parseFacts, parseMetadata, parseObservations, parseSummary } from "../ir-facts/index.js";
import { parseMir } from "../ir-mir/index.js";
import { parseTypes } from "../ir-types/index.js";
import type { Cursor, RecordFields } from "./parse-values.js";
import { choice, closeRecord, delimiter, invalid, nullable, openRecord, readArray, readBodyId, readChild, readDefinitionId, readField, readModuleId, readNodeId, readNumber, readPackageId, readSignatureId, readString, whitespace } from "./parse-values.js";
import { readDiagnostic } from "./parse-diagnostics.js";
import { readArtifactBindings, readConstantReference, readConstValue, readExecution, readInstance } from "./parse-types.js";
import type { TextStep } from "./parse-values.js";
import { arrayText, atomicText, fieldText } from "./parse-values.js";
import type { SyntaxReadPorts, SyntaxValue } from "./parse-syntax-values.js";
import { finishSyntaxRecord, readSyntaxReference, resolveSyntaxValue, syntaxArray } from "./parse-syntax-values.js";
import { readTirBodyText } from "./parse-tir.js";
import { parseSyntaxDocument } from "./parse-syntax.js";

function readPublishedBodyText<Root>(cursor: Cursor, ports: SyntaxReadPorts, finish: (value: SyntaxValue<PublishedBody>) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "PublishedBody"), fields =>
    fieldText<BodyInstance, Root>(cursor, fields, "instance", (next, done) => atomicText(next, readInstance, done), instance =>
      fieldText<SyntaxValue<TirBody>, Root>(cursor, fields, "tir", (next, done) => readTirBodyText(next, ports, done), tir =>
        fieldText<MirBody, Root>(cursor, fields, "mir", (next, done) => atomicText(next, cursor => readChild(cursor, parseMir), done), mir =>
          fieldText<readonly BodyFacts[], Root>(cursor, fields, "facts", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readChild(cursor, parseFacts), done), done), facts =>
          fieldText<BodyObservations, Root>(cursor, fields, "observations", (next, done) => atomicText(next, cursor => readChild(cursor, parseObservations), done), observations =>
            finishSyntaxRecord<PublishedBody, Root>(cursor, fields, {
              resolve: () => resolveSyntaxValue(tir, body => ({ instance, tir: body, mir, observations, facts })),
            }, finish)))))));
}

function readModuleBodiesText<Root>(cursor: Cursor, ports: SyntaxReadPorts, finish: (value: SyntaxValue<ModuleBodies>) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ModuleBodies"), fields =>
    fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), module =>
      fieldText<SyntaxValue<SourceFile<TypedPhase>>, Root>(cursor, fields, "tree", (next, done) => readSyntaxReference(next, ports.SourceFile, done), tree =>
        fieldText<readonly SyntaxValue<PublishedBody>[], Root>(cursor, fields, "bodies", (next, done) => arrayText(next, (next, done) => readPublishedBodyText(next, ports, done), done), bodies => {
          const published = syntaxArray(bodies);
          return finishSyntaxRecord<ModuleBodies, Root>(cursor, fields, {
            resolve: () => resolveSyntaxValue(tree, source => resolveSyntaxValue(published, values => ({
              module, tree: source, bodies: values,
            }))),
          }, finish);
        }))));
}

export const parseModuleBodies: ParseModuleBodies = (_index, text) => {
  const cursor = programCursor(text);
  return parseSyntaxDocument(cursor, ports => readModuleBodiesText(cursor, ports, value => ({
    kind: "complete", result: { kind: "parsed", value },
  })));
};

function programCursor(text: string): Cursor {
  return { text, offset: 0, identities: {
    type: tyId, signature: sigId, node: nodeId, local: localId,
    expansion: expansionId, hostCode: hostDiagnosticCode,
  } };
}

export const parseProgramIndex: ParseProgramIndex = text => {
  const cursor = programCursor(text);
  const parsed = readProgramIndex(cursor);
  if (parsed.kind === "invalid-text") return parsed;
  whitespace(cursor);
  return cursor.offset === text.length ? parsed : invalid(cursor, cursor.offset, ["end of input"]);
};

function readSignatureRecord(cursor: Cursor): TextParseResult<SignatureRecord> {
  const kind = choice(cursor, ["advertised","api-signature","api-body"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "advertised":
    case "api-signature": {
      const definition = readField(cursor, fields, "definition", readDefinitionId);
      if (definition.kind === "invalid-text") return definition;
      const bindings = readField(cursor, fields, "bindings", readArtifactBindings);
      if (bindings.kind === "invalid-text") return bindings;
      const ordinal = readField(cursor, fields, "ordinal", readNumber);
      if (ordinal.kind === "invalid-text") return ordinal;
      const signature = readField(cursor, fields, "signature", readSignatureId);
      if (signature.kind === "invalid-text") return signature;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        definition: definition.value, bindings: bindings.value, ordinal: ordinal.value, signature: signature.value
      } };
    }
    case "api-body": {
      const definition = readField(cursor, fields, "definition", readDefinitionId);
      if (definition.kind === "invalid-text") return definition;
      const bindings = readField(cursor, fields, "bindings", readArtifactBindings);
      if (bindings.kind === "invalid-text") return bindings;
      const ordinal = readField(cursor, fields, "ordinal", readNumber);
      if (ordinal.kind === "invalid-text") return ordinal;
      const signature = readField(cursor, fields, "signature", readSignatureId);
      if (signature.kind === "invalid-text") return signature;
      const body = readField(cursor, fields, "body", next => nullable(next, readBodyId));
      if (body.kind === "invalid-text") return body;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        definition: definition.value, bindings: bindings.value, ordinal: ordinal.value, signature: signature.value, body: body.value
      } };
    }
  }
}

function readBodyRecord(cursor: Cursor): TextParseResult<BodyRecord> {
  const kind = choice(cursor, ["BodyRecord"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const instance = readField(cursor, fields, "instance", readInstance);
  if (instance.kind === "invalid-text") return instance;
  const module = readField(cursor, fields, "module", readModuleId);
  if (module.kind === "invalid-text") return module;
  const owner = readField(cursor, fields, "owner", readDefinitionId);
  if (owner.kind === "invalid-text") return owner;
  const root = readField(cursor, fields, "root", readNodeId);
  if (root.kind === "invalid-text") return root;
  const mirLocalCount = readField(cursor, fields, "mirLocalCount", readNumber);
  if (mirLocalCount.kind === "invalid-text") return mirLocalCount;
  const mirConstantCount = readField(cursor, fields, "mirConstantCount", readNumber);
  if (mirConstantCount.kind === "invalid-text") return mirConstantCount;
  const mirPlaceCount = readField(cursor, fields, "mirPlaceCount", readNumber);
  if (mirPlaceCount.kind === "invalid-text") return mirPlaceCount;
  const mirBlockCount = readField(cursor, fields, "mirBlockCount", readNumber);
  if (mirBlockCount.kind === "invalid-text") return mirBlockCount;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    instance: instance.value, module: module.value, owner: owner.value, root: root.value, mirLocalCount: mirLocalCount.value, mirConstantCount: mirConstantCount.value, mirPlaceCount: mirPlaceCount.value, mirBlockCount: mirBlockCount.value
  } };
}

function readConstantRecord(cursor: Cursor): TextParseResult<ConstantRecord> {
  const kind = choice(cursor, ["ConstantRecord"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const reference = readField(cursor, fields, "reference", readConstantReference);
  if (reference.kind === "invalid-text") return reference;
  const value = readField(cursor, fields, "value", readConstValue);
  if (value.kind === "invalid-text") return value;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    reference: reference.value, value: value.value
  } };
}

function readProgramIndex(cursor: Cursor): TextParseResult<ProgramIndex> {
  const kind = choice(cursor, ["ProgramIndex"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const schema = readField(cursor, fields, "schema", readNumber);
  if (schema.kind === "invalid-text") return schema;
  const rootPackage = readField(cursor, fields, "rootPackage", readPackageId);
  if (rootPackage.kind === "invalid-text") return rootPackage;
  const packages = readField(cursor, fields, "packages", next => readArray(next, readPackage));
  if (packages.kind === "invalid-text") return packages;
  const modules = readField(cursor, fields, "modules", next => readArray(next, readModule));
  if (modules.kind === "invalid-text") return modules;
  const types = readField(cursor, fields, "types", next => readChild(next, parseTypes));
  if (types.kind === "invalid-text") return types;
  const signatures = readField(cursor, fields, "signatures", next => readArray(next, readSignatureRecord));
  if (signatures.kind === "invalid-text") return signatures;
  const bodies = readField(cursor, fields, "bodies", next => readArray(next, readBodyRecord));
  if (bodies.kind === "invalid-text") return bodies;
  const executions = readField(cursor, fields, "executions", next => readArray(next, readExecution));
  if (executions.kind === "invalid-text") return executions;
  const metadata = readField(cursor, fields, "metadata", next => readArray(next, next => readChild(next, parseMetadata)));
  if (metadata.kind === "invalid-text") return metadata;
  const summaries = readField(cursor, fields, "summaries", next => readArray(next, next => readChild(next, parseSummary)));
  if (summaries.kind === "invalid-text") return summaries;
  const constants = readField(cursor, fields, "constants", next => readArray(next, readConstantRecord));
  if (constants.kind === "invalid-text") return constants;
  const diagnostics = readField(cursor, fields, "diagnostics", next => readArray(next, readDiagnostic));
  if (diagnostics.kind === "invalid-text") return diagnostics;
  const nativeFactsKey = readField(cursor, fields, "nativeFactsKey", readString);
  if (nativeFactsKey.kind === "invalid-text") return nativeFactsKey;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    schema: schema.value, nativeFactsKey: nativeFactsKey.value, rootPackage: rootPackage.value, packages: packages.value, modules: modules.value, types: types.value, signatures: signatures.value, bodies: bodies.value, executions: executions.value, metadata: metadata.value, summaries: summaries.value, constants: constants.value, diagnostics: diagnostics.value
  } };
}

function readPackageExport(cursor: Cursor): TextParseResult<PackageExport> {
  const opened = openRecord(cursor, "PackageExport");
  if (opened.kind === "invalid-text") return opened;
  const specifier = readField(cursor, opened.value, "specifier", readString);
  if (specifier.kind === "invalid-text") return specifier;
  const module = readField(cursor, opened.value, "module", readModuleId);
  if (module.kind === "invalid-text") return module;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { specifier: specifier.value, module: module.value } };
}

function readPackage(cursor: Cursor): TextParseResult<PackageRecord> {
  const opened = openRecord(cursor, "PackageRecord");
  if (opened.kind === "invalid-text") return opened;
  const id = readField(cursor, opened.value, "id", readPackageId);
  if (id.kind === "invalid-text") return id;
  const name = readField(cursor, opened.value, "name", next => nullable(next, readString));
  if (name.kind === "invalid-text") return name;
  const packageRoot = readField(cursor, opened.value, "packageRoot", readString);
  if (packageRoot.kind === "invalid-text") return packageRoot;
  const sourceRoot = readField(cursor, opened.value, "sourceRoot", readString);
  if (sourceRoot.kind === "invalid-text") return sourceRoot;
  const dependencies = readField(cursor, opened.value, "dependencies", next => readArray(next, readPackageId));
  if (dependencies.kind === "invalid-text") return dependencies;
  const exports = readField(cursor, opened.value, "exports", next => readArray(next, readPackageExport));
  if (exports.kind === "invalid-text") return exports;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    id: id.value, name: name.value, packageRoot: packageRoot.value, sourceRoot: sourceRoot.value,
    dependencies: dependencies.value, exports: exports.value,
  } };
}

function readModuleExport(cursor: Cursor): TextParseResult<ModuleExport> {
  const opened = openRecord(cursor, "ModuleExport");
  if (opened.kind === "invalid-text") return opened;
  const name = readField(cursor, opened.value, "name", readString);
  if (name.kind === "invalid-text") return name;
  const definition = readField(cursor, opened.value, "definition", readDefinitionId);
  if (definition.kind === "invalid-text") return definition;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { name: name.value, definition: definition.value } };
}

function readDefinitionNode(cursor: Cursor): TextParseResult<DefinitionNode> {
  const opened = openRecord(cursor, "DefinitionNode");
  if (opened.kind === "invalid-text") return opened;
  const definition = readField(cursor, opened.value, "definition", readDefinitionId);
  if (definition.kind === "invalid-text") return definition;
  const node = readField(cursor, opened.value, "node", readNodeId);
  if (node.kind === "invalid-text") return node;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { definition: definition.value, node: node.value } };
}

function readModule(cursor: Cursor): TextParseResult<ModuleRecord> {
  const opened = openRecord(cursor, "ModuleRecord");
  if (opened.kind === "invalid-text") return opened;
  const module = readField(cursor, opened.value, "module", readModuleId);
  if (module.kind === "invalid-text") return module;
  const owner = readField(cursor, opened.value, "package", readPackageId);
  if (owner.kind === "invalid-text") return owner;
  const items = readField(cursor, opened.value, "items", next => readArray(next, readDefinitionNode));
  if (items.kind === "invalid-text") return items;
  const exports = readField(cursor, opened.value, "exports", next => readArray(next, readModuleExport));
  if (exports.kind === "invalid-text") return exports;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    module: module.value, package: owner.value, items: items.value, exports: exports.value,
  } };
}

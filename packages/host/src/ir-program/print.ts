import type { BodyRecord, ConstantRecord, ModuleRecord, PackageRecord, PrintModuleBodies, PrintProgramIndex, PublishedBody, SignatureRecord } from "./contract.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import type { TirBody } from "../ir-tir/contract.js";
import { printFacts, printMetadata, printObservations, printSummary } from "../ir-facts/index.js";
import { printMir } from "../ir-mir/index.js";
import { printTypes } from "../ir-types/index.js";
import { textArtifactBindings, textBindingVector, textBodyInstance, textConstantReference, textConstValue, textExecution, textTypeEvidence } from "./text-types.js";
import { textHirLexicalScope } from "./text-core.js";
import { textBodyCaptureRow } from "./text-inference.js";
import { createSyntaxText, syntaxText } from "./print-syntax.js";
import { boolean, deferred, emitText, field, identity, nullable, numeric, numericIdentity, record, sequence, text, textDiagnostic, textLocalRef, textSourceNodeRef, token } from "./text-values.js";

function packageRecord(value: PackageRecord): TextWork {
  return deferred(value, () => record("PackageRecord", [
    field("id", identity("pkg", value.id)),
    field("name", nullable(value.name, text)),
    field("packageRoot", text(value.packageRoot)), field("sourceRoot", text(value.sourceRoot)),
    field("dependencies", sequence(value.dependencies, dependency => identity("pkg", dependency))),
    field("exports", sequence(value.exports, exported => deferred(exported, () => record("PackageExport", [
      field("specifier", text(exported.specifier)), field("module", identity("mod", exported.module)),
    ])))),
  ]));
}

function moduleRecord(value: ModuleRecord): TextWork {
  return deferred(value, () => record("ModuleRecord", [
    field("module", identity("mod", value.module)), field("package", identity("pkg", value.package)),
    field("items", sequence(value.items, item => deferred(item, () => record("DefinitionNode", [
      field("definition", identity("def", item.definition)), field("node", numericIdentity("n", item.node)),
    ])))),
    field("exports", sequence(value.exports, exported => deferred(exported, () => record("ModuleExport", [
      field("name", text(exported.name)), field("definition", identity("def", exported.definition)),
    ])))),
  ]));
}

function signatureRecord(value: SignatureRecord): TextWork {
  return deferred(value, () => {
    const common = [
      field("definition", identity("def", value.definition)),
      field("bindings", textArtifactBindings(value.bindings)),
      field("ordinal", numeric(value.ordinal)), field("signature", numericIdentity("sig", value.signature)),
    ];
    switch (value.kind) {
      case "advertised":
      case "api-signature": return record(value.kind, common);
      case "api-body": return record(value.kind, [
        ...common, field("body", nullable(value.body, body => identity("body", body))),
      ]);
    }
  });
}

function bodyRecord(value: BodyRecord): TextWork {
  return deferred(value, () => record("BodyRecord", [
    field("instance", textBodyInstance(value.instance)), field("module", identity("mod", value.module)),
    field("owner", identity("def", value.owner)), field("root", numericIdentity("n", value.root)),
    field("mirLocalCount", numeric(value.mirLocalCount)), field("mirConstantCount", numeric(value.mirConstantCount)),
    field("mirPlaceCount", numeric(value.mirPlaceCount)), field("mirBlockCount", numeric(value.mirBlockCount)),
  ]));
}

function constantRecord(value: ConstantRecord): TextWork {
  return deferred(value, () => record("ConstantRecord", [
    field("reference", textConstantReference(value.reference)), field("value", textConstValue(value.value)),
  ]));
}

export const printProgramIndex: PrintProgramIndex = index => `${emitText(deferred(index, () => record("ProgramIndex", [
  field("schema", numeric(index.schema)), field("rootPackage", identity("pkg", index.rootPackage)),
  field("packages", sequence(index.packages, packageRecord)), field("modules", sequence(index.modules, moduleRecord)),
  field("types", token(printTypes(index.types).trimEnd())),
  field("signatures", sequence(index.signatures, signatureRecord)), field("bodies", sequence(index.bodies, bodyRecord)),
  field("executions", sequence(index.executions, textExecution)),
  field("metadata", sequence(index.metadata, value => token(printMetadata(value).trimEnd()))),
  field("summaries", sequence(index.summaries, value => token(printSummary(value).trimEnd()))),
  field("constants", sequence(index.constants, constantRecord)), field("diagnostics", sequence(index.diagnostics, textDiagnostic)),
  field("nativeFactsKey", text(index.nativeFactsKey)),
])), "ProgramIndex")}\n`;

function tirBodyRecord(value: TirBody, context: SyntaxTextContext): TextWork {
  return deferred(value, () => record("TirBody", [
    field("body", identity("body", value.body)), field("owner", identity("def", value.owner)),
    field("bindings", textArtifactBindings(value.bindings)), field("lexicalBindings", textBindingVector(value.lexicalBindings)),
    field("dependence", text(value.dependence)), field("signature", numericIdentity("sig", value.signature)),
    field("completion", numericIdentity("t", value.completion)),
    field("yielded", nullable(value.yielded, type => numericIdentity("t", type))),
    field("sent", nullable(value.sent, type => numericIdentity("t", type))),
    field("params", sequence(value.params, parameter => deferred(parameter, () => record("TirParam", [
      field("local", numericIdentity("l", parameter.local)), field("declaration", identity("def", parameter.declaration)),
      field("role", text(parameter.role)), field("passing", text(parameter.passing)),
      field("initializer", nullable(parameter.initializer, body => identity("body", body))),
      field("storage", numericIdentity("t", parameter.storage)),
    ])))),
    field("locals", sequence(value.locals, local => deferred(local, () => record("TirLocal", [
      field("id", numericIdentity("l", local.id)), field("declaration", textSourceNodeRef(local.declaration)),
      field("name", text(local.name)), field("role", text(local.role)),
      field("capturedFrom", nullable(local.capturedFrom, textLocalRef)), field("mutable", boolean(local.mutable)),
      field("storage", numericIdentity("t", local.storage)),
    ])))),
    field("root", context.reference(value.root)),
    field("nestedBodies", sequence(value.nestedBodies, body => identity("body", body))),
    field("captures", sequence(value.captures, textBodyCaptureRow)),
    field("scopes", sequence(value.scopes, textHirLexicalScope)),
    field("evidence", sequence(value.evidence, textTypeEvidence)),
    field("asynchronous", boolean(value.asynchronous)), field("generator", boolean(value.generator)),
  ]));
}

function publishedBody(value: PublishedBody, context: SyntaxTextContext): TextWork {
  return deferred(value, () => record("PublishedBody", [
    field("instance", textBodyInstance(value.instance)), field("tir", tirBodyRecord(value.tir, context)),
    field("mir", token(printMir(value.mir).trimEnd())), field("facts", sequence(value.facts, facts => token(printFacts(facts).trimEnd()))),
    field("observations", token(printObservations(value.observations).trimEnd())),
  ]));
}

export const printModuleBodies: PrintModuleBodies = (_index, module) => {
  const arena = createSyntaxText(module);
  const chunks = [emitText(deferred(module, () => record("ModuleBodies", [
    field("module", identity("mod", module.module)), field("tree", arena.context.reference(module.tree)),
    field("bodies", sequence(module.bodies, body => publishedBody(body, arena.context))),
  ])), "ModuleBodies")];
  for (const [position, node] of arena.nodes.entries()) {
    chunks.push(`n:${position}=${emitText(syntaxText(node, arena.context), `n:${position}`)}`);
  }
  return chunks.join("\n");
};

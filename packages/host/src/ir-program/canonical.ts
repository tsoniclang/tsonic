import type { CanonicalizeProgram, SignatureRecord } from "./contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import { publicationRewrite, rewriteArtifactBindings, rewriteConstant, rewriteExecution, rewriteInstance } from "./canonical-types.js";
import { rewriteMetadata, rewriteSummary, rewriteSummaryKey } from "./canonical-facts.js";
import { rewriteModuleSyntax } from "./canonical-syntax.js";

function rewriteSignature(rewrite: TypeRewrite, record: SignatureRecord): SignatureRecord {
  const common = {
    definition: record.definition, bindings: rewriteArtifactBindings(rewrite, record.bindings),
    ordinal: record.ordinal, signature: rewrite.signature(record.signature),
  };
  switch (record.kind) {
    case "advertised":
    case "api-signature": return { ...common, kind: record.kind };
    case "api-body": return { ...common, kind: "api-body", body: record.body };
  }
}

export const canonicalizeProgram: CanonicalizeProgram = (program, publication) => {
  const rewrite = publicationRewrite(publication);
  const index = program.index;
  return {
    index: {
      schema: index.schema, rootPackage: index.rootPackage, packages: index.packages, modules: index.modules,
      types: publication.table, signatures: index.signatures.map(record => rewriteSignature(rewrite, record)),
      bodies: index.bodies.map(record => ({
        instance: rewriteInstance(rewrite, record.instance), module: record.module, owner: record.owner, root: record.root,
        mirLocalCount: record.mirLocalCount, mirConstantCount: record.mirConstantCount,
        mirPlaceCount: record.mirPlaceCount, mirBlockCount: record.mirBlockCount,
      })),
      executions: index.executions.map(execution => rewriteExecution(rewrite, execution)),
      metadata: index.metadata.map(record => rewriteMetadata(rewrite, record)),
      summaries: index.summaries.map(summary => rewriteSummary(rewrite, summary, rewriteSummaryKey(rewrite, summary.key))),
      constants: index.constants.map(record => ({ initializer: rewriteInstance(rewrite, record.initializer), value: rewriteConstant(rewrite, record.value) })),
      diagnostics: index.diagnostics,
    },
    modules: program.modules.map((module, position) => rewriteModuleSyntax(rewrite, module, `HostProgram.modules[${position}]`)),
  };
};

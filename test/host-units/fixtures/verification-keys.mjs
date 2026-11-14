import { artifactBindingsData, executionKey, instanceKey } from "../../../packages/host/dist/ir-types/index.js";
import { summaryKey } from "../../../packages/host/dist/ir-facts/index.js";

export const declarationInstanceKey = value => [value.definition, artifactBindingsData(value.bindings)];

export const relationalOwnerKey = value => value.kind === "body"
  ? [value.kind, executionKey(value.execution)] : [value.kind, summaryKey(value.key)];

export function bindingTargetKey(value) {
  switch (value.kind) {
    case "body": case "observations": return [value.kind, instanceKey(value.instance)];
    case "summary": return [value.kind, summaryKey(value.summary)];
    case "metadata": return [value.kind, declarationInstanceKey(value.metadata)];
  }
  throw new Error("Unlisted native binding target fixture");
}

export const sourceReferenceKey = value => [value.kind,
  value.kind === "body" ? value.value.body : value.value.owner, value.value.node];

export const libraryExportKey = value => [[value.module.providerId, value.module.providerVersion,
  value.module.packageName, value.module.moduleSpecifier, value.module.providerModuleId],
value.exportId, value.memberId, value.signatureId];

import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import { declaredExecutionKey, executionKey } from "../ir-types/index.js";
import type { AdmitSummaryIdentity, FactsVerificationContext, SummaryIdentity, SummaryKey, SummaryPositionKey } from "./contract.js";
import { admitOwnerIdentity } from "./verification.js";
import type { DefId } from "../ids/contract.js";

export const summaryKey: SummaryIdentity = key => encodeKey([key.kind, key.kind === "body"
  ? executionKey(key.execution) : declaredExecutionKey(key.execution)]);

export const admitSummaryIdentity: AdmitSummaryIdentity = (key, account) =>
  admitOwnerIdentity({ kind: "summary", key }, account);

export const summaryPositionKey: SummaryPositionKey = at => at.kind === "body"
  ? encodeKey([at.kind, executionKey(at.execution), at.point.block, at.point.statement, at.edge])
  : encodeKey([at.kind, declaredExecutionKey(at.execution), at.source.kind,
    at.source.kind === "body" ? at.source.value.body : at.source.value.owner, at.source.value.node]);

export const summaryBindings = (key: SummaryKey): ArtifactBindings => key.kind === "body"
  ? key.execution.instance.bindings : key.execution.request.bindings;

export const summaryDefinition = (key: SummaryKey, context: FactsVerificationContext): DefId | null => key.kind === "body"
  ? context.bodyOwner(key.execution.instance.body) : key.execution.request.definition;

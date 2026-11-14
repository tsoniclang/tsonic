import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import { declaredExecutionKey, executionKey } from "../ir-types/index.js";
import type { FactsVerificationContext, SummaryIdentity, SummaryKey } from "./contract.js";
import type { DefId } from "../ids/contract.js";

export const summaryKey: SummaryIdentity = key => encodeKey([key.kind, key.kind === "body"
  ? executionKey(key.execution) : declaredExecutionKey(key.execution)]);

export const summaryBindings = (key: SummaryKey): ArtifactBindings => key.kind === "body"
  ? key.execution.instance.bindings : key.execution.request.bindings;

export const summaryDefinition = (key: SummaryKey, context: FactsVerificationContext): DefId | null => key.kind === "body"
  ? context.bodyOwner(key.execution.instance.body) : key.execution.request.definition;

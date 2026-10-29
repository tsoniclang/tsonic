export interface SourceReceiverResourceLimits {
  readonly maximumNodes: number;
  readonly maximumTransportRows: number;
  readonly maximumSteps: number;
}

export interface SourceReceiverResourceFailure {
  readonly kind: "resource";
  readonly subject: "source-node" | "transport-row" | "analysis-work";
  readonly limit: number;
  readonly reason: string;
}

export interface SourceReceiverInvalidEvidence {
  readonly kind: "unresolved";
  readonly reason: string;
}

export const defaultSourceReceiverResourceLimits: SourceReceiverResourceLimits = Object.freeze({
  maximumNodes: 1_048_576,
  maximumTransportRows: 4_194_304,
  maximumSteps: 33_554_432,
});

export function createSourceReceiverResourceBudget(selection: Partial<SourceReceiverResourceLimits> = {}) {
  const limits = { ...defaultSourceReceiverResourceLimits, ...selection };
  let failure: SourceReceiverResourceFailure | SourceReceiverInvalidEvidence | undefined;
  for (const [key, maximum] of Object.entries(defaultSourceReceiverResourceLimits)) {
    const descriptor = Object.getOwnPropertyDescriptor(limits, key);
    const value: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
      failure = Object.freeze({ kind: "unresolved",
        reason: "Receiver resource limits must be positive safe integers no greater than the bounded defaults." });
      break;
    }
  }
  let nodes = 0;
  let rows = 0;
  let steps = 0;
  const admit = (value: number, limit: number, subject: SourceReceiverResourceFailure["subject"]): boolean => {
    if (failure !== undefined) return false;
    if (value > limit) failure = Object.freeze({ kind: "resource", subject, limit,
      reason: `Receiver occurrence analysis exceeds its finite ${subject} resource limit (${limit}).` });
    return failure === undefined;
  };
  return Object.freeze({
    failure: (): SourceReceiverResourceFailure | SourceReceiverInvalidEvidence | undefined => failure,
    node: (): boolean => admit(++nodes, limits.maximumNodes, "source-node"),
    row: (): boolean => {
      if (!admit(rows + 1, limits.maximumTransportRows, "transport-row")) return false;
      rows += 1;
      return true;
    },
    step: (): boolean => admit(++steps, limits.maximumSteps, "analysis-work"),
  });
}

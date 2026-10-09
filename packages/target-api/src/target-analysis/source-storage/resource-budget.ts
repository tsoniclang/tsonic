import type { SourceStorageLimits } from "./types.js";

export interface SourceStorageRows {
  add(cost: number): boolean;
  release(): void;
}

export const defaultSourceStorageLimits: SourceStorageLimits = Object.freeze({
  maximumNodes: 1_048_576,
  maximumEdges: 262_144,
  maximumSubjectRows: 1_048_576,
  maximumTransportRows: 1_048_576,
  maximumSteps: 4_194_304,
});

export function createSourceStorageBudget(selection: SourceStorageLimits) {
  let failure: string | undefined;
  const limits = { ...defaultSourceStorageLimits };
  if (selection === null || typeof selection !== "object") {
    failure = "Source storage limits require a finite data-only selection.";
  } else {
    for (const key of Object.keys(defaultSourceStorageLimits) as (keyof SourceStorageLimits)[]) {
      const descriptor = Object.getOwnPropertyDescriptor(selection, key);
      const value: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > defaultSourceStorageLimits[key]) {
        failure = "Source storage limits must be positive safe integers no greater than the bounded defaults.";
        break;
      }
      limits[key] = value;
    }
  }
  let nodes = 0;
  let edges = 0;
  let subjects = 0;
  let rows = 0;
  let steps = 0;
  const reject = (reason: string): void => { failure ??= reason; };
  const admit = (value: number, maximum: number, label: string): boolean => {
    if (failure !== undefined) return false;
    if (value > maximum) reject(`Source storage transport exceeds its finite ${label} budget.`);
    return failure === undefined;
  };
  return Object.freeze({
    failure: (): string | undefined => failure,
    reject,
    node: (): boolean => admit(++nodes, limits.maximumNodes, "source-node"),
    edge: (): boolean => admit(++edges, limits.maximumEdges, "edge"),
    subject: (cost: number): boolean => {
      if (!Number.isSafeInteger(cost) || cost <= 0) { reject("A source storage subject requires a finite positive row cost."); return false; }
      subjects += cost;
      return admit(subjects, limits.maximumSubjectRows, "subject");
    },
    row: (): boolean => admit(++rows, limits.maximumTransportRows, "transport-row"),
    createRows: (): SourceStorageRows => {
      let retained = 0;
      let released = false;
      return Object.freeze({
        add(cost: number): boolean {
          if (released || !Number.isSafeInteger(cost) || cost <= 0 || cost > limits.maximumTransportRows) {
            reject("Source storage rows require a live owner and a finite positive reservation.");
            return false;
          }
          if (!admit(rows + cost, limits.maximumTransportRows, "transport-row")) return false;
          rows += cost;
          retained += cost;
          return true;
        },
        release(): void {
          if (released) return;
          rows -= retained;
          retained = 0;
          released = true;
        },
      });
    },
    step: (): boolean => admit(++steps, limits.maximumSteps, "analysis-work"),
  });
}

export type SourceStorageBudget = ReturnType<typeof createSourceStorageBudget>;

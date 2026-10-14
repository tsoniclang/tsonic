import type { Node } from "@tsonic/tsts";
import type { SourceFlowLimits } from "./model.js";

export const defaultSourceFlowLimits: SourceFlowLimits = Object.freeze({
  maximumPoints: 262_144,
  maximumEdges: 1_048_576,
  maximumSteps: 4_194_304,
  maximumDepth: 256,
});

export class SourceFlowFailure extends Error {
  constructor(message: string, readonly source: Node | undefined) { super(message); }
}

export function sourceFlowLimits(limits: Partial<SourceFlowLimits>): SourceFlowLimits {
  const selected = { ...defaultSourceFlowLimits, ...limits };
  for (const [name, value] of Object.entries(selected)) {
    const maximum = defaultSourceFlowLimits[name as keyof SourceFlowLimits];
    if (!Number.isSafeInteger(value) || value <= 0 || maximum === undefined || value > maximum) {
      throw new SourceFlowFailure(`Source flow requires a positive finite ${name} no greater than its bounded default.`, undefined);
    }
  }
  return Object.freeze(selected);
}

export function createSourceFlowBudget(limits: SourceFlowLimits) {
  let steps = 0;
  return {
    step(source?: Node): void {
      steps += 1;
      if (steps > limits.maximumSteps) throw new SourceFlowFailure("Source flow exceeds its finite work budget.", source);
    },
    steps: (): number => steps,
  };
}

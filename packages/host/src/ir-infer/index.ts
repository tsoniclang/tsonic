import type {
  ParseConstraints, ParseContributions, ParseInferenceGroup, ParseSolution,
  PrintConstraints, PrintContributions, PrintInferenceGroup, PrintSolution, VerifyInference,
} from "./contract.js";
import { printDocument } from "./print.js";
import { readConstraints, readContributions, readGroup, readSolution } from "./parse.js";
import { verifyInput } from "./verify.js";

export const printConstraints: PrintConstraints = constraints => printDocument({ kind: "ConstraintSet", value: constraints });
export const parseConstraints: ParseConstraints = readConstraints;
export const printContributions: PrintContributions = contributions => {
  const fragments: string[] = [];
  for (const [index, contribution] of contributions.entries()) {
    if (contribution === undefined) throw new TypeError(`Missing inline value at $[${index}].`);
    fragments.push(printDocument({ kind: "AtomicContribution", value: contribution }, `$[${index}]`));
  }
  return fragments.join("\n");
};
export const parseContributions: ParseContributions = readContributions;
export const printInferenceGroup: PrintInferenceGroup = group => printDocument({ kind: "InferenceGroup", value: group });
export const parseInferenceGroup: ParseInferenceGroup = readGroup;
export const printSolution: PrintSolution = solution => printDocument({ kind: "Solution", value: solution });
export const parseSolution: ParseSolution = readSolution;
export const verifyInference: VerifyInference = verifyInput;

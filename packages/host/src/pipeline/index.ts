import { createAccount } from "../dataflow/index.js";
import type { AnalyzeHostProgram } from "./contract.js";
import { captureSourceBarrier } from "./source-barrier.js";
import { typeSourceBarrier } from "./typed-barrier.js";
import { analyzeTypedSource } from "./analysis-barrier.js";
import { publishHostProgram } from "./publication.js";

export const analyzeHostProgram: AnalyzeHostProgram = inputs => {
  const source = captureSourceBarrier(inputs);
  if (source.kind === "refused") return source;
  const typed = typeSourceBarrier(inputs, source.value);
  if (typed.kind === "refused") return typed;
  const account = createAccount(inputs.limits.dataflow);
  const analyzed = analyzeTypedSource(inputs, typed.value, account);
  if (analyzed.kind === "refused") return analyzed;
  return publishHostProgram(inputs, typed.value, analyzed.value, account);
};

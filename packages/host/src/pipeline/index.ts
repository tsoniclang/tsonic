import { createAccount } from "../dataflow/index.js";
import type { AnalyzeHostProgram, ImportPreparationOf, PrepareImports } from "./contract.js";
import { importPreparationOf as readPreparation, prepareSourceImports } from "../front/index.js";
import { captureSourceBarrier } from "./source-barrier.js";
import { typeSourceBarrier } from "./typed-barrier.js";
import { analyzeTypedSource } from "./analysis-barrier.js";
import { publishHostProgram } from "./publication.js";

export const prepareImports: PrepareImports = prepareSourceImports;
export const importPreparationOf: ImportPreparationOf = readPreparation;

export const analyzeHostProgram: AnalyzeHostProgram = inputs => {
  const source = captureSourceBarrier(inputs);
  if (source.kind === "refused") return source;
  const account = createAccount(inputs.limits.dataflow);
  const typed = typeSourceBarrier(inputs, source.value, account);
  if (typed.kind === "refused") return typed;
  const analyzed = analyzeTypedSource(inputs, typed.value, account);
  if (analyzed.kind === "refused") return analyzed;
  return publishHostProgram(inputs, typed.value, analyzed.value, account);
};

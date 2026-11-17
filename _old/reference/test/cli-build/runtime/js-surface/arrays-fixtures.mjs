import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, /tsts:TSTS_DIAGNOSTIC/);
  const sourceContractPatterns = {
    "<anonymous>": /'Array' only refers to a type, but is being used as a value here/u,
    isFinite: /Cannot find name 'Number'|'Number' only refers to a type|Property 'isFinite' does not exist/u,
    log: /Cannot find name 'console'|Property 'log' does not exist/u,
    toString: /Property 'toString' does not exist/u,
    trunc: /Cannot find name 'Math'|Property 'trunc' does not exist/u,
  };
  const pattern = sourceContractPatterns[memberName];
  assert.notEqual(pattern, undefined, `missing exact source-contract diagnostic expectation for ${memberName}`);
  assert.match(stderr, pattern);
}

function assertArrayPredicate(source, operation, predicate, arrayParameter, staticCall = false, resultSuffix = "") {
  const invocation = staticCall
    ? `Tsonic\\.CSharp\\.Js\\.Array\\.${operation}\\(values, `
    : `values\\.${operation}\\(`;
  const suffix = resultSuffix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  assert.match(source, new RegExp(`return ${invocation}\\(int value, int index, Tsonic\\.CSharp\\.Js\\.JSArray<int> ${arrayParameter}\\) => ${predicate.source}\\)${suffix};`, "u"));
}

export { assertExternalCallNotMapped, assertArrayPredicate };

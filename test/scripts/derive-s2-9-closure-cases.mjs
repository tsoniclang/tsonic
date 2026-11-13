// Derives the ir-program case files that carry the other values of the closure decision of amendment S2-9.
//
// Each derived case is an existing case with the closure decision of its arrow function replaced, in the input and in every
// image of the expected result. The expected result of the codec case six-syntax-ArrowFunctionTrue is the identity image of
// its input; the expected result of the instantiation case six-instantiate-syntax-ArrowFunctionTrue is its input body under
// the empty substitution, which preserves every decision. Every type the replacement names is one the arrow function's own
// payload names in the same image (its `type` for the callable, its `convertedType`, the string term of the case's table,
// for a captured local), so the replacement follows the publication of that image; no expected value is taken from a run
// of the compiler.
//
//   s2-9-closure-capture-value       the logical capture "captured-value"
//   s2-9-closure-creation-can-fail   execution: invocation, writesStorage false, failure "unwind"
//   s2-9-closure-deferred            the deferred arm: rule "closure" with its saved input (context of the arrow function's
//                                    occurrence, the callable evidence, and per captured local its identity, its
//                                    evidence and that its binding can be reassigned)
//   s2-9-instantiate-closure-deferred  the same deferred arm through instantiation
//
// Usage: node test/scripts/derive-s2-9-closure-cases.mjs   (from the repository root; rewrites the derived files)
import { readFileSync, writeFileSync } from "node:fs";

const directory = "test/host-cases/ir-program/function";
const evidence = (type, body, node, category) => ({ type, component: { kind: "body", value: { body, node } },
  category: { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null });
const deferredClosure = node => {
  const body = node.tsonic.captures[0].body;
  const type = node.tsonic.type;
  node.tsonic.closure = { kind: "deferred", deferred: { invocation: { rule: "closure", input: {
    context: { occurrence: { body, node: node.id }, origin: node.origin,
      bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
    callable: evidence(type, body, node.id, "callable"),
    captures: node.tsonic.captures.map(local => ({ local, value: evidence(node.tsonic.convertedType, body, node.id, "string"), reassignable: true })),
  } }, result: type } };
};
const codec = "six-syntax-ArrowFunctionTrue";
const derivations = [
  [codec, "s2-9-closure-capture-value", node => { node.tsonic.closure.decision.captures = node.tsonic.captures.map(() => "captured-value"); }],
  [codec, "s2-9-closure-creation-can-fail", node => { node.tsonic.closure.decision.execution = { kind: "invocation", writesStorage: false, failure: "unwind" }; }],
  [codec, "s2-9-closure-deferred", deferredClosure],
  ["six-instantiate-syntax-ArrowFunctionTrue", "s2-9-instantiate-closure-deferred", deferredClosure],
];

for (const [base, name, change] of derivations) {
  const descriptor = JSON.parse(readFileSync(`${directory}/${base}.case.json`, "utf8"));
  let total = 0;
  for (const part of ["input", "expected"]) {
    const document = JSON.parse(readFileSync(`${directory}/${base}.${part}.json`, "utf8"));
    let changed = 0;
    const pending = [document];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && value.kind === "ArrowFunction" && value.tsonic !== null && typeof value.tsonic === "object" &&
        Object.hasOwn(value.tsonic, "closure")) { change(value); changed += 1; }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (changed === 0) throw new Error(`${base}.${part}: no arrow function to change for ${name}`);
    total += changed;
    writeFileSync(`${directory}/${name}.${part}.json`, `${JSON.stringify(document)}\n`);
  }
  writeFileSync(`${directory}/${name}.case.json`, `${JSON.stringify({ ...descriptor, name,
    rule: `${descriptor.rule}; S2-9 value case derived from ${base}`,
    input: `${directory}/${name}.input.json`, expected: `${directory}/${name}.expected.json` })}\n`);
  console.log(`${name}: ${total} payloads changed`);
}

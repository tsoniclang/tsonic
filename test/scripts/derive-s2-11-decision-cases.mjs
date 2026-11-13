// Derives the ir-program case files that carry each value of the fields added by amendment S2-11.
//
// A derived case is an existing codec case with one field value replaced in every decision record of that kind, in the
// input and in both images of the expected result. The expected result of a codec case is the identity image of its
// input (the parsed module and the canonical program under the identity publication), so the same replacement on both
// sides states the same law for the new value; no expected value is taken from a run of the compiler.
//
//   base case                              record               derived values
//   six-conversion-absence                 conversion embedding  check: required/unwind, required/abort
//   six-construction-assignment-pattern    member decision       getter and setter null with location data for each
//                                                               check (none, required/unwind, required/abort) and each
//                                                               receiver (in-place, by-reference)
//   six-callee-no-activation-False         application decision  activation: at-creation, when-first-driven
//   six-closed-operation-boolean-operator0 selected operation    execution: invocation for writesStorage false/true and
//                                                               failure none/unwind/abort
//   six-narrowing-narrowed                 narrowed refinement   failure: abort
//
// Usage: node test/scripts/derive-s2-11-decision-cases.mjs   (from the repository root; rewrites the derived files)
import { readFileSync, writeFileSync } from "node:fs";

const directory = "test/host-cases/ir-program/function";
const checks = [["none", { kind: "none" }], ["required-unwind", { kind: "required", failure: "unwind" }], ["required-abort", { kind: "required", failure: "abort" }]];
const isMember = value => Object.hasOwn(value, "selectedDeclarations") && Object.hasOwn(value, "location") && Object.hasOwn(value, "origins");
const derivations = [
  ...checks.slice(1).map(([name, check]) => ["six-conversion-absence", `s2-11-conversion-check-${name}`,
    value => value.kind === "conversion" && Object.hasOwn(value, "check"), value => { value.check = check; }]),
  ...checks.flatMap(([name, check]) => ["in-place", "by-reference"].map(receiver => ["six-construction-assignment-pattern",
    `s2-11-member-data-${name}-${receiver}`, isMember,
    value => { value.getter = null; value.setter = null; value.location = { kind: "data", check, receiver }; }])),
  ...["at-creation", "when-first-driven"].map(activation => ["six-callee-no-activation-False", `s2-11-application-activation-${activation}`,
    value => Object.hasOwn(value, "implementationBindings") && Object.hasOwn(value, "activation"), value => { value.activation = activation; }]),
  ...[false, true].flatMap(writesStorage => ["none", "unwind", "abort"].map(failure => ["six-closed-operation-boolean-operator0",
    `s2-11-operation-invocation-${writesStorage ? "writes" : "no-write"}-${failure}`,
    value => value.kind === "selected" && Object.hasOwn(value, "execution"),
    value => { value.execution = { kind: "invocation", writesStorage, failure }; }])),
  ["six-narrowing-narrowed", "s2-11-narrowing-failure-abort", value => value.kind === "narrowed" && Object.hasOwn(value, "failure"),
    value => { value.failure = "abort"; }],
];

for (const [base, name, matches, change] of derivations) {
  const descriptor = JSON.parse(readFileSync(`${directory}/${base}.case.json`, "utf8"));
  let total = 0;
  for (const part of ["input", "expected"]) {
    const document = JSON.parse(readFileSync(`${directory}/${base}.${part}.json`, "utf8"));
    let changed = 0;
    const pending = [document];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && matches(value)) { change(value); changed += 1; }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (changed === 0) throw new Error(`${base}.${part}: no record to change for ${name}`);
    total += changed;
    writeFileSync(`${directory}/${name}.${part}.json`, `${JSON.stringify(document)}\n`);
  }
  writeFileSync(`${directory}/${name}.case.json`, `${JSON.stringify({ ...descriptor, name,
    rule: `${descriptor.rule}; S2-11 value case derived from ${base}`,
    input: `${directory}/${name}.input.json`, expected: `${directory}/${name}.expected.json` })}\n`);
  console.log(`${name}: ${total} records changed (from ${base})`);
}

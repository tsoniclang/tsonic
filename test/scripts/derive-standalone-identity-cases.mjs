// Derives the ir-program cases in which the conversion, library and core operation identities stand alone, as the
// operation of an expression that is not a conversion.
//
// After the conversion arms were separated, the bank holds these three identities only inside a `convert` or
// `backed-convert` arm. As standalone operator decisions they are still legal (a conversion operation selected for an
// operator; a library or core operation of a unary expression), and the general readers and rewriters must carry them.
//
// A derived case is the case that carries `discard` on a prefix unary expression (six-operation-discard, and its
// instantiation twin), with the operation identity replaced, image by image, by the identity that the donor case holds
// in its conversion arm at the same position. Base and donor are built on the same index, publication and bindings, which
// the script checks, so the identity's types and declarations mean the same in the base. No expected value is taken from a run of
// the compiler: the expected result of a codec case is the identity image of its input, and of an instantiation case its
// input body under the empty substitution.
//
// Usage: node test/scripts/derive-standalone-identity-cases.mjs   (from the repository root; rewrites the derived files)
import { readFileSync, writeFileSync } from "node:fs";

const directory = "test/host-cases/ir-program/function";
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const read = (name, part) => JSON.parse(readFileSync(`${directory}/${name}.${part}.json`, "utf8"));

// The operation decisions of a document, in traversal order: those on a prefix unary expression, or those in a conversion arm.
function decisions(document, where) {
  const found = [];
  const pending = [document];
  for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
    if (value === null || typeof value !== "object") continue;
    if (isRecord(value) && isRecord(value.tsonic)) {
      if (where === "prefix" && value.kind === "PrefixUnaryExpression" && value.tsonic.operation?.kind === "decided") found.push(value.tsonic.operation.decision.decision);
      if (where === "arm" && isRecord(value.tsonic.conversion) && (value.tsonic.conversion.kind === "convert" || value.tsonic.conversion.kind === "backed-convert"))
        found.push(value.tsonic.conversion.operation.decision);
    }
    const children = Object.values(value);
    for (let position = children.length - 1; position >= 0; position -= 1) pending.push(children[position]);
  }
  return found;
}

const derivations = [
  ["six-operation-discard", "six-conversion-absence", "standalone-operation-conversion"],
  ["six-operation-discard", "six-operation-library", "standalone-operation-library"],
  ["six-operation-discard", "six-operation-core", "standalone-operation-core"],
  ["six-instantiate-operation-discard", "six-instantiate-conversion-absence", "standalone-instantiate-operation-conversion"],
  ["six-instantiate-operation-discard", "six-instantiate-operation-library", "standalone-instantiate-operation-library"],
  ["six-instantiate-operation-discard", "six-instantiate-operation-core", "standalone-instantiate-operation-core"],
];
for (const [base, donor, name] of derivations) {
  const baseInput = read(base, "input");
  const donorInput = read(donor, "input");
  for (const shared of ["index", "publication", "bindings"])
    if (JSON.stringify(baseInput[shared]) !== JSON.stringify(donorInput[shared])) throw new Error(`${base} and ${donor} differ in ${shared}`);
  let total = 0;
  for (const part of ["input", "expected"]) {
    const document = read(base, part);
    const targets = decisions(document, "prefix");
    const sources = decisions(read(donor, part), "arm");
    if (targets.length === 0 || targets.length !== sources.length) throw new Error(`${name}.${part}: ${targets.length} operations in the base, ${sources.length} in the donor`);
    for (const [position, target] of targets.entries()) { target.operation = sources[position].operation; target.execution = sources[position].execution; }
    total += targets.length;
    writeFileSync(`${directory}/${name}.${part}.json`, `${JSON.stringify(document)}\n`);
  }
  const descriptor = JSON.parse(readFileSync(`${directory}/${base}.case.json`, "utf8"));
  writeFileSync(`${directory}/${name}.case.json`, `${JSON.stringify({ ...descriptor, name,
    rule: `${descriptor.rule}; a standalone ${donor.replace(/^six-(instantiate-)?/u, "")} identity, derived from ${base} and ${donor}`,
    input: `${directory}/${name}.input.json`, expected: `${directory}/${name}.expected.json` })}\n`);
  console.log(`${name}: ${total} operations replaced`);
}

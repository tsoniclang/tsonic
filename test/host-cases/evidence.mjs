import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeCaseEvidence(directory, actual, expected) {
  mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(resolve(directory, "mismatch-"));
  const paths = { actual: resolve(root, "actual.value"), expected: resolve(root, "expected.value") };
  writeFileSync(paths.actual, renderCaseValue(actual));
  writeFileSync(paths.expected, renderCaseValue(expected));
  return paths;
}

function renderCaseValue(root) {
  const output = [];
  const pending = [{ kind: "value", value: root }];
  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame.kind === "text") {
      output.push(frame.value);
      continue;
    }
    const value = frame.value;
    if (value === null) output.push("null");
    else if (typeof value === "string") output.push(JSON.stringify(value));
    else if (typeof value === "boolean") output.push(String(value));
    else if (typeof value === "number") output.push(Object.is(value, -0) ? "-0" : String(value));
    else if (typeof value === "bigint") output.push(String(value) + "n");
    else if (Array.isArray(value)) {
      output.push("[");
      pending.push({ kind: "text", value: "]" });
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ kind: "value", value: value[index] });
        if (index > 0) pending.push({ kind: "text", value: "," });
      }
    } else {
      output.push("{");
      pending.push({ kind: "text", value: "}" });
      const keys = Object.keys(value);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        pending.push({ kind: "value", value: value[key] });
        pending.push({ kind: "text", value: JSON.stringify(key) + ":" });
        if (index > 0) pending.push({ kind: "text", value: "," });
      }
    }
  }
  return output.join("") + "\n";
}

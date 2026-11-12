import type { TirBody } from "./contract.js";
import type { TirPrintValue, TirScalarValue } from "./text-layouts.js";
import { hostNumberText, indexTirNodes } from "./text-layouts.js";
import { createTirLayouts } from "./text-model.js";

type TirPrintWork = { readonly kind: "value"; readonly value: TirPrintValue } | { readonly kind: "text"; readonly text: string };

const scalarText = (type: string, value: TirScalarValue): string => {
  if (value === null) return "null";
  switch (typeof value) {
    case "string": return ["mod", "def", "body", "exp"].includes(type)
      ? `${type}:${JSON.stringify(value)}` : JSON.stringify(value);
    case "number": return ["n", "l", "t", "sig"].includes(type) ? `${type}:${hostNumberText(value)}` : hostNumberText(value);
    case "bigint": return `${value}n`;
    case "boolean": return String(value);
  }
};

const printValue = (initial: TirPrintValue): string => {
  const output: string[] = [];
  const pending: TirPrintWork[] = [{ kind: "value", value: initial }];
  for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
    if (work.kind === "text") { output.push(work.text); continue; }
    const value = work.value;
    switch (value.kind) {
      case "scalar": output.push(scalarText(value.type, value.value)); break;
      case "node": output.push(`n:${value.position}`); break;
      case "sequence": {
        pending.push({ kind: "text", text: "]" });
        output.push("[");
        for (const [position, child] of [...value.elements.entries()].reverse()) {
          pending.push({ kind: "value", value: child });
          if (position > 0) pending.push({ kind: "text", text: ", " });
        }
        break;
      }
      case "record": {
        pending.push({ kind: "text", text: ")" });
        output.push(`${value.label}(`);
        const fields = value.fields;
        for (let position = fields.length - 1, field = fields[position]; field !== undefined; field = fields[--position]) {
          pending.push({ kind: "value", value: field.value });
          const name = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(field.name) ? field.name : JSON.stringify(field.name);
          pending.push({ kind: "text", text: `${position === 0 ? "" : ", "}${name}=` });
        }
        break;
      }
    }
  }
  return output.join("");
};

export const printTypedBody = (body: TirBody): string => {
  const layouts = createTirLayouts();
  const arena = indexTirNodes(body, layouts);
  const output = [printValue(arena.body), "\n"];
  for (const node of arena.nodes) {
    output.push(`n:${node.position}=`, printValue(node.value), "\n");
  }
  return output.join("");
};

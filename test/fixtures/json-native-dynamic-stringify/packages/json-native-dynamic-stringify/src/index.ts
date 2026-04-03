import type { JsValue } from "@tsonic/core/types.js";

function writeJson(value: JsValue): void {
  console.log(JSON.stringify(value));
}

export function main(): void {
  writeJson({
    ok: true,
    nested: {
      answer: 42,
    },
    list: ["x", "y"],
  });
}

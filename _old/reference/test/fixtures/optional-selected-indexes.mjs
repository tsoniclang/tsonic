export const optionalSelectedIndexSource = `
import { jsstr } from "@tsonic/js/lang.js";
import type { JsString } from "@tsonic/js/types.js";

export function run(): boolean {
  const exact: JsString = jsstr("ab");
  const matched = /a(b)/.exec(exact);
  const missing = /z/.exec(exact);
  const first = matched?.[0];
  const capture = matched?.[1];
  const absent = missing?.[0];
  const native = /a(b)/.exec("ab");
  return (first ?? exact).toWellFormed() === "ab" &&
    (capture ?? exact).toWellFormed() === "b" &&
    (absent ?? exact).toWellFormed() === "ab" &&
    (native?.[0] ?? "fallback") === "ab";
}
export function main(): void { if (!run()) throw new Error("optional selected index"); }
`;

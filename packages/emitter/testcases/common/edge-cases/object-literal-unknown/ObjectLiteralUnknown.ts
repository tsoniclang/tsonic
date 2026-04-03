import type { JsValue } from "@tsonic/core/types.js";

export function takesUnknown(x: JsValue): JsValue {
  return x;
}

export function passPlainObjectLiteral(): JsValue {
  return takesUnknown({ ok: true, n: 1, s: "x" });
}

export function passNestedObjectLiteral(): JsValue {
  return takesUnknown({ a: { b: true } });
}

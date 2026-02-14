export function takesUnknown(x: unknown): unknown {
  return x;
}

export function passPlainObjectLiteral(): unknown {
  return takesUnknown({ ok: true, n: 1, s: "x" });
}

export function passNestedObjectLiteral(): unknown {
  return takesUnknown({ a: { b: true } });
}

import { decodeDefId, encodeDefId } from "../../../packages/host/dist/ids/index.js";

export function typeParameterDeclaration(owner, ordinal) {
  const decoded = decodeDefId(owner);
  if (decoded.kind !== "decoded") throw new TypeError("An authored parameter fixture retains its actual qualified definition owner");
  return encodeDefId({ module: decoded.value.module, segments: [...decoded.value.segments, { name: `T${ordinal}`, ordinal: 0 }] });
}

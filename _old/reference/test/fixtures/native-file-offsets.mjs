export const nativeFileOffsetDeclarations = `
import type { createReadStream } from "node:fs";
type StreamOptions = Extract<NonNullable<Parameters<typeof createReadStream>[1]>, object>;
type OptionalOffset = StreamOptions["start"];
type Offset = NonNullable<OptionalOffset>;
type AliasedOffset = NonNullable<Offset>;
`;

export const nativeFileOffsetsSource = `${nativeFileOffsetDeclarations}
export function exact(value: Offset): Offset { return value; }
export function alias(value: AliasedOffset): AliasedOffset { return value; }
export function present(value: OptionalOffset): Offset { return value ?? 0; }
export function decimalQuotient(value: Offset): Offset {
  const remainder = value % 10;
  return (value - remainder) / 10;
}
`;

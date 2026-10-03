export const borrowedNullishSequencesSource = `
import type { IncomingMessage } from "node:http";
type NativeHeaders = IncomingMessage["headersDistinct"];
type NativeValues = NonNullable<NativeHeaders[string]>;

export function choose(authored: string[] | null | undefined,
  native: NativeValues | null | undefined): string[] {
  return [...(authored ?? native ?? [])];
}

export function chooseFromHeaders(authored: string[] | null | undefined,
  headers: NativeHeaders, key: string): string[] {
  return [...(authored ?? headers[key] ?? [])];
}

export function snapshot(values: readonly string[]): string[] {
  return [...values];
}
`;

export const incompatibleBorrowedSequenceSource = `
import type { IncomingMessage } from "node:http";
type NativeValues = NonNullable<IncomingMessage["headersDistinct"][string]>;
export function invalid(values: number[], native: NativeValues): string[] {
  return [...(values ?? native)];
}
`;

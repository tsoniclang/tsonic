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

export function firstFromHeaders(headers: NativeHeaders, key: string): string | undefined {
  return headers[key]?.[0];
}

export function snapshotFromHeaders(headers: NativeHeaders, key: string): string[] {
  const values = headers[key];
  return values === undefined ? [] : [...values];
}

export function joinFromHeaders(headers: NativeHeaders, key: string): string {
  const values = headers[key];
  if (values === undefined) return "";
  let result = "";
  for (const value of values) result += value;
  return result;
}

export function chooseLazy(authored: string[] | null | undefined,
  native: NativeValues | null | undefined, fallback: () => string[]): string[] {
  return ["before", ...(authored ?? native ?? fallback()), "after"];
}
`;

export const incompatibleBorrowedSequenceSource = `
import type { IncomingMessage } from "node:http";
type NativeValues = NonNullable<IncomingMessage["headersDistinct"][string]>;
export function invalid(values: number[], native: NativeValues): string[] {
  return [...(values ?? native)];
}
`;

export const mutableBorrowedHeaderSource = `
import type { IncomingMessage } from "node:http";
export function invalid(request: IncomingMessage): void {
  const values = request.headersDistinct["x-item"];
  if (values !== undefined) values[0] = "mutated";
}
`;

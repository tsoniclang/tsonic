import type { byte, bool } from "../../scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../compat.js";
import type { Reader, Writer } from "../../io.js";
import type { Decoder, Encoder, Option } from "./json/jsontext.js";
import { NewDecoder, NewEncoder, writeTo } from "./json/jsontext.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface Options extends Option {
  readonly __jsonOptions?: never;
}

export const JsonFieldNames: unique symbol = Symbol("tsts.jsonFieldNames");

export interface JsonFieldSpec {
  readonly name: string;
  readonly omitZero?: bool;
}

export type JsonFieldName = string | JsonFieldSpec;

export type JsonFieldNameMap = Record<string, JsonFieldName>;

export interface MarshalerTo {
  MarshalJSONTo(encoder: Encoder): GoError;
}

export interface UnmarshalerFrom {
  UnmarshalJSONFrom(decoder: Decoder): GoError;
}

export function Deterministic(value: bool): Options {
  return { name: "Deterministic", value };
}

export function Marshal(value: unknown, ...opts: Array<Options>): [GoSlice<byte>, GoError] {
  try {
    return [Array.from(textEncoder.encode(stringify(value, opts))), undefined];
  } catch (error) {
    return [[], toError(error)];
  }
}

export function MarshalEncode(encoder: GoPtr<Encoder>, value: unknown, ...opts: Array<Options>): GoError {
  if (encoder === undefined) {
    return new Error("nil json encoder");
  }
  if (isMarshalerTo(value)) {
    return value.MarshalJSONTo(encoder);
  }
  return encoder.WriteValue(JSON.parse(stringify(value, opts)));
}

export function MarshalWrite(writer: Writer, value: unknown, ...opts: Array<Options>): GoError {
  const [bytes, err] = Marshal(value, ...opts);
  if (err !== undefined) {
    return err;
  }
  return writeTo(writer, bytes);
}

export function Unmarshal(data: GoSlice<byte>, out: unknown, ...opts: Array<Options>): GoError {
  void opts;
  try {
    assignDecoded(out, JSON.parse(textDecoder.decode(Uint8Array.from(data as Array<number>))));
    return undefined;
  } catch (error) {
    return toError(error);
  }
}

export function UnmarshalDecode(decoder: GoPtr<Decoder>, out: unknown, ...opts: Array<Options>): GoError {
  void opts;
  if (decoder === undefined) {
    return new Error("nil json decoder");
  }
  if (isUnmarshalerFrom(out)) {
    return out.UnmarshalJSONFrom(decoder);
  }
  const [value, err] = decoder.ReadValue();
  if (err !== undefined) {
    return err;
  }
  assignDecoded(out, value);
  return undefined;
}

export function UnmarshalRead(reader: Reader, out: unknown, ...opts: Array<Options>): GoError {
  return UnmarshalDecode(NewDecoder(reader), out, ...opts);
}

const stringify = (value: unknown, opts: Array<Options>): string => {
  const indent = opts.find((option) => option.name === "WithIndent")?.value;
  return JSON.stringify(value, (_key, current) => normalizeForJson(current), typeof indent === "string" ? indent : undefined);
}

const normalizeForJson = (value: unknown): unknown => {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  const fieldNames = getJsonFieldNames(value);
  if (fieldNames !== undefined) {
    const normalized: Record<string, unknown> = {};
    for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
      if (typeof current === "function") {
        continue;
      }
      const field = fieldNames[key];
      const name = typeof field === "string" ? field : field?.name ?? key;
      if (typeof field === "object" && field.omitZero === true && isZeroJsonValue(current)) {
        continue;
      }
      normalized[name] = current;
    }
    return normalized;
  }
  return value;
}

const assignDecoded = (out: unknown, value: unknown): void => {
  if (out === undefined || out === null) {
    return;
  }
  if (Array.isArray(out) && Array.isArray(value)) {
    out.splice(0, out.length, ...value);
    return;
  }
  if (typeof out === "object" && typeof value === "object" && value !== null) {
    Object.assign(out, decodeFieldNames(out, value as Record<string, unknown>));
  }
}

const decodeFieldNames = (out: object, value: Record<string, unknown>): Record<string, unknown> => {
  const fieldNames = getJsonFieldNames(out);
  if (fieldNames === undefined) {
    return value;
  }
  const reverse = new Map<string, string>();
  for (const [key, field] of Object.entries(fieldNames)) {
    reverse.set(typeof field === "string" ? field : field.name, key);
  }
  const decoded: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value)) {
    decoded[reverse.get(key) ?? key] = current;
  }
  return decoded;
}

const getJsonFieldNames = (value: unknown): JsonFieldNameMap | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return (value as { [JsonFieldNames]?: JsonFieldNameMap })[JsonFieldNames];
}

const isZeroJsonValue = (value: unknown): bool => {
  return value === undefined || value === null || value === false || value === 0 || value === "" || (Array.isArray(value) && value.length === 0);
}

const isMarshalerTo = (value: unknown): value is MarshalerTo => {
  return typeof value === "object" && value !== null && "MarshalJSONTo" in value && typeof (value as { MarshalJSONTo: unknown }).MarshalJSONTo === "function";
}

const isUnmarshalerFrom = (value: unknown): value is UnmarshalerFrom => {
  return typeof value === "object" && value !== null && "UnmarshalJSONFrom" in value && typeof (value as { UnmarshalJSONFrom: unknown }).UnmarshalJSONFrom === "function";
}

const toError = (error: unknown): Error => {
  return error instanceof Error ? error : new Error(String(error));
}

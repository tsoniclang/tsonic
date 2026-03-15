import type { EmitterContext } from "./types.js";
import { escapeCSharpIdentifier } from "./emitter-types/index.js";

export type NamingPolicyBucket =
  | "namespaces"
  | "classes"
  | "methods"
  | "properties"
  | "fields"
  | "enumMembers";

const WELL_KNOWN_SYMBOL_PREFIX = "[symbol:";

const isSimpleCSharpIdentifier = (name: string): boolean =>
  /^[_\p{L}][_\p{L}\p{Nd}]*$/u.test(name);

const encodeForGeneratedIdentifier = (name: string): string =>
  Array.from(name)
    .map((ch) => {
      if (/[_\p{L}\p{Nd}]/u.test(ch)) {
        return ch;
      }
      return `_x${ch.codePointAt(0)?.toString(16).toUpperCase()}_`;
    })
    .join("");

export const getCSharpName = (
  name: string,
  _bucket: NamingPolicyBucket,
  _context: EmitterContext
): string => {
  if (name.startsWith("#")) {
    return `__private_${name.slice(1)}`;
  }
  if (name.startsWith(WELL_KNOWN_SYMBOL_PREFIX) && name.endsWith("]")) {
    return `__tsonic_symbol_${name.slice(
      WELL_KNOWN_SYMBOL_PREFIX.length,
      -1
    )}`;
  }
  if (!isSimpleCSharpIdentifier(name)) {
    return `__tsonic_computed_${encodeForGeneratedIdentifier(name)}`;
  }
  return name;
};

export const emitCSharpName = (
  name: string,
  bucket: NamingPolicyBucket,
  context: EmitterContext
): string => {
  return escapeCSharpIdentifier(getCSharpName(name, bucket, context));
};

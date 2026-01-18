import type { EmitterContext } from "./types.js";
import { escapeCSharpIdentifier } from "./emitter-types/index.js";

export type NamingPolicyBucket =
  | "namespaces"
  | "classes"
  | "methods"
  | "properties"
  | "fields"
  | "enumMembers";

export const getCSharpName = (
  name: string,
  _bucket: NamingPolicyBucket,
  _context: EmitterContext
): string => {
  return name;
};

export const emitCSharpName = (
  name: string,
  bucket: NamingPolicyBucket,
  context: EmitterContext
): string => {
  return escapeCSharpIdentifier(getCSharpName(name, bucket, context));
};

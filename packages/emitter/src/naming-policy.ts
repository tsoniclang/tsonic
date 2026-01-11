import {
  applyNamingPolicy,
  resolveNamingPolicy,
  type NamingPolicyBucket,
} from "@tsonic/frontend";
import type { EmitterContext } from "./types.js";
import { escapeCSharpIdentifier } from "./emitter-types/index.js";

export const getCSharpName = (
  name: string,
  bucket: NamingPolicyBucket,
  context: EmitterContext
): string => {
  const policy = resolveNamingPolicy(context.options.namingPolicy, bucket);
  return applyNamingPolicy(name, policy);
};

export const emitCSharpName = (
  name: string,
  bucket: NamingPolicyBucket,
  context: EmitterContext
): string => {
  return escapeCSharpIdentifier(getCSharpName(name, bucket, context));
};


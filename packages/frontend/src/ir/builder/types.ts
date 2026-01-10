/**
 * IR Builder types
 */

import type { NamingPolicyConfig } from "../../resolver/naming-policy.js";

export type IrBuildOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly namingPolicy?: NamingPolicyConfig;
};

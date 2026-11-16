import { encodeKey } from "../ids/index.js";
import type { EscapeTargetKey } from "./contract.js";
import { admitEscapeIdentity } from "./verification.js";
import { escapeData } from "./verify-relations.js";

export const escapeTargetKey: EscapeTargetKey = (target, account) => {
  const stop = admitEscapeIdentity(target, account);
  if (stop !== null) return stop;
  return { kind: "complete", value: encodeKey(escapeData(target)) };
};

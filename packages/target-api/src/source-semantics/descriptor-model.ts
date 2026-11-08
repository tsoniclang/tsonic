import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin } from "../public/source/contracts.js";
import { sourceNumericKeyValueKey } from "../source-model/literals/key.js";

export function sourceMemberOriginKey(value: SourceMemberOrigin, nodeKey: (node: Node) => number): readonly unknown[] {
  if (value.kind === "declared") return [value.kind, nodeKey(value.declaration)];
  if (value.kind === "class-prototype") return [value.kind, nodeKey(value.owner)];
  const key = value.key;
  return [value.kind, nodeKey(value.owner), key.kind,
    key.kind === "unique-symbol" ? nodeKey(key.declaration) : key.kind === "number" ? sourceNumericKeyValueKey(key.value) : key.value];
}

export function freezeSourceMemberOrigin(value: SourceMemberOrigin): SourceMemberOrigin {
  if (value.kind !== "mapped") return Object.freeze({ ...value });
  const key = value.key;
  if (key.kind !== "number") return Object.freeze({ ...value, key: Object.freeze({ ...key }) });
  const numeric = key.value.kind === "authored"
    ? Object.freeze({ kind: "authored" as const, token: Object.freeze({ ...key.value.token }) }) : Object.freeze({ ...key.value });
  return Object.freeze({ ...value, key: Object.freeze({ kind: "number", value: numeric }) });
}

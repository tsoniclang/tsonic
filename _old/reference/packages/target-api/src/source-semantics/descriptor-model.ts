import type { Node } from "@tsonic/tsts";
import type { SourceMemberKey, SourceMemberOrigin } from "../public/source/contracts.js";
import { sourceNumericKeyValueKey } from "../source-model/literals/key.js";

export function sourceMemberOriginKey(value: SourceMemberOrigin, nodeKey: (node: Node) => number): readonly unknown[] {
  if (value.kind === "declared") return [value.kind, nodeKey(value.declaration)];
  if (value.kind === "class-prototype") return [value.kind, nodeKey(value.owner)];
  return [value.kind, nodeKey(value.owner), ...sourceMemberKeyIdentity(value.key, nodeKey)];
}

export function sourceMemberKeyIdentity(key: SourceMemberKey, nodeKey: (node: Node) => number): readonly unknown[] {
  return [key.kind, key.kind === "unique-symbol" ? nodeKey(key.declaration)
    : key.kind === "number" ? sourceNumericKeyValueKey(key.value) : key.value];
}

export function freezeSourceMemberKey(key: SourceMemberKey): SourceMemberKey {
  if (key.kind !== "number") return Object.freeze({ ...key });
  const numeric = key.value.kind === "authored"
    ? Object.freeze({ kind: "authored" as const, token: Object.freeze({ ...key.value.token }) }) : Object.freeze({ ...key.value });
  return Object.freeze({ kind: "number", value: numeric });
}

export function freezeSourceMemberOrigin(value: SourceMemberOrigin): SourceMemberOrigin {
  return value.kind !== "mapped" ? Object.freeze({ ...value }) : Object.freeze({ ...value, key: freezeSourceMemberKey(value.key) });
}

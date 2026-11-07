// Member origin identity (pure descriptor algebra). The checker-reading member-origin selection is host-input/member-origins.ts.
import type { SourceMemberKey, SourceTypeDescriptorMember } from "./types.js";

type Origin = SourceTypeDescriptorMember["origin"];

export function sourceTypeDescriptorMemberOriginsEqual(left: Origin, right: Origin): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "declared": return right.kind === "declared" && left.declaration === right.declaration;
    case "class-prototype": return right.kind === "class-prototype" && left.owner === right.owner;
    case "mapped": return right.kind === "mapped" && left.owner === right.owner && sourceTypeDescriptorMemberKeysEqual(left.key, right.key);
  }
}

export function sourceTypeDescriptorMemberKeysEqual(left: SourceMemberKey, right: SourceMemberKey): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "string": return right.kind === "string" && left.value === right.value;
    case "number": return right.kind === "number" && Object.is(left.value, right.value);
    case "unique-symbol": return right.kind === "unique-symbol" && left.declaration === right.declaration;
  }
}

export function freezeSourceTypeDescriptorMemberOrigin(origin: Origin): Origin {
  return origin.kind === "mapped" ? Object.freeze({ ...origin, key: Object.freeze({ ...origin.key }) })
    : Object.freeze({ ...origin });
}

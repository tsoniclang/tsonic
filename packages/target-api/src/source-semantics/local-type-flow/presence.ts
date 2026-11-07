import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceHostCall } from "../../host-input/queries.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorUnion, type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceTypeDescriptor } from "./types.js";

// Read absence in the Host value model. The only checker input is the presence witness (host-input `presence`, one
// absence classifier with void counted as absence, A11); the absence arm itself is always the Host's.

/**
 * The result descriptor of an optional-chain call (`a?.f()`, `a?.b.f()`): it carries absence when the chain can
 * short-circuit, i.e. when the presence witness at the call says the value read there can be absent. A result whose
 * descriptor already carries absence is unchanged.
 */
export function sourceTypeFlowOptionalChainCallResult(unions: SourceTypeDescriptorUnions, input: SourceHostInput,
  call: SourceHostCall, type: SourceTypeDescriptor): SourceTypeDescriptor {
  if (!call.optionalChain || sourceTypeDescriptorStructure(type).kind === "optional") return type;
  if (input.presence(call.call) !== "possibly-absent") return type;
  return sourceTypeDescriptorUnion(unions, [type, { kind: "intrinsic", intrinsic: "absence" }])!;
}

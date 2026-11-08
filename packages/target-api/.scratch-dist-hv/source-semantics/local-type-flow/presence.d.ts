import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceHostCall } from "../../host-input/queries.js";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceTypeDescriptor } from "./types.js";
/**
 * The result descriptor of an optional-chain call (`a?.f()`, `a?.b.f()`): it carries absence when the chain can
 * short-circuit, i.e. when the presence witness at the call says the value read there can be absent. A result whose
 * descriptor already carries absence is unchanged.
 */
export declare function sourceTypeFlowOptionalChainCallResult(unions: SourceTypeDescriptorUnions, input: SourceHostInput, call: SourceHostCall, type: SourceTypeDescriptor): SourceTypeDescriptor;
//# sourceMappingURL=presence.d.ts.map
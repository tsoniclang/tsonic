import type { Node } from "@tsonic/tsts";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceHostAliasApplication, SourceHostQueries, SourceHostType } from "../../host-input/queries.js";
import type { SourceTypeDescriptor, SourceTypeFlowSource } from "./types.js";
type Bindings = ReadonlyMap<Node, SourceTypeDescriptor>;
export declare function sourceTypeDescriptorConditionalDefinition(source: SourceTypeFlowSource, unions: SourceTypeDescriptorUnions, queries: SourceHostQueries, application: SourceHostAliasApplication, bindings: Bindings, read: (node: Node, bindings: Bindings, checked: ReadonlyMap<Node, SourceHostType>) => SourceTypeDescriptor | undefined): SourceTypeDescriptor | undefined;
export {};
//# sourceMappingURL=conditional-descriptors.d.ts.map
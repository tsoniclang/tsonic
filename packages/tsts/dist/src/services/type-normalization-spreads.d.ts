import type { Checker } from "../internal/checker/checker/state.js";
import type { LiteralCreationInput } from "../internal/checker/checker/literal-creation.js";
import type { LiteralCreatorInput } from "../internal/checker/checker/literal-creation.js";
import type { Node } from "../internal/ast/spine.js";
import type { Type } from "../internal/checker/types.js";
type Event = LiteralCreatorInput;
interface Produced {
    readonly type: Type;
    readonly event: Event;
}
type EventIndex = Map<Node, Map<Node | null, Map<string, Type>>>;
export interface LiteralGraph {
    readonly values: ReadonlySet<Type>;
    readonly events: readonly Produced[];
    readonly index: EventIndex;
}
export declare function reacquireLiteralGraph(producer: Checker, type: Type, normalize: (type: Type) => Type, remember: (original: Type, selected: Type) => void, admitted: Map<Type, LiteralCreationInput | null>, graphs: Map<Type, LiteralGraph | undefined>): Type | undefined;
export {};
//# sourceMappingURL=type-normalization-spreads.d.ts.map
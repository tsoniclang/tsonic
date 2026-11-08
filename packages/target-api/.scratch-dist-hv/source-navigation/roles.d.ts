import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceRoleModel } from "../public/source/roles.js";
import type { SourceProgramNavigation } from "./types.js";
/** Host-internal inputs of the role model. */
export interface SourceRoleModelInput {
    readonly ast: AstReader;
    readonly navigation: SourceProgramNavigation;
    /**
     * The declaration the Host value type at `node` names: `facts.values.type(node)` is a declared descriptor, or a union
     * whose only non-absent arm is one. Undefined otherwise. From the Host value model, never a checked type (R3).
     */
    valueTypeDeclaration(node: Node): Node | undefined;
    /** Constant truth value of a condition expression when the Source fixes it (literal facts), else undefined. */
    conditionValue(expression: Node): boolean | undefined;
    /**
     * Whether the Host value type at `node` is definitely primitive (coercing it runs no user code): from
     * `facts.values.type(node)`, never a checked type or an annotation classifier (R1, R3; R2 #15). The expression
     * effects (`expressions.effects`) take operand primitiveness only from here.
     */
    valueIsPrimitive(node: Node): boolean;
}
export declare function createSourceRoleModel(input: SourceRoleModelInput): SourceRoleModel;
//# sourceMappingURL=roles.d.ts.map
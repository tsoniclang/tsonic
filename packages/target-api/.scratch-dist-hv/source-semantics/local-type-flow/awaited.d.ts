import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceAwaitedArms } from "../../public/source/facts.js";
import { type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import type { SourceClosedSum, SourceTypeDescriptor } from "./types.js";
/** The payload binder position of a thenable class or interface declaration; undefined when it is not thenable. */
export declare function sourceThenablePayloadBinder(ast: AstReader, declaration: Node): number | undefined;
/**
 * The authored payload type argument of an async callable's return annotation (`Promise<T>` -> `T`, through
 * parentheses, parameterless aliases and nested thenables, as `await` unwraps): the type-argument node at the
 * thenable declaration's payload binder (sourceThenablePayloadBinder). Declaration and authored-syntax input only (R3).
 * undefined: the annotation is not a thenable reference (e.g. a union), or the reference names no declaration.
 */
export declare function sourceTypeFlowAuthoredAwaitedArgument(ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">, annotation: Node): Node | undefined;
/**
 * The awaited payload of a value whose Host descriptor is `described`: a thenable arm contributes its payload binder's
 * argument, a non-thenable arm is its own payload, absence stays absence. undefined: an arm is a structural thenable
 * (a shape with a `then` member), whose payload has no declaration rule.
 */
export declare function sourceTypeDescriptorAwaitedPayload(ast: AstReader, unions: SourceTypeDescriptorUnions, described: SourceTypeDescriptor): SourceTypeDescriptor | undefined;
/**
 * The awaited-arm relation (public SourceAwaitedArms) of an awaited value whose operand Host descriptor is `operand` and
 * whose awaited Host result is `awaited`: for each present operand arm, its awaited payload (the declaration rule above)
 * and the awaited-sum arm each payload arm resolves to, by descriptor identity (absence resolves to the absence arm).
 * undefined when the awaited result is not a closed sum, or a payload has no declaration rule (a structural thenable,
 * which `values.awaited` refuses).
 */
export declare function sourceTypeFlowAwaitedArms(ast: AstReader, unions: SourceTypeDescriptorUnions, sumOf: (type: SourceTypeDescriptor) => SourceClosedSum | undefined, use: Node, operand: SourceTypeDescriptor, awaited: SourceTypeDescriptor): SourceAwaitedArms | undefined;
//# sourceMappingURL=awaited.d.ts.map
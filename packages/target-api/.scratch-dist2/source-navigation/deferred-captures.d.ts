import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
/**
 * Whether a binding with a callable initializer, such as `const visit = () => { visit(); }`, is captured by a
 * function value created before its declaration completes.
 */
export declare function sourceBindingCapturedBeforeInitialization(declaration: Node, ast: AstReader, navigation: Pick<SourceProgramNavigation, "declarationUses">): boolean;
/**
 * Whether a binding declared without an initializer, such as `let value: number; const read = () => value; value = 9;`,
 * is captured by a function value created before its first direct write in its own scope completes. A binding with
 * no such write is never initialized, so any capture reads it before initialization.
 */
export declare function sourceBindingCapturedBeforeFirstWrite(declaration: Node, ast: AstReader, navigation: Pick<SourceProgramNavigation, "declarationUses">): boolean;
//# sourceMappingURL=deferred-captures.d.ts.map
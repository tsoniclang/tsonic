import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "./literal-values-model.js";
import type { SourceTypeDescriptor } from "./descriptor-model.js";
export type SourceTypeDescriptorTypeofCategory = "number" | "bigint" | "string" | "boolean" | "symbol" | "function" | "object";
/**
 * The category, or undefined when the descriptor proves none (`object`, `any`, `unknown`, a type parameter, a reference
 * without a definition, a union of different categories). `literal` reads an enum member initializer's Host constant.
 */
export declare function sourceTypeDescriptorTypeofCategory(ast: Pick<AstReader, "is" | "as" | "members">, type: SourceTypeDescriptor, literal: (node: Node) => SourceLiteralValue | undefined): SourceTypeDescriptorTypeofCategory | undefined;
//# sourceMappingURL=descriptor-categories.d.ts.map
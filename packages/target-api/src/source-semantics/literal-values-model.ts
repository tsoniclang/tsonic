import type { Node } from "@tsonic/tsts";

export type SourceLiteralForm = SourceLiteralValue["form"];

interface SourceLiteralNumbers {
  readonly number?: number;
  readonly integer?: bigint;
  readonly integerConstant?: bigint;
}

export interface SourceTextLiteralValue extends SourceLiteralNumbers {
  readonly form: "string" | "template";
  readonly text: string;
  readonly elements?: undefined;
}

export interface SourceArrayLiteralValue extends SourceLiteralNumbers {
  readonly form: "array";
  readonly elements: readonly (SourceLiteralValue | undefined)[];
  readonly text?: undefined;
}

export interface SourceScalarLiteralValue extends SourceLiteralNumbers {
  readonly form: "true" | "false" | "numeric" | "bigint" | "prefix-unary" | "parenthesized" | "binary";
  readonly text?: undefined;
  readonly elements?: undefined;
}

export type SourceLiteralValue =
  | SourceTextLiteralValue
  | SourceArrayLiteralValue
  | SourceScalarLiteralValue;

export interface SourceLiteralIndex {
  readonly literalValue: { readonly get: (node: Node) => SourceLiteralValue | undefined };
}

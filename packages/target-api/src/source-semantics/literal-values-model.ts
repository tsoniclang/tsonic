import type { Node } from "@tsonic/tsts";

export type SourceLiteralForm = SourceLiteralValue["form"];

interface SourceLiteralNumbers {
  readonly number?: number;
  readonly integer?: bigint;
  readonly integerConstant?: bigint;
}

export interface SourceNumericLiteralToken {
  readonly coefficient: bigint;
  readonly exponent: bigint;
  readonly negative: boolean;
  readonly decimalText: string;
}

export type SourceNumericLiteralEvidence =
  | { readonly kind: "authored"; readonly token: SourceNumericLiteralToken }
  | { readonly kind: "checked-float64"; readonly value: number };

export interface SourceTextLiteralValue extends SourceLiteralNumbers {
  readonly form: "string" | "template";
  readonly text: string;
  readonly elements?: undefined;
  readonly numeric?: undefined;
}

export interface SourceArrayLiteralValue extends SourceLiteralNumbers {
  readonly form: "array";
  readonly elements: readonly (SourceLiteralValue | undefined)[];
  readonly text?: undefined;
  readonly numeric?: undefined;
}

export interface SourceNumericLiteralValue extends SourceLiteralNumbers {
  readonly form: "numeric";
  readonly numeric: SourceNumericLiteralEvidence;
  readonly text?: undefined;
  readonly elements?: undefined;
}

export interface SourceScalarLiteralValue extends SourceLiteralNumbers {
  readonly form: "true" | "false" | "bigint" | "prefix-unary" | "parenthesized" | "binary";
  readonly text?: undefined;
  readonly elements?: undefined;
  readonly numeric?: SourceNumericLiteralEvidence;
}

export type SourceLiteralValue =
  | SourceTextLiteralValue
  | SourceArrayLiteralValue
  | SourceNumericLiteralValue
  | SourceScalarLiteralValue;

export interface SourceLiteralIndex {
  readonly literalValue: { readonly get: (node: Node) => SourceLiteralValue | undefined };
}

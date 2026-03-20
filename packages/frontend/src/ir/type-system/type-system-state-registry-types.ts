import type { Diagnostic } from "../../types/diagnostic.js";
import type { IrType } from "../types/index.js";
import { unknownType } from "./types.js";
import type { ResolvedCall } from "./type-system-state-call-types.js";

export const BUILTIN_NOMINALS: Readonly<Record<string, string>> = {
  string: "String",
  number: "Number",
  boolean: "Boolean",
  bigint: "BigInt",
  symbol: "Symbol",
};

export const poisonedCall = (
  arity: number,
  diagnostics: readonly Diagnostic[]
): ResolvedCall => ({
  surfaceParameterTypes: Array(arity).fill(unknownType),
  parameterTypes: Array(arity).fill(unknownType),
  parameterModes: Array(arity).fill("value" as const),
  returnType: unknownType,
  hasDeclaredReturnType: false,
  diagnostics,
});

export type NominalLookupResult = {
  readonly targetNominal: string;
  readonly memberType: IrType;
  readonly substitution: ReadonlyMap<string, IrType>;
};

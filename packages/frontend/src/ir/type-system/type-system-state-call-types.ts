import type { Diagnostic } from "../../types/diagnostic.js";
import type { IrType } from "../types/index.js";
import type { MemberId, ParameterMode, SignatureId } from "./types.js";

export type MemberRef =
  | { readonly kind: "byId"; readonly id: MemberId }
  | { readonly kind: "byName"; readonly name: string };

export type Site = {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly node?: unknown;
};

export type CallQuery = {
  readonly sigId: SignatureId;
  readonly argumentCount: number;
  readonly receiverType?: IrType;
  readonly declaringClrType?: string;
  readonly explicitTypeArgs?: readonly IrType[];
  readonly argTypes?: readonly (IrType | undefined)[];
  readonly expectedReturnType?: IrType;
  readonly site?: Site;
};

export type TypePredicateResult =
  | {
      readonly kind: "param";
      readonly parameterIndex: number;
      readonly targetType: IrType;
    }
  | {
      readonly kind: "this";
      readonly targetType: IrType;
    };

export type ResolvedCall = {
  readonly thisParameterType?: IrType;
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly surfaceParameterTypes: readonly (IrType | undefined)[];
  readonly restParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  readonly surfaceRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  readonly parameterModes: readonly ParameterMode[];
  readonly returnType: IrType;
  readonly hasDeclaredReturnType: boolean;
  readonly typePredicate?: TypePredicateResult;
  readonly selectionMeta?: {
    readonly hasRestParameter: boolean;
    readonly typeParamCount: number;
    readonly parameterCount: number;
    readonly stableId: string;
  };
  readonly diagnostics: readonly Diagnostic[];
};

export type TypeSubstitutionMap = ReadonlyMap<string, IrType>;

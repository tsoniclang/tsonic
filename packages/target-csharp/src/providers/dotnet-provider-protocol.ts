export type DotnetProviderOperation =
  | "indexAssembly"
  | "resolveModule"
  | "resolveType"
  | "resolveCall"
  | "satisfiesConstraint"
  | "getParameterMode"
  | "getRuntimeCarrier";

export interface DotnetProviderRequest {
  readonly id: string;
  readonly operation: DotnetProviderOperation;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface DotnetProviderResponse {
  readonly id: string;
  readonly ok: boolean;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: readonly DotnetProviderDiagnostic[];
}

export interface DotnetProviderDiagnostic {
  readonly code: string;
  readonly message: string;
}

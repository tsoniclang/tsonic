import {
  Diagnostic,
  SourceLocation,
  createDiagnostic,
} from "../../types/diagnostic.js";
import {
  capability,
  isCapabilityUnavailable,
  type BackendCapabilityManifest,
  type FeatureKey,
} from "../../capabilities/backend-capabilities.js";
import type {
  IrModule,
  IrPattern,
  IrInterfaceMember,
  IrType,
  IrExpression,
  IrParameter,
  IrStatement,
  IrTypeAliasDeclaration,
  IrTypeParameter,
  IrIfBranchPlan,
  IrIfGuardShape,
} from "../types.js";

export type SoundnessValidationResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
};

export type SoundnessGateOptions = {
  readonly knownReferenceTypes?: ReadonlySet<string>;
  readonly backendCapabilities?: BackendCapabilityManifest;
};

export type UniversalHygieneOptions = Omit<
  SoundnessGateOptions,
  "backendCapabilities"
>;

export type CapabilityValidationOptions = SoundnessGateOptions;

export const KNOWN_BUILTINS = new Set([
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  "half",
  "float",
  "double",
  "decimal",
  "bool",
  "char",
  "bigint",
  "string",
  "object",
  "void",
]);

export type ValidationContext = {
  readonly filePath: string;
  readonly namespace: string;
  readonly diagnostics: Diagnostic[];
  readonly localTypeNames: ReadonlySet<string>;
  readonly localTypeAliases: ReadonlyMap<string, IrTypeAliasDeclaration>;
  readonly namespaceLocalTypeNames: ReadonlySet<string>;
  readonly namespaceTypeAliases: ReadonlyMap<string, IrTypeAliasDeclaration>;
  readonly importedTypeNames: ReadonlySet<string>;
  readonly knownReferenceTypes: ReadonlySet<string>;
  readonly backendCapabilities?: BackendCapabilityManifest;
  readonly enableCapabilityChecks: boolean;
  readonly validationMode: "universal" | "capability";
  readonly typeParameterNames: ReadonlySet<string>;
  readonly activeTypeValidation: WeakSet<object>;
};

export const moduleLocation = (ctx: ValidationContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

export const shouldReportUnsupportedCapability = (
  ctx: ValidationContext,
  capabilityName: FeatureKey
): boolean =>
  ctx.enableCapabilityChecks &&
  isCapabilityUnavailable(ctx.backendCapabilities, capabilityName);

export const createUnsupportedCapabilityDiagnostic = (
  ctx: ValidationContext,
  capabilityName: FeatureKey,
  fallbackCode: Diagnostic["code"],
  fallbackMessage: string,
  fallbackRemediation: string,
  location: SourceLocation = moduleLocation(ctx)
): Diagnostic => {
  const backendCapability = capability(ctx.backendCapabilities, capabilityName);
  return createDiagnostic(
    backendCapability?.diagnosticCode ?? fallbackCode,
    "error",
    backendCapability?.diagnosticMessage ?? fallbackMessage,
    location,
    backendCapability?.remediation ?? fallbackRemediation
  );
};

export const getReferenceResolutionCandidates = (
  name: string
): readonly string[] => {
  const candidates = new Set<string>([name]);

  if (name.endsWith("$instance")) {
    const base = name.slice(0, -"$instance".length);
    if (base.length > 0) {
      candidates.add(base);

      const unsuffixed = base.replace(/_\d+$/, "");
      if (unsuffixed.length > 0) {
        candidates.add(unsuffixed);
      }
    }
  }

  return Array.from(candidates);
};

export type {
  Diagnostic,
  IrExpression,
  IrInterfaceMember,
  IrModule,
  IrParameter,
  IrPattern,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
  IrTypeParameter,
  IrIfBranchPlan,
  IrIfGuardShape,
};
export { createDiagnostic };

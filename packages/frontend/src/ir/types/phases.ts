import type { IrExpression } from "./expressions.js";
import type { IrType } from "./ir-types.js";
import type { IrModule } from "./module.js";
import type { IrStatement } from "./statements.js";

declare const irPhaseBrand: unique symbol;
declare const irTargetBrand: unique symbol;
declare const backendTargetBrand: unique symbol;

export type BackendTargetId<Name extends string = string> = Name & {
  readonly [backendTargetBrand]: "BackendTargetId";
};

export const defineBackendTargetId = <Name extends string>(
  name: Name
): BackendTargetId<Name> => name as BackendTargetId<Name>;

export type IrPhase =
  | "raw"
  | "normalized"
  | "soundnessValidated"
  | "numericProved"
  | "callResolutionRefreshed"
  | "emittable";

export type PhasedIrModule<Phase extends IrPhase> = IrModule & {
  readonly [irPhaseBrand]: Phase;
};

export type PhasedIrStatement<Phase extends IrPhase> = IrStatement & {
  readonly [irPhaseBrand]: Phase;
};

export type PhasedIrExpression<Phase extends IrPhase> = IrExpression & {
  readonly [irPhaseBrand]: Phase;
};

export type PhasedIrType<Phase extends IrPhase> = IrType & {
  readonly [irPhaseBrand]: Phase;
};

export type NormalizedIrModule = PhasedIrModule<"normalized">;
export type SoundnessValidatedIrModule = PhasedIrModule<"soundnessValidated">;
export type NumericProvedIrModule = PhasedIrModule<"numericProved">;
export type CallResolutionRefreshedIrModule =
  PhasedIrModule<"callResolutionRefreshed">;
export type EmittableIrModule<
  Target extends BackendTargetId = BackendTargetId,
> = PhasedIrModule<"emittable"> & {
  readonly [irTargetBrand]: Target;
};

export type ValidatedIrExpression = PhasedIrExpression<"soundnessValidated">;
export type EmittableIrExpression = PhasedIrExpression<"emittable">;
export type ValidatedIrType = PhasedIrType<"soundnessValidated">;
export type EmittableIrType = PhasedIrType<"emittable">;

export const assumeIrPhase = <Phase extends IrPhase>(
  module: IrModule
): PhasedIrModule<Phase> => module as PhasedIrModule<Phase>;

export const assumeIrModulesPhase = <Phase extends IrPhase>(
  modules: readonly IrModule[]
): readonly PhasedIrModule<Phase>[] =>
  modules as readonly PhasedIrModule<Phase>[];

export const assumeEmittableIrModule = <
  Target extends BackendTargetId = BackendTargetId,
>(
  module: IrModule,
  targetId?: Target
): EmittableIrModule<Target> => {
  void targetId;
  return assumeIrPhase<"emittable">(module) as EmittableIrModule<Target>;
};

export const assumeEmittableIrModules = <
  Target extends BackendTargetId = BackendTargetId,
>(
  modules: readonly IrModule[],
  targetId?: Target
): readonly EmittableIrModule<Target>[] => {
  void targetId;
  return assumeIrModulesPhase<"emittable">(
    modules
  ) as readonly EmittableIrModule<Target>[];
};

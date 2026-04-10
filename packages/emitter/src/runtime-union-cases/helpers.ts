import type { IrType } from "@tsonic/frontend";
import { identifierType } from "../core/format/backend-ast/builders.js";
import { printType } from "../core/format/backend-ast/printer.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { getOrRegisterRuntimeUnionCarrier } from "../core/semantic/runtime-union-registry.js";

export const buildRuntimeUnionCarrierTypeAst = (
  memberTypeAsts: readonly CSharpTypeAst[],
  semanticFamilyKey?: string
): CSharpTypeAst => {
  const carrier = getOrRegisterRuntimeUnionCarrier(
    memberTypeAsts,
    undefined,
    semanticFamilyKey ? { familyKey: semanticFamilyKey } : undefined
  );
  return identifierType(`global::${carrier.fullName}`, [
    ...memberTypeAsts,
  ]);
};

export const printRuntimeUnionCarrierType = (
  memberTypeAsts: readonly CSharpTypeAst[],
  semanticFamilyKey?: string
): string =>
  printType(buildRuntimeUnionCarrierTypeAst(memberTypeAsts, semanticFamilyKey));

export const printRuntimeUnionCarrierTypeForIrType = (
  type: IrType | undefined,
  memberTypeAsts: readonly CSharpTypeAst[]
): string =>
  printRuntimeUnionCarrierType(
    memberTypeAsts,
    type?.kind === "unionType" ? type.runtimeCarrierFamilyKey : undefined
  );

export const normalizeRuntimeUnionCarrierNames = (text: string): string =>
  text
    .replace(
      /global::Tsonic\.Internal\.Union\d+(?=<)/g,
      "global::Tsonic.Internal.Union"
    )
    .replace(
      /global::Tsonic\.Internal\.Union\d+_[A-F0-9]{8}/g,
      "global::Tsonic.Internal.Union"
    )
    .replace(/\bTsonic\.Internal\.Union\d+(?=<)/g, "Tsonic.Internal.Union")
    .replace(/\bTsonic\.Internal\.Union\d+_[A-F0-9]{8}\b/g, "Tsonic.Internal.Union")
    .replace(/\bUnion\d+(?=<)/g, "Union")
    .replace(/\bUnion\d+_[A-F0-9]{8}\b/g, "Union");

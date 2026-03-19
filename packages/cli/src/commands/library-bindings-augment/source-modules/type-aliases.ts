import type { IrStatement } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import { printIrType, printTypeParameters } from "../shared.js";
import type { SourceTypeAliasDef } from "../types.js";

export const renderExportedTypeAlias = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  internalIndexDts: string,
  sourceAlias: SourceTypeAliasDef | undefined
): Result<
  {
    readonly line: string;
    readonly internalAliasImport?: string;
  },
  string
> => {
  const typeParams = printTypeParameters(stmt.typeParameters);
  if (stmt.type.kind === "objectType") {
    const arity = stmt.typeParameters?.length ?? 0;
    const internalName = `${stmt.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
    const exportedInternal = new RegExp(
      String.raw`^export\s+(?:declare\s+)?(?:class|interface|type)\s+${internalName}\b`,
      "m"
    ).test(internalIndexDts);
    if (!exportedInternal) {
      return {
        ok: false,
        error:
          `Failed to bind exported structural alias '${stmt.name}' to internal type '${internalName}'.\n` +
          `Expected '${internalName}' to exist in internal/index.d.ts for this namespace.`,
      };
    }

    const typeArgs =
      stmt.typeParameters && stmt.typeParameters.length > 0
        ? `<${stmt.typeParameters.map((tp) => tp.name).join(", ")}>`
        : "";

    return {
      ok: true,
      value: {
        line: `export type ${stmt.name}${typeParams} = ${internalName}${typeArgs};`,
        internalAliasImport: internalName,
      },
    };
  }

  const rhs =
    sourceAlias?.typeText ?? printIrType(stmt.type, { parentPrecedence: 0 });
  return {
    ok: true,
    value: { line: `export type ${stmt.name}${typeParams} = ${rhs};` },
  };
};

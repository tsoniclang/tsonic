import { tsonicCoreSourceSemanticsModules } from "@tsonic/source-core";

export const sourcePrimitiveProfileDeclarations = tsonicCoreSourceSemanticsModules()
  .flatMap(module => module.exports.flatMap(declaration => declaration.kind === "source-primitive"
    ? [`type ${declaration.exportName} = import(${JSON.stringify(module.moduleSpecifier)}).${declaration.exportName};`]
    : []))
  .join("\n");

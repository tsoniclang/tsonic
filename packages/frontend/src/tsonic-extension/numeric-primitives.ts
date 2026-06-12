import type { CompilerExtension } from "@tsonic/tsts";
import { getTstsTypeReferenceName, visitTstsSubtree } from "@tsonic/tsts";
import type { NumericPrimitiveFact } from "../source-frontend/source-facts.js";
import { numericPrimitiveFactKey } from "../source-frontend/source-facts.js";
import {
  getSourcePrimitiveFact,
  getSourcePrimitiveNames,
} from "../source-frontend/source-primitive-taxonomy.js";
import {
  collectImportedNamesByLocalName,
  coreTypesModules,
} from "./core-imports.js";

export const getNumericPrimitiveSourceNames = getSourcePrimitiveNames;

export const createTsonicNumericPrimitiveExtension = (): CompilerExtension => ({
  id: "tsonic.numeric-primitives",
  afterParseSourceFile: (context): void => {
    const primitiveByLocalName = new Map<string, NumericPrimitiveFact>();
    for (const binding of collectImportedNamesByLocalName(
      context.imports,
      coreTypesModules
    ).values()) {
      const primitive = getSourcePrimitiveFact(binding.importedName);
      if (!primitive) continue;
      primitiveByLocalName.set(binding.localName, primitive);
    }

    if (primitiveByLocalName.size === 0) return;

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;
      const typeName = getTstsTypeReferenceName(node);
      if (!typeName) return;
      const primitive = primitiveByLocalName.get(typeName);
      if (!primitive) return;
      context.facts.set(numericPrimitiveFactKey, node, primitive);
    });
  },
});

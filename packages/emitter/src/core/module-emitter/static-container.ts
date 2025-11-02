/**
 * Static container class emission
 */

import { IrModule, IrStatement } from "@tsonic/frontend";
import { EmitterContext, indent, getIndent, withStatic } from "../../types.js";
import { emitStatement } from "../../statement-emitter.js";
import { emitExport } from "../exports.js";

export type StaticContainerResult = {
  readonly code: string;
  readonly context: EmitterContext;
};

/**
 * Check if there's a namespace-level class with the same name as the module
 */
export const hasMatchingClassName = (
  declarations: readonly IrStatement[],
  className: string
): boolean => {
  return declarations.some(
    (decl) =>
      (decl.kind === "classDeclaration" ||
        decl.kind === "interfaceDeclaration") &&
      decl.name === className
  );
};

/**
 * Emit static container class for module-level members
 */
export const emitStaticContainer = (
  module: IrModule,
  members: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean
): StaticContainerResult => {
  const classContext = withStatic(indent(baseContext), true);
  const bodyContext = indent(classContext);
  const ind = getIndent(classContext);

  const containerParts: string[] = [];
  containerParts.push(`${ind}public static class ${module.className}`);
  containerParts.push(`${ind}{`);

  const bodyParts: string[] = [];
  let bodyCurrentContext = bodyContext;

  for (const stmt of members) {
    const [code, newContext] = emitStatement(stmt, bodyCurrentContext);
    bodyParts.push(code);
    bodyCurrentContext = newContext;
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, bodyCurrentContext);
    if (exportCode[0]) {
      bodyParts.push(exportCode[0]);
      bodyCurrentContext = exportCode[1];
    }
  }

  if (bodyParts.length > 0) {
    containerParts.push(bodyParts.join("\n\n"));
  }

  containerParts.push(`${ind}}`);

  return {
    code: containerParts.join("\n"),
    context: { ...bodyCurrentContext, hasInheritance },
  };
};

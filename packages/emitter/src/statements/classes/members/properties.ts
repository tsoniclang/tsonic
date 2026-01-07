/**
 * Property member emission
 */

import { IrClassMember } from "@tsonic/frontend";
import {
  EmitterContext,
  dedent,
  getIndent,
  indent,
  withScoped,
} from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitType } from "../../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/attributes.js";
import { emitBlockStatement } from "../../blocks.js";

/**
 * Emit a property declaration
 */
export const emitPropertyMember = (
  member: IrClassMember & { kind: "propertyDeclaration" },
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];
  const hasAccessors = !!(member.getterBody || member.setterBody);

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  if (member.isStatic) {
    parts.push("static");
  }

  // Override modifier (from metadata or TS base class detection)
  if (member.isOverride) {
    parts.push("override");
  }

  // Required modifier (C# 11) - must be set in object initializer
  if (member.isRequired) {
    parts.push("required");
  }

  if (!hasAccessors && member.isReadonly) {
    parts.push("readonly");
  }

  // Property type - uses standard type emission pipeline
  // Note: type is always set for class fields (from annotation or inference)
  if (member.type) {
    const [typeName, newContext] = emitType(member.type, currentContext);
    currentContext = newContext;
    parts.push(typeName);
  } else {
    parts.push("object");
  }

  // Property name (escape C# keywords)
  parts.push(escapeCSharpIdentifier(member.name));

  // Emit attributes before the property declaration
  const [attributesCode, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  const attrPrefix = attributesCode ? attributesCode + "\n" : "";

  if (!hasAccessors) {
    // Emit as field (TypeScript class fields map to C# fields, not properties)
    let code = `${attrPrefix}${ind}${parts.join(" ")}`;
    if (member.initializer) {
      const [initFrag, finalContext] = emitExpression(
        member.initializer,
        currentContext
      );
      code += ` = ${initFrag.text}`;
      currentContext = finalContext;
    }
    return [`${code};`, currentContext];
  }

  const lines: string[] = [];
  lines.push(`${attrPrefix}${ind}${parts.join(" ")}`);

  // Property body scope (indentation + locals)
  let bodyContext = indent(currentContext);
  const bodyInd = getIndent(bodyContext);
  lines.push(`${bodyInd}{`);

  if (member.getterBody) {
    lines.push(`${bodyInd}get`);
    const getterBodyContext = indent(bodyContext);
    const [getterBlock, getterCtx] = withScoped(
      getterBodyContext,
      { returnType: member.type },
      (scopedCtx) => emitBlockStatement(member.getterBody!, scopedCtx)
    );
    lines.push(getterBlock);
    bodyContext = dedent(getterCtx);
  }

  if (member.setterBody) {
    lines.push(`${bodyInd}set`);
    const setterBodyContext = indent(bodyContext);
    const setterParamName = member.setterParamName;

    const [rawSetterBlock, setterCtx] = withScoped(
      setterBodyContext,
      {
        localNameMap:
          setterParamName && setterParamName !== "value"
            ? new Map([
                ...(setterBodyContext.localNameMap ?? []),
                [setterParamName, escapeCSharpIdentifier(setterParamName)],
              ])
            : setterBodyContext.localNameMap,
      },
      (scopedCtx) => emitBlockStatement(member.setterBody!, scopedCtx)
    );

    const setterBlock = (() => {
      if (!setterParamName || setterParamName === "value") return rawSetterBlock;

      const escapedParam = escapeCSharpIdentifier(setterParamName);
      const stmtInd = getIndent(setterBodyContext);
      const injectLine = `${stmtInd}var ${escapedParam} = value;`;

      const blockLines = rawSetterBlock.split("\n");
      if (blockLines.length > 1) {
        blockLines.splice(1, 0, injectLine, "");
        return blockLines.join("\n");
      }
      return rawSetterBlock;
    })();

    lines.push(setterBlock);
    bodyContext = dedent(setterCtx);
  }

  lines.push(`${bodyInd}}`);

  return [lines.join("\n"), dedent(bodyContext)];
};

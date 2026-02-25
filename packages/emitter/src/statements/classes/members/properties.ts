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
import { emitExpressionAst } from "../../../expression-emitter.js";
import { printExpression } from "../../../core/format/backend-ast/printer.js";
import { emitType } from "../../../type-emitter.js";
import { emitAttributes } from "../../../core/format/attributes.js";
import { emitBlockStatement } from "../../blocks.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { allocateLocalName } from "../../../core/format/local-names.js";

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
  const shouldEmitField = !!member.emitAsField && !hasAccessors;
  // TypeScript class fields map to C# auto-properties by default.
  // This is required for reflection-based libraries (e.g., EF Core, System.Text.Json),
  // and matches TypeScript’s object-model semantics more closely than C# fields.
  //
  // Accessor bodies (`get foo() {}` / `set foo(v) {}`) are emitted as explicit properties.

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  if (member.isStatic) {
    parts.push("static");
  }

  if (shouldEmitField && member.isReadonly) {
    parts.push("readonly");
  }

  // Shadowing/hiding modifier (from metadata).
  // C# warns when a property hides a base property; emit `new` for clarity.
  if (!member.isStatic && !member.isOverride && member.isShadow) {
    parts.push("new");
  }

  // Override modifier (from metadata or TS base class detection)
  if (!shouldEmitField && member.isOverride) {
    parts.push("override");
  }

  // Base property virtual (required when overridden in derived types)
  if (
    !shouldEmitField &&
    !member.isStatic &&
    !member.isOverride &&
    member.isVirtual
  ) {
    parts.push("virtual");
  }

  // Required modifier (C# 11) - must be set in object initializer
  if (!shouldEmitField && !member.isStatic && member.isRequired) {
    parts.push("required");
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
  parts.push(
    emitCSharpName(
      member.name,
      shouldEmitField ? "fields" : "properties",
      context
    )
  );

  // Emit attributes before the property declaration
  const [attributesCode, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  const attrPrefix = attributesCode ? attributesCode + "\n" : "";

  if (shouldEmitField) {
    let code = `${attrPrefix}${ind}${parts.join(" ")};`;
    if (member.initializer) {
      const [initAst, finalContext] = emitExpressionAst(
        member.initializer,
        currentContext
      );
      currentContext = finalContext;
      code = `${attrPrefix}${ind}${parts.join(" ")} = ${printExpression(initAst)};`;
    }
    return [code, currentContext];
  }

  if (!hasAccessors) {
    // C# does not allow `init` on static members. For static readonly fields, emit a
    // get-only auto-property with initializer.
    const accessors = member.isReadonly
      ? member.isStatic
        ? "{ get; }"
        : "{ get; init; }"
      : "{ get; set; }";

    let code = `${attrPrefix}${ind}${parts.join(" ")} ${accessors}`;
    if (member.initializer) {
      const [initAst, finalContext] = emitExpressionAst(
        member.initializer,
        currentContext
      );
      currentContext = finalContext;
      code += ` = ${printExpression(initAst)};`;
    }
    return [code, currentContext];
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
    const savedUsed = getterBodyContext.usedLocalNames;
    const getterEmitContext: EmitterContext = {
      ...getterBodyContext,
      usedLocalNames: new Set<string>(),
    };
    const [getterBlock, getterCtx] = withScoped(
      getterEmitContext,
      { returnType: member.type },
      (scopedCtx) => emitBlockStatement(member.getterBody!, scopedCtx)
    );
    lines.push(getterBlock);
    bodyContext = { ...dedent(getterCtx), usedLocalNames: savedUsed };
  }

  if (member.setterBody) {
    lines.push(`${bodyInd}set`);
    const setterBodyContext = indent(bodyContext);
    const savedUsed = setterBodyContext.usedLocalNames;

    // C# property setters have an implicit `value` parameter. Seed it to avoid CS0136 when
    // user code declares `value` as a local (valid in TS when setter param name differs).
    let setterEmitContext: EmitterContext = {
      ...setterBodyContext,
      usedLocalNames: new Set<string>(["value"]),
    };

    const setterParamName = member.setterParamName;
    let aliasLine: string | undefined;
    let scopedLocalNameMap: ReadonlyMap<string, string> | undefined =
      setterBodyContext.localNameMap;
    if (setterParamName && setterParamName !== "value") {
      const alloc = allocateLocalName(setterParamName, setterEmitContext);
      setterEmitContext = alloc.context;
      const nextMap = new Map(setterBodyContext.localNameMap ?? []);
      nextMap.set(setterParamName, alloc.emittedName);
      scopedLocalNameMap = nextMap;
      const stmtInd = getIndent(setterBodyContext);
      aliasLine = `${stmtInd}var ${alloc.emittedName} = value;`;
    }

    const [rawSetterBlock, setterCtx] = withScoped(
      setterEmitContext,
      { localNameMap: scopedLocalNameMap },
      (scopedCtx) => emitBlockStatement(member.setterBody!, scopedCtx)
    );

    const setterBlock = (() => {
      if (!aliasLine) return rawSetterBlock;

      const blockLines = rawSetterBlock.split("\n");
      if (blockLines.length > 1) {
        blockLines.splice(1, 0, aliasLine, "");
        return blockLines.join("\n");
      }
      return rawSetterBlock;
    })();

    lines.push(setterBlock);
    bodyContext = { ...dedent(setterCtx), usedLocalNames: savedUsed };
  }

  lines.push(`${bodyInd}}`);

  return [lines.join("\n"), dedent(bodyContext)];
};

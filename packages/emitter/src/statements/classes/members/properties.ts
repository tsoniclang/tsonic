/**
 * Property member emission — returns CSharpMemberAst (field or property declaration)
 */

import { IrClassMember } from "@tsonic/frontend";
import { EmitterContext, dedent, indent, withScoped } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import { emitAttributes } from "../../../core/format/attributes.js";
import { emitBlockStatementAst } from "../../../statement-emitter.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { allocateLocalName } from "../../../core/format/local-names.js";
import type {
  CSharpMemberAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpBlockStatementAst,
} from "../../../core/format/backend-ast/types.js";

/**
 * Emit a property declaration as a CSharpMemberAst
 */
export const emitPropertyMember = (
  member: IrClassMember & { kind: "propertyDeclaration" },
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  let currentContext = context;
  const hasAccessors = !!(member.getterBody || member.setterBody);
  const shouldEmitField = !!member.emitAsField && !hasAccessors;

  // Build modifier list
  const modifiers: string[] = [];
  const accessibility = member.accessibility ?? "public";
  modifiers.push(accessibility);

  if (member.isStatic) {
    modifiers.push("static");
  }

  if (shouldEmitField && member.isReadonly) {
    modifiers.push("readonly");
  }

  // Shadowing/hiding modifier
  if (!member.isStatic && !member.isOverride && member.isShadow) {
    modifiers.push("new");
  }

  // Override modifier
  if (!shouldEmitField && member.isOverride) {
    modifiers.push("override");
  }

  // Virtual modifier
  if (
    !shouldEmitField &&
    !member.isStatic &&
    !member.isOverride &&
    member.isVirtual
  ) {
    modifiers.push("virtual");
  }

  // Required modifier (C# 11)
  if (!shouldEmitField && !member.isStatic && member.isRequired) {
    modifiers.push("required");
  }

  // Property type
  let typeAst: CSharpTypeAst = { kind: "predefinedType", keyword: "object" };
  if (member.type) {
    const [tAst, newContext] = emitTypeAst(member.type, currentContext);
    typeAst = tAst;
    currentContext = newContext;
  }

  // Property name
  const name = emitCSharpName(
    member.name,
    shouldEmitField ? "fields" : "properties",
    context
  );

  // Attributes
  const [attrs, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  // Initializer (if any)
  let initAst: CSharpExpressionAst | undefined;
  if (member.initializer) {
    const [iAst, finalContext] = emitExpressionAst(
      member.initializer,
      currentContext
    );
    initAst = iAst;
    currentContext = finalContext;
  }

  // Case 1: Field
  if (shouldEmitField) {
    const fieldAst: CSharpMemberAst = {
      kind: "fieldDeclaration",
      attributes: attrs,
      modifiers,
      type: typeAst,
      name,
      initializer: initAst,
    };
    return [fieldAst, currentContext];
  }

  // Case 2: Auto-property (no explicit accessors)
  if (!hasAccessors) {
    const propAst: CSharpMemberAst = {
      kind: "propertyDeclaration",
      attributes: attrs,
      modifiers,
      type: typeAst,
      name,
      hasGetter: true,
      hasSetter: !member.isReadonly,
      hasInit: member.isReadonly && !member.isStatic ? true : undefined,
      isAutoProperty: true,
      initializer: initAst,
    };
    return [propAst, currentContext];
  }

  // Case 3: Explicit property with getter/setter bodies
  let bodyContext = indent(currentContext);
  let getterBody: CSharpBlockStatementAst | undefined;
  let setterBody: CSharpBlockStatementAst | undefined;

  if (member.getterBody) {
    const getterBodyContext = indent(bodyContext);
    const savedUsed = getterBodyContext.usedLocalNames;
    const getterEmitContext: EmitterContext = {
      ...getterBodyContext,
      usedLocalNames: new Set<string>(),
    };
    const [getterBlock, getterCtx] = withScoped(
      getterEmitContext,
      { returnType: member.type },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (scopedCtx) => emitBlockStatementAst(member.getterBody!, scopedCtx)
    );
    getterBody = getterBlock;
    bodyContext = { ...dedent(getterCtx), usedLocalNames: savedUsed };
  }

  if (member.setterBody) {
    const setterBodyContext = indent(bodyContext);
    const savedUsed = setterBodyContext.usedLocalNames;

    // C# property setters have an implicit `value` parameter. Seed it to avoid CS0136.
    let setterEmitContext: EmitterContext = {
      ...setterBodyContext,
      usedLocalNames: new Set<string>(["value"]),
    };

    const setterParamName = member.setterParamName;
    let aliasStmt: CSharpStatementAst | undefined;
    let scopedLocalNameMap: ReadonlyMap<string, string> | undefined =
      setterBodyContext.localNameMap;
    if (setterParamName && setterParamName !== "value") {
      const alloc = allocateLocalName(setterParamName, setterEmitContext);
      setterEmitContext = alloc.context;
      const nextMap = new Map(setterBodyContext.localNameMap ?? []);
      nextMap.set(setterParamName, alloc.emittedName);
      scopedLocalNameMap = nextMap;
      aliasStmt = {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          {
            name: alloc.emittedName,
            initializer: {
              kind: "identifierExpression",
              identifier: "value",
            },
          },
        ],
      };
    }

    const [rawSetterBlock, setterCtx] = withScoped(
      setterEmitContext,
      { localNameMap: scopedLocalNameMap },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (scopedCtx) => emitBlockStatementAst(member.setterBody!, scopedCtx)
    );

    // Inject alias statement at start of setter body if needed
    setterBody = aliasStmt
      ? {
          kind: "blockStatement",
          statements: [aliasStmt, ...rawSetterBlock.statements],
        }
      : rawSetterBlock;

    bodyContext = { ...dedent(setterCtx), usedLocalNames: savedUsed };
  }

  const propAst: CSharpMemberAst = {
    kind: "propertyDeclaration",
    attributes: attrs,
    modifiers,
    type: typeAst,
    name,
    hasGetter: !!member.getterBody,
    hasSetter: !!member.setterBody,
    isAutoProperty: false,
    getterBody,
    setterBody,
  };
  return [propAst, dedent(bodyContext)];
};

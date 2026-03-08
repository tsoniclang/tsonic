import * as ts from "typescript";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import type { IrExpression, IrObjectExpression, IrType } from "../../types.js";
import type { ProgramContext } from "../../program-context.js";
import { getSourceSpan } from "./helpers.js";

export const SUPPORTED_IMPORT_META_FIELDS = new Set([
  "url",
  "filename",
  "dirname",
]);

export const isImportMetaMetaProperty = (
  node: ts.Node
): node is ts.MetaProperty =>
  ts.isMetaProperty(node) &&
  node.keywordToken === ts.SyntaxKind.ImportKeyword &&
  node.name.text === "meta";

const getImportMetaFilePath = (node: ts.Node): string =>
  node.getSourceFile().fileName.replace(/\\/g, "/");

export const getImportMetaFieldValue = (
  node: ts.Node,
  field: "url" | "filename" | "dirname"
): string => {
  const filePath = getImportMetaFilePath(node);
  if (field === "url") {
    return pathToFileURL(filePath).href;
  }
  if (field === "dirname") {
    return dirname(filePath).replace(/\\/g, "/");
  }
  return filePath;
};

const importMetaObjectType = (): IrType => ({
  kind: "objectType",
  members: [
    {
      kind: "propertySignature",
      name: "url",
      type: { kind: "primitiveType", name: "string" },
      isOptional: false,
      isReadonly: true,
    },
    {
      kind: "propertySignature",
      name: "filename",
      type: { kind: "primitiveType", name: "string" },
      isOptional: false,
      isReadonly: true,
    },
    {
      kind: "propertySignature",
      name: "dirname",
      type: { kind: "primitiveType", name: "string" },
      isOptional: false,
      isReadonly: true,
    },
  ],
});

export const convertImportMetaObject = (
  node: ts.MetaProperty,
  _ctx: ProgramContext
): IrObjectExpression => {
  const sourceSpan = getSourceSpan(node);
  const metaType = importMetaObjectType();

  const makeField = (
    field: "url" | "filename" | "dirname"
  ): Extract<
    IrObjectExpression["properties"][number],
    { kind: "property" }
  > => {
    const value = getImportMetaFieldValue(node, field);
    return {
      kind: "property",
      key: field,
      shorthand: false,
      value: {
        kind: "literal",
        value,
        raw: JSON.stringify(value),
        inferredType: { kind: "primitiveType", name: "string" },
        sourceSpan,
      },
    };
  };

  return {
    kind: "object",
    properties: [makeField("url"), makeField("filename"), makeField("dirname")],
    inferredType: metaType,
    contextualType: metaType,
    sourceSpan,
  };
};

export const tryConvertImportMetaProperty = (
  node: ts.PropertyAccessExpression,
  _ctx: ProgramContext
): IrExpression | undefined => {
  if (!isImportMetaMetaProperty(node.expression)) return undefined;

  const field = node.name.text;
  if (!SUPPORTED_IMPORT_META_FIELDS.has(field)) {
    return undefined;
  }

  const sourceSpan = getSourceSpan(node);
  const value = getImportMetaFieldValue(
    node,
    field as "url" | "filename" | "dirname"
  );
  return {
    kind: "literal",
    value,
    raw: JSON.stringify(value),
    inferredType: { kind: "primitiveType", name: "string" },
    sourceSpan,
  };
};

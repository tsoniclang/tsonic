import type { Diagnostic, IrType, IrTypeParameter } from "@tsonic/frontend";
import * as ts from "typescript";
import type { SourceTypeImport } from "./types.js";

const typePrinter = ts.createPrinter({ removeComments: true });

export const renderDiagnostics = (diags: readonly Diagnostic[]): string => {
  return diags
    .map((d) => {
      if (d.location) {
        return `${d.location.file}:${d.location.line}:${d.location.column} ${d.message}`;
      }
      return d.message;
    })
    .join("\n");
};

export const escapeRegExp = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const printTypeNodeText = (
  node: ts.TypeNode,
  sourceFile: ts.SourceFile
): string => {
  const raw = node.getText(sourceFile).trim();
  if (raw.length > 0) {
    return raw;
  }
  return typePrinter
    .printNode(ts.EmitHint.Unspecified, node, sourceFile)
    .trim();
};

export const textContainsIdentifier = (
  text: string,
  identifier: string
): boolean => {
  const pattern = new RegExp(String.raw`\b${escapeRegExp(identifier)}\b`);
  return pattern.test(text);
};

export const ensureUndefinedInType = (typeText: string): string => {
  const trimmed = typeText.trim();
  if (/\bundefined\b/.test(trimmed)) return trimmed;
  return `${trimmed} | undefined`;
};

export const normalizeModuleFileKey = (filePath: string): string => {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
};

export const getPropertyNameText = (
  name: ts.PropertyName
): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
};

export const stripExistingSection = (
  text: string,
  startMarker: string,
  endMarker: string
): string => {
  const start = text.indexOf(startMarker);
  if (start < 0) return text;
  const end = text.indexOf(endMarker, start);
  if (end < 0) return text;
  return text.slice(0, start) + text.slice(end + endMarker.length);
};

export const upsertSectionAfterImports = (
  text: string,
  startMarker: string,
  endMarker: string,
  body: string
): string => {
  const stripped = stripExistingSection(text, startMarker, endMarker);
  const lines = stripped.split("\n");

  let insertAt = 0;
  while (insertAt < lines.length) {
    const line = lines[insertAt] ?? "";
    const trimmed = line.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("import ")
    ) {
      insertAt += 1;
      continue;
    }
    break;
  }

  const head = lines.slice(0, insertAt).join("\n").trimEnd();
  const tail = lines.slice(insertAt).join("\n").trimStart();
  const section = `${startMarker}\n${body.trimEnd()}\n${endMarker}`;

  const parts: string[] = [];
  if (head) parts.push(head);
  parts.push(section);
  if (tail) parts.push(tail);
  return parts.join("\n\n") + "\n";
};

export const upsertSection = (
  text: string,
  startMarker: string,
  endMarker: string,
  body: string
): string => {
  const stripped = stripExistingSection(text, startMarker, endMarker).trimEnd();
  const section = `\n\n${startMarker}\n${body.trimEnd()}\n${endMarker}\n`;
  return stripped + section;
};

export const splitTopLevelCommaSeparated = (text: string): string[] => {
  const parts: string[] = [];
  let depthAngle = 0;
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "<") depthAngle += 1;
    else if (ch === ">") depthAngle = Math.max(0, depthAngle - 1);
    else if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (
      ch === "," &&
      depthAngle === 0 &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter((p) => p.length > 0);
};

export const splitTopLevelTypeArgs = (text: string): string[] => {
  return splitTopLevelCommaSeparated(text);
};

export const expandUnionsDeep = (typeText: string): string => {
  const unionPrefixRe = /Union_\d+</g;
  let result = typeText;

  while (true) {
    unionPrefixRe.lastIndex = 0;
    const prefixMatch = unionPrefixRe.exec(result);
    if (!prefixMatch) break;

    const openAngle = prefixMatch.index + prefixMatch[0].length - 1;
    let depth = 1;
    let closeAngle = -1;
    for (let i = openAngle + 1; i < result.length; i += 1) {
      const ch = result[i];
      if (ch === "<") depth += 1;
      else if (ch === ">") {
        depth -= 1;
        if (depth === 0) {
          closeAngle = i;
          break;
        }
      }
    }
    if (closeAngle < 0) break;

    const inner = result.slice(openAngle + 1, closeAngle);
    const args = splitTopLevelTypeArgs(inner);
    if (args.length < 2) break;

    const expanded = `(${args.join(" | ")})`;
    result =
      result.slice(0, prefixMatch.index) +
      expanded +
      result.slice(closeAngle + 1);
  }

  return result;
};

export const typeNodeUsesImportedTypeNames = (
  node: ts.TypeNode,
  typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>
): boolean => {
  const allowlistedImportSources = new Set<string>(["@tsonic/core/types.js"]);

  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isTypeReferenceNode(current) && ts.isIdentifier(current.typeName)) {
      const imported = typeImportsByLocalName.get(current.typeName.text);
      if (imported && !allowlistedImportSources.has(imported.source.trim())) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

export const unwrapParens = (node: ts.TypeNode): ts.TypeNode => {
  let current = node;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
};

type TypePrinterContext = {
  readonly parentPrecedence: number;
};

export const printTypeParameters = (
  tps: readonly IrTypeParameter[] | undefined
): string => {
  if (!tps || tps.length === 0) return "";

  const parts = tps.map((tp) => {
    const chunk: string[] = [];
    chunk.push(tp.name);
    if (tp.constraint) {
      chunk.push(
        `extends ${printIrType(tp.constraint, { parentPrecedence: 0 })}`
      );
    }
    if (tp.default) {
      chunk.push(`= ${printIrType(tp.default, { parentPrecedence: 0 })}`);
    }
    return chunk.join(" ");
  });

  return `<${parts.join(", ")}>`;
};

export const printIrType = (type: IrType, ctx: TypePrinterContext): string => {
  const wrap = (s: string, prec: number): string =>
    prec < ctx.parentPrecedence ? `(${s})` : s;

  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return typeof type.value === "string"
        ? JSON.stringify(type.value)
        : String(type.value);
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "typeParameterType":
      return type.name;
    case "referenceType": {
      const base = type.name;
      const args = type.typeArguments ?? [];
      if (args.length === 0) return base;
      const rendered = args
        .map((a) => printIrType(a, { parentPrecedence: 0 }))
        .join(", ");
      return `${base}<${rendered}>`;
    }
    case "arrayType":
      return `${printIrType(type.elementType, { parentPrecedence: 2 })}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((t) => printIrType(t, { parentPrecedence: 0 }))
        .join(", ")}]`;
    case "functionType": {
      const ps = type.parameters
        .map((p, i) => {
          const name =
            p.pattern.kind === "identifierPattern" ? p.pattern.name : `p${i + 1}`;
          const t = p.type
            ? printIrType(p.type, { parentPrecedence: 0 })
            : "unknown";
          return `${name}: ${t}`;
        })
        .join(", ");
      const ret = printIrType(type.returnType, { parentPrecedence: 0 });
      return wrap(`(${ps}) => ${ret}`, 2);
    }
    case "unionType": {
      const rendered = type.types
        .map((t) => printIrType(t, { parentPrecedence: 0 }))
        .join(" | ");
      return wrap(rendered, 0);
    }
    case "intersectionType": {
      const rendered = type.types
        .map((t) => printIrType(t, { parentPrecedence: 1 }))
        .join(" & ");
      return wrap(rendered, 1);
    }
    case "dictionaryType": {
      const k = printIrType(type.keyType, { parentPrecedence: 0 });
      const v = printIrType(type.valueType, { parentPrecedence: 0 });
      return `Record<${k}, ${v}>`;
    }
    case "objectType": {
      if (type.members.length === 0) return "{}";
      const members = type.members
        .map((member) => {
          if (member.kind === "propertySignature") {
            const readonly = member.isReadonly ? "readonly " : "";
            const optional = member.isOptional ? "?" : "";
            const memberType = printIrType(member.type, {
              parentPrecedence: 0,
            });
            return `${readonly}${member.name}${optional}: ${memberType}`;
          }

          const typeParams = printTypeParameters(member.typeParameters);
          const args = member.parameters
            .map((p, i) => {
              const name =
                p.pattern.kind === "identifierPattern"
                  ? p.pattern.name
                  : `p${i + 1}`;
              const optional = p.isOptional ? "?" : "";
              const paramType = p.type
                ? printIrType(p.type, { parentPrecedence: 0 })
                : "unknown";
              return `${name}${optional}: ${paramType}`;
            })
            .join(", ");
          const returnType = member.returnType
            ? printIrType(member.returnType, { parentPrecedence: 0 })
            : "void";
          return `${member.name}${typeParams}(${args}): ${returnType}`;
        })
        .join("; ");
      return `{ ${members} }`;
    }
    default:
      return "unknown";
  }
};

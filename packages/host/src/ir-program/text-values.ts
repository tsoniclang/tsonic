import type { SourceNodeRef, NodeRef, LocalRef, ItemNodeRef, LibraryModuleIdentity, Origin, Derivation } from "../ids/contract.js";
import type { CheckJsDirective, CommentDirective, CommentRange, NodeHeader, NodeList, Pragma, PragmaArgument, PragmaArguments, SyntaxNode, TextRange } from "../ir-hir/contract.js";
import { orderPragmaArguments } from "../ir-hir/index.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { Diagnostic, DiagnosticCode, DiagnosticSite, MessageArgument, RelatedDiagnostic, DiagnosticFix, TextEdit } from "../diag/contract.js";

export function textSourceNodeRef(value: SourceNodeRef): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "body":
        return record(value.kind, [
      field("value", textNodeRef(value.value)),
    ]);
      case "item":
        return record(value.kind, [
      field("value", textItemNodeRef(value.value)),
    ]);
    }
  });
}

export function textNodeRef(value: NodeRef): TextWork {
  return deferred(value, () => {
    return record("NodeRef", [
      field("body", identity("body", value.body)),
      field("node", numericIdentity("n", value.node)),
    ]);
  });
}

export function textLocalRef(value: LocalRef): TextWork {
  return deferred(value, () => {
    return record("LocalRef", [
      field("body", identity("body", value.body)),
      field("local", numericIdentity("l", value.local)),
    ]);
  });
}

export function textItemNodeRef(value: ItemNodeRef): TextWork {
  return deferred(value, () => {
    return record("ItemNodeRef", [
      field("owner", identity("def", value.owner)),
      field("node", numericIdentity("n", value.node)),
    ]);
  });
}

export function textLibraryModuleIdentity(value: LibraryModuleIdentity): TextWork {
  return deferred(value, () => {
    return record("LibraryModuleIdentity", [
      field("providerId", text(value.providerId)),
      field("providerVersion", text(value.providerVersion)),
      field("packageName", (value.packageName === null ? token("null") : text(value.packageName))),
      field("moduleSpecifier", text(value.moduleSpecifier)),
      field("providerModuleId", text(value.providerModuleId)),
    ]);
  });
}

export function textOrigin(value: Origin): TextWork {
  return deferred(value, () => {
    return record("Origin", [
      field("module", identity("mod", value.module)),
      field("start", numeric(value.start)),
      field("length", numeric(value.length)),
      field("derived", sequence(value.derived, entry0 => textDerivation(entry0))),
    ]);
  });
}

export function textDiagnostic(value: Diagnostic): TextWork {
  return deferred(value, () => {
    return record("Diagnostic", [
      field("code", textDiagnosticCode(value.code)),
      field("severity", text(value.severity)),
      field("site", textDiagnosticSite(value.site)),
      field("source", (value.source === null ? token("null") : text(value.source))),
      field("evidence", sequence(value.evidence, entry0 => text(entry0))),
      field("message", text(value.message)),
      field("arguments", sequence(value.arguments, entry0 => textMessageArgument(entry0))),
      field("related", sequence(value.related, entry0 => textRelatedDiagnostic(entry0))),
      field("fix", (value.fix === null ? token("null") : textDiagnosticFix(value.fix))),
    ]);
  });
}

export function textDerivation(value: Derivation): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "lowering":
        return record(value.kind, [
      field("pass", text(value.pass)),
    ]);
      case "expansion":
        return record(value.kind, [
      field("expansion", identity("exp", value.expansion)),
    ]);
    }
  });
}

export function textDiagnosticCode(value: DiagnosticCode): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "host":
        return record(value.kind, [
      field("name", text(value.name)),
      field("rendered", text(value.rendered)),
    ]);
      case "checker":
        return record(value.kind, [
      field("number", numeric(value.number)),
      field("rendered", text(value.rendered)),
    ]);
      case "extension":
        return record(value.kind, [
      field("number", numeric(value.number)),
      field("extensionCode", text(value.extensionCode)),
      field("rendered", text(value.rendered)),
    ]);
    }
  });
}

export function textDiagnosticSite(value: DiagnosticSite): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "source":
        return record(value.kind, [
      field("origin", textOrigin(value.origin)),
    ]);
      case "file":
        return record(value.kind, [
      field("path", text(value.path)),
    ]);
      case "none":
        return record(value.kind, []);
    }
  });
}

export function textMessageArgument(value: MessageArgument): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "text":
        return record(value.kind, [
      field("value", text(value.value)),
    ]);
      case "integer":
        return record(value.kind, [
      field("value", integer(value.value)),
    ]);
      case "number":
        return record(value.kind, [
      field("value", numeric(value.value)),
    ]);
      case "origin":
        return record(value.kind, [
      field("value", textOrigin(value.value)),
    ]);
    }
  });
}

export function textRelatedDiagnostic(value: RelatedDiagnostic): TextWork {
  return deferred(value, () => {
    return record("RelatedDiagnostic", [
      field("site", textDiagnosticSite(value.site)),
      field("code", textDiagnosticCode(value.code)),
      field("message", text(value.message)),
    ]);
  });
}

export function textDiagnosticFix(value: DiagnosticFix): TextWork {
  return deferred(value, () => {
    return record("DiagnosticFix", [
      field("description", text(value.description)),
      field("edits", sequence(value.edits, entry0 => textTextEdit(entry0))),
    ]);
  });
}

export function textTextEdit(value: TextEdit): TextWork {
  return deferred(value, () => {
    return record("TextEdit", [
      field("origin", textOrigin(value.origin)),
      field("replacement", text(value.replacement)),
    ]);
  });
}

export interface SyntaxTextContext {
  readonly reference: (node: SyntaxNode<TypedPhase>) => TextWork;
}

export function textRange(value: TextRange): TextWork {
  return deferred(value, () => record("TextRange", [field("pos", numeric(value.pos)), field("end", numeric(value.end))]));
}

export function textSyntaxHeader(value: NodeHeader): readonly TextField[] {
  return [
    field("id", numericIdentity("n", value.id)), field("origin", textOrigin(value.origin)),
    field("parent", nullable(value.parent, node => numericIdentity("n", node))),
    field("flags", sequence(value.flags, text)), field("loc", textRange(value.loc)),
  ];
}

export function textNodeList<Item extends SyntaxNode<TypedPhase>>(
  value: NodeList<Item>, context: SyntaxTextContext, name: "NodeList" | "ModifierList" = "NodeList",
): TextWork {
  return deferred(value, () => record(name, [
    field("loc", textRange(value.loc)), field("nodes", sequence(value.nodes, context.reference)),
  ]));
}

export function textCommentDirective(value: CommentDirective): TextWork {
  return deferred(value, () => record(value.kind, [field("loc", textRange(value.loc))]));
}

export function textCommentRange(value: CommentRange): TextWork {
  return deferred(value, () => record(value.kind, [
    field("pos", numeric(value.pos)), field("end", numeric(value.end)),
    field("hasTrailingNewLine", boolean(value.hasTrailingNewLine)),
  ]));
}

export function textPragmaArgument(value: PragmaArgument): TextWork {
  return deferred(value, () => record("PragmaArgument", [
    field("pos", numeric(value.pos)), field("end", numeric(value.end)),
    field("name", text(value.name)), field("value", text(value.value)),
  ]));
}

function pragmaFields(value: PragmaArguments): readonly TextField[] {
  return orderPragmaArguments(value).map(entry => field(entry.name, textPragmaArgument(entry.value)));
}

export function textPragma(value: Pragma): TextWork {
  return deferred(value, () => record(value.kind, [
    field("pos", numeric(value.pos)), field("end", numeric(value.end)),
    field("hasTrailingNewLine", boolean(value.hasTrailingNewLine)), field("name", text(value.name)),
    field("args", deferred(value.args, () => record("PragmaArguments", pragmaFields(value.args)))),
  ]));
}

export function textCheckJsDirective(value: CheckJsDirective): TextWork {
  return deferred(value, () => record("CheckJsDirective", [
    field("enabled", boolean(value.enabled)), field("range", textCommentRange(value.range)),
  ]));
}

export interface TextField {
  readonly name: string;
  readonly value: TextWork;
}

export type TextWork =
  | { readonly kind: "token"; readonly text: string }
  | { readonly kind: "record"; readonly name: string; readonly fields: readonly TextField[] }
  | { readonly kind: "array"; readonly source: object; readonly length: number;
      readonly entry: (position: number) => TextWork | null }
  | { readonly kind: "projection"; readonly source: object; readonly project: () => TextWork };

export interface TextPath {
  readonly parent: TextPath | null;
  readonly segment: string;
}

type TextTask =
  | { readonly kind: "value"; readonly value: TextWork; readonly path: TextPath }
  | { readonly kind: "leave"; readonly source: object };

export function token(text: string): TextWork {
  return { kind: "token", text };
}

export function text(value: string): TextWork {
  return token(JSON.stringify(value));
}

export function hostNumber(value: number): string {
  if (Object.is(value, -0)) return "-0";
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "+Infinity";
  if (value === -Infinity) return "-Infinity";
  return String(value);
}

export function numeric(value: number): TextWork {
  return token(hostNumber(value));
}

export function boolean(value: boolean): TextWork {
  return token(String(value));
}

export function integer(value: bigint): TextWork {
  return token(`${value}n`);
}

export function numericIdentity(
  prefix: "n" | "l" | "b" | "p" | "t" | "sig" | "c" | "cand"
    | "producer" | "bound" | "context" | "origins" | "path" | "boundary" | "layout" | "field",
  value: number,
): TextWork {
  return token(`${prefix}:${hostNumber(value)}`);
}

export function identity(prefix: "pkg" | "mod" | "def" | "body" | "exp" | "group" | "component", value: string): TextWork {
  return token(`${prefix}:${JSON.stringify(value)}`);
}

export function field(name: string, value: TextWork): TextField {
  return { name, value };
}

export function record(name: string, fields: readonly TextField[]): TextWork {
  return { kind: "record", name, fields };
}

export function sequence<Value>(values: readonly Value[], project: (value: Value) => TextWork): TextWork {
  return {
    kind: "array", source: values, length: values.length,
    entry: position => {
      const value = values[position];
      if (value === undefined) return null;
      return project(value);
    },
  };
}

export function deferred(source: object, project: () => TextWork): TextWork {
  return { kind: "projection", source, project };
}

export function nullable<Value>(value: Value | null, project: (value: Value) => TextWork): TextWork {
  return value === null ? token("null") : project(value);
}

export function pathText(path: TextPath): string {
  const segments: string[] = [];
  let current: TextPath | null = path;
  while (current !== null) {
    segments.push(current.segment);
    current = current.parent;
  }
  return segments.reverse().join("");
}

export function emitText(root: TextWork, name: string): string {
  const chunks: string[] = [];
  const active = new Set<object>();
  const work: TextTask[] = [{ kind: "value", value: root, path: { parent: null, segment: name } }];
  let task = work.pop();
  while (task !== undefined) {
    if (task.kind === "leave") {
      active.delete(task.source);
      task = work.pop();
      continue;
    }
    const value = task.value;
    switch (value.kind) {
      case "token": chunks.push(value.text); break;
      case "projection": {
        if (active.has(value.source)) throw new TypeError(`Inline cycle at ${pathText(task.path)}`);
        active.add(value.source);
        work.push({ kind: "leave", source: value.source });
        work.push({ kind: "value", value: value.project(), path: task.path });
        break;
      }
      case "record": {
        chunks.push(`${value.name}(`);
        work.push({ kind: "value", value: token(")"), path: task.path });
        const base = work.length;
        for (const [position, entry] of value.fields.entries()) {
          const slot = base + (value.fields.length - position - 1) * 2;
          const path = { parent: task.path, segment: `.${entry.name}` };
          work[slot] = { kind: "value", value: entry.value, path };
          const name = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entry.name) ? entry.name : JSON.stringify(entry.name);
          work[slot + 1] = { kind: "value", value: token(`${position === 0 ? "" : ", "}${name}=`), path };
        }
        break;
      }
      case "array": {
        if (active.has(value.source)) throw new TypeError(`Inline cycle at ${pathText(task.path)}`);
        active.add(value.source);
        work.push({ kind: "leave", source: value.source });
        chunks.push("[");
        work.push({ kind: "value", value: token("]"), path: task.path });
        const base = work.length;
        for (let position = 0; position < value.length; position += 1) {
          const path = { parent: task.path, segment: `[${position}]` };
          const entry = value.entry(position);
          if (entry === null) throw new TypeError(`Inline array hole at ${pathText(path)}`);
          const slot = base + (value.length - position - 1) * 2;
          work[slot] = { kind: "value", value: entry, path };
          work[slot + 1] = { kind: "value", value: token(position === 0 ? "" : ", "), path };
        }
        break;
      }
    }
    task = work.pop();
  }
  return chunks.join("");
}

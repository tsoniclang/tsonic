// Focused, faithful port of the subset of TS-Go's _scripts/schema.ts needed by
// the TSTS AST generator's free-fn/adapter emitters. It mirrors the Go
// generator's type-resolution and alias-derivation rules, but exposes TS
// reference formatting (GoPtr/GoSlice + Node/NodeList aliases) instead of Go.
//
// This is generator tooling (NOT a ported @tsgo-unit). It reproduces the exact
// structures emitted by generate-go-ast.ts so the generated TS mirrors
// ast_generated.go in the free-fn/adapter model.

const PRIMITIVE_TYPES = new Set([
  "any",
  "bool",
  "boolean",
  "int",
  "ModifierFlags",
  "NodeFlags",
  "string",
  "TokenFlags",
]);

// Maps the schema's primitive/scalar type names to their TS reference form.
// Node/NodeList/union/list types are handled structurally (they resolve to the
// generated `= Node` / `= NodeList` aliases and so reference those alias names).
const TS_PRIMITIVE_MAP = {
  bool: "bool",
  boolean: "bool",
  int: "int",
  string: "string",
  any: "unknown",
  NodeFlags: "NodeFlags",
  ModifierFlags: "ModifierFlags",
  TokenFlags: "TokenFlags",
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function uncapitalize(s) {
  if (s.startsWith("JSDoc")) return "jsdoc" + s.slice(5);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export class AstSchema {
  constructor(schema) {
    this.schema = schema;
    this.definitions = schema.nodes.definitions;
    this.bases = schema.bases;
    this.aliases = schema.nodes.aliases;
    this.listAliases = schema.nodes.listAliases || {};
    this.kinds = schema.kinds || { elements: [], markers: [], aliases: {} };

    // Reverse map: element-type cache-key -> list alias name (for raw lists' element typing).
    this.listAliasNameByElement = new Map();
    for (const [aliasName, elementType] of Object.entries(this.listAliases)) {
      this.listAliasNameByElement.set(elementType, aliasName);
    }

    // Instantiation alias name -> node name.
    this.instantiationAliasMap = new Map();
    for (const [nodeName, def] of Object.entries(this.definitions)) {
      for (const aliasName of Object.keys(def.instantiationAliases || {})) {
        this.instantiationAliasMap.set(aliasName, nodeName);
      }
    }
  }

  capitalize(s) { return capitalize(s); }
  uncapitalize(s) { return uncapitalize(s); }

  nodeNames() {
    return Object.keys(this.definitions);
  }

  baseNames() {
    return Object.keys(this.bases);
  }

  // ── Kind aliases (for IsXxxKind guards + multi-kind expansion) ────────────

  kindAliasNames() {
    return Object.keys(this.kinds.aliases || {});
  }

  hasKindAlias(name) {
    return !!(this.kinds.aliases && name in this.kinds.aliases);
  }

  kindElementNames() {
    return (this.kinds.elements || []).map((e) => (typeof e === "string" ? e : e.name)).filter(Boolean);
  }

  resolveKindMarkerValue(name) {
    const markers = this.kinds.markers || [];
    const marker = markers.find((m) => m.name === name);
    if (marker) return this.resolveKindMarkerValue(marker.value);
    return name;
  }

  kindAliasMembers(name) {
    const value = this.kinds.aliases[name];
    if (Array.isArray(value)) return value;
    // Range form: { range: [first, last] }
    const elements = this.kindElementNames();
    const first = this.resolveKindMarkerValue(value.range[0]);
    const last = this.resolveKindMarkerValue(value.range[1]);
    const firstIdx = elements.indexOf(first);
    const lastIdx = elements.indexOf(last);
    if (firstIdx === -1 || lastIdx === -1) {
      throw new Error(`Range alias ${name}: could not resolve [${value.range[0]}, ${value.range[1]}]`);
    }
    return elements.slice(firstIdx, lastIdx + 1);
  }

  kindAliasIsRange(name) {
    const value = this.kinds.aliases[name];
    return !Array.isArray(value) && !!value.range;
  }

  kindAliasRange(name) {
    return this.kinds.aliases[name].range;
  }

  // Expand a kind alias (recursively) to concrete kind element names.
  expandKindAliasMembers(name) {
    if (!this.hasKindAlias(name)) return [name];
    const out = [];
    for (const m of this.kindAliasMembers(name)) {
      if (this.hasKindAlias(m)) out.push(...this.expandKindAliasMembers(m));
      else out.push(m);
    }
    return out;
  }

  // ── Node defs ─────────────────────────────────────────────────────────────

  syntaxKindName(nodeName) {
    const kind = this.definitions[nodeName].kind;
    if (Array.isArray(kind)) return kind[0];
    return kind || nodeName;
  }

  kindAliasesOf(nodeName) {
    const kind = this.definitions[nodeName].kind;
    if (Array.isArray(kind)) return kind.slice(1);
    return [];
  }

  instantiationAliasesOf(nodeName) {
    return Object.entries(this.definitions[nodeName].instantiationAliases || {}).map(([name, typeArg]) => ({ name, typeArg }));
  }

  // The declared `kind` type of a node, used to decide multi-kind/typeParameter.
  // Returns { kindNames: string[], isTypeParameter: bool } where kindNames are
  // concrete SyntaxKind names (for IsXxx generation).
  kindTypesOf(nodeName) {
    const def = this.definitions[nodeName];
    // Type-parameter node (e.g. Token<TKind extends TokenSyntaxKind>): the Kind
    // member's type is the type-parameter name, whose constraint is a kind alias.
    if (def.typeParameters && def.typeParameters.length > 0) {
      const kindMember = (def.members || []).find((m) => m.name === "Kind" || m.name === "kind");
      const tname = kindMember ? this._typeName(kindMember.type) : undefined;
      const tp = tname ? def.typeParameters.find((p) => p.name === tname) : undefined;
      const constraint = tp ? tp.constraint : tname;
      if (constraint && this.hasKindAlias(constraint)) {
        return { kindNames: this.expandKindAliasMembers(constraint), isTypeParameter: true };
      }
    }
    const kindMemberDef = (def.members || []).find((m) => m.name === "Kind" || m.name === "kind");
    if (kindMemberDef) {
      // Resolve the member's type (inherited members take the base field type).
      const kindMember = new AstMember(this, kindMemberDef, nodeName);
      const t = kindMember.rawType;
      if (Array.isArray(t)) {
        const names = t.map((x) => (typeof x === "string" && x.startsWith("SyntaxKind.") ? x.slice("SyntaxKind.".length) : x));
        return { kindNames: names, isTypeParameter: false };
      }
      if (this.hasKindAlias(t)) {
        return { kindNames: this.expandKindAliasMembers(t), isTypeParameter: false };
      }
      if (typeof t === "string" && t.startsWith("SyntaxKind.")) {
        return { kindNames: [t.slice("SyntaxKind.".length)], isTypeParameter: false };
      }
    }
    return { kindNames: [this.syntaxKindName(nodeName)], isTypeParameter: false };
  }

  isMultiKind(nodeName) {
    return this.kindTypesOf(nodeName).kindNames.length > 1;
  }

  _typeName(t) {
    if (Array.isArray(t)) return undefined;
    return t;
  }

  // Resolved extends keys for a node or base.
  extendsKeysOf(name) {
    if (name in this.definitions) return this.definitions[name].extends || [];
    if (name in this.bases) return this.bases[name].extends || [];
    return [];
  }

  // Transitive base chain (the set of base names reachable via extends), in
  // a deterministic depth-first order matching Go embedding resolution.
  baseChainOf(name, seen = new Set(), order = []) {
    for (const ext of this.extendsKeysOf(name)) {
      if (!seen.has(ext)) {
        seen.add(ext);
        order.push(ext);
        this.baseChainOf(ext, seen, order);
      }
    }
    return order;
  }

  // ── Member info ────────────────────────────────────────────────────────────

  members(nodeName) {
    return (this.definitions[nodeName].members || []).map((m) => new AstMember(this, m, nodeName));
  }

  // Members participating in factory/visitor/clone (excludes noFactory).
  schemaMembers(nodeName) {
    return this.members(nodeName).filter((m) => !m.noFactory);
  }

  baseFields(baseName) {
    const fields = this.bases[baseName].fields || {};
    return Object.entries(fields).map(([name, f]) => new AstMember(this, { name, ...f }, undefined));
  }

  // Look up a field by name across a node/base's transitive base chain (for
  // inherited members whose type/list comes from the base field).
  inheritedField(name, ownerName) {
    for (const baseName of this.baseChainOf(ownerName)) {
      const fields = this.bases[baseName] && this.bases[baseName].fields;
      if (fields && name in fields) {
        return new AstMember(this, { name, ...fields[name] }, undefined);
      }
    }
    return undefined;
  }

  baseBrand(baseName) {
    return this.bases[baseName].brand;
  }

  // ── TS reference formatting ──────────────────────────────────────────────

  // Resolves a schema type-string to its TS reference form for a field/param,
  // honoring the list kind. Mirrors generate-go-ast.ts formatGoReference but in
  // the free-fn/adapter model: all node/union/list/alias node types resolve to
  // the generated `= Node` / `= NodeList` aliases, wrapped in GoPtr/GoSlice as Go
  // uses `*`/`[]`.
  formatTsReference(rawType, listKind) {
    if (listKind === "raw") {
      // Go raw lists are []*Node for node elements, []T for scalar elements.
      if (this._baseKindOf(rawType) === "node") return "GoSlice<GoPtr<Node>>";
      const elem = this._scalarTsRef(rawType);
      return `GoSlice<${elem.ref}>`;
    }
    if (listKind === "ModifierList") {
      return "GoPtr<ModifierList>";
    }
    if (listKind === "NodeList") {
      // *<ListAlias> or *NodeList
      const aliasName = this._listAliasNameFor(rawType);
      return `GoPtr<${aliasName || "NodeList"}>`;
    }
    const scalar = this._scalarTsRef(rawType);
    if (scalar.isNode || scalar.isAlias) {
      return `GoPtr<${scalar.ref}>`;
    }
    return scalar.ref;
  }

  // The TS name a NodeList alias uses for a given element type, e.g. element
  // "Statement" -> "StatementList". Falls back to undefined (-> NodeList).
  _listAliasNameFor(rawType) {
    const key = Array.isArray(rawType) ? rawType.join("|") : rawType;
    return this.listAliasNameByElement.get(key);
  }

  // Resolve a scalar (non-list) schema type-string into a TS reference plus
  // classification flags. Unions resolve to Node (matching the Go union rule).
  _scalarTsRef(rawType) {
    if (Array.isArray(rawType)) {
      // Union of types. Go: if any node/list -> *Node; if all kinds -> Kind.
      const baseKinds = new Set(rawType.map((t) => this._baseKindOf(t)));
      if ([...baseKinds].every((k) => k === "kind")) {
        return { ref: "Kind", isNode: false, isAlias: false };
      }
      // node/list union -> Node
      return { ref: "Node", isNode: true, isAlias: false };
    }
    const t = rawType;
    if (t === "Kind" || t.startsWith("SyntaxKind.")) {
      return { ref: "Kind", isNode: false, isAlias: false };
    }
    if (PRIMITIVE_TYPES.has(t)) {
      return { ref: TS_PRIMITIVE_MAP[t] ?? t, isNode: false, isAlias: false };
    }
    if (t === "Node") return { ref: "Node", isNode: true, isAlias: false };
    if (t in this.listAliases) {
      // a list-alias name used directly as a (NodeList) reference
      return { ref: t, isNode: false, isAlias: true };
    }
    if (this.hasKindAlias(t)) {
      // kind alias used as a value type -> Kind
      return { ref: "Kind", isNode: false, isAlias: false };
    }
    if (this.instantiationAliasMap.has(t)) {
      return { ref: t, isNode: false, isAlias: true };
    }
    if (t in this.aliases) {
      return { ref: t, isNode: false, isAlias: true };
    }
    if (t in this.definitions) {
      // concrete node referenced directly -> its FooNode alias
      return { ref: `${t}Node`, isNode: false, isAlias: true };
    }
    if (t in this.bases) {
      return { ref: t, isNode: true, isAlias: false };
    }
    // External / unknown scalar (Symbol, SymbolTable, FlowNode, TokenFlags, ...)
    return { ref: t, isNode: false, isAlias: false };
  }

  _baseKindOf(t) {
    if (Array.isArray(t)) {
      const kinds = new Set(t.map((x) => this._baseKindOf(x)));
      if ([...kinds].every((k) => k === "kind")) return "kind";
      if (kinds.has("node")) return "node";
      return "union";
    }
    if (t === "Kind" || t.startsWith("SyntaxKind.")) return "kind";
    if (this.hasKindAlias(t)) return "kind";
    if (PRIMITIVE_TYPES.has(t)) return "primitive";
    if (t === "Node" || t in this.definitions || t in this.bases || t in this.aliases || t in this.listAliases || this.instantiationAliasMap.has(t)) {
      return "node";
    }
    return "primitive";
  }
}

export class AstMember {
  constructor(schema, member, nodeName) {
    this.schema = schema;
    this.member = member;
    this.nodeName = nodeName;
  }

  get name() { return this.member.name; }

  // Inherited members may omit type/list/optional; they then take the base
  // field's value (schema.ts `inheritedField` semantics).
  get _baseField() {
    if (this._baseFieldCache !== undefined) return this._baseFieldCache || undefined;
    if (this.inherited && this.nodeName) {
      this._baseFieldCache = this.schema.inheritedField(this.name, this.nodeName) || null;
    } else {
      this._baseFieldCache = null;
    }
    return this._baseFieldCache || undefined;
  }

  get rawType() {
    if (this.member.type !== undefined) return this.member.type;
    const bf = this._baseField;
    if (bf) return bf.rawType;
    return this.member.type;
  }

  get listKind() {
    if (this.member.list !== undefined) return this.member.list;
    if (this.inherited) {
      const bf = this._baseField;
      if (bf) return bf.listKind;
    }
    return this.member.list;
  }

  get optional() {
    if (this.member.optional !== undefined) return this.member.optional === true;
    const bf = this._baseField;
    if (bf) return bf.optional;
    return false;
  }
  get inherited() { return this.member.inherited === true; }
  get private() { return this.member.private === true; }
  get goOnly() { return this.member.goOnly === true; }
  get noGo() { return this.member.noGo === true; }
  get bitmask() { return this.member.bitmask; }
  get visit() {
    if (this.member.visit !== undefined) return this.member.visit;
    const bf = this._baseField;
    if (bf) return bf.visit;
    return undefined;
  }
  // goOnly implies noTS; explicit noTS honored.
  get noTS() { return this.goOnly || this.member.noTS === true; }
  // goOnly implies noFactory; explicit noFactory honored.
  get noFactory() { return this.goOnly || this.member.noFactory === true; }

  isKindParam() {
    if (this.name !== "Kind" && this.name !== "kind") return false;
    const t = this.rawType;
    // Type-parameter Kind (e.g. Token<TKind>): resolve to its constraint.
    if (!Array.isArray(t) && this.nodeName) {
      const tps = this.schema.definitions[this.nodeName].typeParameters || [];
      const tp = tps.find((p) => p.name === t);
      if (tp) return this.schema._baseKindOf(tp.constraint) === "kind";
    }
    return this.schema._baseKindOf(t) === "kind";
  }

  isChild() {
    // A child is a node or node-list reference. Raw lists of scalars (e.g.
    // JSDocCommentBase.text []string) are NOT children. Mirrors schema.ts
    // isChild: type.baseKind() is "list" (node element) or "node".
    if (this.listKind === "NodeList" || this.listKind === "ModifierList") return true;
    if (this.listKind === "raw") {
      return this.schema._baseKindOf(this.rawType) === "node";
    }
    return this.schema._baseKindOf(this.rawType) === "node";
  }

  tsReference() {
    let raw = this.rawType;
    // Resolve a type-parameter name (e.g. Token<TKind>) to its constraint.
    if (!Array.isArray(raw) && this.nodeName) {
      const tps = this.schema.definitions[this.nodeName].typeParameters || [];
      const tp = tps.find((p) => p.name === raw);
      if (tp) raw = tp.constraint;
    }
    return this.schema.formatTsReference(raw, this.listKind);
  }

  goParamName() {
    const name = this.schema.uncapitalize(this.name);
    if (name === "type") return "typeNode";
    if (name === "default") return "defaultNode";
    if (name === "case") return "caseNode";
    // `arguments` is reserved as a binding name in TS strict mode.
    if (name === "arguments") return "argumentsNodes";
    return name;
  }
}

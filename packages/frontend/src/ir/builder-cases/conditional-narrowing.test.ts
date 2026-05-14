/**
 * IR Builder tests: Conditional expression narrowing and logical operator narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrBlockStatement,
  IrFunctionDeclaration,
  IrIfStatement,
  IrReturnStatement,
  IrVariableDeclaration,
} from "../types.js";
import { stableIrTypeKey } from "../types/type-ops.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – conditional narrowing", () => {
    it("handles recursive nullish coalescing without exploding union deduplication", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "interface TreeNode {",
            "  value: string;",
            "  next?: TreeNode;",
            "}",
            "",
            "export function pick(",
            "  current: TreeNode | undefined,",
            "  fallback: TreeNode",
            "): TreeNode {",
            "  const selected = current ?? fallback;",
            "  return selected;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const selectedDecl = pickFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "selected"
            )
        );
        expect(selectedDecl).to.not.equal(undefined);
        if (!selectedDecl) return;

        const selectedInit = selectedDecl.declarations[0]?.initializer;
        expect(selectedInit?.kind).to.equal("logical");
        if (!selectedInit || selectedInit.kind !== "logical") return;

        expect(selectedInit.operator).to.equal("??");
        expect(selectedInit.inferredType?.kind).to.equal("referenceType");
        if (selectedInit.inferredType?.kind !== "referenceType") return;

        expect(stableIrTypeKey(selectedInit.inferredType)).to.include(
          "TreeNode"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("collapses constructor-backed nullish fallbacks to the canonical nominal type", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class Page {}",
            "",
            "class Holder {",
            "  page: Page | undefined = undefined;",
            "}",
            "",
            "export function pick(holder: Holder): Page {",
            "  const fallback = new Page();",
            "  const selected = holder.page ?? fallback;",
            "  return selected;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const fallbackDecl = pickFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "fallback"
            )
        );
        expect(fallbackDecl).to.not.equal(undefined);
        if (!fallbackDecl) return;

        const fallbackInit = fallbackDecl.declarations[0]?.initializer;
        expect(fallbackInit?.kind).to.equal("new");
        expect(fallbackInit?.inferredType?.kind).to.equal("referenceType");
        if (
          !fallbackInit ||
          fallbackInit.kind !== "new" ||
          fallbackInit.inferredType?.kind !== "referenceType"
        ) {
          return;
        }

        expect(fallbackInit.inferredType.typeId?.tsName).to.equal("Page");

        const selectedDecl = pickFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "selected"
            )
        );
        expect(selectedDecl).to.not.equal(undefined);
        if (!selectedDecl) return;

        const selectedInit = selectedDecl.declarations[0]?.initializer;
        expect(selectedInit?.kind).to.equal("logical");
        if (!selectedInit || selectedInit.kind !== "logical") return;

        expect(selectedInit.operator).to.equal("??");
        expect(selectedInit.inferredType?.kind).to.equal("referenceType");
        if (selectedInit.inferredType?.kind !== "referenceType") return;

        expect(selectedInit.inferredType.typeId?.stableId).to.equal(
          fallbackInit.inferredType.typeId?.stableId
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("handles recursive generic property access without exploding type-id attachment", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare class Map<K, V> {",
            "  get(key: K): V | undefined;",
            "}",
            "",
            "interface PageContext {",
            "  relPermalink: string;",
            "  site: SiteContext;",
            "}",
            "",
            "interface SiteContext {",
            "  Taxonomies: Map<string, Map<string, PageContext[]>>;",
            "  home?: PageContext;",
            "}",
            "",
            "class TaxonomiesValue {",
            "  site: SiteContext;",
            "  constructor(site: SiteContext) {",
            "    this.site = site;",
            "  }",
            "}",
            "",
            "class TaxonomyTermsValue {",
            "  terms: Map<string, PageContext[]>;",
            "  site: SiteContext;",
            "  constructor(terms: Map<string, PageContext[]>, site: SiteContext) {",
            "    this.terms = terms;",
            "    this.site = site;",
            "  }",
            "}",
            "",
            "type TemplateValue = TaxonomiesValue | TaxonomyTermsValue | undefined;",
            "",
            "export function resolve(",
            "  cur: TemplateValue,",
            "  seg: string",
            "): TemplateValue {",
            "  if (cur instanceof TaxonomiesValue) {",
            "    const site = cur.site;",
            "    const terms =",
            "      site.Taxonomies.get(seg) ??",
            "      site.Taxonomies.get(seg.toLowerCase());",
            "    cur = terms !== undefined",
            "      ? new TaxonomyTermsValue(terms, site)",
            "      : undefined;",
            "  }",
            "  return cur;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const resolveFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "resolve"
        );
        expect(resolveFn).to.not.equal(undefined);
        if (!resolveFn) return;

        const branch = resolveFn.body.statements.find(
          (stmt): stmt is IrIfStatement => stmt.kind === "ifStatement"
        );
        expect(branch).to.not.equal(undefined);
        if (!branch) return;

        expect(branch.thenStatement.kind).to.equal("blockStatement");
        if (branch.thenStatement.kind !== "blockStatement") return;

        const thenBlock: IrBlockStatement = branch.thenStatement;
        const termsDecl = thenBlock.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "terms"
            )
        );
        expect(termsDecl).to.not.equal(undefined);
        if (!termsDecl) return;

        const termsInit = termsDecl.declarations[0]?.initializer;
        expect(termsInit?.kind).to.equal("logical");
        if (!termsInit || termsInit.kind !== "logical") return;

        expect(termsInit.operator).to.equal("??");
        expect(termsInit.inferredType?.kind).to.equal("unionType");
        if (
          !termsInit.inferredType ||
          termsInit.inferredType.kind !== "unionType"
        ) {
          return;
        }

        const mapMember = termsInit.inferredType.types.find(
          (
            type
          ): type is Extract<
            (typeof termsInit.inferredType.types)[number],
            { kind: "referenceType" }
          > => type.kind === "referenceType" && type.name === "Map"
        );
        expect(mapMember).to.not.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("records frontend branch proof facts for typeof fallthrough", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function classify(value: string | number | undefined): int {",
            '  if (typeof value === "string") {',
            "    return 1;",
            "  }",
            "  return 0;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const classifyFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "classify"
        );
        expect(classifyFn).to.not.equal(undefined);
        if (!classifyFn) return;

        const branch = classifyFn.body.statements.find(
          (stmt): stmt is IrIfStatement => stmt.kind === "ifStatement"
        );
        expect(branch).to.not.equal(undefined);
        if (!branch) return;

        expect(branch.thenPlan.narrowedBindings[0]?.bindingKey).to.equal(
          "value"
        );
        expect(branch.thenPlan.narrowedBindings[0]?.targetType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(branch.elsePlan.narrowedBindings[0]?.bindingKey).to.equal(
          "value"
        );
        expect(branch.elsePlan.narrowedBindings[0]?.targetType.kind).to.equal(
          "unionType"
        );
        if (
          branch.elsePlan.narrowedBindings[0]?.targetType.kind !== "unionType"
        ) {
          return;
        }
        expect(
          branch.elsePlan.narrowedBindings[0].targetType.types.some(
            (type) => type.kind === "primitiveType" && type.name === "string"
          )
        ).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers the assignable common nominal supertype for conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class TemplateValue {}",
            "class PageValue extends TemplateValue {",
            "  slug: string;",
            "  constructor(slug: string) {",
            "    super();",
            "    this.slug = slug;",
            "  }",
            "}",
            "declare function resolve(): TemplateValue;",
            "export function pick(flag: boolean): TemplateValue {",
            '  const actual = flag ? new PageValue("home") : resolve();',
            "  return actual;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const returnStmt = pickFn.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.inferredType?.kind).to.equal(
          "referenceType"
        );
        if (returnStmt?.expression?.inferredType?.kind !== "referenceType") {
          return;
        }
        expect(stableIrTypeKey(returnStmt.expression.inferredType)).to.include(
          "TemplateValue"
        );
      } finally {
        fixture.cleanup();
      }
    });
  });
});

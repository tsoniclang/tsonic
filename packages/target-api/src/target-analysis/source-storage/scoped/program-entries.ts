import type { Node } from "@tsonic/tsts";
import { Node_Initializer, VariableDeclarationList_Declarations, VariableStatement_DeclarationList } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageTerm } from "../graph/scoped-model.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";

// Whole-program execution starts in every checked source file and in the body of every exported callable, which a
// caller outside the program may run (RULINGS 2026-10-23). An exported body runs in its declaration activation, whose
// parameters and receiver are the symbolic external inputs, so its writes are possible effects of the program.
export function createSourceStorageProgramEntries(source: TargetSourceProgram, transport: SourceStorageScopedTransport,
  scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, step: () => boolean) {
  const { ast, navigation } = source;
  let entries: readonly { readonly region: Node; readonly owner?: Node }[] | undefined;
  const collect = (): typeof entries => {
    const regions: { readonly region: Node; readonly owner?: Node }[] = [];
    const exported = (declaration: Node): boolean => navigation.declarationUseSummary(declaration).exported;
    const entry = (callable: Node): void => {
      for (const region of transport.regions.callable(callable, undefined)) regions.push(Object.freeze({ region, owner: callable }));
    };
    for (const file of transport.sourceFiles) {
      if (!step()) return undefined;
      if (file.IsDeclarationFile) continue;
      regions.push(Object.freeze({ region: file }));
      for (const statement of ast.statements(file)) {
        if (statement === undefined || !step()) continue;
        if (ast.is.IsFunctionDeclaration(statement) && ast.body(statement) !== undefined && exported(statement)) entry(statement);
        else if (ast.is.IsClassDeclaration(statement) && exported(statement)) {
          for (const member of ast.members(statement)) {
            if (member === undefined || !step()) continue;
            if (ast.body(member) === undefined || ast.hasModifierKind(member, "private")) continue;
            if (ast.is.IsConstructorDeclaration(member) || ast.is.IsMethodDeclaration(member) ||
              ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) entry(member);
          }
        } else if (ast.is.IsVariableStatement(statement)) {
          for (const declaration of VariableDeclarationList_Declarations(ast, VariableStatement_DeclarationList(ast, statement)) ?? []) {
            if (declaration === undefined || !step() || !exported(declaration)) continue;
            const initializer = Node_Initializer(ast, declaration);
            if (initializer !== undefined && (ast.is.IsArrowFunction(initializer) || ast.is.IsFunctionExpression(initializer))) entry(initializer);
          }
        }
      }
    }
    return Object.freeze(regions);
  };
  // The region terms of every program entry that reaches the execution root's demand.
  return (term: Extract<SourceStorageTerm, { readonly kind: "execution-root" }>): SourceStorageTerm[] | undefined => {
    entries ??= collect();
    if (entries === undefined) return undefined;
    const terms: SourceStorageTerm[] = [];
    for (const { region, owner } of entries) {
      const reaches = reachability.region(region, term.demand);
      const scope = owner === undefined ? scopes.empty : scopes.declarationFor(owner, scopes.empty);
      if (reaches === undefined || scope === undefined) return undefined;
      if (reaches) terms.push(Object.freeze({ kind: "region", region, scope, demand: term.demand, deferred: term.deferred }));
    }
    return terms;
  };
}

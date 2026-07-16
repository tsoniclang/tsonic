# Host Strict Schema-Cast Audit

## Contract

Generated `ast.as.AsX` functions are schema casts. They are valid only after an exact `ast.is.IsX` predicate proves the node kind. They are not null-safe casts, type guards, or structural probes.

Static ESM dependency classification is owned by `packages/host/src/analysis/module-reference.ts`. Project dependency analysis and capability activation consume that one classification result.

## Source-Level Contract

```ts
import "./setup.js";
import type { Shape } from "./types.js";
import DefaultValue, { type Shape as DefaultShape } from "./mixed.js";
export { type Shape as PublicShape } from "./types.js";
export * from "./runtime.js";
```

The host classifies `setup.js`, `mixed.js`, and `runtime.js` as runtime edges. It classifies the two type-only references as static semantic inputs without runtime edges. The live default binding in the mixed import prevents erasure.

## Occurrence Inventory

| File | Function | Cast | Purpose | Classification | Action | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| `analysis/module-reference.ts` | `getStaticModuleReference` | `AsImportDeclaration` | Read a proven import declaration | Exact-predicate schema cast | Centralized from both consumers | Classification matrix + cast scanner |
| `analysis/module-reference.ts` | `getStaticModuleReference` | `AsExportDeclaration` | Read a proven export declaration | Exact-predicate schema cast | Centralized from both consumers | Classification matrix + cast scanner |
| `analysis/module-reference.ts` | `importHasRuntimeValue` | `AsImportClause` | Read a present, proven import clause | Exact-predicate schema cast | Reject predicate/cast disagreement | Classification matrix + cast scanner |
| `analysis/project-source.ts` | `getBaseClassReferenceNode` | `AsExpressionWithTypeArguments` | Read a proven heritage element | Exact-predicate schema cast | Added exact child-kind proof | Cast scanner |
| `analysis/project-source.ts` | `getImportedModuleExport` | `AsImportDeclaration` | Read the proven ancestor import | Exact-predicate schema cast | Missing ancestor now returns no imported reference | Cast scanner + module graph tests |
| `analysis/project-source.ts` | `getImportedExportName` | `AsImportClause` | Identify a proven default import binding | Exact-predicate schema cast | Retained with explicit predicate | Cast scanner |
| `analysis/project-source.ts` | `getImportedExportName` | `AsImportSpecifier` | Read a proven named import binding | Exact-predicate schema cast | Retained with explicit predicate | Cast scanner |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsVariableDeclaration` | Read an authored variable type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsParameterDeclaration` | Read an authored parameter type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsTypeAliasDeclaration` | Read a type-alias body | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + type-form tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsPropertyDeclaration` | Read an authored property type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + declaration tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsPropertySignatureDeclaration` | Read an authored property-signature type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + object-shape tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsMethodDeclaration` | Read a method return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + call-carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsMethodSignatureDeclaration` | Read a method-signature return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + call-carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsFunctionDeclaration` | Read a function return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + call-carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsFunctionExpression` | Read a function-expression return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + call-carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsArrowFunction` | Read an arrow return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + call-carrier tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsCallSignatureDeclaration` | Read a call-signature return type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + callable tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsConstructSignatureDeclaration` | Read a construct-signature result type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + constructor tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsGetAccessorDeclaration` | Read a getter result type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + property tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsSetAccessorDeclaration` | Read a setter annotation | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + property tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsIndexSignatureDeclaration` | Read an index-signature result type | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + element-access tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsFunctionTypeNode` | Read a function-type result | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + callable tests |
| `analysis/project-source.ts` | `getDeclarationTypeNode` | `AsConstructorTypeNode` | Read a constructor-type result | Exact-predicate schema cast | Replaced wrong-kind probing chain | Cast scanner + constructor tests |
| `analysis/project-source.ts` | `getDeclarationCarrierSubject` | `AsVariableDeclaration` | Read a proven variable initializer | Exact-predicate schema cast | Replaced raw structural field probing | Cast scanner + carrier tests |
| `analysis/project-source.ts` | `getDeclarationCarrierSubject` | `AsParameterDeclaration` | Read a proven parameter initializer | Exact-predicate schema cast | Replaced raw structural field probing | Cast scanner + carrier tests |
| `analysis/project-source.ts` | `getDeclarationCarrierSubject` | `AsPropertyDeclaration` | Read a proven property initializer | Exact-predicate schema cast | Replaced raw structural field probing | Cast scanner + carrier tests |
| `analysis/symbols.ts` | `getReferenceQueryNode` | `AsTypeReferenceNode` | Read a proven type reference name | Exact-predicate schema cast | Retained | Cast scanner + source analysis tests |
| `analysis/symbols.ts` | `getReferenceQueryNode` | `AsExpressionWithTypeArguments` | Read a proven heritage reference | Exact-predicate schema cast | Retained | Cast scanner + heritage tests |
| `analysis/symbols.ts` | `isTypeReferenceQuery` | `AsTypeReferenceNode` | Compare a proven parent type reference | Exact-predicate schema cast | Retained | Cast scanner + type-form tests |
| `target-facts/runtime-carriers.ts` | `getProjectSourceCallReturnCarrier` | `AsCallExpression` | Read a proven call callee | Exact-predicate schema cast | Retained | Cast scanner + call-carrier tests |
| `target-facts/runtime-carriers.ts` | `getProjectSourceConstructionCarrier` | `AsNewExpression` | Read a proven constructor expression | Exact-predicate schema cast | Retained | Cast scanner + constructor tests |
| `target-facts/runtime-carriers.ts` | `getProjectSourceCallTypeParameterSubstitutions` | `AsPropertyAccessExpression` | Read a receiver only for a proven property-access callee | Exact-predicate schema cast | Added exact callee-kind proof | Cast scanner + generic-call tests |

## Removed Invalid Classes

- Eleven duplicated import/export casts were removed from project dependency analysis and capability activation.
- The absent side-effect-import clause is never cast.
- A default binding is checked before inline type-only named bindings, so a live default import cannot be erased.
- Seventeen declaration casts no longer probe arbitrary nodes in a null-coalescing chain.
- Declaration carrier discovery no longer reads raw `Type` or `Initializer` fields through structural object casts.
- An arbitrary call callee is no longer cast to a property access.

## Mechanical Gates

- `test/cli/module-reference-classification.test.mjs` applies one 17-row import/export matrix to project dependencies and capability activation.
- `test/host-schema-cast-architecture.test.mjs` inventories all 33 remaining generated casts and requires an exact local predicate for every occurrence.
- The architecture gate bans duplicate import-classification helpers in both consumers.

/**
 * ImportClassifier — categorizes imports for backend-specific handling.
 *
 * Plan-black: type-only forward declaration. No code imports this.
 * Plan-beta: used by the backend adapter to classify imports before
 *            emitting language-specific import statements.
 */

import type { IrImport } from "@tsonic/frontend";

/**
 * Classification of an import for backend emission.
 */
export type ImportClassification =
  | { readonly kind: "clrNamespace"; readonly namespace: string }
  | { readonly kind: "localModule"; readonly modulePath: string }
  | { readonly kind: "external"; readonly packageName: string }
  | { readonly kind: "builtin" };

/**
 * Classifies imports into categories that backends can handle differently.
 *
 * C# backend:  clrNamespace → `using Namespace;`
 *              localModule → file-level dependency
 *              external → package reference
 *
 * Future backends would map these categories to their own import systems.
 */
export type ImportClassifier = {
  readonly classify: (imp: IrImport) => ImportClassification;
};

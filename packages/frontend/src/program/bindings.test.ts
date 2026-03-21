/**
 * Binding system tests — split into topic modules under bindings-cases/.
 *
 *   registry-basics.test.ts              — add / retrieve / clear / case-insensitive
 *   registry-member-resolution.test.ts   — overloads, CLR name, alias, extension methods
 *   load-bindings.test.ts                — filesystem manifest loading & transitive deps
 *   dotnet-payload-boundaries.test.ts    — semantic surface vs dotnet payload helpers
 *   hierarchical-and-type-semantics.test.ts — hierarchical manifests, type semantics, emitter map
 */

import "./bindings-cases/registry-basics.test.js";
import "./bindings-cases/registry-member-resolution.test.js";
import "./bindings-cases/load-bindings.test.js";
import "./bindings-cases/dotnet-payload-boundaries.test.js";
import "./bindings-cases/hierarchical-and-type-semantics.test.js";

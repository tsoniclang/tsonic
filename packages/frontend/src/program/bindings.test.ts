/**
 * Binding system tests — split into topic modules under bindings-tests/.
 *
 *   registry-basics.test.ts              — add / retrieve / clear / case-insensitive
 *   registry-member-resolution.test.ts   — overloads, CLR name, alias, extension methods
 *   load-bindings.test.ts                — filesystem manifest loading & transitive deps
 *   hierarchical-and-type-semantics.test.ts — hierarchical manifests, type semantics, emitter map
 */

import "./bindings-tests/registry-basics.test.js";
import "./bindings-tests/registry-member-resolution.test.js";
import "./bindings-tests/load-bindings.test.js";
import "./bindings-tests/hierarchical-and-type-semantics.test.js";

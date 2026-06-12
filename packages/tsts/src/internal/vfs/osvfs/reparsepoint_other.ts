import type { bool } from "@tsonic/core/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/reparsepoint_other.go::varGroup::isReparsePoint","kind":"varGroup","status":"implemented","sigHash":"f0026c2c464e814022e423d5a87a1849cc69e9f3a35d6da1599ecc00e15c07b9","bodyHash":"69d832eeb95fa9e743f3ab3a086fd902aeabd292247b0965c5d798759caba9df"}
 *
 * Go source:
 * var isReparsePoint func(path string) bool
 */
// Only Windows has reparse points; leave this nil (undefined) for other OSes.
export const isReparsePoint: ((path: string) => bool) | undefined = undefined;

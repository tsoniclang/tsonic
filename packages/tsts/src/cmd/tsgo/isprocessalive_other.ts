import type { bool, int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_other.go::constGroup::processAliveSupported","kind":"constGroup","status":"implemented","sigHash":"cb51e9ea32c184706a4d2cd1cbcad16927646693ac9daad79dd8eb56c7420775","bodyHash":"ebacb25a7545c4613440e40dcccf6d56eb491b3bbb2f2f25846047238f0dd6af"}
 *
 * Go source:
 * const processAliveSupported = false
 */
export const processAliveSupported: bool = false as bool;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_other.go::func::isProcessAlive","kind":"func","status":"implemented","sigHash":"d83dcd73cfb8598c099bef25fb8d571025714373dcb22b5c28c415df37df9719","bodyHash":"0dd786ef234dc2c1c83cf80dd298c970ff2255dbc8a199803103dc2c60f1aac1"}
 *
 * Go source:
 * func isProcessAlive(pid int) bool {
 * 	panic("isProcessAlive is not supported on this platform")
 * }
 */
export function isProcessAlive(pid: int): bool {
  throw new globalThis.Error("isProcessAlive is not supported on this platform");
}

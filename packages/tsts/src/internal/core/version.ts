import { IndexFunc } from "../../go/strings.js";
import type { GoRune } from "../../go/compat.js";

// Go strings are immutable UTF-8 byte sequences; `s[:i]` slices on byte offsets.
// strings.IndexFunc returns a byte offset, so we mirror that contract by operating
// over the UTF-8 byte view and converting back to a JS string at the boundary.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteSlice = (s: string, start: number, end?: number): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/version.go::varGroup::version","kind":"varGroup","status":"implemented","sigHash":"6f15dc9e15411aaf131338261dfeb142ae032283be7bc55a54627293a6bd499c","bodyHash":"d8937f57191d9a6434c24f04c09ddd1053d5dfadb4b245761eb4c4494785d1dc"}
 *
 * Go source:
 * var version = "7.0.0-dev"
 */
export let version: string = "7.0.0-dev";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/version.go::func::Version","kind":"func","status":"implemented","sigHash":"435e58b2449ff60065ece1684ead65c3df1b87879148e0860f1a39af178c5a13","bodyHash":"13b7928d416beeb7d5657b12aec9258b2b090014f1c5485383b894a8d13b90e3"}
 *
 * Go source:
 * func Version() string {
 * 	return version
 * }
 */
export function Version(): string {
  return version;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/version.go::varGroup::versionMajorMinor","kind":"varGroup","status":"implemented","sigHash":"49f478012f30fa571d31ebacfa976aeb091faf6c13f2307eada0f0bcc8654bde","bodyHash":"71209ef9bb8341ee82d10a617294c8a2103ada6d6353249682d0d6972ff44cfb"}
 *
 * Go source:
 * var versionMajorMinor = func() string {
 * 	seenMajor := false
 * 	i := strings.IndexFunc(version, func(r rune) bool {
 * 		if r == '.' {
 * 			if seenMajor {
 * 				return true
 * 			}
 * 			seenMajor = true
 * 		}
 * 		return false
 * 	})
 * 	if i == -1 {
 * 		panic("invalid version string: " + version)
 * 	}
 * 	return version[:i]
 * }()
 */
export let versionMajorMinor: string = ((): string => {
  let seenMajor = false;
  const i = IndexFunc(version, (r: GoRune): boolean => {
    if (r === 0x2e /* '.' */) {
      if (seenMajor) {
        return true;
      }
      seenMajor = true;
    }
    return false;
  });
  if (i === -1) {
    throw new globalThis.Error("invalid version string: " + version);
  }
  return byteSlice(version, 0, i);
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/version.go::func::VersionMajorMinor","kind":"func","status":"implemented","sigHash":"54f3fbae55818abc6b74aa3cb73b7de994e9a3fcd7f43566c4da620e2b8735a4","bodyHash":"de80e1e8f889e396f18138cd6c448fcbe5939d62b649914de4940c6849456b31"}
 *
 * Go source:
 * func VersionMajorMinor() string {
 * 	return versionMajorMinor
 * }
 */
export function VersionMajorMinor(): string {
  return versionMajorMinor;
}

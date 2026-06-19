import type { bool } from "../../go/scalars.js";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { FS } from "../vfs/vfs.js";
import { embedded, wrapFS, libPath } from "./embed.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::constGroup::Embedded","kind":"constGroup","status":"implemented","sigHash":"f83bb3a895de36d262628c2ffa89238eeb5aeda78485d347176df8c732d05e94","bodyHash":"c0c88de3f5fa3856e1b5d7df4b38835b244b4e3f4a34b5c6b85ea4276e844d05"}
 *
 * Go source:
 * const Embedded = embedded
 */
export const Embedded: bool = embedded;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::func::WrapFS","kind":"func","status":"implemented","sigHash":"fbf63e8f5730e4d4ad448c39a6c9dda36bacb6620125539a16dba50e8b31bd5b","bodyHash":"64205eed3f120c5e605fb6e96d5ddc64e4b7ca2609e468b84f54535bd9d748ca"}
 *
 * Go source:
 * func WrapFS(fs vfs.FS) vfs.FS {
 * 	return wrapFS(fs)
 * }
 */
export function WrapFS(fs: FS): FS {
  return wrapFS(fs);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::func::LibPath","kind":"func","status":"implemented","sigHash":"9a8bb91147a81a624745284df1b9a8267be434906aaaaebb60cd8f93f5e43e9e","bodyHash":"42ee928c425567b9bac8a8ccb258870acbf8c7e42342d3f325134bfd0718cebc"}
 *
 * Go source:
 * func LibPath() string {
 * 	return libPath()
 * }
 */
export function LibPath(): string {
  return libPath();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::varGroup::bundledSourceDir","kind":"varGroup","status":"implemented","sigHash":"b04d87ddb555f4f8ab4973fdb51e25a7181608b9b4ed6b381d65b9c27c293de1","bodyHash":"1afe1a7d5b5a23cb62cadfb28bc42e133b78ac4345432515b8ec6dea78cddddf"}
 *
 * Go source:
 * var bundledSourceDir = sync.OnceValue(func() string {
 * 	_, filename, _, ok := runtime.Caller(0)
 * 	if !ok {
 * 		panic("bundled: could not get current filename")
 * 	}
 * 	return filepath.Dir(filepath.FromSlash(filename))
 * })
 */
export const bundledSourceDir: () => string = (() => {
  let value: string | undefined;
  return (): string => {
    if (value === undefined) {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      if (existsSync(path.join(dir, "libs"))) {
        value = dir;
      } else {
        const sourceDir = path.resolve(dir, "../../../../src/internal/bundled");
        value = existsSync(path.join(sourceDir, "libs")) ? sourceDir : dir;
      }
    }
    return value;
  };
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::varGroup::testingLibPath","kind":"varGroup","status":"implemented","sigHash":"ae9c824e9f3290815693dc17b3238b5880e487333e8412ef76295efaa320ebbe","bodyHash":"5d62285376c54a8572ae6d31b9f99a3aee5ecd1901c8df08f73e7f49ff21f53b"}
 *
 * Go source:
 * var testingLibPath = sync.OnceValue(func() string {
 * 	if !testing.Testing() {
 * 		panic("bundled: TestingLibPath should only be called during tests")
 * 	}
 * 	return tspath.NormalizeSlashes(filepath.Join(bundledSourceDir(), "libs"))
 * })
 */
export const testingLibPath: () => string = (() => {
  let value: string | undefined;
  return (): string => {
    value ??= path.join(bundledSourceDir(), "libs").replaceAll(path.sep, "/");
    return value;
  };
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/bundled.go::func::TestingLibPath","kind":"func","status":"implemented","sigHash":"ba7ce2ebda507afa53f7209bee1e8a78eaa40816a03b43b1e4b5aca77cea70b4","bodyHash":"7e27d547d53c817b225620915e89b5f7fe053a36aa36b6249c34652f03147aaa"}
 *
 * Go source:
 * func TestingLibPath() string {
 * 	return testingLibPath()
 * }
 */
export function TestingLibPath(): string {
  return testingLibPath();
}

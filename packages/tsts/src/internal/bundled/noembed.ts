import type { bool } from "../../go/scalars.js";
import type { FS } from "../vfs/vfs.js";
import { FS as OSFS } from "../vfs/osvfs/os.js";
import { CombinePaths, GetDirectoryPath, NormalizeSlashes } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/noembed.go::constGroup::embedded","kind":"constGroup","status":"implemented","sigHash":"4c71f07d139be967c63073fca793530940c74775bb8902e2816a1d12ec2bd08f","bodyHash":"9a61ddb70a4ccfb4a2047d3232fa5c524b2ebe4fd07fa651c76d5c20fb8f27c3"}
 *
 * Go source:
 * const embedded = false
 */
export const embedded: bool = false;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/noembed.go::func::wrapFS","kind":"func","status":"implemented","sigHash":"47cfe8da7e0cd5cc2c1c0216f3222db8d8e58c9f41164fe2c18174a5c0f956af","bodyHash":"eba5f6fe07a2682b79de13b7191aa337e043f5aa938d0fefe1f00044ff37ff4f"}
 *
 * Go source:
 * func wrapFS(fs vfs.FS) vfs.FS {
 * 	return fs
 * }
 */
export function wrapFS(fs: FS): FS {
  return fs;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/noembed.go::varGroup::executableDir","kind":"varGroup","status":"implemented","sigHash":"aa8e3ebfca7d9cccb7ab7ee05165d0f86d20f1ef76c330b62a12e5bcba7feaf9","bodyHash":"1c4791ecc0bf4e25207c73785b83638b9b67990b9ce569bda195ded6ab995441"}
 *
 * Go source:
 * var executableDir = sync.OnceValue(func() string {
 * 	exe, err := os.Executable()
 * 	if err != nil {
 * 		panic(fmt.Sprintf("bundled: failed to get executable path: %v", err))
 * 	}
 * 	exe = tspath.NormalizeSlashes(exe)
 * 	exe = osvfs.FS().Realpath(exe)
 * 	return tspath.GetDirectoryPath(exe)
 * })
 */
export const executableDir: () => string = (() => {
  let value: string | undefined;
  return (): string => {
    value ??= GetDirectoryPath(OSFS().Realpath(NormalizeSlashes(process.execPath)));
    return value;
  };
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/noembed.go::varGroup::libPath","kind":"varGroup","status":"implemented","sigHash":"ad0b589440958694bb78420c9845cb5295abbbd5d5d968a09b8ae66a4d24a2c9","bodyHash":"0805855c17fc690731ad6e7d79f21032892bcbd537bf8726c27fa086d4d5d613"}
 *
 * Go source:
 * var libPath = sync.OnceValue(func() string {
 * 	if testing.Testing() {
 * 		return TestingLibPath()
 * 	}
 * 	dir := executableDir()
 * 
 * 	libdts := tspath.CombinePaths(dir, "lib.d.ts")
 * 	if info := osvfs.FS().Stat(libdts); info == nil {
 * 		panic(fmt.Sprintf("bundled: %v does not exist; this executable may be misplaced", libdts))
 * 	}
 * 
 * 	return dir
 * })
 */
export const libPath: () => string = (() => {
  let value: string | undefined;
  return (): string => {
    if (value === undefined) {
      const dir = executableDir();
      const libdts = CombinePaths(dir, "lib.d.ts");
      if (OSFS().Stat(libdts) === undefined) {
        throw new globalThis.Error(`bundled: ${libdts} does not exist; this executable may be misplaced`);
      }
      value = dir;
    }
    return value;
  };
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/noembed.go::func::IsBundled","kind":"func","status":"implemented","sigHash":"3f477cfe9b05ddb51898d09813758cfacd213c1117616d19ee277dc5e15bc096","bodyHash":"32c3a58a00840e7606f6509147666c8f4aa09fe7f4739623db7a60216c09ca3f"}
 *
 * Go source:
 * func IsBundled(path string) bool {
 * 	return false
 * }
 */
export function IsBundled(_path: string): bool {
  return false;
}

import type { bool } from "../../go/scalars.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

function onceValue<T>(factory: () => T): () => T {
  let initialized = false;
  let value: T;
  return (): T => {
    if (!initialized) {
      value = factory();
      initialized = true;
    }
    return value;
  };
}

function statPath(path: string): { isFile(): bool; isDirectory(): bool } | undefined {
  try {
    return statSync(path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::varGroup::rootPath","kind":"varGroup","status":"implemented","sigHash":"d779ea1d3c4911edb0463e1b8f631ae2a0b3806c6524016734a195df1e74e654","bodyHash":"625b948e50dd3e9029ecdfe2b0f73846f9ad349bd65ef018ef551cd00a05606f"}
 *
 * Go source:
 * var rootPath = sync.OnceValue(func() string {
 * 	_, filename, _, ok := runtime.Caller(0)
 * 	if !ok {
 * 		panic("could not get current filename")
 * 	}
 * 	filename = filepath.FromSlash(filename) // runtime.Caller always returns forward slashes; https://go.dev/issues/3335, https://go.dev/cl/603275
 * 
 * 	if strings.HasPrefix(filename, "github.com/") {
 * 		panic("repo root cannot be found when built with -trimpath")
 * 	}
 * 
 * 	if !filepath.IsAbs(filename) {
 * 		panic(filename + " is not an absolute path")
 * 	}
 * 
 * 	root := filepath.VolumeName(filename) + string(filepath.Separator)
 * 
 * 	dir := filepath.Dir(filename)
 * 	for {
 * 		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
 * 			return dir
 * 		}
 * 		if dir == root {
 * 			break
 * 		}
 * 		dir = filepath.Dir(dir)
 * 	}
 * 
 * 	panic("could not find go.mod above " + filename)
 * })
 */
export const rootPath: () => string = onceValue((): string => {
  const filename = fileURLToPath(import.meta.url);
  let dir = dirname(filename);
  for (;;) {
    const candidate = join(dir, "_vendor", "typescript-go");
    if (statPath(join(candidate, "go.mod"))?.isFile()) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new globalThis.Error("could not find pinned TS-Go root above " + filename);
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::func::RootPath","kind":"func","status":"implemented","sigHash":"25eabb046687ed118017fa3f0ed296e235701fbc559ebb753551a3f79b8465d5","bodyHash":"315c05883fb1675f7c7ee1758a228dd23bdf5d382d294f1a42ca1c8dce2b6b0b"}
 *
 * Go source:
 * func RootPath() string {
 * 	return rootPath()
 * }
 */
export function RootPath(): string {
  return rootPath();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::varGroup::typeScriptSubmodulePath","kind":"varGroup","status":"implemented","sigHash":"91cb05fb38dd4f01e4117c39aeedd05fd5b2e602e53755707615426e93fa012e","bodyHash":"8ec5dd4b53d452aa3b2a854bbb02fb004f7a62865ef0f0a4dbfbd6bce4a3c486"}
 *
 * Go source:
 * var typeScriptSubmodulePath = sync.OnceValue(func() string {
 * 	return filepath.Join(rootPath(), "_submodules", "TypeScript")
 * })
 */
export const typeScriptSubmodulePath: () => string = onceValue((): string => {
  return join(rootPath(), "_submodules", "TypeScript");
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::func::TypeScriptSubmodulePath","kind":"func","status":"implemented","sigHash":"5dedbac102d94ff7892b0c21a535de701ccb5467e95f58e05cdff68b37cd002d","bodyHash":"ee4d827a7b3e436ea9b8661abc1873939811852ba09ee20a3e60e6678040ff39"}
 *
 * Go source:
 * func TypeScriptSubmodulePath() string {
 * 	return typeScriptSubmodulePath()
 * }
 */
export function TypeScriptSubmodulePath(): string {
  return typeScriptSubmodulePath();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::varGroup::testDataPath","kind":"varGroup","status":"implemented","sigHash":"e0df8ed1166ac3b7f5dd5cbeb09fd127aac6d6fb16a175f3f12d50ff29d43db9","bodyHash":"f6d951ba4ab5164a24a2f183461ca6c6c5d27caeb457b6c986e0e950353bb867"}
 *
 * Go source:
 * var testDataPath = sync.OnceValue(func() string {
 * 	return filepath.Join(rootPath(), "testdata")
 * })
 */
export const testDataPath: () => string = onceValue((): string => {
  return join(rootPath(), "testdata");
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::func::TestDataPath","kind":"func","status":"implemented","sigHash":"d5378b1759e3413d0bb5f2afb79ea4be43f7bc2fdef4735a980a63ce687f3e34","bodyHash":"611ec0a58882c07791f71c8a94bbe7843e3bcf727a519dbf179f58fadfdf9f51"}
 *
 * Go source:
 * func TestDataPath() string {
 * 	return testDataPath()
 * }
 */
export function TestDataPath(): string {
  return testDataPath();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::varGroup::typeScriptSubmoduleExists","kind":"varGroup","status":"implemented","sigHash":"cc06eaac839b13cb5cc480c5baa3c1b4cef221b53211155d9dffc93c75b43563","bodyHash":"37c027b54a4bc86cc602bd8e4d8147913db73329845f2ecaf83d98d3b2beb8e6"}
 *
 * Go source:
 * var typeScriptSubmoduleExists = sync.OnceValue(func() bool {
 * 	p := filepath.Join(typeScriptSubmodulePath(), "package.json")
 * 	if _, err := os.Stat(p); err != nil {
 * 		if os.IsNotExist(err) {
 * 			return false
 * 		}
 * 		panic(err)
 * 	}
 * 	return true
 * })
 */
export const typeScriptSubmoduleExists: () => bool = onceValue((): bool => {
  const packageJson = join(typeScriptSubmodulePath(), "package.json");
  return statPath(packageJson)?.isFile() === true;
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::func::TypeScriptSubmoduleExists","kind":"func","status":"implemented","sigHash":"451c0d34479719cd9f459227d93466aedc711f30647c68381e36bab012637fa3","bodyHash":"95026a986eb5ee1dc4f32472fa57363f33828073bffc2123b302d2eaa0b8dabe"}
 *
 * Go source:
 * func TypeScriptSubmoduleExists() bool {
 * 	return typeScriptSubmoduleExists()
 * }
 */
export function TypeScriptSubmoduleExists(): bool {
  return typeScriptSubmoduleExists();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::type::SkippableTest","kind":"type","status":"implemented","sigHash":"923ca98fd2e2042ae4e7c5115cc0f3fa24f09bd06599412aa46d1189da8dbdb6","bodyHash":"8081b7b1514cf9c4e1adcb30e65159a9276fb45f61104bdcd8225cf45f467007"}
 *
 * Go source:
 * SkippableTest interface {
 * 	Helper()
 * 	Skipf(format string, args ...any)
 * }
 */
export interface SkippableTest {
  Helper(): void;
  Skipf(format: string, ...args: Array<unknown>): void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/repo/paths.go::func::SkipIfNoTypeScriptSubmodule","kind":"func","status":"implemented","sigHash":"e0ecd71cc0a337cb4c13b0b543ec5e35f461aca047653d2281ae6155e1619a8d","bodyHash":"7d2974263cbf0bec266d65f8fcc40288e0b6aac9d11dad2000740fc8cf7d96cf"}
 *
 * Go source:
 * func SkipIfNoTypeScriptSubmodule(t SkippableTest) {
 * 	t.Helper()
 * 	if !typeScriptSubmoduleExists() {
 * 		t.Skipf("TypeScript submodule does not exist")
 * 	}
 * }
 */
export function SkipIfNoTypeScriptSubmodule(t: SkippableTest): void {
  t.Helper();
  if (!typeScriptSubmoduleExists()) {
    t.Skipf("TypeScript submodule does not exist");
  }
}

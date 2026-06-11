import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoMap, GoRune, GoSlice } from "../../go/compat.js";
import * as strings from "../../go/strings.js";
import * as cmp from "../../go/cmp.js";
import * as slices from "../../go/slices.js";
import * as unicode from "../../go/unicode.js";
import * as stringutil from "../stringutil/compare.js";

// Byte/char-code constants used for faithful byte-level path inspection.
// Go indexes path strings by byte; this port indexes the equivalent code unit
// via charCodeAt and compares against these constants.
const CHAR_SLASH: int = 0x2f; // '/'
const CHAR_BACKSLASH: int = 0x5c; // '\\'
const CHAR_COLON: int = 0x3a; // ':'
const CHAR_PERCENT: int = 0x25; // '%'
const CHAR_DOT: int = 0x2e; // '.'
const CHAR_CARET: int = 0x5e; // '^'
const CHAR_3: int = 0x33; // '3'
const CHAR_a: int = 0x61; // 'a'
const CHAR_z: int = 0x7a; // 'z'
const CHAR_A: int = 0x41; // 'A'
const CHAR_Z: int = 0x5a; // 'Z'

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::type::Path","kind":"type","status":"implemented","sigHash":"48d9c069b22fce45bb0f6b728f90c9bd60249652541b54ea8ed8cca29efa985b","bodyHash":"9a9832518709a64e2da48d05b97cee0a925eb42e8db882c39201d075958dc410"}
 *
 * Go source:
 * Path string
 */
export type Path = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::constGroup::DirectorySeparator+urlSchemeSeparator","kind":"constGroup","status":"implemented","sigHash":"e2202c0299e4fb0c19de05c0a4f2759e08de2c23fbd0f02c8137bb15134dc17d","bodyHash":"d69be34d2dad0f0c80881f60681c68a980d77a4bc3720dec29001d3f23dda212"}
 *
 * Go source:
 * const (
 * 	DirectorySeparator = '/'
 * 	urlSchemeSeparator = "://"
 * )
 */
export const DirectorySeparator: GoRune = 0x2f; // '/'
export const urlSchemeSeparator: string = "://";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::isAnyDirectorySeparator","kind":"func","status":"implemented","sigHash":"e4f517d188bd478146a128c4d1afe09a12033a2bfb91dbf6582b2cf6d3d6683a","bodyHash":"1f9b8752191511277cd271ba504371830885fcd6980dd315c52a8df207c7171a"}
 *
 * Go source:
 * func isAnyDirectorySeparator(char byte) bool {
 * 	return char == '/' || char == '\\'
 * }
 */
export function isAnyDirectorySeparator(char: byte): bool {
  return char === CHAR_SLASH || char === CHAR_BACKSLASH;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsUrl","kind":"func","status":"implemented","sigHash":"ba5ed813e6938c9eaaf3db3757300a49a573a025d2d45c5260ba77eaf4562585","bodyHash":"2b3427cd6879b238004a26551afe06949fbe1645c0e1446ded0d16ea7f3f7a02"}
 *
 * Go source:
 * func IsUrl(path string) bool {
 * 	return GetEncodedRootLength(path) < 0
 * }
 */
export function IsUrl(path: string): bool {
  return GetEncodedRootLength(path) < 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsRootedDiskPath","kind":"func","status":"implemented","sigHash":"3177572f6dd378edfb8f72b06add9145b24473f6235569dfa1a28f8016fd5efe","bodyHash":"a2dd413dccfc2e2e1227c1467d25e4f414b15042b39acf2192358b30d5fe2aa5"}
 *
 * Go source:
 * func IsRootedDiskPath(path string) bool {
 * 	return GetEncodedRootLength(path) > 0
 * }
 */
export function IsRootedDiskPath(path: string): bool {
  return GetEncodedRootLength(path) > 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsDiskPathRoot","kind":"func","status":"implemented","sigHash":"b13231f54d10ea7d76a88c7a830e7d80b2b37cee3efb172d3164b084bc50ca88","bodyHash":"7be18827c6c3ae24aea0aa8063a3d4fb4e8f1f613fa7d39421144a312b5865d1"}
 *
 * Go source:
 * func IsDiskPathRoot(path string) bool {
 * 	rootLength := GetEncodedRootLength(path)
 * 	return rootLength > 0 && rootLength == len(path)
 * }
 */
export function IsDiskPathRoot(path: string): bool {
  const rootLength = GetEncodedRootLength(path);
  return rootLength > 0 && rootLength === path.length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsDynamicFileName","kind":"func","status":"implemented","sigHash":"91a8bce6c32f23c48c9cc840e16a89b6697fa2d507743c24c0048cb1aa57ab56","bodyHash":"676d84bf5cfb545b56b85f35f231ac73dbed046929a62043bb362ef6cfacc6ed"}
 *
 * Go source:
 * func IsDynamicFileName(fileName string) bool {
 * 	return strings.HasPrefix(fileName, "^/")
 * }
 */
export function IsDynamicFileName(fileName: string): bool {
  return strings.HasPrefix(fileName, "^/");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::PathIsAbsolute","kind":"func","status":"implemented","sigHash":"ef815213643b55785a4b56855920c6f3a56a3217bc07e85223b191ab3368f72f","bodyHash":"9c801a379e482bb6851d0de7eff8c76781f662255ecb695c6b4fad32900dd446"}
 *
 * Go source:
 * func PathIsAbsolute(path string) bool {
 * 	return GetEncodedRootLength(path) != 0
 * }
 */
export function PathIsAbsolute(path: string): bool {
  return GetEncodedRootLength(path) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::HasTrailingDirectorySeparator","kind":"func","status":"implemented","sigHash":"f65ef4e9aeecf5b5e82c714705364cf846d460f43b98ba71f044c3a510b8584b","bodyHash":"167485e37641a1ffc5513b041a91a5c409d20d8297783d106120750198a79f5f"}
 *
 * Go source:
 * func HasTrailingDirectorySeparator(path string) bool {
 * 	return len(path) > 0 && isAnyDirectorySeparator(path[len(path)-1])
 * }
 */
export function HasTrailingDirectorySeparator(path: string): bool {
  return path.length > 0 && isAnyDirectorySeparator(path.charCodeAt(path.length - 1));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::CombinePaths","kind":"func","status":"implemented","sigHash":"7da062a21dccc4ef5737ad2340bf86bdd0d1f6d04491b982b0e1daa8c8ee84c9","bodyHash":"ad3a26c3e046d81c0f729c63e52540e65eca3628ce0c46174e912f0b9535a386"}
 *
 * Go source:
 * func CombinePaths(firstPath string, paths ...string) string {
 * 	// TODO (drosen): There is potential for a fast path here.
 * 	// In the case where we find the last absolute path and just path.Join from there.
 * 	firstPath = NormalizeSlashes(firstPath)
 * 
 * 	var b strings.Builder
 * 	size := len(firstPath) + len(paths)
 * 	for _, p := range paths {
 * 		size += len(p)
 * 	}
 * 	b.Grow(size)
 * 
 * 	b.WriteString(firstPath)
 * 
 * 	// To provide a way to "set" the path, keep track of the start and then slice.
 * 	// This will waste some memory each time we do it, but saving memory is more common.
 * 	start := 0
 * 	result := func() string {
 * 		return b.String()[start:]
 * 	}
 * 	setResult := func(value string) {
 * 		start = b.Len()
 * 		b.WriteString(value)
 * 	}
 * 
 * 	for _, trailingPath := range paths {
 * 		if trailingPath == "" {
 * 			continue
 * 		}
 * 		trailingPath = NormalizeSlashes(trailingPath)
 * 		if result() == "" || GetRootLength(trailingPath) != 0 {
 * 			// `trailingPath` is absolute.
 * 			setResult(trailingPath)
 * 		} else {
 * 			if !HasTrailingDirectorySeparator(result()) {
 * 				b.WriteByte(DirectorySeparator)
 * 			}
 * 			b.WriteString(trailingPath)
 * 		}
 * 	}
 * 	return result()
 * }
 */
export function CombinePaths(firstPath: string, ...paths: Array<string>): string {
  // TODO (drosen): There is potential for a fast path here.
  // In the case where we find the last absolute path and just path.Join from there.
  firstPath = NormalizeSlashes(firstPath);

  const b = new strings.Builder();
  let size = firstPath.length + paths.length;
  for (const p of paths) {
    size += p.length;
  }
  b.Grow(size);

  b.WriteString(firstPath);

  // To provide a way to "set" the path, keep track of the start and then slice.
  // This will waste some memory each time we do it, but saving memory is more common.
  // (Go tracks `start` as a byte offset into the builder; this port slices the
  // decoded string, so `start` is tracked as the decoded-string length to keep
  // the slice self-consistent with the builder contents.)
  let start = 0;
  const result = (): string => {
    return b.String().slice(start);
  };
  const setResult = (value: string): void => {
    start = b.String().length;
    b.WriteString(value);
  };

  for (let trailingPath of paths) {
    if (trailingPath === "") {
      continue;
    }
    trailingPath = NormalizeSlashes(trailingPath);
    if (result() === "" || GetRootLength(trailingPath) !== 0) {
      // `trailingPath` is absolute.
      setResult(trailingPath);
    } else {
      if (!HasTrailingDirectorySeparator(result())) {
        b.WriteByte(DirectorySeparator);
      }
      b.WriteString(trailingPath);
    }
  }
  return result();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetPathComponents","kind":"func","status":"implemented","sigHash":"3fd4194ec0012d7e3c1a8ce1e1c52df453326d6530ad55d7e146b35646584e79","bodyHash":"39f1cfcb5de0d643f3a3793a0b51502280f433b6ffa07d92662964b64dc1d3e0"}
 *
 * Go source:
 * func GetPathComponents(path string, currentDirectory string) []string {
 * 	path = CombinePaths(currentDirectory, path)
 * 	return pathComponents(path, GetRootLength(path))
 * }
 */
export function GetPathComponents(path: string, currentDirectory: string): GoSlice<string> {
  path = CombinePaths(currentDirectory, path);
  return pathComponents(path, GetRootLength(path));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::pathComponents","kind":"func","status":"implemented","sigHash":"2edb72fdb333f7a6f0f458cdc12f449eed5c4d41bb590d3bef41346428771453","bodyHash":"8cd88f033768b6fd636cf1f35f699e5ac5963336d5413e702d42db355853cb66"}
 *
 * Go source:
 * func pathComponents(path string, rootLength int) []string {
 * 	root := path[:rootLength]
 * 	rest := strings.Split(path[rootLength:], "/")
 * 	if len(rest) > 0 && rest[len(rest)-1] == "" {
 * 		rest = rest[:len(rest)-1]
 * 	}
 * 	return append([]string{root}, rest...)
 * }
 */
export function pathComponents(path: string, rootLength: int): GoSlice<string> {
  const root = path.slice(0, rootLength);
  let rest = strings.Split(path.slice(rootLength), "/");
  if (rest.length > 0 && rest[rest.length - 1] === "") {
    rest = rest.slice(0, rest.length - 1);
  }
  return [root, ...rest];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsVolumeCharacter","kind":"func","status":"implemented","sigHash":"bfd3815df675fabe7f78f3cf172462bbaf2ecde3559b469a44ee836577b04d7e","bodyHash":"90785bf39f8d53e8901f689a4c6e5aac1913fe5a6bcaeb1c95ada402af84fa34"}
 *
 * Go source:
 * func IsVolumeCharacter(char byte) bool {
 * 	return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
 * }
 */
export function IsVolumeCharacter(char: byte): bool {
  return (char >= CHAR_a && char <= CHAR_z) || (char >= CHAR_A && char <= CHAR_Z);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::getFileUrlVolumeSeparatorEnd","kind":"func","status":"implemented","sigHash":"a81071c8d2c297dc2bcfcfc8b0c487a97acf4f5b14b799b271039b053055aca6","bodyHash":"ba1ead55f2fa543ba6f00435346bb1d103de17d54990922b75f72855fef6f3b4"}
 *
 * Go source:
 * func getFileUrlVolumeSeparatorEnd(url string, start int) int {
 * 	if len(url) <= start {
 * 		return -1
 * 	}
 * 	ch0 := url[start]
 * 	if ch0 == ':' {
 * 		return start + 1
 * 	}
 * 	if ch0 == '%' && len(url) > start+2 && url[start+1] == '3' {
 * 		ch2 := url[start+2]
 * 		if ch2 == 'a' || ch2 == 'A' {
 * 			return start + 3
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function getFileUrlVolumeSeparatorEnd(url: string, start: int): int {
  if (url.length <= start) {
    return -1;
  }
  const ch0 = url.charCodeAt(start);
  if (ch0 === CHAR_COLON) {
    return start + 1;
  }
  if (ch0 === CHAR_PERCENT && url.length > start + 2 && url.charCodeAt(start + 1) === CHAR_3) {
    const ch2 = url.charCodeAt(start + 2);
    if (ch2 === CHAR_a || ch2 === CHAR_A) {
      return start + 3;
    }
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetEncodedRootLength","kind":"func","status":"implemented","sigHash":"5af37d1c2fccbdaec3decb59645fdae723dfb9750b80245eac6f8dd108c774e8","bodyHash":"43dd93a314965a7ef03e90b911460ea9369da18c1989d6e2256b395cad1e5ea1"}
 *
 * Go source:
 * func GetEncodedRootLength(path string) int {
 * 	ln := len(path)
 * 	if ln == 0 {
 * 		return 0
 * 	}
 * 	ch0 := path[0]
 * 
 * 	// POSIX or UNC
 * 	if ch0 == '/' || ch0 == '\\' {
 * 		if ln == 1 || path[1] != ch0 {
 * 			return 1 // POSIX: "/" (or non-normalized "\")
 * 		}
 * 
 * 		offset := 2
 * 		p1 := strings.IndexByte(path[offset:], ch0)
 * 		if p1 < 0 {
 * 			return ln // UNC: "//server" or "\\server"
 * 		}
 * 
 * 		return p1 + offset + 1 // UNC: "//server/" or "\\server\"
 * 	}
 * 
 * 	// DOS
 * 	if IsVolumeCharacter(ch0) && ln > 1 && path[1] == ':' {
 * 		if ln == 2 {
 * 			return 2 // DOS: "c:" (but not "c:d")
 * 		}
 * 		ch2 := path[2]
 * 		if ch2 == '/' || ch2 == '\\' {
 * 			return 3 // DOS: "c:/" or "c:\"
 * 		}
 * 	}
 * 
 * 	// Untitled paths (e.g., "^/untitled/ts-nul-authority/Untitled-1")
 * 	if ch0 == '^' && ln > 1 && path[1] == '/' {
 * 		return 2 // Untitled: "^/"
 * 	}
 * 
 * 	// URL
 * 	schemeEnd := strings.Index(path, urlSchemeSeparator)
 * 	if schemeEnd != -1 {
 * 		authorityStart := schemeEnd + len(urlSchemeSeparator)
 * 		authorityLength := strings.Index(path[authorityStart:], "/")
 * 		if authorityLength != -1 { // URL: "file:///", "file://server/", "file://server/path"
 * 			authorityEnd := authorityStart + authorityLength
 * 
 * 			// For local "file" URLs, include the leading DOS volume (if present).
 * 			// Per https://www.ietf.org/rfc/rfc1738.txt, a host of "" or "localhost" is a
 * 			// special case interpreted as "the machine from which the URL is being interpreted".
 * 			scheme := path[:schemeEnd]
 * 			authority := path[authorityStart:authorityEnd]
 * 			if scheme == "file" && (authority == "" || authority == "localhost") && (len(path) > authorityEnd+2) && IsVolumeCharacter(path[authorityEnd+1]) {
 * 				volumeSeparatorEnd := getFileUrlVolumeSeparatorEnd(path, authorityEnd+2)
 * 				if volumeSeparatorEnd != -1 {
 * 					if volumeSeparatorEnd == len(path) {
 * 						// URL: "file:///c:", "file://localhost/c:", "file:///c$3a", "file://localhost/c%3a"
 * 						// but not "file:///c:d" or "file:///c%3ad"
 * 						return ^volumeSeparatorEnd
 * 					}
 * 					if path[volumeSeparatorEnd] == '/' {
 * 						// URL: "file:///c:/", "file://localhost/c:/", "file:///c%3a/", "file://localhost/c%3a/"
 * 						return ^(volumeSeparatorEnd + 1)
 * 					}
 * 				}
 * 			}
 * 			return ^(authorityEnd + 1) // URL: "file://server/", "http://server/"
 * 		}
 * 		return ^ln // URL: "file://server", "http://server"
 * 	}
 * 
 * 	// relative
 * 	return 0
 * }
 */
export function GetEncodedRootLength(path: string): int {
  const ln = path.length;
  if (ln === 0) {
    return 0;
  }
  const ch0 = path.charCodeAt(0);

  // POSIX or UNC
  if (ch0 === CHAR_SLASH || ch0 === CHAR_BACKSLASH) {
    if (ln === 1 || path.charCodeAt(1) !== ch0) {
      return 1; // POSIX: "/" (or non-normalized "\")
    }

    const offset = 2;
    const p1 = path.slice(offset).indexOf(globalThis.String.fromCharCode(ch0));
    if (p1 < 0) {
      return ln; // UNC: "//server" or "\\server"
    }

    return p1 + offset + 1; // UNC: "//server/" or "\\server\"
  }

  // DOS
  if (IsVolumeCharacter(ch0) && ln > 1 && path.charCodeAt(1) === CHAR_COLON) {
    if (ln === 2) {
      return 2; // DOS: "c:" (but not "c:d")
    }
    const ch2 = path.charCodeAt(2);
    if (ch2 === CHAR_SLASH || ch2 === CHAR_BACKSLASH) {
      return 3; // DOS: "c:/" or "c:\"
    }
  }

  // Untitled paths (e.g., "^/untitled/ts-nul-authority/Untitled-1")
  if (ch0 === CHAR_CARET && ln > 1 && path.charCodeAt(1) === CHAR_SLASH) {
    return 2; // Untitled: "^/"
  }

  // URL
  const schemeEnd = path.indexOf(urlSchemeSeparator);
  if (schemeEnd !== -1) {
    const authorityStart = schemeEnd + urlSchemeSeparator.length;
    const authorityLength = path.slice(authorityStart).indexOf("/");
    if (authorityLength !== -1) {
      // URL: "file:///", "file://server/", "file://server/path"
      const authorityEnd = authorityStart + authorityLength;

      // For local "file" URLs, include the leading DOS volume (if present).
      // Per https://www.ietf.org/rfc/rfc1738.txt, a host of "" or "localhost" is a
      // special case interpreted as "the machine from which the URL is being interpreted".
      const scheme = path.slice(0, schemeEnd);
      const authority = path.slice(authorityStart, authorityEnd);
      if (scheme === "file" && (authority === "" || authority === "localhost") && ln > authorityEnd + 2 && IsVolumeCharacter(path.charCodeAt(authorityEnd + 1))) {
        const volumeSeparatorEnd = getFileUrlVolumeSeparatorEnd(path, authorityEnd + 2);
        if (volumeSeparatorEnd !== -1) {
          if (volumeSeparatorEnd === path.length) {
            // URL: "file:///c:", "file://localhost/c:", "file:///c$3a", "file://localhost/c%3a"
            // but not "file:///c:d" or "file:///c%3ad"
            return ~volumeSeparatorEnd;
          }
          if (path.charCodeAt(volumeSeparatorEnd) === CHAR_SLASH) {
            // URL: "file:///c:/", "file://localhost/c:/", "file:///c%3a/", "file://localhost/c%3a/"
            return ~(volumeSeparatorEnd + 1);
          }
        }
      }
      return ~(authorityEnd + 1); // URL: "file://server/", "http://server/"
    }
    return ~ln; // URL: "file://server", "http://server"
  }

  // relative
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetRootLength","kind":"func","status":"implemented","sigHash":"18d7dbfa5d0406aaa416710e604ea5ee7a23d18a06f8e4984ba6b52a57cbd2cf","bodyHash":"0b6a4fbd2202f90442e696ea7b690624e8f1636448d0c16212216123a452c403"}
 *
 * Go source:
 * func GetRootLength(path string) int {
 * 	rootLength := GetEncodedRootLength(path)
 * 	if rootLength < 0 {
 * 		return ^rootLength
 * 	}
 * 	return rootLength
 * }
 */
export function GetRootLength(path: string): int {
  const rootLength = GetEncodedRootLength(path);
  if (rootLength < 0) {
    return ~rootLength;
  }
  return rootLength;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetDirectoryPath","kind":"func","status":"implemented","sigHash":"5b5dcb5872b251b75b8d6dd153802a7c164b00c8e7f064ddfd565a26796da3a9","bodyHash":"3f10f8f6c1bf510102e5563ec6f7720d8ed86989af3bceb4a0a0663b3788fce4"}
 *
 * Go source:
 * func GetDirectoryPath(path string) string {
 * 	path = NormalizeSlashes(path)
 * 
 * 	// If the path provided is itself a root, then return it.
 * 	rootLength := GetRootLength(path)
 * 	if rootLength == len(path) {
 * 		return path
 * 	}
 * 
 * 	// return the leading portion of the path up to the last (non-terminal) directory separator
 * 	// but not including any trailing directory separator.
 * 	path = RemoveTrailingDirectorySeparator(path)
 * 	return path[:max(rootLength, strings.LastIndex(path, "/"))]
 * }
 */
export function GetDirectoryPath(path: string): string {
  path = NormalizeSlashes(path);

  // If the path provided is itself a root, then return it.
  const rootLength = GetRootLength(path);
  if (rootLength === path.length) {
    return path;
  }

  // return the leading portion of the path up to the last (non-terminal) directory separator
  // but not including any trailing directory separator.
  path = RemoveTrailingDirectorySeparator(path);
  return path.slice(0, globalThis.Math.max(rootLength, path.lastIndexOf("/")));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::Path.GetDirectoryPath","kind":"method","status":"implemented","sigHash":"e774d02dfce390300776af2a557af9700d0516c289b32d9468c8634496709a7d","bodyHash":"6f0f978c83cf52072c2e356ad8af3c5e1f2b3a880fdfe44d2bc0f09fdc5c8bd9"}
 *
 * Go source:
 * func (p Path) GetDirectoryPath() Path {
 * 	return Path(GetDirectoryPath(string(p)))
 * }
 */
export function Path_GetDirectoryPath(receiver: Path): Path {
  return GetDirectoryPath(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetPathFromPathComponents","kind":"func","status":"implemented","sigHash":"e810e42fd22534b98a230c001734d81d82443786d2ed6a25a8349f9085183dce","bodyHash":"cdc33bb346dccaa249b76555239c7b6a037c6b731f1c99b369abc70f9d3835ac"}
 *
 * Go source:
 * func GetPathFromPathComponents(pathComponents []string) string {
 * 	if len(pathComponents) == 0 {
 * 		return ""
 * 	}
 *
 * 	root := pathComponents[0]
 * 	if root != "" {
 * 		root = EnsureTrailingDirectorySeparator(root)
 * 	}
 *
 * 	return root + strings.Join(pathComponents[1:], "/")
 * }
 */
export function GetPathFromPathComponents(pathComponents: GoSlice<string>): string {
  if (pathComponents.length === 0) {
    return "";
  }

  let root = pathComponents[0]!;
  if (root !== "") {
    root = EnsureTrailingDirectorySeparator(root);
  }

  return root + strings.Join(pathComponents.slice(1), "/");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::NormalizeSlashes","kind":"func","status":"implemented","sigHash":"3b19f70472000984bd76fed7419025c09ecc57ed21b43efeba48e3811e3f4fb8","bodyHash":"cc9cd174124faf5c38d600405aab1bd046683fd87ce2d25674c3803630770717"}
 *
 * Go source:
 * func NormalizeSlashes(path string) string {
 * 	return strings.ReplaceAll(path, "\\", "/")
 * }
 */
export function NormalizeSlashes(path: string): string {
  return strings.ReplaceAll(path, "\\", "/");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::reducePathComponents","kind":"func","status":"implemented","sigHash":"ed6c27852680341a1afb2c43e44a042d9833a8f507a5c3d55d148d587af9cc07","bodyHash":"d5eab229151dc90b33b27b20128a3ee53bf4d5d05a71473d28758fe702d1cea4"}
 *
 * Go source:
 * func reducePathComponents(components []string) []string {
 * 	if len(components) == 0 {
 * 		return []string{}
 * 	}
 * 	reduced := []string{components[0]}
 * 	for i := 1; i < len(components); i++ {
 * 		component := components[i]
 * 		if component == "" {
 * 			continue
 * 		}
 * 		if component == "." {
 * 			continue
 * 		}
 * 		if component == ".." {
 * 			if len(reduced) > 1 {
 * 				if reduced[len(reduced)-1] != ".." {
 * 					reduced = reduced[:len(reduced)-1]
 * 					continue
 * 				}
 * 			} else if reduced[0] != "" {
 * 				continue
 * 			}
 * 		}
 * 		reduced = append(reduced, component)
 * 	}
 * 	return reduced
 * }
 */
export function reducePathComponents(components: GoSlice<string>): GoSlice<string> {
  if (components.length === 0) {
    return [];
  }
  const reduced: GoSlice<string> = [components[0]!];
  for (let i = 1; i < components.length; i++) {
    const component = components[i]!;
    if (component === "") {
      continue;
    }
    if (component === ".") {
      continue;
    }
    if (component === "..") {
      if (reduced.length > 1) {
        if (reduced[reduced.length - 1] !== "..") {
          reduced.pop();
          continue;
        }
      } else if (reduced[0] !== "") {
        continue;
      }
    }
    reduced.push(component);
  }
  return reduced;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ResolvePath","kind":"func","status":"implemented","sigHash":"44ae4957981c709649da7a834d4aca574944b47e8d2c05c0892835d3b7c7f443","bodyHash":"9829b3ad082cc004d3e46268020c6d47a7ba77a12d676fc32401d3842b532e46"}
 *
 * Go source:
 * func ResolvePath(path string, paths ...string) string {
 * 	var combinedPath string
 * 	if len(paths) > 0 {
 * 		combinedPath = CombinePaths(path, paths...)
 * 	} else {
 * 		combinedPath = NormalizeSlashes(path)
 * 	}
 * 	return NormalizePath(combinedPath)
 * }
 */
export function ResolvePath(path: string, ...paths: Array<string>): string {
  let combinedPath: string;
  if (paths.length > 0) {
    combinedPath = CombinePaths(path, ...paths);
  } else {
    combinedPath = NormalizeSlashes(path);
  }
  return NormalizePath(combinedPath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ResolveTripleslashReference","kind":"func","status":"implemented","sigHash":"adb01261e0a68870f388e1117b7d7a21595d602b02c73fa9439b75a989313fde","bodyHash":"4005cfe268feca1d7a1fddb8723bdb75a7d655d4d215c1868bc7d7fdf5048cae"}
 *
 * Go source:
 * func ResolveTripleslashReference(moduleName string, containingFile string) string {
 * 	basePath := GetDirectoryPath(containingFile)
 * 	if IsRootedDiskPath(moduleName) {
 * 		return NormalizePath(moduleName)
 * 	}
 * 	return NormalizePath(CombinePaths(basePath, moduleName))
 * }
 */
export function ResolveTripleslashReference(moduleName: string, containingFile: string): string {
  const basePath = GetDirectoryPath(containingFile);
  if (IsRootedDiskPath(moduleName)) {
    return NormalizePath(moduleName);
  }
  return NormalizePath(CombinePaths(basePath, moduleName));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetNormalizedPathComponents","kind":"func","status":"implemented","sigHash":"e4a30b0057868bde1ed9c29443e92bc126ecf378134c4fb9e6c73d6406e4671c","bodyHash":"62adbad8a748ceae4a8810fa88dbe533b273d7977aa95bae625c8410a55cbd51"}
 *
 * Go source:
 * func GetNormalizedPathComponents(path string, currentDirectory string) []string {
 * 	combined := CombinePaths(currentDirectory, path)
 * 	return getNormalizedPathComponentsFromCombined(combined)
 * }
 */
export function GetNormalizedPathComponents(path: string, currentDirectory: string): GoSlice<string> {
  const combined = CombinePaths(currentDirectory, path);
  return getNormalizedPathComponentsFromCombined(combined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::getNormalizedPathComponentsFromCombined","kind":"func","status":"implemented","sigHash":"592acdd689e57fbc2466ba35c5d142e63509cbc72c5bc020100936da2a36176d","bodyHash":"82b2ab2767a4076a3786ab5c5687356ecd0b7f54ef31c1ec52ae16a4c88cb974"}
 *
 * Go source:
 * func getNormalizedPathComponentsFromCombined(path string) []string {
 * 	rootLength := GetRootLength(path)
 * 	// Always include the root component (empty string for relative paths).
 * 	components := make([]string, 1, 8)
 * 	components[0] = path[:rootLength]
 * 
 * 	for i := rootLength; i < len(path); {
 * 		// Skip directory separators (handles consecutive separators and trailing '/').
 * 		for i < len(path) && path[i] == '/' {
 * 			i++
 * 		}
 * 		if i >= len(path) {
 * 			break
 * 		}
 * 
 * 		start := i
 * 		for i < len(path) && path[i] != '/' {
 * 			i++
 * 		}
 * 		component := path[start:i]
 * 
 * 		if component == "" || component == "." {
 * 			continue
 * 		}
 * 		if component == ".." {
 * 			if len(components) > 1 {
 * 				if components[len(components)-1] != ".." {
 * 					components = components[:len(components)-1]
 * 					continue
 * 				}
 * 			} else if components[0] != "" {
 * 				// If this is an absolute path, we can't go above the root.
 * 				continue
 * 			}
 * 		}
 * 
 * 		components = append(components, component)
 * 	}
 * 
 * 	return components
 * }
 */
export function getNormalizedPathComponentsFromCombined(path: string): GoSlice<string> {
  const rootLength = GetRootLength(path);
  // Always include the root component (empty string for relative paths).
  const components: GoSlice<string> = [path.slice(0, rootLength)];

  for (let i = rootLength; i < path.length; ) {
    // Skip directory separators (handles consecutive separators and trailing '/').
    for (; i < path.length && path.charCodeAt(i) === CHAR_SLASH; ) {
      i++;
    }
    if (i >= path.length) {
      break;
    }

    const start = i;
    for (; i < path.length && path.charCodeAt(i) !== CHAR_SLASH; ) {
      i++;
    }
    const component = path.slice(start, i);

    if (component === "" || component === ".") {
      continue;
    }
    if (component === "..") {
      if (components.length > 1) {
        if (components[components.length - 1] !== "..") {
          components.pop();
          continue;
        }
      } else if (components[0] !== "") {
        // If this is an absolute path, we can't go above the root.
        continue;
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetNormalizedAbsolutePathWithoutRoot","kind":"func","status":"implemented","sigHash":"81980ebeb2e122b44237831207ebd0d87eb28c27bdf397dc0fa933b39412cad2","bodyHash":"5174ae1812d529b55090adf45f2b5a608ab03672da8bccbff2425d9b9490d560"}
 *
 * Go source:
 * func GetNormalizedAbsolutePathWithoutRoot(fileName string, currentDirectory string) string {
 * 	absolutePath := GetNormalizedAbsolutePath(fileName, currentDirectory)
 * 	rootLength := GetRootLength(absolutePath)
 * 	return absolutePath[rootLength:]
 * }
 */
export function GetNormalizedAbsolutePathWithoutRoot(fileName: string, currentDirectory: string): string {
  const absolutePath = GetNormalizedAbsolutePath(fileName, currentDirectory);
  const rootLength = GetRootLength(absolutePath);
  return absolutePath.slice(rootLength);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetNormalizedAbsolutePath","kind":"func","status":"implemented","sigHash":"4d11dab3da5ccbac23ddab0f9f08090ab7244c51215fc8d6fe1129e74b59a5a3","bodyHash":"3dc0e46d7c57c69291e363227b3c3db662096c4eae6ddda4015692a1bd8493e1"}
 *
 * Go source:
 * func GetNormalizedAbsolutePath(fileName string, currentDirectory string) string {
 * 	rootLength := GetRootLength(fileName)
 * 	if rootLength == 0 && currentDirectory != "" {
 * 		fileName = CombinePaths(currentDirectory, fileName)
 * 	} else {
 * 		// CombinePaths normalizes slashes, so not necessary in other branch
 * 		fileName = NormalizeSlashes(fileName)
 * 	}
 * 	rootLength = GetRootLength(fileName)
 * 
 * 	if simpleNormalized, ok := simpleNormalizePath(fileName); ok {
 * 		length := len(simpleNormalized)
 * 		if length > rootLength {
 * 			return RemoveTrailingDirectorySeparator(simpleNormalized)
 * 		}
 * 		if length == rootLength && rootLength != 0 {
 * 			return EnsureTrailingDirectorySeparator(simpleNormalized)
 * 		}
 * 		return simpleNormalized
 * 	}
 * 
 * 	length := len(fileName)
 * 	root := fileName[:rootLength]
 * 	// `normalized` is only initialized once `fileName` is determined to be non-normalized.
 * 	// `changed` is set at the same time.
 * 	var changed bool
 * 	var normalized string
 * 	var segmentStart int
 * 	index := rootLength
 * 	normalizedUpTo := index
 * 	seenNonDotDotSegment := rootLength != 0
 * 	for index < length {
 * 		// At beginning of segment
 * 		segmentStart = index
 * 		ch := fileName[index]
 * 		for ch == '/' {
 * 			index++
 * 			if index < length {
 * 				ch = fileName[index]
 * 			} else {
 * 				break
 * 			}
 * 		}
 * 		if index > segmentStart {
 * 			// Seen superfluous separator
 * 			if !changed {
 * 				normalized = fileName[:max(rootLength, segmentStart-1)]
 * 				changed = true
 * 			}
 * 			if index == length {
 * 				break
 * 			}
 * 			segmentStart = index
 * 		}
 * 		// Past any superfluous separators
 * 		segmentEnd := strings.IndexByte(fileName[index+1:], '/')
 * 		if segmentEnd == -1 {
 * 			segmentEnd = length
 * 		} else {
 * 			segmentEnd += index + 1
 * 		}
 * 		segmentLength := segmentEnd - segmentStart
 * 		if segmentLength == 1 && fileName[index] == '.' {
 * 			// "." segment (skip)
 * 			if !changed {
 * 				normalized = fileName[:normalizedUpTo]
 * 				changed = true
 * 			}
 * 		} else if segmentLength == 2 && fileName[index] == '.' && fileName[index+1] == '.' {
 * 			// ".." segment
 * 			if !seenNonDotDotSegment {
 * 				if changed {
 * 					if len(normalized) == rootLength {
 * 						normalized += ".."
 * 					} else {
 * 						normalized += "/.."
 * 					}
 * 				} else {
 * 					normalizedUpTo = index + 2
 * 				}
 * 			} else if !changed {
 * 				if normalizedUpTo-1 >= 0 {
 * 					normalized = fileName[:max(rootLength, strings.LastIndexByte(fileName[:normalizedUpTo-1], '/'))]
 * 				} else {
 * 					normalized = fileName[:normalizedUpTo]
 * 				}
 * 				changed = true
 * 				seenNonDotDotSegment = (len(normalized) != rootLength || rootLength != 0) && normalized != ".." && !strings.HasSuffix(normalized, "/..")
 * 			} else {
 * 				lastSlash := strings.LastIndexByte(normalized, '/')
 * 				if lastSlash != -1 {
 * 					normalized = normalized[:max(rootLength, lastSlash)]
 * 				} else {
 * 					normalized = root
 * 				}
 * 				seenNonDotDotSegment = (len(normalized) != rootLength || rootLength != 0) && normalized != ".." && !strings.HasSuffix(normalized, "/..")
 * 			}
 * 		} else if changed {
 * 			if len(normalized) != rootLength {
 * 				normalized += "/"
 * 			}
 * 			seenNonDotDotSegment = true
 * 			normalized += fileName[segmentStart:segmentEnd]
 * 		} else {
 * 			seenNonDotDotSegment = true
 * 			normalizedUpTo = segmentEnd
 * 		}
 * 		index = segmentEnd + 1
 * 	}
 * 	if changed {
 * 		return normalized
 * 	}
 * 	if length > rootLength {
 * 		return RemoveTrailingDirectorySeparators(fileName)
 * 	}
 * 	if length == rootLength {
 * 		return EnsureTrailingDirectorySeparator(fileName)
 * 	}
 * 	return fileName
 * }
 */
export function GetNormalizedAbsolutePath(fileName: string, currentDirectory: string): string {
  let rootLength = GetRootLength(fileName);
  if (rootLength === 0 && currentDirectory !== "") {
    fileName = CombinePaths(currentDirectory, fileName);
  } else {
    // CombinePaths normalizes slashes, so not necessary in other branch
    fileName = NormalizeSlashes(fileName);
  }
  rootLength = GetRootLength(fileName);

  {
    const [simpleNormalized, ok] = simpleNormalizePath(fileName);
    if (ok) {
      const length = simpleNormalized.length;
      if (length > rootLength) {
        return RemoveTrailingDirectorySeparator(simpleNormalized);
      }
      if (length === rootLength && rootLength !== 0) {
        return EnsureTrailingDirectorySeparator(simpleNormalized);
      }
      return simpleNormalized;
    }
  }

  const length = fileName.length;
  const root = fileName.slice(0, rootLength);
  // `normalized` is only initialized once `fileName` is determined to be non-normalized.
  // `changed` is set at the same time.
  let changed = false;
  let normalized = "";
  let segmentStart = 0;
  let index = rootLength;
  let normalizedUpTo = index;
  let seenNonDotDotSegment = rootLength !== 0;
  while (index < length) {
    // At beginning of segment
    segmentStart = index;
    let ch = fileName.charCodeAt(index);
    while (ch === CHAR_SLASH) {
      index++;
      if (index < length) {
        ch = fileName.charCodeAt(index);
      } else {
        break;
      }
    }
    if (index > segmentStart) {
      // Seen superfluous separator
      if (!changed) {
        normalized = fileName.slice(0, globalThis.Math.max(rootLength, segmentStart - 1));
        changed = true;
      }
      if (index === length) {
        break;
      }
      segmentStart = index;
    }
    // Past any superfluous separators
    let segmentEnd = fileName.slice(index + 1).indexOf("/");
    if (segmentEnd === -1) {
      segmentEnd = length;
    } else {
      segmentEnd += index + 1;
    }
    const segmentLength = segmentEnd - segmentStart;
    if (segmentLength === 1 && fileName.charCodeAt(index) === CHAR_DOT) {
      // "." segment (skip)
      if (!changed) {
        normalized = fileName.slice(0, normalizedUpTo);
        changed = true;
      }
    } else if (segmentLength === 2 && fileName.charCodeAt(index) === CHAR_DOT && fileName.charCodeAt(index + 1) === CHAR_DOT) {
      // ".." segment
      if (!seenNonDotDotSegment) {
        if (changed) {
          if (normalized.length === rootLength) {
            normalized += "..";
          } else {
            normalized += "/..";
          }
        } else {
          normalizedUpTo = index + 2;
        }
      } else if (!changed) {
        if (normalizedUpTo - 1 >= 0) {
          normalized = fileName.slice(0, globalThis.Math.max(rootLength, fileName.slice(0, normalizedUpTo - 1).lastIndexOf("/")));
        } else {
          normalized = fileName.slice(0, normalizedUpTo);
        }
        changed = true;
        seenNonDotDotSegment = (normalized.length !== rootLength || rootLength !== 0) && normalized !== ".." && !strings.HasSuffix(normalized, "/..");
      } else {
        const lastSlash = normalized.lastIndexOf("/");
        if (lastSlash !== -1) {
          normalized = normalized.slice(0, globalThis.Math.max(rootLength, lastSlash));
        } else {
          normalized = root;
        }
        seenNonDotDotSegment = (normalized.length !== rootLength || rootLength !== 0) && normalized !== ".." && !strings.HasSuffix(normalized, "/..");
      }
    } else if (changed) {
      if (normalized.length !== rootLength) {
        normalized += "/";
      }
      seenNonDotDotSegment = true;
      normalized += fileName.slice(segmentStart, segmentEnd);
    } else {
      seenNonDotDotSegment = true;
      normalizedUpTo = segmentEnd;
    }
    index = segmentEnd + 1;
  }
  if (changed) {
    return normalized;
  }
  if (length > rootLength) {
    return RemoveTrailingDirectorySeparators(fileName);
  }
  if (length === rootLength) {
    return EnsureTrailingDirectorySeparator(fileName);
  }
  return fileName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::simpleNormalizePath","kind":"func","status":"implemented","sigHash":"e45377aaf29f102c9642dba21ebb0efc22e34dad629535547f27b27d151d464e","bodyHash":"8719483a56e4d8860df6f5bd02452fa3fb82cd0775ce9ef5774f72a91f8741bc"}
 *
 * Go source:
 * func simpleNormalizePath(path string) (string, bool) {
 * 	// Most paths don't require normalization
 * 	if !hasRelativePathSegment(path) {
 * 		return path, true
 * 	}
 * 	// Some paths only require cleanup of `/./` or leading `./`
 * 	simplified := strings.ReplaceAll(path, "/./", "/")
 * 	trimmed := strings.TrimPrefix(simplified, "./")
 * 	if trimmed != path && !hasRelativePathSegment(trimmed) && !(trimmed != simplified && strings.HasPrefix(trimmed, "/")) {
 * 		// If we trimmed a leading "./" and the path now starts with "/", we changed the meaning
 * 		path = trimmed
 * 		return path, true
 * 	}
 * 	return "", false
 * }
 */
export function simpleNormalizePath(path: string): [string, bool] {
  // Most paths don't require normalization
  if (!hasRelativePathSegment(path)) {
    return [path, true];
  }
  // Some paths only require cleanup of `/./` or leading `./`
  const simplified = strings.ReplaceAll(path, "/./", "/");
  const trimmed = strings.TrimPrefix(simplified, "./");
  if (trimmed !== path && !hasRelativePathSegment(trimmed) && !(trimmed !== simplified && strings.HasPrefix(trimmed, "/"))) {
    // If we trimmed a leading "./" and the path now starts with "/", we changed the meaning
    path = trimmed;
    return [path, true];
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::hasRelativePathSegment","kind":"func","status":"implemented","sigHash":"630c8cb829872ef77ac96657875fd771a1d0430239175462c7cebfd45945153c","bodyHash":"e2f5c1b5e746beaf141e247805bc25a0f66f026dc7e12354e826dd8b80985095"}
 *
 * Go source:
 * func hasRelativePathSegment(p string) bool {
 * 	n := len(p)
 * 	if n == 0 {
 * 		return false
 * 	}
 * 
 * 	if p == "." || p == ".." {
 * 		return true
 * 	}
 * 
 * 	// Leading "./" OR "../"
 * 	if p[0] == '.' {
 * 		if n >= 2 && p[1] == '/' {
 * 			return true
 * 		}
 * 		// Leading "../"
 * 		if n >= 3 && p[1] == '.' && p[2] == '/' {
 * 			return true
 * 		}
 * 	}
 * 	// Trailing "/." OR "/.."
 * 	if p[n-1] == '.' {
 * 		if n >= 2 && p[n-2] == '/' {
 * 			return true
 * 		}
 * 		if n >= 3 && p[n-2] == '.' && p[n-3] == '/' {
 * 			return true
 * 		}
 * 	}
 * 
 * 	// Now look for any `//` or `/./` or `/../`
 * 
 * 	prevSlash := false
 * 	segLen := 0   // length of current segment since last slash
 * 	dotCount := 0 // consecutive dots at start of the current segment; -1 => not only dots
 * 
 * 	for i := range n {
 * 		c := p[i]
 * 		if c == '/' {
 * 			// "//"
 * 			if prevSlash {
 * 				return true
 * 			}
 * 			// "/./" or "/../"
 * 			if (segLen == 1 && dotCount == 1) || (segLen == 2 && dotCount == 2) {
 * 				return true
 * 			}
 * 			prevSlash = true
 * 			segLen = 0
 * 			dotCount = 0
 * 			continue
 * 		}
 * 
 * 		if c == '.' {
 * 			if dotCount >= 0 {
 * 				dotCount++
 * 			}
 * 		} else {
 * 			dotCount = -1
 * 		}
 * 		segLen++
 * 		prevSlash = false
 * 	}
 * 
 * 	// Trailing "/." or "/.."
 * 	return (segLen == 1 && dotCount == 1) || (segLen == 2 && dotCount == 2)
 * }
 */
export function hasRelativePathSegment(p: string): bool {
  const n = p.length;
  if (n === 0) {
    return false;
  }

  if (p === "." || p === "..") {
    return true;
  }

  // Leading "./" OR "../"
  if (p.charCodeAt(0) === CHAR_DOT) {
    if (n >= 2 && p.charCodeAt(1) === CHAR_SLASH) {
      return true;
    }
    // Leading "../"
    if (n >= 3 && p.charCodeAt(1) === CHAR_DOT && p.charCodeAt(2) === CHAR_SLASH) {
      return true;
    }
  }
  // Trailing "/." OR "/.."
  if (p.charCodeAt(n - 1) === CHAR_DOT) {
    if (n >= 2 && p.charCodeAt(n - 2) === CHAR_SLASH) {
      return true;
    }
    if (n >= 3 && p.charCodeAt(n - 2) === CHAR_DOT && p.charCodeAt(n - 3) === CHAR_SLASH) {
      return true;
    }
  }

  // Now look for any `//` or `/./` or `/../`

  let prevSlash = false;
  let segLen = 0; // length of current segment since last slash
  let dotCount = 0; // consecutive dots at start of the current segment; -1 => not only dots

  for (let i = 0; i < n; i++) {
    const c = p.charCodeAt(i);
    if (c === CHAR_SLASH) {
      // "//"
      if (prevSlash) {
        return true;
      }
      // "/./" or "/../"
      if ((segLen === 1 && dotCount === 1) || (segLen === 2 && dotCount === 2)) {
        return true;
      }
      prevSlash = true;
      segLen = 0;
      dotCount = 0;
      continue;
    }

    if (c === CHAR_DOT) {
      if (dotCount >= 0) {
        dotCount++;
      }
    } else {
      dotCount = -1;
    }
    segLen++;
    prevSlash = false;
  }

  // Trailing "/." or "/.."
  return (segLen === 1 && dotCount === 1) || (segLen === 2 && dotCount === 2);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::NormalizePath","kind":"func","status":"implemented","sigHash":"7e39610ff62d2b2c38a791fdb0ef023fe3321276a22df435a5880e5bde769c8c","bodyHash":"bf7267b0875a72c1dee3adc65b8e7068c3cd20b8e7cde35f10fe464637dd7b67"}
 *
 * Go source:
 * func NormalizePath(path string) string {
 * 	path = NormalizeSlashes(path)
 * 	if normalized, ok := simpleNormalizePath(path); ok {
 * 		return normalized
 * 	}
 * 	normalized := GetNormalizedAbsolutePath(path, "")
 * 	if normalized != "" && HasTrailingDirectorySeparator(path) {
 * 		normalized = EnsureTrailingDirectorySeparator(normalized)
 * 	}
 * 	return normalized
 * }
 */
export function NormalizePath(path: string): string {
  path = NormalizeSlashes(path);
  {
    const [normalized, ok] = simpleNormalizePath(path);
    if (ok) {
      return normalized;
    }
  }
  let normalized = GetNormalizedAbsolutePath(path, "");
  if (normalized !== "" && HasTrailingDirectorySeparator(path)) {
    normalized = EnsureTrailingDirectorySeparator(normalized);
  }
  return normalized;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetCanonicalFileName","kind":"func","status":"implemented","sigHash":"e393c766b588520499698913e94ff7791ccb9fff71da476fa19998bda4c69e04","bodyHash":"eaa2fbdb5e708cae47aae73ed6c57d4ddbd59dd55528dc3e01bcc88fbc26eedb"}
 *
 * Go source:
 * func GetCanonicalFileName(fileName string, useCaseSensitiveFileNames bool) string {
 * 	if useCaseSensitiveFileNames {
 * 		return fileName
 * 	}
 * 	return ToFileNameLowerCase(fileName)
 * }
 */
export function GetCanonicalFileName(fileName: string, useCaseSensitiveFileNames: bool): string {
  if (useCaseSensitiveFileNames) {
    return fileName;
  }
  return ToFileNameLowerCase(fileName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ToFileNameLowerCase","kind":"func","status":"implemented","sigHash":"5bd84289e0a506f344d7b836e2ec7f04013b1b721c2272bf86de836e974d6926","bodyHash":"94acba966b5e3ae5a3c9e0087ea12db69732be4b6f242290b878ab2651613e7c"}
 *
 * Go source:
 * func ToFileNameLowerCase(fileName string) string {
 * 	const IWithDot = '\u0130'
 * 
 * 	ascii := true
 * 	needsLower := false
 * 	fileNameLen := len(fileName)
 * 	for i := range fileNameLen {
 * 		c := fileName[i]
 * 		if c >= 0x80 {
 * 			ascii = false
 * 			break
 * 		}
 * 		if 'A' <= c && c <= 'Z' {
 * 			needsLower = true
 * 		}
 * 	}
 * 	if ascii {
 * 		if !needsLower {
 * 			return fileName
 * 		}
 * 		b := make([]byte, fileNameLen)
 * 		for i := range fileNameLen {
 * 			c := fileName[i]
 * 			if 'A' <= c && c <= 'Z' {
 * 				c += 'a' - 'A' // +32
 * 			}
 * 			b[i] = c
 * 		}
 * 		// SAFETY: We construct a string that aliases b’s backing array without copying.
 * 		// (1) Lifetime: The address of b’s elements escapes via the returned string,
 * 		//     so escape analysis allocates b’s backing array on the heap. The string
 * 		//     header points to that heap allocation, ensuring it remains live for the
 * 		//     string’s lifetime.
 * 		// (2) Initialization: We assign to every b[i] before creating the string.
 * 		//     (Note: Go zeroes all allocated memory, so “uninitialized” bytes cannot occur.)
 * 		// (3) Immutability: We do not modify b after this point, so the string view
 * 		//     observes immutable data.
 * 		// (4) Non-empty: On this path len(b) > 0, so &b[0] is a valid, non-nil pointer.
 * 		return unsafe.String(&b[0], len(b))
 * 	}
 * 
 * 	return strings.Map(func(r rune) rune {
 * 		if r == IWithDot {
 * 			return r
 * 		}
 * 		return unicode.ToLower(r)
 * 	}, fileName)
 * }
 */
export function ToFileNameLowerCase(fileName: string): string {
  const IWithDot: GoRune = 0x0130;

  let ascii = true;
  let needsLower = false;
  const fileNameLen = fileName.length;
  for (let i = 0; i < fileNameLen; i++) {
    const c = fileName.charCodeAt(i);
    if (c >= 0x80) {
      ascii = false;
      break;
    }
    if (CHAR_A <= c && c <= CHAR_Z) {
      needsLower = true;
    }
  }
  if (ascii) {
    if (!needsLower) {
      return fileName;
    }
    const b: GoSlice<byte> = new globalThis.Array<byte>(fileNameLen);
    for (let i = 0; i < fileNameLen; i++) {
      let c = fileName.charCodeAt(i);
      if (CHAR_A <= c && c <= CHAR_Z) {
        c += 32; // 'a' - 'A' // +32
      }
      b[i] = c;
    }
    // SAFETY: The Go code aliases b's backing array as a string via unsafe.String.
    // On this ASCII-only path every byte is < 0x80, so building the string from the
    // byte (char-code) values is exact.
    return globalThis.String.fromCharCode(...b);
  }

  return strings.Map((r: GoRune): GoRune => {
    if (r === IWithDot) {
      return r;
    }
    return unicode.ToLower(r);
  }, fileName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ToPath","kind":"func","status":"implemented","sigHash":"b3c0ac5ada8ba1e74e607eaa537d8a037deb4af011eb65bc14b4c47c3dfe1e8a","bodyHash":"d24d755421a5e764241ae611e18b95a39ec3ce69029c19d5ff7111c59d0033ed"}
 *
 * Go source:
 * func ToPath(fileName string, basePath string, useCaseSensitiveFileNames bool) Path {
 * 	var nonCanonicalizedPath string
 * 	if IsRootedDiskPath(fileName) {
 * 		nonCanonicalizedPath = NormalizePath(fileName)
 * 	} else {
 * 		nonCanonicalizedPath = GetNormalizedAbsolutePath(fileName, basePath)
 * 	}
 * 	return Path(GetCanonicalFileName(nonCanonicalizedPath, useCaseSensitiveFileNames))
 * }
 */
export function ToPath(fileName: string, basePath: string, useCaseSensitiveFileNames: bool): Path {
  let nonCanonicalizedPath: string;
  if (IsRootedDiskPath(fileName)) {
    nonCanonicalizedPath = NormalizePath(fileName);
  } else {
    nonCanonicalizedPath = GetNormalizedAbsolutePath(fileName, basePath);
  }
  return GetCanonicalFileName(nonCanonicalizedPath, useCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::RemoveTrailingDirectorySeparator","kind":"func","status":"implemented","sigHash":"df8c8bb60d13c58ac3c95184bd3f58ec47765f2241cda6aee1c4aca91f3cb8d7","bodyHash":"766675e5b0352a26c88acfbc9580b69af6468aa9950c8d1c8ff1e36f492b03f6"}
 *
 * Go source:
 * func RemoveTrailingDirectorySeparator(path string) string {
 * 	if HasTrailingDirectorySeparator(path) {
 * 		return path[:len(path)-1]
 * 	}
 * 	return path
 * }
 */
export function RemoveTrailingDirectorySeparator(path: string): string {
  if (HasTrailingDirectorySeparator(path)) {
    return path.slice(0, path.length - 1);
  }
  return path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::Path.RemoveTrailingDirectorySeparator","kind":"method","status":"implemented","sigHash":"3cd4a3caeca29fa522d8bc20332f8fc095cbc82ae91c86eb9b3a8ca01f07c9cc","bodyHash":"136f32cce92c9a000a2a12155ae449a0b538b0660cea6e04847d80789f49ed22"}
 *
 * Go source:
 * func (p Path) RemoveTrailingDirectorySeparator() Path {
 * 	return Path(RemoveTrailingDirectorySeparator(string(p)))
 * }
 */
export function Path_RemoveTrailingDirectorySeparator(receiver: Path): Path {
  return RemoveTrailingDirectorySeparator(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::RemoveTrailingDirectorySeparators","kind":"func","status":"implemented","sigHash":"47b5e01506fe75b92dc31d0b7b2034512c328400dc8bf76822ef57093c2960f5","bodyHash":"fff2c954c4e75a22e0fbcc6637b717bb4da2963593e74f03683f06f45b22895b"}
 *
 * Go source:
 * func RemoveTrailingDirectorySeparators(path string) string {
 * 	for HasTrailingDirectorySeparator(path) {
 * 		path = RemoveTrailingDirectorySeparator(path)
 * 	}
 * 	return path
 * }
 */
export function RemoveTrailingDirectorySeparators(path: string): string {
  while (HasTrailingDirectorySeparator(path)) {
    path = RemoveTrailingDirectorySeparator(path);
  }
  return path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::EnsureTrailingDirectorySeparator","kind":"func","status":"implemented","sigHash":"3909b4617c5e93f72ed69074f1d47f18c09a512aa0569a80dbee6d79ba3c1535","bodyHash":"f5d1867b2c6f63538f93997e039f89a850553a4e102112bc2d90f49c3a0f0987"}
 *
 * Go source:
 * func EnsureTrailingDirectorySeparator(path string) string {
 * 	if !HasTrailingDirectorySeparator(path) {
 * 		return path + "/"
 * 	}
 *
 * 	return path
 * }
 */
export function EnsureTrailingDirectorySeparator(path: string): string {
  if (!HasTrailingDirectorySeparator(path)) {
    return path + "/";
  }

  return path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::Path.EnsureTrailingDirectorySeparator","kind":"method","status":"implemented","sigHash":"cfbdef82a7efc517d401fbbd003e5a325e067e5211263defa20691fe4c33fe34","bodyHash":"beb46b3acafbf7cd53f402a3cab281d976c51abf5f9eeb357200569bc518eeab"}
 *
 * Go source:
 * func (p Path) EnsureTrailingDirectorySeparator() Path {
 * 	return Path(EnsureTrailingDirectorySeparator(string(p)))
 * }
 */
export function Path_EnsureTrailingDirectorySeparator(receiver: Path): Path {
  return EnsureTrailingDirectorySeparator(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetPathComponentsRelativeTo","kind":"func","status":"implemented","sigHash":"d3a2ac9f60ff4a22ceb9af74c7ced8830d7b5811b277aac213139cbf824a9b02","bodyHash":"5a6d85baece5181371cc1d6fdfd1dc244dee0747baf9e0e0785800d8f65242ed"}
 *
 * Go source:
 * func GetPathComponentsRelativeTo(from string, to string, options ComparePathsOptions) []string {
 * 	fromComponents := reducePathComponents(GetPathComponents(from, options.CurrentDirectory))
 * 	toComponents := reducePathComponents(GetPathComponents(to, options.CurrentDirectory))
 * 
 * 	start := 0
 * 	maxCommonComponents := min(len(fromComponents), len(toComponents))
 * 	stringEqualer := options.getEqualityComparer()
 * 	for ; start < maxCommonComponents; start++ {
 * 		fromComponent := fromComponents[start]
 * 		toComponent := toComponents[start]
 * 		if start == 0 {
 * 			if !stringutil.EquateStringCaseInsensitive(fromComponent, toComponent) {
 * 				break
 * 			}
 * 		} else {
 * 			if !stringEqualer(fromComponent, toComponent) {
 * 				break
 * 			}
 * 		}
 * 	}
 * 
 * 	if start == 0 {
 * 		return toComponents
 * 	}
 * 
 * 	numDotDotSlashes := len(fromComponents) - start
 * 	result := make([]string, 1+numDotDotSlashes+len(toComponents)-start)
 * 
 * 	result[0] = ""
 * 	i := 1
 * 	// Add all the relative components until we hit a common directory.
 * 	for range numDotDotSlashes {
 * 		result[i] = ".."
 * 		i++
 * 	}
 * 	// Now add all the remaining components of the "to" path.
 * 	for _, component := range toComponents[start:] {
 * 		result[i] = component
 * 		i++
 * 	}
 * 
 * 	return result
 * }
 */
export function GetPathComponentsRelativeTo(from_: string, to: string, options: ComparePathsOptions): GoSlice<string> {
  const fromComponents = reducePathComponents(GetPathComponents(from_, options.CurrentDirectory));
  const toComponents = reducePathComponents(GetPathComponents(to, options.CurrentDirectory));

  let start = 0;
  const maxCommonComponents = globalThis.Math.min(fromComponents.length, toComponents.length);
  const stringEqualer = ComparePathsOptions_getEqualityComparer(options);
  for (; start < maxCommonComponents; start++) {
    const fromComponent = fromComponents[start]!;
    const toComponent = toComponents[start]!;
    if (start === 0) {
      if (!stringutil.EquateStringCaseInsensitive(fromComponent, toComponent)) {
        break;
      }
    } else {
      if (!stringEqualer(fromComponent, toComponent)) {
        break;
      }
    }
  }

  if (start === 0) {
    return toComponents;
  }

  const numDotDotSlashes = fromComponents.length - start;
  const result: GoSlice<string> = new globalThis.Array<string>(1 + numDotDotSlashes + toComponents.length - start);

  result[0] = "";
  let i = 1;
  // Add all the relative components until we hit a common directory.
  for (let _n = 0; _n < numDotDotSlashes; _n++) {
    result[i] = "..";
    i++;
  }
  // Now add all the remaining components of the "to" path.
  for (const component of toComponents.slice(start)) {
    result[i] = component;
    i++;
  }

  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetRelativePathFromDirectory","kind":"func","status":"implemented","sigHash":"9f5553577ee9b895f01985504d2aaa43b4b10a71a6ffe25086c277ecfc4823c7","bodyHash":"056931acb4753e5e87a39c80220cec80ce275d6b1886be28c620ce455e2d5d99"}
 *
 * Go source:
 * func GetRelativePathFromDirectory(fromDirectory string, to string, options ComparePathsOptions) string {
 * 	if (GetRootLength(fromDirectory) > 0) != (GetRootLength(to) > 0) {
 * 		panic("paths must either both be absolute or both be relative")
 * 	}
 * 	pathComponents := GetPathComponentsRelativeTo(fromDirectory, to, options)
 * 	return GetPathFromPathComponents(pathComponents)
 * }
 */
export function GetRelativePathFromDirectory(fromDirectory: string, to: string, options: ComparePathsOptions): string {
  if (GetRootLength(fromDirectory) > 0 !== GetRootLength(to) > 0) {
    throw new globalThis.Error("paths must either both be absolute or both be relative");
  }
  const pathComponents = GetPathComponentsRelativeTo(fromDirectory, to, options);
  return GetPathFromPathComponents(pathComponents);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetRelativePathFromFile","kind":"func","status":"implemented","sigHash":"aeb55ad508e389deacc1899e1ada8de6d6837bda950a5a1c83eb88711a5c3ccd","bodyHash":"94871ec554533fbae222d8d165b0856a7b23b22a2fa38e951f98d0e6d279f5b8"}
 *
 * Go source:
 * func GetRelativePathFromFile(from string, to string, options ComparePathsOptions) string {
 * 	return EnsurePathIsNonModuleName(GetRelativePathFromDirectory(GetDirectoryPath(from), to, options))
 * }
 */
export function GetRelativePathFromFile(from_: string, to: string, options: ComparePathsOptions): string {
  return EnsurePathIsNonModuleName(GetRelativePathFromDirectory(GetDirectoryPath(from_), to, options));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ConvertToRelativePath","kind":"func","status":"implemented","sigHash":"7d4541b9d2ce9cda038820f2ac248d8789a1e54a9564d09374191a5652731e90","bodyHash":"1f3af44da4245c9ee823206f0227624c3697f466552e0ad651dd3b05412904d6"}
 *
 * Go source:
 * func ConvertToRelativePath(absoluteOrRelativePath string, options ComparePathsOptions) string {
 * 	if !IsRootedDiskPath(absoluteOrRelativePath) {
 * 		return absoluteOrRelativePath
 * 	}
 * 
 * 	return GetRelativePathToDirectoryOrUrl(options.CurrentDirectory, absoluteOrRelativePath, false /*isAbsolutePathAnUrl* /, options)
 * }
 */
export function ConvertToRelativePath(absoluteOrRelativePath: string, options: ComparePathsOptions): string {
  if (!IsRootedDiskPath(absoluteOrRelativePath)) {
    return absoluteOrRelativePath;
  }

  return GetRelativePathToDirectoryOrUrl(options.CurrentDirectory, absoluteOrRelativePath, false /*isAbsolutePathAnUrl*/, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetRelativePathToDirectoryOrUrl","kind":"func","status":"implemented","sigHash":"ef1cb18f03ba0c061edcc7ba7a81c528149657555e5c0d9268c9173887145260","bodyHash":"05a852e97fd16b924e001f6d67ff0fef402b361d3d9c7b82206953dc4f0266d7"}
 *
 * Go source:
 * func GetRelativePathToDirectoryOrUrl(directoryPathOrUrl string, relativeOrAbsolutePath string, isAbsolutePathAnUrl bool, options ComparePathsOptions) string {
 * 	pathComponents := GetPathComponentsRelativeTo(
 * 		directoryPathOrUrl,
 * 		relativeOrAbsolutePath,
 * 		options,
 * 	)
 * 
 * 	firstComponent := pathComponents[0]
 * 	if isAbsolutePathAnUrl && IsRootedDiskPath(firstComponent) {
 * 		var prefix string
 * 		if firstComponent[0] == DirectorySeparator {
 * 			prefix = "file://"
 * 		} else {
 * 			prefix = "file:///"
 * 		}
 * 		pathComponents[0] = prefix + firstComponent
 * 	}
 * 
 * 	return GetPathFromPathComponents(pathComponents)
 * }
 */
export function GetRelativePathToDirectoryOrUrl(directoryPathOrUrl: string, relativeOrAbsolutePath: string, isAbsolutePathAnUrl: bool, options: ComparePathsOptions): string {
  const pathComponents = GetPathComponentsRelativeTo(directoryPathOrUrl, relativeOrAbsolutePath, options);

  const firstComponent = pathComponents[0]!;
  if (isAbsolutePathAnUrl && IsRootedDiskPath(firstComponent)) {
    let prefix: string;
    if (firstComponent.charCodeAt(0) === DirectorySeparator) {
      prefix = "file://";
    } else {
      prefix = "file:///";
    }
    pathComponents[0] = prefix + firstComponent;
  }

  return GetPathFromPathComponents(pathComponents);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetBaseFileName","kind":"func","status":"implemented","sigHash":"6f5bd5289a3ccc61e47517fa302563516b6243f214d8344472340b3f85a90690","bodyHash":"8657bc5bd773adfe8d8c4f10ab4f0a098925052d1da0d485e6dd79fb9ec94a70"}
 *
 * Go source:
 * func GetBaseFileName(path string) string {
 * 	path = NormalizeSlashes(path)
 * 
 * 	// if the path provided is itself the root, then it has no file name.
 * 	rootLength := GetRootLength(path)
 * 	if rootLength == len(path) {
 * 		return ""
 * 	}
 * 
 * 	// return the trailing portion of the path starting after the last (non-terminal) directory
 * 	// separator but not including any trailing directory separator.
 * 	path = RemoveTrailingDirectorySeparator(path)
 * 	return path[max(GetRootLength(path), strings.LastIndex(path, string(DirectorySeparator))+1):]
 * }
 */
export function GetBaseFileName(path: string): string {
  path = NormalizeSlashes(path);

  // if the path provided is itself the root, then it has no file name.
  const rootLength = GetRootLength(path);
  if (rootLength === path.length) {
    return "";
  }

  // return the trailing portion of the path starting after the last (non-terminal) directory
  // separator but not including any trailing directory separator.
  path = RemoveTrailingDirectorySeparator(path);
  return path.slice(globalThis.Math.max(GetRootLength(path), path.lastIndexOf(globalThis.String.fromCharCode(DirectorySeparator)) + 1));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetAnyExtensionFromPath","kind":"func","status":"implemented","sigHash":"09845c4bb572210829a9da4f1c86d2ee47ca76b25c3a63fd38d4621bb0b15537","bodyHash":"be833ccc747e1710b2f9904926a0b7413a33fd3a8d4fc550e77118851e398bbd"}
 *
 * Go source:
 * func GetAnyExtensionFromPath(path string, extensions []string, ignoreCase bool) string {
 * 	// Retrieves any string from the final "." onwards from a base file name.
 * 	// Unlike extensionFromPath, which throws an exception on unrecognized extensions.
 * 	if len(extensions) > 0 {
 * 		return getAnyExtensionFromPathWorker(RemoveTrailingDirectorySeparator(path), extensions, stringutil.GetStringEqualityComparer(ignoreCase))
 * 	}
 * 
 * 	baseFileName := GetBaseFileName(path)
 * 	extensionIndex := strings.LastIndex(baseFileName, ".")
 * 	if extensionIndex >= 0 {
 * 		return baseFileName[extensionIndex:]
 * 	}
 * 	return ""
 * }
 */
export function GetAnyExtensionFromPath(path: string, extensions: GoSlice<string>, ignoreCase: bool): string {
  // Retrieves any string from the final "." onwards from a base file name.
  // Unlike extensionFromPath, which throws an exception on unrecognized extensions.
  if (extensions.length > 0) {
    return getAnyExtensionFromPathWorker(RemoveTrailingDirectorySeparator(path), extensions, stringutil.GetStringEqualityComparer(ignoreCase));
  }

  const baseFileName = GetBaseFileName(path);
  const extensionIndex = baseFileName.lastIndexOf(".");
  if (extensionIndex >= 0) {
    return baseFileName.slice(extensionIndex);
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::getAnyExtensionFromPathWorker","kind":"func","status":"implemented","sigHash":"e0a93f066dea3c56624c155cf6f7aa5f4f760aba081a729202000bd2529e72ec","bodyHash":"e8de912987a5290bdebb7e1644516148a63b6ada2e728460af4f3c99c6b83c18"}
 *
 * Go source:
 * func getAnyExtensionFromPathWorker(path string, extensions []string, stringEqualityComparer func(a, b string) bool) string {
 * 	for _, extension := range extensions {
 * 		result := tryGetExtensionFromPath(path, extension, stringEqualityComparer)
 * 		if result != "" {
 * 			return result
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function getAnyExtensionFromPathWorker(path: string, extensions: GoSlice<string>, stringEqualityComparer: (a: string, b: string) => bool): string {
  for (const extension of extensions) {
    const result = tryGetExtensionFromPath(path, extension, stringEqualityComparer);
    if (result !== "") {
      return result;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::tryGetExtensionFromPath","kind":"func","status":"implemented","sigHash":"8f912eba982dc277454b5d20814ec09ca979808d4cb95ad2ff2ecc4f8df68f7b","bodyHash":"488385a7fa624dc5c2330df583e9b643d9ce0f36b821cef915bdf5f3cca499e8"}
 *
 * Go source:
 * func tryGetExtensionFromPath(path string, extension string, stringEqualityComparer func(a, b string) bool) string {
 * 	if !strings.HasPrefix(extension, ".") {
 * 		extension = "." + extension
 * 	}
 * 	if len(path) >= len(extension) && path[len(path)-len(extension)] == '.' {
 * 		pathExtension := path[len(path)-len(extension):]
 * 		if stringEqualityComparer(pathExtension, extension) {
 * 			return pathExtension
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function tryGetExtensionFromPath(path: string, extension: string, stringEqualityComparer: (a: string, b: string) => bool): string {
  if (!strings.HasPrefix(extension, ".")) {
    extension = "." + extension;
  }
  if (path.length >= extension.length && path.charCodeAt(path.length - extension.length) === CHAR_DOT) {
    const pathExtension = path.slice(path.length - extension.length);
    if (stringEqualityComparer(pathExtension, extension)) {
      return pathExtension;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::PathIsRelative","kind":"func","status":"implemented","sigHash":"3dec5fb5afca07efec276397fdc8e4ae1b2c7331f997f61c31d92a9e7c207796","bodyHash":"d789e435d6283144b38c0b29f119e5ea7a8b55bdd25b6f0a2f0962861e135005"}
 *
 * Go source:
 * func PathIsRelative(path string) bool {
 * 	// True if path is ".", "..", or starts with "./", "../", ".\\", or "..\\".
 * 
 * 	if path == "." || path == ".." {
 * 		return true
 * 	}
 * 
 * 	if len(path) >= 2 && path[0] == '.' && (path[1] == '/' || path[1] == '\\') {
 * 		return true
 * 	}
 * 
 * 	if len(path) >= 3 && path[0] == '.' && path[1] == '.' && (path[2] == '/' || path[2] == '\\') {
 * 		return true
 * 	}
 * 
 * 	return false
 * }
 */
export function PathIsRelative(path: string): bool {
  // True if path is ".", "..", or starts with "./", "../", ".\\", or "..\\".

  if (path === "." || path === "..") {
    return true;
  }

  if (path.length >= 2 && path.charCodeAt(0) === CHAR_DOT && (path.charCodeAt(1) === CHAR_SLASH || path.charCodeAt(1) === CHAR_BACKSLASH)) {
    return true;
  }

  if (path.length >= 3 && path.charCodeAt(0) === CHAR_DOT && path.charCodeAt(1) === CHAR_DOT && (path.charCodeAt(2) === CHAR_SLASH || path.charCodeAt(2) === CHAR_BACKSLASH)) {
    return true;
  }

  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::EnsurePathIsNonModuleName","kind":"func","status":"implemented","sigHash":"beb07a45ca12ed9281725247063dd51e901c5cb4f974b5bd69f4bd16ca6ec028","bodyHash":"c0d7171c92ed0f710191471a9634b849d0152a53c618a4dfe92638eeba5f0e0e"}
 *
 * Go source:
 * func EnsurePathIsNonModuleName(path string) string {
 * 	if !PathIsAbsolute(path) && !PathIsRelative(path) {
 * 		return "./" + path
 * 	}
 * 	return path
 * }
 */
export function EnsurePathIsNonModuleName(path: string): string {
  if (!PathIsAbsolute(path) && !PathIsRelative(path)) {
    return "./" + path;
  }
  return path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::IsExternalModuleNameRelative","kind":"func","status":"implemented","sigHash":"20fc6a76f2efe330023e5482cea054c3ad8e1ebd6988ff4e7b13370d8a30a6f8","bodyHash":"6d163dad6eb2b74e7b6e16c5c04f4a89d9f9bf6e7705150e2abc8b324ddd935d"}
 *
 * Go source:
 * func IsExternalModuleNameRelative(moduleName string) bool {
 * 	// TypeScript 1.0 spec (April 2014): 11.2.1
 * 	// An external module name is "relative" if the first term is "." or "..".
 * 	// Update: We also consider a path like `C:\foo.ts` "relative" because we do not search for it in `node_modules` or treat it as an ambient module.
 * 	return PathIsRelative(moduleName) || IsRootedDiskPath(moduleName)
 * }
 */
export function IsExternalModuleNameRelative(moduleName: string): bool {
  // TypeScript 1.0 spec (April 2014): 11.2.1
  // An external module name is "relative" if the first term is "." or "..".
  // Update: We also consider a path like `C:\foo.ts` "relative" because we do not search for it in `node_modules` or treat it as an ambient module.
  return PathIsRelative(moduleName) || IsRootedDiskPath(moduleName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::type::ComparePathsOptions","kind":"type","status":"implemented","sigHash":"f1bee15ad327306037dcddc7a9d7f1b31a541df2637aba63470009cf663691fa","bodyHash":"d24dce2e69eb5d8b9dd83ce162ba3d7f2094b68dbc1657227df587eb5b9c94a8"}
 *
 * Go source:
 * ComparePathsOptions struct {
 * 	UseCaseSensitiveFileNames bool
 * 	CurrentDirectory          string
 * }
 */
export interface ComparePathsOptions {
  UseCaseSensitiveFileNames: bool;
  CurrentDirectory: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::ComparePathsOptions.GetComparer","kind":"method","status":"implemented","sigHash":"9ad42231c770e992cc56b1fc75e34a72649da194d7d2f672ec6eb1f7d2a72f38","bodyHash":"aa3bd9b99f999167b1a4e11af2c036931161538d73fa75815c3879bb899b1552"}
 *
 * Go source:
 * func (o ComparePathsOptions) GetComparer() func(a, b string) int {
 * 	return stringutil.GetStringComparer(!o.UseCaseSensitiveFileNames)
 * }
 */
export function ComparePathsOptions_GetComparer(receiver: ComparePathsOptions): (a: string, b: string) => int {
  return stringutil.GetStringComparer(!receiver.UseCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::ComparePathsOptions.getEqualityComparer","kind":"method","status":"implemented","sigHash":"f39b333ff1d28a5c02c18d721897e15d0382ff94f7dc08195c47c5ae0c01558d","bodyHash":"5e87bba8d7e3dff489795dba2b435c95542e107605499c9882d38e9a4bcf5bf8"}
 *
 * Go source:
 * func (o ComparePathsOptions) getEqualityComparer() func(a, b string) bool {
 * 	return stringutil.GetStringEqualityComparer(!o.UseCaseSensitiveFileNames)
 * }
 */
export function ComparePathsOptions_getEqualityComparer(receiver: ComparePathsOptions): (a: string, b: string) => bool {
  return stringutil.GetStringEqualityComparer(!receiver.UseCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ComparePaths","kind":"func","status":"implemented","sigHash":"f86450b607d533b0aed5dff222cfd4881f09bfe45045abeb76b207ef1be052c3","bodyHash":"152369f0cf7d90b050148734c60fe3c1ec8a9d8d3c18598d58f778ca947cba38"}
 *
 * Go source:
 * func ComparePaths(a string, b string, options ComparePathsOptions) int {
 * 	a = CombinePaths(options.CurrentDirectory, a)
 * 	b = CombinePaths(options.CurrentDirectory, b)
 * 
 * 	if a == b {
 * 		return 0
 * 	}
 * 	if a == "" {
 * 		return -1
 * 	}
 * 	if b == "" {
 * 		return 1
 * 	}
 * 
 * 	// NOTE: Performance optimization - shortcut if the root segments differ as there would be no
 * 	//       need to perform path reduction.
 * 	aRoot := a[:GetRootLength(a)]
 * 	bRoot := b[:GetRootLength(b)]
 * 	result := stringutil.CompareStringsCaseInsensitive(aRoot, bRoot)
 * 	if result != 0 {
 * 		return result
 * 	}
 * 
 * 	// NOTE: Performance optimization - shortcut if there are no relative path segments in
 * 	//       the non-root portion of the path
 * 	aRest := a[len(aRoot):]
 * 	bRest := b[len(bRoot):]
 * 	if !hasRelativePathSegment(aRest) && !hasRelativePathSegment(bRest) {
 * 		return options.GetComparer()(aRest, bRest)
 * 	}
 * 
 * 	// The path contains a relative path segment. Normalize the paths and perform a slower component
 * 	// by component comparison.
 * 	aComponents := reducePathComponents(GetPathComponents(a, ""))
 * 	bComponents := reducePathComponents(GetPathComponents(b, ""))
 * 	sharedLength := min(len(aComponents), len(bComponents))
 * 	for i := 1; i < sharedLength; i++ {
 * 		result := options.GetComparer()(aComponents[i], bComponents[i])
 * 		if result != 0 {
 * 			return result
 * 		}
 * 	}
 * 	return cmp.Compare(len(aComponents), len(bComponents))
 * }
 */
export function ComparePaths(a: string, b: string, options: ComparePathsOptions): int {
  a = CombinePaths(options.CurrentDirectory, a);
  b = CombinePaths(options.CurrentDirectory, b);

  if (a === b) {
    return 0;
  }
  if (a === "") {
    return -1;
  }
  if (b === "") {
    return 1;
  }

  // NOTE: Performance optimization - shortcut if the root segments differ as there would be no
  //       need to perform path reduction.
  const aRoot = a.slice(0, GetRootLength(a));
  const bRoot = b.slice(0, GetRootLength(b));
  const result = stringutil.CompareStringsCaseInsensitive(aRoot, bRoot);
  if (result !== 0) {
    return result;
  }

  // NOTE: Performance optimization - shortcut if there are no relative path segments in
  //       the non-root portion of the path
  const aRest = a.slice(aRoot.length);
  const bRest = b.slice(bRoot.length);
  if (!hasRelativePathSegment(aRest) && !hasRelativePathSegment(bRest)) {
    return ComparePathsOptions_GetComparer(options)(aRest, bRest);
  }

  // The path contains a relative path segment. Normalize the paths and perform a slower component
  // by component comparison.
  const aComponents = reducePathComponents(GetPathComponents(a, ""));
  const bComponents = reducePathComponents(GetPathComponents(b, ""));
  const sharedLength = globalThis.Math.min(aComponents.length, bComponents.length);
  for (let i = 1; i < sharedLength; i++) {
    const result = ComparePathsOptions_GetComparer(options)(aComponents[i]!, bComponents[i]!);
    if (result !== 0) {
      return result;
    }
  }
  return cmp.Compare(aComponents.length, bComponents.length);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ComparePathsCaseSensitive","kind":"func","status":"implemented","sigHash":"1e9da1b25ea5d46fc465c7ce2e4e85c31c7ea30b4e2fcce02d76a5317f5e5d4e","bodyHash":"be512da97e9a42d8dafd8e0e21bd9a3847cab9d2765dc4bbab5a72f29fd7aec2"}
 *
 * Go source:
 * func ComparePathsCaseSensitive(a string, b string, currentDirectory string) int {
 * 	return ComparePaths(a, b, ComparePathsOptions{UseCaseSensitiveFileNames: true, CurrentDirectory: currentDirectory})
 * }
 */
export function ComparePathsCaseSensitive(a: string, b: string, currentDirectory: string): int {
  return ComparePaths(a, b, { UseCaseSensitiveFileNames: true, CurrentDirectory: currentDirectory });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ComparePathsCaseInsensitive","kind":"func","status":"implemented","sigHash":"9ff2c6519a08a03df3d83327a1d7cfa04b2982803d2aadb32eb2a76e941a9d1e","bodyHash":"aae3d3d3116edf9a6a217678cbde3293fda3f7a364ee632fa7d01d326c638166"}
 *
 * Go source:
 * func ComparePathsCaseInsensitive(a string, b string, currentDirectory string) int {
 * 	return ComparePaths(a, b, ComparePathsOptions{UseCaseSensitiveFileNames: false, CurrentDirectory: currentDirectory})
 * }
 */
export function ComparePathsCaseInsensitive(a: string, b: string, currentDirectory: string): int {
  return ComparePaths(a, b, { UseCaseSensitiveFileNames: false, CurrentDirectory: currentDirectory });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ContainsPath","kind":"func","status":"implemented","sigHash":"18c7e3ac770f583a89c70218590949a1025ee02b40fb0ab6a616f0212e7c5589","bodyHash":"9c92556bb2d78104c343a48d693da8c9edd165129c3f057929691a93ff51460b"}
 *
 * Go source:
 * func ContainsPath(parent string, child string, options ComparePathsOptions) bool {
 * 	parent = CombinePaths(options.CurrentDirectory, parent)
 * 	child = CombinePaths(options.CurrentDirectory, child)
 * 	if parent == "" || child == "" {
 * 		return false
 * 	}
 * 	if parent == child {
 * 		return true
 * 	}
 * 	parentComponents := reducePathComponents(GetPathComponents(parent, ""))
 * 	childComponents := reducePathComponents(GetPathComponents(child, ""))
 * 	if len(childComponents) < len(parentComponents) {
 * 		return false
 * 	}
 * 
 * 	componentComparer := options.getEqualityComparer()
 * 	for i, parentComponent := range parentComponents {
 * 		var comparer func(a, b string) bool
 * 		if i == 0 {
 * 			comparer = stringutil.EquateStringCaseInsensitive
 * 		} else {
 * 			comparer = componentComparer
 * 		}
 * 		if !comparer(parentComponent, childComponents[i]) {
 * 			return false
 * 		}
 * 	}
 * 
 * 	return true
 * }
 */
export function ContainsPath(parent: string, child: string, options: ComparePathsOptions): bool {
  parent = CombinePaths(options.CurrentDirectory, parent);
  child = CombinePaths(options.CurrentDirectory, child);
  if (parent === "" || child === "") {
    return false;
  }
  if (parent === child) {
    return true;
  }
  const parentComponents = reducePathComponents(GetPathComponents(parent, ""));
  const childComponents = reducePathComponents(GetPathComponents(child, ""));
  if (childComponents.length < parentComponents.length) {
    return false;
  }

  const componentComparer = ComparePathsOptions_getEqualityComparer(options);
  for (let i = 0; i < parentComponents.length; i++) {
    const parentComponent = parentComponents[i]!;
    let comparer: (a: string, b: string) => bool;
    if (i === 0) {
      comparer = stringutil.EquateStringCaseInsensitive;
    } else {
      comparer = componentComparer;
    }
    if (!comparer(parentComponent, childComponents[i]!)) {
      return false;
    }
  }

  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::method::Path.ContainsPath","kind":"method","status":"implemented","sigHash":"10a92167bfc70f8ac36f78defa1bcd7d83262b4ff1eb6577a5a7b28a78b12753","bodyHash":"41986d57b69c234608f4b76bda79d4e8c3d74fbd1fedcad86901ddda66986cfc"}
 *
 * Go source:
 * func (p Path) ContainsPath(child Path) bool {
 * 	if len(p) == 0 {
 * 		return false
 * 	}
 * 	return p == child || len(child) > len(p) && strings.HasPrefix(string(child), string(p)) && (p[len(p)-1] == '/' || child[len(p)] == '/')
 * }
 */
export function Path_ContainsPath(receiver: Path, child: Path): bool {
  if (receiver.length === 0) {
    return false;
  }
  return receiver === child || (child.length > receiver.length && strings.HasPrefix(child, receiver) && (receiver.charCodeAt(receiver.length - 1) === CHAR_SLASH || child.charCodeAt(receiver.length) === CHAR_SLASH));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::FileExtensionIs","kind":"func","status":"implemented","sigHash":"52c8aa096f7d604ae5c3981388b1a109a833a3c9a2a6db5ca46cb7001db2cd91","bodyHash":"c6cd19dae0a3f5c1c3cb4c84a1eac8a58c74bf312a13034e965dab809b8a4269"}
 *
 * Go source:
 * func FileExtensionIs(path string, extension string) bool {
 * 	return len(path) > len(extension) && strings.HasSuffix(path, extension)
 * }
 */
export function FileExtensionIs(path: string, extension: string): bool {
  return path.length > extension.length && strings.HasSuffix(path, extension);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ForEachAncestorDirectoryStoppingAtGlobalCache","kind":"func","status":"implemented","sigHash":"0356b04f3dd886a51f1660fe51149012eb4b73b4f58bb64b0a92961be4fab077","bodyHash":"d46ca6690f5d18214dba0c553ee6024f57ff84a44561af9ef15014a6a7ec3340"}
 *
 * Go source:
 * func ForEachAncestorDirectoryStoppingAtGlobalCache[T any](
 * 	globalCacheLocation string,
 * 	directory string,
 * 	callback func(directory string) (result T, stop bool),
 * ) T {
 * 	result, _ := ForEachAncestorDirectory(directory, func(ancestorDirectory string) (T, bool) {
 * 		result, stop := callback(ancestorDirectory)
 * 		if stop || ancestorDirectory == globalCacheLocation {
 * 			return result, true
 * 		}
 * 		return result, false
 * 	})
 * 	return result
 * }
 */
export function ForEachAncestorDirectoryStoppingAtGlobalCache<T>(globalCacheLocation: string, directory: string, callback: (directory: string) => [T, bool]): T {
  const [result] = ForEachAncestorDirectory<T>(directory, (ancestorDirectory: string): [T, bool] => {
    const [result, stop] = callback(ancestorDirectory);
    if (stop || ancestorDirectory === globalCacheLocation) {
      return [result, true];
    }
    return [result, false];
  });
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ForEachAncestorDirectory","kind":"func","status":"implemented","sigHash":"6c00ad2499515e2ef162ee822663fd2c811471a883b248d5d0d4bc804bc08aee","bodyHash":"0b47593ec6332f51a66c5e493570a6d67a531eacd66e277ae5cd0e5ef0aa8dd2"}
 *
 * Go source:
 * func ForEachAncestorDirectory[T any](directory string, callback func(directory string) (result T, stop bool)) (result T, ok bool) {
 * 	for {
 * 		result, stop := callback(directory)
 * 		if stop {
 * 			return result, true
 * 		}
 * 
 * 		parentPath := GetDirectoryPath(directory)
 * 		if parentPath == directory {
 * 			var zero T
 * 			return zero, false
 * 		}
 * 
 * 		directory = parentPath
 * 	}
 * }
 */
export function ForEachAncestorDirectory<T>(directory: string, callback: (directory: string) => [T, bool]): [T, bool] {
  for (;;) {
    const [result, stop] = callback(directory);
    if (stop) {
      return [result, true];
    }

    const parentPath = GetDirectoryPath(directory);
    if (parentPath === directory) {
      const zero = undefined as T;
      return [zero, false];
    }

    directory = parentPath;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::ForEachAncestorDirectoryPath","kind":"func","status":"implemented","sigHash":"4cec0fe3612f19afa164ee3ebd4ba0148e63660e69929d354ae5742cf2cf57d5","bodyHash":"dc2d231bacd797549bf4df38ddb12a2d17b0ed4dd4608f5d775594a4f1c34b9e"}
 *
 * Go source:
 * func ForEachAncestorDirectoryPath[T any](directory Path, callback func(directory Path) (result T, stop bool)) (result T, ok bool) {
 * 	return ForEachAncestorDirectory(string(directory), func(directory string) (T, bool) {
 * 		return callback(Path(directory))
 * 	})
 * }
 */
export function ForEachAncestorDirectoryPath<T>(directory: Path, callback: (directory: Path) => [T, bool]): [T, bool] {
  return ForEachAncestorDirectory<T>(directory, (directory: string): [T, bool] => {
    return callback(directory);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::HasExtension","kind":"func","status":"implemented","sigHash":"527600f113b3dbde28e74316227b595ea53b22454a346a7880a866083ca9e57f","bodyHash":"f3c54d35d9b46743683c24cf45aad32090cab01ad60a4b5327dc0ba35322815e"}
 *
 * Go source:
 * func HasExtension(fileName string) bool {
 * 	return strings.Contains(GetBaseFileName(fileName), ".")
 * }
 */
export function HasExtension(fileName: string): bool {
  return strings.Contains(GetBaseFileName(fileName), ".");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::SplitVolumePath","kind":"func","status":"implemented","sigHash":"9e788b75c992493bb053f5e1af0b1541c6cef04aa35c5669464e5b530912fd3d","bodyHash":"99b2964acc363f3bb2df44ee7ac61649613e6f0f396b597016e5926000097bf1"}
 *
 * Go source:
 * func SplitVolumePath(path string) (volume string, rest string, ok bool) {
 * 	if len(path) >= 2 && IsVolumeCharacter(path[0]) && path[1] == ':' {
 * 		return strings.ToLower(path[0:2]), path[2:], true
 * 	}
 * 	return "", path, false
 * }
 */
export function SplitVolumePath(path: string): [string, string, bool] {
  if (path.length >= 2 && IsVolumeCharacter(path.charCodeAt(0)) && path.charCodeAt(1) === CHAR_COLON) {
    return [strings.ToLower(path.slice(0, 2)), path.slice(2), true];
  }
  return ["", path, false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::GetCommonParents","kind":"func","status":"implemented","sigHash":"696b9ed205e7cf2a768c3a21cc6c5387bdee9f363fbfbb38daf36837f83a3d27","bodyHash":"9cd23a80ec2864bfddbbd2c711ad6a10605b68606ce965ac129c7089c483f462"}
 *
 * Go source:
 * func GetCommonParents(
 * 	paths []string,
 * 	minComponents int,
 * 	getPathComponents func(path string, currentDirectory string) []string,
 * 	options ComparePathsOptions,
 * ) (parents []string, ignored map[string]struct{}) {
 * 	if minComponents < 1 {
 * 		panic("minComponents must be at least 1")
 * 	}
 * 	if len(paths) == 0 {
 * 		return nil, nil
 * 	}
 * 	if len(paths) == 1 {
 * 		if len(reducePathComponents(getPathComponents(paths[0], options.CurrentDirectory))) < minComponents {
 * 			return nil, map[string]struct{}{paths[0]: {}}
 * 		}
 * 		return paths, nil
 * 	}
 * 
 * 	ignored = make(map[string]struct{})
 * 	pathComponents := make([][]string, 0, len(paths))
 * 	for _, path := range paths {
 * 		components := reducePathComponents(getPathComponents(path, options.CurrentDirectory))
 * 		if len(components) < minComponents {
 * 			ignored[path] = struct{}{}
 * 		} else {
 * 			pathComponents = append(pathComponents, components)
 * 		}
 * 	}
 * 
 * 	results := getCommonParentsWorker(pathComponents, minComponents, options)
 * 	resultPaths := make([]string, len(results))
 * 	for i, comps := range results {
 * 		resultPaths[i] = GetPathFromPathComponents(comps)
 * 	}
 * 
 * 	return resultPaths, ignored
 * }
 */
export function GetCommonParents(paths: GoSlice<string>, minComponents: int, getPathComponents: (path: string, currentDirectory: string) => GoSlice<string>, options: ComparePathsOptions): [GoSlice<string>, GoMap<string, { readonly __tsgoEmpty?: never }>] {
  if (minComponents < 1) {
    throw new globalThis.Error("minComponents must be at least 1");
  }
  if (paths.length === 0) {
    return [[], new globalThis.Map<string, { readonly __tsgoEmpty?: never }>()];
  }
  if (paths.length === 1) {
    if (reducePathComponents(getPathComponents(paths[0]!, options.CurrentDirectory)).length < minComponents) {
      const ignoredSingle = new globalThis.Map<string, { readonly __tsgoEmpty?: never }>();
      ignoredSingle.set(paths[0]!, {});
      return [[], ignoredSingle];
    }
    return [paths, new globalThis.Map<string, { readonly __tsgoEmpty?: never }>()];
  }

  const ignored = new globalThis.Map<string, { readonly __tsgoEmpty?: never }>();
  const pathComponents: GoSlice<GoSlice<string>> = [];
  for (const path of paths) {
    const components = reducePathComponents(getPathComponents(path, options.CurrentDirectory));
    if (components.length < minComponents) {
      ignored.set(path, {});
    } else {
      pathComponents.push(components);
    }
  }

  const results = getCommonParentsWorker(pathComponents, minComponents, options);
  const resultPaths: GoSlice<string> = new globalThis.Array<string>(results.length);
  for (let i = 0; i < results.length; i++) {
    resultPaths[i] = GetPathFromPathComponents(results[i]!);
  }

  return [resultPaths, ignored];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::getCommonParentsWorker","kind":"func","status":"implemented","sigHash":"bf649fb8c7ac6e4ebf25b631d9c5c672e67748af4b4e7b8a0a8d64da62585e16","bodyHash":"8678e7842e09dfd07e6e8a44db995a3b077080ab0e6b4f14f5d212e4108ae5f2"}
 *
 * Go source:
 * func getCommonParentsWorker(componentGroups [][]string, minComponents int, options ComparePathsOptions) [][]string {
 * 	if len(componentGroups) == 0 {
 * 		return nil
 * 	}
 * 	// Determine the maximum depth we can consider
 * 	maxDepth := len(componentGroups[0])
 * 	for _, comps := range componentGroups[1:] {
 * 		if l := len(comps); l < maxDepth {
 * 			maxDepth = l
 * 		}
 * 	}
 * 
 * 	equality := options.getEqualityComparer()
 * 	for lastCommonIndex := range maxDepth {
 * 		candidate := componentGroups[0][lastCommonIndex]
 * 		for j, comps := range componentGroups[1:] {
 * 			if !equality(candidate, comps[lastCommonIndex]) { // divergence
 * 				if lastCommonIndex < minComponents {
 * 					// Not enough components, we need to fan out
 * 					orderedGroups := make([]Path, 0, len(componentGroups)-j)
 * 					newGroups := make(map[Path]struct {
 * 						head  []string
 * 						tails [][]string
 * 					})
 * 					for _, g := range componentGroups {
 * 						key := ToPath(g[lastCommonIndex], options.CurrentDirectory, options.UseCaseSensitiveFileNames)
 * 						if _, ok := newGroups[key]; !ok {
 * 							orderedGroups = append(orderedGroups, key)
 * 						}
 * 						newGroups[key] = struct {
 * 							head  []string
 * 							tails [][]string
 * 						}{
 * 							head:  g[:lastCommonIndex+1],
 * 							tails: append(newGroups[key].tails, g[lastCommonIndex+1:]),
 * 						}
 * 					}
 * 					slices.Sort(orderedGroups)
 * 					result := make([][]string, 0, len(newGroups))
 * 					for _, key := range orderedGroups {
 * 						group := newGroups[key]
 * 						subResults := getCommonParentsWorker(group.tails, minComponents-(lastCommonIndex+1), options)
 * 						for _, sr := range subResults {
 * 							result = append(result, append(group.head, sr...))
 * 						}
 * 					}
 * 					return result
 * 				}
 * 				return [][]string{componentGroups[0][:lastCommonIndex]}
 * 			}
 * 		}
 * 	}
 * 
 * 	return [][]string{componentGroups[0][:maxDepth]}
 * }
 */
export function getCommonParentsWorker(componentGroups: GoSlice<GoSlice<string>>, minComponents: int, options: ComparePathsOptions): GoSlice<GoSlice<string>> {
  if (componentGroups.length === 0) {
    return [];
  }
  // Determine the maximum depth we can consider
  let maxDepth = componentGroups[0]!.length;
  for (const comps of componentGroups.slice(1)) {
    const l = comps.length;
    if (l < maxDepth) {
      maxDepth = l;
    }
  }

  const equality = ComparePathsOptions_getEqualityComparer(options);
  for (let lastCommonIndex = 0; lastCommonIndex < maxDepth; lastCommonIndex++) {
    const candidate = componentGroups[0]![lastCommonIndex]!;
    {
      const rest = componentGroups.slice(1);
      for (let j = 0; j < rest.length; j++) {
        const comps = rest[j]!;
        if (!equality(candidate, comps[lastCommonIndex]!)) {
          // divergence
          if (lastCommonIndex < minComponents) {
            // Not enough components, we need to fan out
            const orderedGroups: GoSlice<Path> = [];
            const newGroups = new globalThis.Map<Path, { head: GoSlice<string>; tails: GoSlice<GoSlice<string>> }>();
            for (const g of componentGroups) {
              const key = ToPath(g[lastCommonIndex]!, options.CurrentDirectory, options.UseCaseSensitiveFileNames);
              if (!newGroups.has(key)) {
                orderedGroups.push(key);
              }
              const existing = newGroups.get(key);
              const existingTails = existing !== undefined ? existing.tails : [];
              newGroups.set(key, {
                head: g.slice(0, lastCommonIndex + 1),
                tails: [...existingTails, g.slice(lastCommonIndex + 1)],
              });
            }
            slices.Sort(orderedGroups);
            const result: GoSlice<GoSlice<string>> = [];
            for (const key of orderedGroups) {
              const group = newGroups.get(key)!;
              const subResults = getCommonParentsWorker(group.tails, minComponents - (lastCommonIndex + 1), options);
              for (const sr of subResults) {
                result.push([...group.head, ...sr]);
              }
            }
            return result;
          }
          return [componentGroups[0]!.slice(0, lastCommonIndex)];
        }
      }
    }
  }

  return [componentGroups[0]!.slice(0, maxDepth)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::StartsWithDirectory","kind":"func","status":"implemented","sigHash":"15f26c08b4ca94c86f21f1981345179f0365fff0a9d8fd52a8075dd8fa2e6fdf","bodyHash":"8af4657e642b48dc223e38579ae61993dcf0576de0ab7502fcda61d4b94988b8"}
 *
 * Go source:
 * func StartsWithDirectory(fileName string, directoryName string, useCaseSensitiveFileNames bool) bool {
 * 	if directoryName == "" {
 * 		return false
 * 	}
 * 
 * 	canonicalFileName := GetCanonicalFileName(fileName, useCaseSensitiveFileNames)
 * 	canonicalDirectoryName := GetCanonicalFileName(directoryName, useCaseSensitiveFileNames)
 * 	canonicalDirectoryName = strings.TrimSuffix(canonicalDirectoryName, "/")
 * 	canonicalDirectoryName = strings.TrimSuffix(canonicalDirectoryName, "\\")
 * 
 * 	return strings.HasPrefix(canonicalFileName, canonicalDirectoryName+"/") ||
 * 		strings.HasPrefix(canonicalFileName, canonicalDirectoryName+"\\")
 * }
 */
export function StartsWithDirectory(fileName: string, directoryName: string, useCaseSensitiveFileNames: bool): bool {
  if (directoryName === "") {
    return false;
  }

  const canonicalFileName = GetCanonicalFileName(fileName, useCaseSensitiveFileNames);
  let canonicalDirectoryName = GetCanonicalFileName(directoryName, useCaseSensitiveFileNames);
  canonicalDirectoryName = strings.TrimSuffix(canonicalDirectoryName, "/");
  canonicalDirectoryName = strings.TrimSuffix(canonicalDirectoryName, "\\");

  return strings.HasPrefix(canonicalFileName, canonicalDirectoryName + "/") || strings.HasPrefix(canonicalFileName, canonicalDirectoryName + "\\");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/path.go::func::CompareNumberOfDirectorySeparators","kind":"func","status":"implemented","sigHash":"f9dbd5a56140131ff21fa4b299d431889e849ea166fa118ed50aabd48dcba575","bodyHash":"54d538fdcad023f7f3b28590b7d2fa22171acd83f115cc2e11656fd69d1ba036"}
 *
 * Go source:
 * func CompareNumberOfDirectorySeparators(path1, path2 string) int {
 * 	return cmp.Compare(strings.Count(path1, "/"), strings.Count(path2, "/"))
 * }
 */
export function CompareNumberOfDirectorySeparators(path1: string, path2: string): int {
  return cmp.Compare(strings.Count(path1, "/"), strings.Count(path2, "/"));
}

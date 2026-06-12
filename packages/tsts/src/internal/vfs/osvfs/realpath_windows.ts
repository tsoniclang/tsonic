import type { int } from "@tsonic/core/types.js";
import type { GoError } from "../../../go/compat.js";
import * as goErrors from "../../../go/errors.js";
import * as goOs from "../../../go/os.js";
import * as syscall from "../../../go/syscall.js";
import * as windows from "../../../go/golang.org/x/sys/windows.js";
import type { Handle } from "../../../go/golang.org/x/sys/windows.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_windows.go::func::realpath","kind":"func","status":"implemented","sigHash":"508722058bcc5fa76607b13bc59e8f966d9f9163f69d336a8e1b7975a4fdb721","bodyHash":"c6685bdb1c35701c8c4197feecd86a69e6eed5e8699e492c064c93b8c5e06ad9"}
 *
 * Go source:
 * func realpath(path string) (string, error) {
 * 	var h windows.Handle
 * 	if len(path) < 248 {
 * 		var err error
 * 		h, err = openMetadata(path)
 * 		if err != nil {
 * 			return "", err
 * 		}
 * 		defer windows.CloseHandle(h) //nolint:errcheck
 * 	} else {
 * 		// For long paths, defer to os.Open to run the path through fixLongPath.
 * 		f, err := os.Open(path)
 * 		if err != nil {
 * 			return "", err
 * 		}
 * 		defer f.Close()
 *
 * 		// Works on directories too since https://go.dev/cl/405275.
 * 		h = windows.Handle(f.Fd())
 * 	}
 *
 * 	// based on https://github.com/golang/go/blob/f4e3ec3dbe3b8e04a058d266adf8e048bab563f2/src/os/file_windows.go#L389
 *
 * 	const _VOLUME_NAME_DOS = 0
 *
 * 	buf := make([]uint16, 310) // https://github.com/microsoft/go-winio/blob/3c9576c9346a1892dee136329e7e15309e82fb4f/internal/stringbuffer/wstring.go#L13
 * 	for {
 * 		n, err := windows.GetFinalPathNameByHandle(h, &buf[0], uint32(len(buf)), _VOLUME_NAME_DOS)
 * 		if err != nil {
 * 			return "", err
 * 		}
 * 		if n < uint32(len(buf)) {
 * 			break
 * 		}
 * 		buf = make([]uint16, n)
 * 	}
 *
 * 	s := syscall.UTF16ToString(buf)
 * 	if len(s) > 4 && s[:4] == `\\?\` {
 * 		s = s[4:]
 * 		if len(s) > 3 && s[:3] == `UNC` {
 * 			// return path like \\server\share\...
 * 			return `\` + s[3:], nil
 * 		}
 * 		return s, nil
 * 	}
 *
 * 	return "", errors.New("GetFinalPathNameByHandle returned unexpected path: " + s)
 * }
 */
export function realpath(path: string): [string, GoError] {
  let h: Handle;
  if (path.length < 248) {
    const [hResult, err] = openMetadata(path);
    if (err !== undefined) {
      return ["", err];
    }
    h = hResult;
    // defer windows.CloseHandle(h) — in TS we call it after the loop below
    const result = realpathWithHandle(h, path);
    windows.CloseHandle(h);
    return result;
  } else {
    // For long paths, defer to os.Open to run the path through fixLongPath.
    const [f, openErr] = goOs.Open(path) as [goOs.File, GoError];
    if (openErr !== undefined) {
      return ["", openErr];
    }
    // Works on directories too since https://go.dev/cl/405275.
    h = f as unknown as Handle;
    const result = realpathWithHandle(h, path);
    (f as unknown as { Close(): GoError }).Close();
    return result;
  }
}

function realpathWithHandle(h: Handle, _path: string): [string, GoError] {
  const _VOLUME_NAME_DOS = 0;

  let buf = new Array<number>(310);
  for (;;) {
    const [n, err] = windows.GetFinalPathNameByHandle(h, buf[0], buf.length as int, _VOLUME_NAME_DOS as int) as [int, GoError];
    if (err !== undefined) {
      return ["", err];
    }
    if (n < (buf.length as int)) {
      break;
    }
    buf = new Array<number>(n as number);
  }

  let s = syscall.UTF16ToString(buf) as string;
  if (s.length > 4 && s.slice(0, 4) === "\\\\?\\") {
    s = s.slice(4);
    if (s.length > 3 && s.slice(0, 3) === "UNC") {
      // return path like \\server\share\...
      return ["\\" + s.slice(3), undefined];
    }
    return [s, undefined];
  }

  return ["", goErrors.New("GetFinalPathNameByHandle returned unexpected path: " + s)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_windows.go::func::openMetadata","kind":"func","status":"implemented","sigHash":"aa6e140f5928eb206baa4f9223a2bfcda7c0aaa3d5b94f7e0c88f1a39e96e455","bodyHash":"44ec667118d3f6395aa38229790831db3f6e030485014cbd5509f86798cad518"}
 *
 * Go source:
 * func openMetadata(path string) (windows.Handle, error) {
 * 	// based on https://github.com/microsoft/go-winio/blob/3c9576c9346a1892dee136329e7e15309e82fb4f/pkg/fs/resolve.go#L113
 *
 * 	pathUTF16, err := windows.UTF16PtrFromString(path)
 * 	if err != nil {
 * 		return windows.InvalidHandle, err
 * 	}
 *
 * 	const (
 * 		_FILE_ANY_ACCESS = 0
 *
 * 		_FILE_SHARE_READ   = 0x01
 * 		_FILE_SHARE_WRITE  = 0x02
 * 		_FILE_SHARE_DELETE = 0x04
 *
 * 		_OPEN_EXISTING = 0x03
 *
 * 		_FILE_FLAG_BACKUP_SEMANTICS = 0x0200_0000
 * 	)
 *
 * 	h, err := windows.CreateFile(
 * 		pathUTF16,
 * 		_FILE_ANY_ACCESS,
 * 		_FILE_SHARE_READ|_FILE_SHARE_WRITE|_FILE_SHARE_DELETE,
 * 		nil,
 * 		_OPEN_EXISTING,
 * 		_FILE_FLAG_BACKUP_SEMANTICS,
 * 		0,
 * 	)
 * 	if err != nil {
 * 		return 0, &os.PathError{
 * 			Op:   "CreateFile",
 * 			Path: path,
 * 			Err:  err,
 * 		}
 * 	}
 * 	return h, nil
 * }
 */
export function openMetadata(path: string): [Handle, GoError] {
  // based on https://github.com/microsoft/go-winio/blob/3c9576c9346a1892dee136329e7e15309e82fb4f/pkg/fs/resolve.go#L113

  const [pathUTF16, pathUTF16Err] = windows.UTF16PtrFromString(path) as [unknown, GoError];
  if (pathUTF16Err !== undefined) {
    return [windows.InvalidHandle as Handle, pathUTF16Err];
  }

  const _FILE_ANY_ACCESS = 0;
  const _FILE_SHARE_READ = 0x01;
  const _FILE_SHARE_WRITE = 0x02;
  const _FILE_SHARE_DELETE = 0x04;
  const _OPEN_EXISTING = 0x03;
  const _FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;

  const [h, createErr] = windows.CreateFile(
    pathUTF16,
    _FILE_ANY_ACCESS,
    (_FILE_SHARE_READ | _FILE_SHARE_WRITE | _FILE_SHARE_DELETE),
    undefined,
    _OPEN_EXISTING,
    _FILE_FLAG_BACKUP_SEMANTICS,
    0,
  ) as [Handle, GoError];
  if (createErr !== undefined) {
    return [0 as unknown as Handle, new globalThis.Error(`CreateFile ${path}: ${createErr.message}`)];
  }
  return [h, undefined];
}

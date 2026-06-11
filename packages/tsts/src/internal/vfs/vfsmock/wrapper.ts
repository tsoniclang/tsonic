import type { GoPtr } from "../../../go/compat.js";
import { RWMutex } from "../../../go/sync.js";
import type { FS } from "../vfs.js";
import type { FSMock } from "./mock_generated.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/wrapper.go::func::Wrap","kind":"func","status":"implemented","sigHash":"462f048fe139267a07e0cf63f1bda61dc164bb450051a3a8e807e726d4b1c98d","bodyHash":"135dd53eb3273b1c82f5256de18b6f75aef7923d2e89150db626b7e683c66209"}
 *
 * Go source:
 * func Wrap(fs vfs.FS) *FSMock {
 * 	return &FSMock{
 * 		DirectoryExistsFunc:           fs.DirectoryExists,
 * 		FileExistsFunc:                fs.FileExists,
 * 		GetAccessibleEntriesFunc:      fs.GetAccessibleEntries,
 * 		ReadFileFunc:                  fs.ReadFile,
 * 		RealpathFunc:                  fs.Realpath,
 * 		RemoveFunc:                    fs.Remove,
 * 		ChtimesFunc:                   fs.Chtimes,
 * 		StatFunc:                      fs.Stat,
 * 		UseCaseSensitiveFileNamesFunc: fs.UseCaseSensitiveFileNames,
 * 		WalkDirFunc:                   fs.WalkDir,
 * 		WriteFileFunc:                 fs.WriteFile,
 * 		AppendFileFunc:                fs.AppendFile,
 * 	}
 * }
 */
export function Wrap(fs: FS): GoPtr<FSMock> {
  return {
    DirectoryExistsFunc: (path: string) => fs.DirectoryExists(path),
    FileExistsFunc: (path: string) => fs.FileExists(path),
    GetAccessibleEntriesFunc: (path: string) => fs.GetAccessibleEntries(path),
    ReadFileFunc: (path: string) => fs.ReadFile(path),
    RealpathFunc: (path: string) => fs.Realpath(path),
    RemoveFunc: (path: string) => fs.Remove(path),
    ChtimesFunc: (path: string, aTime, mTime) => fs.Chtimes(path, aTime, mTime),
    StatFunc: (path: string) => fs.Stat(path),
    UseCaseSensitiveFileNamesFunc: () => fs.UseCaseSensitiveFileNames(),
    WalkDirFunc: (root: string, walkFn) => fs.WalkDir(root, walkFn),
    WriteFileFunc: (path: string, data: string) => fs.WriteFile(path, data),
    AppendFileFunc: (path: string, data: string) => fs.AppendFile(path, data),
    calls: {
      AppendFile: [],
      Chtimes: [],
      DirectoryExists: [],
      FileExists: [],
      GetAccessibleEntries: [],
      ReadFile: [],
      Realpath: [],
      Remove: [],
      Stat: [],
      UseCaseSensitiveFileNames: [],
      WalkDir: [],
      WriteFile: [],
    },
    lockAppendFile: new RWMutex(),
    lockChtimes: new RWMutex(),
    lockDirectoryExists: new RWMutex(),
    lockFileExists: new RWMutex(),
    lockGetAccessibleEntries: new RWMutex(),
    lockReadFile: new RWMutex(),
    lockRealpath: new RWMutex(),
    lockRemove: new RWMutex(),
    lockStat: new RWMutex(),
    lockUseCaseSensitiveFileNames: new RWMutex(),
    lockWalkDir: new RWMutex(),
    lockWriteFile: new RWMutex(),
  };
}

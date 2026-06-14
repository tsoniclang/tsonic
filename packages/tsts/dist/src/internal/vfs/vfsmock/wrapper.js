import { RWMutex } from "../../../go/sync.js";
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
export function Wrap(fs) {
    return {
        DirectoryExistsFunc: (path) => fs.DirectoryExists(path),
        FileExistsFunc: (path) => fs.FileExists(path),
        GetAccessibleEntriesFunc: (path) => fs.GetAccessibleEntries(path),
        ReadFileFunc: (path) => fs.ReadFile(path),
        RealpathFunc: (path) => fs.Realpath(path),
        RemoveFunc: (path) => fs.Remove(path),
        ChtimesFunc: (path, aTime, mTime) => fs.Chtimes(path, aTime, mTime),
        StatFunc: (path) => fs.Stat(path),
        UseCaseSensitiveFileNamesFunc: () => fs.UseCaseSensitiveFileNames(),
        WalkDirFunc: (root, walkFn) => fs.WalkDir(root, walkFn),
        WriteFileFunc: (path, data) => fs.WriteFile(path, data),
        AppendFileFunc: (path, data) => fs.AppendFile(path, data),
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
//# sourceMappingURL=wrapper.js.map
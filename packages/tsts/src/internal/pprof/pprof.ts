import type { GoError, GoPtr } from "../../go/compat.js";
import type { Writer } from "../../go/io.js";
import type { File } from "../../go/os.js";
import type { Mutex } from "../../go/sync.js";
import * as errors from "../../go/errors.js";
import * as fmt from "../../go/fmt.js";
import * as io from "../../go/io.js";
import * as os from "../../go/os.js";
import * as filepath from "../../go/path/filepath.js";
import * as runtime from "../../go/runtime.js";
import * as pprof from "../../go/runtime/pprof.js";
import * as time from "../../go/time.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::type::ProfileSession","kind":"type","status":"implemented","sigHash":"a76723aee5edb81e8c1f6267b0588ad887b2600150fd55b9359a35d02584972b","bodyHash":"9c7b63f36067a4f2f8855292fabf046b03e3b4ab7ee006c3f944514a17a2b87a"}
 *
 * Go source:
 * ProfileSession struct {
 * 	cpuFilePath string
 * 	memFilePath string
 * 	cpuFile     *os.File
 * 	logWriter   io.Writer
 * }
 */
export interface ProfileSession {
  cpuFilePath: string;
  memFilePath: string;
  cpuFile: GoPtr<File>;
  logWriter: Writer;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::func::BeginProfiling","kind":"func","status":"implemented","sigHash":"a03af38b93e0ea5e9b3679a92098b32afd8ab657ebc16f01b62c318a3b301399","bodyHash":"21f6df63a3a5240f32fbcfa3e390f242daf5663fbaeba66e9d432c228a719057"}
 *
 * Go source:
 * func BeginProfiling(profileDir string, logWriter io.Writer) *ProfileSession {
 * 	if err := os.MkdirAll(profileDir, 0o755); err != nil {
 * 		panic(err)
 * 	}
 * 
 * 	pid := os.Getpid()
 * 
 * 	cpuProfilePath := filepath.Join(profileDir, fmt.Sprintf("%d-cpuprofile.pb.gz", pid))
 * 	memProfilePath := filepath.Join(profileDir, fmt.Sprintf("%d-memprofile.pb.gz", pid))
 * 	cpuFile, err := os.Create(cpuProfilePath)
 * 	if err != nil {
 * 		panic(err)
 * 	}
 * 
 * 	if err := pprof.StartCPUProfile(cpuFile); err != nil {
 * 		panic(err)
 * 	}
 * 
 * 	return &ProfileSession{
 * 		cpuFilePath: cpuProfilePath,
 * 		memFilePath: memProfilePath,
 * 		cpuFile:     cpuFile,
 * 		logWriter:   logWriter,
 * 	}
 * }
 */
export function BeginProfiling(profileDir: string, logWriter: Writer): GoPtr<ProfileSession> {
  const mkdirErr = os.MkdirAll(profileDir, 0o755);
  if (mkdirErr !== undefined) {
    throw mkdirErr;
  }
  const pid = os.Getpid();
  const cpuProfilePath = filepath.Join(profileDir, fmt.Sprintf("%d-cpuprofile.pb.gz", pid));
  const memProfilePath = filepath.Join(profileDir, fmt.Sprintf("%d-memprofile.pb.gz", pid));
  const [cpuFile, createErr] = os.Create(cpuProfilePath);
  if (createErr !== undefined) {
    throw createErr;
  }
  const startErr = pprof.StartCPUProfile(cpuFile);
  if (startErr !== undefined) {
    throw startErr;
  }
  return {
    cpuFilePath: cpuProfilePath,
    memFilePath: memProfilePath,
    cpuFile,
    logWriter,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::method::ProfileSession.Stop","kind":"method","status":"implemented","sigHash":"383f6c1004cf555d9405f4764a856ab6f44a6242bcc29aeeecd00a70350fb664","bodyHash":"24a708fabe90294b3553921965d509443694035da607f6f7de2b302d253e7365"}
 *
 * Go source:
 * func (p *ProfileSession) Stop() {
 * 	pprof.StopCPUProfile()
 * 	p.cpuFile.Close()
 * 
 * 	if p.memFilePath != "" {
 * 		memFile, err := os.Create(p.memFilePath)
 * 		if err != nil {
 * 			panic(err)
 * 		}
 * 		if err := pprof.Lookup("allocs").WriteTo(memFile, 0); err != nil {
 * 			panic(err)
 * 		}
 * 		memFile.Close()
 * 		fmt.Fprintf(p.logWriter, "Memory profile: %v\n", p.memFilePath)
 * 	}
 * 
 * 	fmt.Fprintf(p.logWriter, "CPU profile: %v\n", p.cpuFilePath)
 * }
 */
export function ProfileSession_Stop(receiver: GoPtr<ProfileSession>): void {
  const p = receiver!;
  pprof.StopCPUProfile();
  p.cpuFile!.Close();

  if (p.memFilePath !== "") {
    const [memFile, createErr] = os.Create(p.memFilePath);
    if (createErr !== undefined) {
      throw createErr;
    }
    const profile = pprof.Lookup("allocs");
    const writeErr = profile!.WriteTo(memFile, 0);
    if (writeErr !== undefined) {
      throw writeErr;
    }
    memFile.Close();
    fmt.Fprintf(p.logWriter, "Memory profile: %v\n", p.memFilePath);
  }

  fmt.Fprintf(p.logWriter, "CPU profile: %v\n", p.cpuFilePath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::type::CPUProfiler","kind":"type","status":"implemented","sigHash":"758f83a1a8afe5668daa84d92f1939ba14796c4820896e11c396f95e5867a988","bodyHash":"b5e9b96d1ab1a8a93a70fb4f4a0c812766c25cf044a928ea95adae619be3ea71"}
 *
 * Go source:
 * CPUProfiler struct {
 * 	mu      sync.Mutex
 * 	session *ProfileSession
 * }
 */
export interface CPUProfiler {
  mu: Mutex;
  session: GoPtr<ProfileSession>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::method::CPUProfiler.StartCPUProfile","kind":"method","status":"implemented","sigHash":"336f17798607a75b5afc3ee6b67a7f5dd39f54e8b340ef8331e1478ba6b701ef","bodyHash":"37c77fbf384b13bebe991a21537c033f3a673a69dbb6b9156b5ea8b4d6870801"}
 *
 * Go source:
 * func (c *CPUProfiler) StartCPUProfile(profileDir string) error {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 * 
 * 	if c.session != nil {
 * 		return errors.New("CPU profiling already in progress")
 * 	}
 * 
 * 	if err := os.MkdirAll(profileDir, 0o755); err != nil {
 * 		return fmt.Errorf("failed to create profile directory: %w", err)
 * 	}
 * 
 * 	cpuProfilePath := filepath.Join(profileDir, fmt.Sprintf("%d-%d-cpuprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()))
 * 	cpuFile, err := os.Create(cpuProfilePath)
 * 	if err != nil {
 * 		return fmt.Errorf("failed to create CPU profile file: %w", err)
 * 	}
 * 
 * 	if err := pprof.StartCPUProfile(cpuFile); err != nil {
 * 		cpuFile.Close()
 * 		os.Remove(cpuProfilePath)
 * 		return fmt.Errorf("failed to start CPU profile: %w", err)
 * 	}
 * 
 * 	c.session = &ProfileSession{
 * 		cpuFilePath: cpuProfilePath,
 * 		cpuFile:     cpuFile,
 * 		logWriter:   io.Discard,
 * 	}
 * 	return nil
 * }
 */
export function CPUProfiler_StartCPUProfile(receiver: GoPtr<CPUProfiler>, profileDir: string): GoError {
  const c = receiver!;
  c.mu.Lock();
  try {
    if (c.session !== undefined) {
      return errors.New("CPU profiling already in progress");
    }
    const mkdirErr = os.MkdirAll(profileDir, 0o755);
    if (mkdirErr !== undefined) {
      return fmt.Errorf("failed to create profile directory: %w", mkdirErr);
    }
    const cpuProfilePath = filepath.Join(profileDir, fmt.Sprintf("%d-%d-cpuprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()));
    const [cpuFile, createErr] = os.Create(cpuProfilePath);
    if (createErr !== undefined) {
      return fmt.Errorf("failed to create CPU profile file: %w", createErr);
    }
    const startErr = pprof.StartCPUProfile(cpuFile);
    if (startErr !== undefined) {
      cpuFile.Close();
      os.Remove(cpuProfilePath);
      return fmt.Errorf("failed to start CPU profile: %w", startErr);
    }
    c.session = {
      cpuFilePath: cpuProfilePath,
      memFilePath: "",
      cpuFile,
      logWriter: io.Discard,
    };
    return undefined;
  } finally {
    c.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::method::CPUProfiler.StopCPUProfile","kind":"method","status":"implemented","sigHash":"265a83d69f78d31aaf7f3b1b83149ac1799609bd56f05cade4c12650bcad334f","bodyHash":"1dd7f6d5e3dd36274c4ae9b79f63e045e12d3131e116c2e120b9e7e144b0f0c6"}
 *
 * Go source:
 * func (c *CPUProfiler) StopCPUProfile() (string, error) {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 * 
 * 	if c.session == nil {
 * 		return "", errors.New("CPU profiling not in progress")
 * 	}
 * 
 * 	filePath := c.session.cpuFilePath
 * 	c.session.Stop()
 * 	c.session = nil
 * 
 * 	return filePath, nil
 * }
 */
export function CPUProfiler_StopCPUProfile(receiver: GoPtr<CPUProfiler>): [string, GoError] {
  const c = receiver!;
  c.mu.Lock();
  try {
    if (c.session === undefined) {
      return ["", new globalThis.Error("CPU profiling not in progress")];
    }

    const filePath = c.session!.cpuFilePath;
    ProfileSession_Stop(c.session);
    c.session = undefined;

    return [filePath, undefined];
  } finally {
    c.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::func::SaveHeapProfile","kind":"func","status":"implemented","sigHash":"493a044c790af1b846f6a90ad8cd166dc93081e24d57ac0c319400474bfa114e","bodyHash":"8314850d02bdde5789f2b3c4541cc1d270a50953e0d0c5bedf6217f7bc3bf2b6"}
 *
 * Go source:
 * func SaveHeapProfile(profileDir string) (string, error) {
 * 	if err := os.MkdirAll(profileDir, 0o755); err != nil {
 * 		return "", fmt.Errorf("failed to create profile directory: %w", err)
 * 	}
 * 
 * 	heapProfilePath := filepath.Join(profileDir, fmt.Sprintf("%d-%d-heapprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()))
 * 	heapFile, err := os.Create(heapProfilePath)
 * 	if err != nil {
 * 		return "", fmt.Errorf("failed to create heap profile file: %w", err)
 * 	}
 * 	defer heapFile.Close()
 * 
 * 	runtime.GC()
 * 	if err := pprof.Lookup("heap").WriteTo(heapFile, 0); err != nil {
 * 		os.Remove(heapProfilePath)
 * 		return "", fmt.Errorf("failed to write heap profile: %w", err)
 * 	}
 * 
 * 	return heapProfilePath, nil
 * }
 */
export function SaveHeapProfile(profileDir: string): [string, GoError] {
  const mkdirErr = os.MkdirAll(profileDir, 0o755);
  if (mkdirErr !== undefined) {
    return ["", fmt.Errorf("failed to create profile directory: %w", mkdirErr)];
  }
  const heapProfilePath = filepath.Join(profileDir, fmt.Sprintf("%d-%d-heapprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()));
  const [heapFile, createErr] = os.Create(heapProfilePath);
  if (createErr !== undefined) {
    return ["", fmt.Errorf("failed to create heap profile file: %w", createErr)];
  }
  try {
    runtime.GC();
    const profile = pprof.Lookup("heap");
    const writeErr = profile!.WriteTo(heapFile, 0);
    if (writeErr !== undefined) {
      os.Remove(heapProfilePath);
      return ["", fmt.Errorf("failed to write heap profile: %w", writeErr)];
    }
    return [heapProfilePath, undefined];
  } finally {
    heapFile.Close();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::func::SaveAllocProfile","kind":"func","status":"implemented","sigHash":"88938cc5084d6b8f0ea6ded5d38ca9c8155b861b1cd9a998bfa4733955bf1e96","bodyHash":"cb4afc11bf378ca4cdc90ec1a7b33f336e3f6584f6386403ae4fc881d6ec2a07"}
 *
 * Go source:
 * func SaveAllocProfile(profileDir string) (string, error) {
 * 	if err := os.MkdirAll(profileDir, 0o755); err != nil {
 * 		return "", fmt.Errorf("failed to create profile directory: %w", err)
 * 	}
 * 
 * 	allocProfilePath := filepath.Join(profileDir, fmt.Sprintf("%d-%d-allocprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()))
 * 	allocFile, err := os.Create(allocProfilePath)
 * 	if err != nil {
 * 		return "", fmt.Errorf("failed to create alloc profile file: %w", err)
 * 	}
 * 	defer allocFile.Close()
 * 
 * 	if err := pprof.Lookup("allocs").WriteTo(allocFile, 0); err != nil {
 * 		os.Remove(allocProfilePath)
 * 		return "", fmt.Errorf("failed to write alloc profile: %w", err)
 * 	}
 * 
 * 	return allocProfilePath, nil
 * }
 */
export function SaveAllocProfile(profileDir: string): [string, GoError] {
  const mkdirErr = os.MkdirAll(profileDir, 0o755);
  if (mkdirErr !== undefined) {
    return ["", fmt.Errorf("failed to create profile directory: %w", mkdirErr)];
  }
  const allocProfilePath = filepath.Join(profileDir, fmt.Sprintf("%d-%d-allocprofile.pb.gz", os.Getpid(), time.Now().UnixMilli()));
  const [allocFile, createErr] = os.Create(allocProfilePath);
  if (createErr !== undefined) {
    return ["", fmt.Errorf("failed to create alloc profile file: %w", createErr)];
  }
  try {
    const profile = pprof.Lookup("allocs");
    const writeErr = profile!.WriteTo(allocFile, 0);
    if (writeErr !== undefined) {
      os.Remove(allocProfilePath);
      return ["", fmt.Errorf("failed to write alloc profile: %w", writeErr)];
    }
    return [allocProfilePath, undefined];
  } finally {
    allocFile.Close();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pprof/pprof.go::func::RunGC","kind":"func","status":"implemented","sigHash":"8f507d8d1ba55f3c46badf76e6f03b91604cc0fd40e4afc582dfec3d26dacc4c","bodyHash":"5d96aaf762583125e894aa4d0b3e0d9b72568402afeb89ace19da8ee82768b9b"}
 *
 * Go source:
 * func RunGC() {
 * 	runtime.GC()
 * }
 */
export function RunGC(): void {
  runtime.GC();
}

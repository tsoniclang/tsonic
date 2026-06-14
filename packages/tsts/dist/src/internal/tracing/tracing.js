import { Errorf, Sprintf } from "../../go/fmt.js";
import { SortFunc } from "../../go/slices.js";
import { Builder, Compare } from "../../go/strings.js";
import { Mutex } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";
import { SourceFile_ECMALineMap, SourceFile_FileName, SourceFile_Text } from "../ast/ast.js";
import { EscapeAllInternalSymbolNames } from "../ast/symbol.js";
import { Node_End } from "../ast/spine.js";
import { GetSourceFileOfNode } from "../ast/utilities.js";
import { Deterministic, MarshalIndent, MarshalWrite } from "../json/json.js";
import { GetECMALineAndUTF16CharacterOfPosition, GetTokenPosOfNode } from "../scanner/scanner.js";
import { CombinePaths, ToPath } from "../tspath/path.js";
// string([]byte) conversion, matching the established decode idiom used by the
// other ported internal files.
const utf8Decoder = new globalThis.TextDecoder("utf-8");
const bytesToString = (b) => utf8Decoder.decode(globalThis.Uint8Array.from(b));
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::sampleInterval","kind":"constGroup","status":"implemented","sigHash":"25c973b1afe221ef6ac3524ebb2277caae5ae583959b55818a02cf688bcce16d","bodyHash":"63ef002d0cd8813105bc046fa2b3273461b215f34158c33d7a816aa530b3d6fa"}
 *
 * Go source:
 * const sampleInterval = 10 * time.Millisecond
 */
// 10 * time.Millisecond expressed in nanoseconds (Go time.Duration unit).
// Push uses sampleInterval / 1000.0 to convert to microseconds for comparison.
export const sampleInterval = 10_000_000;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::traceFileName","kind":"constGroup","status":"implemented","sigHash":"5ce6bcd3404ffeb42b22630f2857b4ab142cfc3b645f64ab3fde0715b125adb1","bodyHash":"5e409ad7ec15a4441743658e2084dfb54340ea5f500b8faa5633c6b04dce2adb"}
 *
 * Go source:
 * const traceFileName = "trace.json"
 */
export const traceFileName = "trace.json";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::flushThreshold","kind":"constGroup","status":"implemented","sigHash":"cef73237434416f0a15d4a047bdf3f741fa02d391e4498a7d55a733ffb954c41","bodyHash":"2837be96789ec61b1d70ba31dff156fd49bf42bf74bfca597af48616205ca359"}
 *
 * Go source:
 * const flushThreshold = 256 * 1024
 */
export const flushThreshold = 256 * 1024;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::PhaseParse+PhaseProgram+PhaseBind+PhaseCheck+PhaseCheckTypes+PhaseEmit+PhaseSession","kind":"constGroup","status":"implemented","sigHash":"06b838ba2c0b7f081e06caa541fc7c5a4921203fdbe61907e8f7fe5abbb73bc4","bodyHash":"4c308e475b18aa5105166da12a5ad8b5e888a5be050b026bc086647b79e468a3"}
 *
 * Go source:
 * const (
 * 	PhaseParse      Phase = "parse"
 * 	PhaseProgram    Phase = "program"
 * 	PhaseBind       Phase = "bind"
 * 	PhaseCheck      Phase = "check"
 * 	PhaseCheckTypes Phase = "checkTypes"
 * 	PhaseEmit       Phase = "emit"
 * 	PhaseSession    Phase = "session"
 * )
 */
export const PhaseParse = "parse";
export const PhaseProgram = "program";
export const PhaseBind = "bind";
export const PhaseCheck = "check";
export const PhaseCheckTypes = "checkTypes";
export const PhaseEmit = "emit";
export const PhaseSession = "session";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::StartTracing","kind":"func","status":"implemented","sigHash":"f8a080c13c359705b29a921436a3d137cb4907b12330f2a0394850336b83a2e4","bodyHash":"96a524b12cacdca282d4c053ce0aadf5d6540b5206d622eb83ba604ab3081bfe"}
 *
 * Go source:
 * func StartTracing(fs vfs.FS, traceDir string, configFilePath string, deterministic bool) (*Tracing, error) {
 * 	tr := &Tracing{
 * 		fs:             fs,
 * 		traceDir:       traceDir,
 * 		tracePath:      tspath.CombinePaths(traceDir, traceFileName),
 * 		configFilePath: configFilePath,
 * 		legend:         []TraceRecord{},
 * 		tracers:        []*typeTracer{},
 * 		deterministic:  deterministic,
 * 		startTime:      time.Now(),
 * 	}
 * 	tr.traceStarted.Store(true)
 *
 * 	// Write the trace file header with metadata events
 * 	tr.traceContent.WriteString("[\n")
 *
 * 	// Write metadata events (matching TypeScript's format)
 * 	metaTs := tr.timestamp()
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "process_name", Args: map[string]any{"name": "tsgo"}})
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "thread_name", Args: map[string]any{"name": "Main"}})
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "disabled-by-default-devtools.timeline", TS: metaTs, Name: "TracingStartedInBrowser"})
 *
 * 	// Truncate any existing trace file with the header so subsequent AppendFile
 * 	// calls extend a clean file.
 * 	if err := tr.fs.WriteFile(tr.tracePath, tr.traceContent.String()); err != nil {
 * 		return nil, fmt.Errorf("failed to write trace file header: %w", err)
 * 	}
 * 	tr.traceContent.Reset()
 *
 * 	return tr, nil
 * }
 */
export function StartTracing(fs, traceDir, configFilePath, deterministic) {
    const traceContent = new Builder();
    const traceStarted = new Bool();
    const tr = {
        fs: fs,
        traceDir: traceDir,
        tracePath: CombinePaths(traceDir, traceFileName),
        configFilePath: configFilePath,
        legend: [],
        tracers: [],
        traceContent: traceContent,
        traceStarted: traceStarted,
        deterministic: deterministic,
        timestampCounter: 0,
        startTime: {},
        mu: new Mutex(),
        flushErr: undefined,
    };
    tr.traceStarted.Store(true);
    // Write the trace file header with metadata events
    tr.traceContent.WriteString("[\n");
    // Write metadata events (matching TypeScript's format)
    const metaTs = Tracing_timestamp(tr);
    Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "process_name", S: "", Dur: undefined, Args: new globalThis.Map([["name", "tsgo"]]) });
    tr.traceContent.WriteString(",\n");
    Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "thread_name", S: "", Dur: undefined, Args: new globalThis.Map([["name", "Main"]]) });
    tr.traceContent.WriteString(",\n");
    Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "M", Cat: "disabled-by-default-devtools.timeline", TS: metaTs, Name: "TracingStartedInBrowser", S: "", Dur: undefined, Args: undefined });
    // Truncate any existing trace file with the header so subsequent AppendFile
    // calls extend a clean file.
    const err = tr.fs.WriteFile(tr.tracePath, tr.traceContent.String());
    if (err !== undefined) {
        return [undefined, Errorf("failed to write trace file header: %w", err)];
    }
    tr.traceContent.Reset();
    return [tr, undefined];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.timestamp","kind":"method","status":"implemented","sigHash":"7b52274f7d713d510dc1aac4a8e1f31e498084e240ba050f6b871fde75fcebc6","bodyHash":"f9b5765e3183bdf2a02a5cd15497698464424bab3a66006595e19d0aa2b68adb"}
 *
 * Go source:
 * func (tr *Tracing) timestamp() float64 {
 * 	if tr.deterministic {
 * 		tr.timestampCounter++
 * 		return float64(tr.timestampCounter)
 * 	}
 * 	return float64(time.Since(tr.startTime).Nanoseconds()) / 1000.0
 * }
 */
export function Tracing_timestamp(receiver) {
    const tr = receiver;
    if (tr.deterministic) {
        tr.timestampCounter = (tr.timestampCounter + 1);
        return tr.timestampCounter;
    }
    // time.Since(tr.startTime).Nanoseconds() / 1000.0 — performance.now() gives ms, multiply by 1000 for microseconds
    return (globalThis.performance.now() * 1000.0);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::writeEventTo","kind":"func","status":"implemented","sigHash":"dd8580a528968c3a11ce3a4ed88fd012df13a8619b9d4eaf033fb2028d175f59","bodyHash":"354a91fd0a37d0bef9f8e1afbe5bde4ff0242de50af38dcc4ee97bff9d668c64"}
 *
 * Go source:
 * func writeEventTo(buf *strings.Builder, event traceEvent) {
 * 	if err := json.MarshalWrite(buf, event, json.Deterministic(true)); err != nil {
 * 		panic(fmt.Sprintf("failed to marshal trace event: %v", err))
 * 	}
 * }
 */
export function writeEventTo(buf, event) {
    const err = MarshalWrite(buf, event, Deterministic(true));
    if (err !== undefined) {
        throw new globalThis.Error(Sprintf("failed to marshal trace event: %v", err));
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.writeEvent","kind":"method","status":"implemented","sigHash":"e861cdb9e060a518b3ee4c97ac32052b0fadb6d511261c038cac20e1ae0f86c2","bodyHash":"11f7d57e84140f0c6ccbcbe384b724dfcdd8375f5f591a8bc97c0d7d5f25be92"}
 *
 * Go source:
 * func (tr *Tracing) writeEvent(event traceEvent) {
 * 	writeEventTo(&tr.traceContent, event)
 * }
 */
export function Tracing_writeEvent(receiver, event) {
    writeEventTo(receiver.traceContent, event);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.maybeFlushLocked","kind":"method","status":"implemented","sigHash":"24eeee0eae95bc40185fcdfcb5fdea50b0541197ca2b454417c6df002d527c45","bodyHash":"547f1210d18dffa787df8fd73106079b580d244d2adfdd5ebf306cdba9c49822"}
 *
 * Go source:
 * func (tr *Tracing) maybeFlushLocked() {
 * 	if tr.flushErr != nil {
 * 		tr.traceContent.Reset()
 * 		return
 * 	}
 * 	if tr.traceContent.Len() < flushThreshold {
 * 		return
 * 	}
 * 	if err := tr.fs.AppendFile(tr.tracePath, tr.traceContent.String()); err != nil {
 * 		tr.flushErr = fmt.Errorf("failed to flush trace file: %w", err)
 * 	}
 * 	tr.traceContent.Reset()
 * }
 */
export function Tracing_maybeFlushLocked(receiver) {
    const tr = receiver;
    if (tr.flushErr !== undefined) {
        tr.traceContent.Reset();
        return;
    }
    if (tr.traceContent.Len() < flushThreshold) {
        return;
    }
    const err = tr.fs.AppendFile(tr.tracePath, tr.traceContent.String());
    if (err !== undefined) {
        tr.flushErr = Errorf("failed to flush trace file: %w", err);
    }
    tr.traceContent.Reset();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.Instant","kind":"method","status":"implemented","sigHash":"e72ba6ff68ef9b87d7ce9af888330afdabda477c1cc3070b04b1a13d81c2c477","bodyHash":"1f925447bc81f00a0bcdcd1d84866b43fd101d33b09e919f97dcd1c4f99b1aae"}
 *
 * Go source:
 * func (tr *Tracing) Instant(phase Phase, name string, args map[string]any) {
 * 	if tr == nil || !tr.traceStarted.Load() {
 * 		return
 * 	}
 *
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	// Re-check under the lock: StopTracing may have run between the load above
 * 	// and acquiring the lock. Once stopped, further writes would land in a buffer
 * 	// that has already been flushed and the closing "]" written.
 * 	if !tr.traceStarted.Load() {
 * 		return
 * 	}
 *
 * 	ts := tr.timestamp()
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "I", Cat: string(phase), TS: ts, Name: name, S: "g", Args: args})
 * 	tr.maybeFlushLocked()
 * }
 */
export function Tracing_Instant(receiver, phase, name, args) {
    const tr = receiver;
    if (tr === undefined || !tr.traceStarted.Load()) {
        return;
    }
    tr.mu.Lock();
    try {
        // Re-check under the lock: StopTracing may have run between the load above
        // and acquiring the lock. Once stopped, further writes would land in a buffer
        // that has already been flushed and the closing "]" written.
        if (!tr.traceStarted.Load()) {
            return;
        }
        const ts = Tracing_timestamp(tr);
        tr.traceContent.WriteString(",\n");
        Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "I", Cat: phase, TS: ts, Name: name, S: "g", Args: args, Dur: undefined });
        Tracing_maybeFlushLocked(tr);
    }
    finally {
        tr.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.Push","kind":"method","status":"implemented","sigHash":"f718c05374a354a9bd493a2b4808be89935c9995e89990c29664a18f9c0d8253","bodyHash":"13d36e63bd430963a42f98246c9933d7e05d67f824fd1871d8aa49eaac7b126f"}
 *
 * Go source:
 * func (tr *Tracing) Push(phase Phase, name string, args map[string]any, separateBeginAndEnd bool) func() {
 * 	if tr == nil || !tr.traceStarted.Load() {
 * 		return func() {}
 * 	}
 *
 * 	if separateBeginAndEnd {
 * 		tr.mu.Lock()
 * 		if !tr.traceStarted.Load() {
 * 			tr.mu.Unlock()
 * 			return func() {}
 * 		}
 * 		ts := tr.timestamp()
 * 		tr.traceContent.WriteString(",\n")
 * 		tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "B", Cat: string(phase), TS: ts, Name: name, Args: args})
 * 		tr.maybeFlushLocked()
 * 		tr.mu.Unlock()
 *
 * 		return func() {
 * 			tr.mu.Lock()
 * 			defer tr.mu.Unlock()
 * 			if !tr.traceStarted.Load() {
 * 				return
 * 			}
 * 			endTs := tr.timestamp()
 * 			tr.traceContent.WriteString(",\n")
 * 			tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "E", Cat: string(phase), TS: endTs, Name: name, Args: args})
 * 			tr.maybeFlushLocked()
 * 		}
 * 	}
 *
 * 	// Sampled event: only record if duration crosses a sampling boundary.
 * 	// In deterministic mode, sampled events are skipped entirely to avoid flaky baselines,
 * 	// so avoid the cost of cloning args / capturing the start time.
 * 	if tr.deterministic {
 * 		return func() {}
 * 	}
 * 	startTime := time.Now()
 * 	args = maps.Clone(args)
 * 	return func() {
 * 		dur := float64(time.Since(startTime).Nanoseconds()) / 1000.0
 * 		startMicros := float64(startTime.Sub(tr.startTime).Nanoseconds()) / 1000.0
 * 		intervalMicros := float64(sampleInterval.Nanoseconds()) / 1000.0
 * 		if intervalMicros-math.Mod(startMicros, intervalMicros) > dur {
 * 			return
 * 		}
 * 		tr.mu.Lock()
 * 		defer tr.mu.Unlock()
 * 		if !tr.traceStarted.Load() {
 * 			return
 * 		}
 * 		tr.traceContent.WriteString(",\n")
 * 		tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "X", Cat: string(phase), TS: startMicros, Name: name, Dur: &dur, Args: args})
 * 		tr.maybeFlushLocked()
 * 	}
 * }
 */
export function Tracing_Push(receiver, phase, name, args, separateBeginAndEnd) {
    const tr = receiver;
    if (tr === undefined || !tr.traceStarted.Load()) {
        return () => { };
    }
    if (separateBeginAndEnd) {
        tr.mu.Lock();
        if (!tr.traceStarted.Load()) {
            tr.mu.Unlock();
            return () => { };
        }
        const ts = Tracing_timestamp(tr);
        tr.traceContent.WriteString(",\n");
        Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "B", Cat: phase, TS: ts, Name: name, S: "", Dur: undefined, Args: args });
        Tracing_maybeFlushLocked(tr);
        tr.mu.Unlock();
        return () => {
            tr.mu.Lock();
            try {
                if (!tr.traceStarted.Load()) {
                    return;
                }
                const endTs = Tracing_timestamp(tr);
                tr.traceContent.WriteString(",\n");
                Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "E", Cat: phase, TS: endTs, Name: name, S: "", Dur: undefined, Args: args });
                Tracing_maybeFlushLocked(tr);
            }
            finally {
                tr.mu.Unlock();
            }
        };
    }
    // Sampled event: only record if duration crosses a sampling boundary.
    // In deterministic mode, sampled events are skipped entirely to avoid flaky baselines.
    if (tr.deterministic) {
        return () => { };
    }
    const startMicros = (globalThis.performance.now() * 1000.0);
    const argsClone = new globalThis.Map(args);
    return () => {
        const endMicros = (globalThis.performance.now() * 1000.0);
        const dur = endMicros - startMicros;
        const intervalMicros = (sampleInterval / 1000.0);
        if (intervalMicros - (startMicros % intervalMicros) > dur) {
            return;
        }
        tr.mu.Lock();
        try {
            if (!tr.traceStarted.Load()) {
                return;
            }
            tr.traceContent.WriteString(",\n");
            Tracing_writeEvent(tr, { PID: 1, TID: 1, PH: "X", Cat: phase, TS: startMicros, Name: name, S: "", Dur: dur, Args: argsClone });
            Tracing_maybeFlushLocked(tr);
        }
        finally {
            tr.mu.Unlock();
        }
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.NewTypeTracer","kind":"method","status":"implemented","sigHash":"15d85ee1a5aee224cc129c19c1afa25e103db4ab07b29d61d08fc2d1c9bcfb64","bodyHash":"0e57e00dbff850c34f9f2fcdf7fa7502215baf8e903fc37fb80958b31f040bd0"}
 *
 * Go source:
 * func (tr *Tracing) NewTypeTracer(checkerIndex int) Tracer {
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	typesPath := tspath.CombinePaths(tr.traceDir, fmt.Sprintf("types_%d.json", checkerIndex))
 * 	tracer := &typeTracer{
 * 		fs:           tr.fs,
 * 		checkerIndex: checkerIndex,
 * 		typesPath:    typesPath,
 * 		types:        []TracedType{},
 * 	}
 * 	tr.tracers = append(tr.tracers, tracer)
 * 	tr.legend = append(tr.legend, TraceRecord{
 * 		ConfigFilePath: tr.configFilePath,
 * 		TracePath:      tr.tracePath,
 * 		TypesPath:      typesPath,
 * 	})
 * 	return tracer
 * }
 */
export function Tracing_NewTypeTracer(receiver, checkerIndex) {
    const tr = receiver;
    tr.mu.Lock();
    try {
        const typesPath = CombinePaths(tr.traceDir, Sprintf("types_%d.json", checkerIndex));
        const tracer = {
            fs: tr.fs,
            checkerIndex: checkerIndex,
            typesPath: typesPath,
            types: [],
            mu: new Mutex(),
        };
        tr.tracers = [...tr.tracers, tracer];
        tr.legend = [
            ...tr.legend,
            {
                ConfigFilePath: tr.configFilePath,
                TracePath: tr.tracePath,
                TypesPath: typesPath,
            },
        ];
        return typeTracer_as_Tracer(tracer);
    }
    finally {
        tr.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.StopTracing","kind":"method","status":"implemented","sigHash":"d03472b1307ce51d2332d35aeb4c650ed9277e5b6cd2b2739ed9fc586a559797","bodyHash":"eff1ffa5ddae7375a845e4cb70832f590d03cab823a4bc0c377fd6b42d521078"}
 *
 * Go source:
 * func (tr *Tracing) StopTracing() error {
 * 	// Dump types from all tracers BEFORE acquiring the lock, because
 * 	// DumpTypes → buildTypeDescriptor → Display() → TypeToString can
 * 	// re-enter the checker which calls Push/Pop (which need tr.mu).
 * 	for _, tracer := range tr.tracers {
 * 		if err := tracer.DumpTypes(); err != nil {
 * 			return fmt.Errorf("failed to dump types for checker %d: %w", tracer.checkerIndex, err)
 * 		}
 * 	}
 *
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	// Close the trace file(s)
 * 	if tr.traceStarted.Load() {
 * 		// Surface any buffered flush failure before attempting the final write.
 * 		if tr.flushErr != nil {
 * 			tr.traceContent.Reset()
 * 			tr.traceStarted.Store(false)
 * 			return tr.flushErr
 * 		}
 * 		// Flush any remaining buffered content and close the JSON array.
 * 		if err := tr.fs.AppendFile(tr.tracePath, tr.traceContent.String()+"\n]\n"); err != nil {
 * 			return fmt.Errorf("failed to write trace file: %w", err)
 * 		}
 * 		tr.traceContent.Reset()
 * 		tr.traceStarted.Store(false)
 * 	}
 *
 * 	// Sort legend entries by typesPath for deterministic output
 * 	slices.SortFunc(tr.legend, func(a, b TraceRecord) int {
 * 		return strings.Compare(a.TypesPath, b.TypesPath)
 * 	})
 *
 * 	// Write the legend file
 * 	legendPath := tspath.CombinePaths(tr.traceDir, "legend.json")
 * 	legendData, err := json.MarshalIndent(tr.legend, "", "  ")
 * 	if err != nil {
 * 		return fmt.Errorf("failed to marshal legend file: %w", err)
 * 	}
 * 	if err := tr.fs.WriteFile(legendPath, string(legendData)); err != nil {
 * 		return fmt.Errorf("failed to write legend file: %w", err)
 * 	}
 *
 * 	return nil
 * }
 */
export function Tracing_StopTracing(receiver) {
    const tr = receiver;
    // Dump types from all tracers BEFORE acquiring the lock, because
    // DumpTypes → buildTypeDescriptor → Display() → TypeToString can
    // re-enter the checker which calls Push/Pop (which need tr.mu).
    for (const tracer of tr.tracers) {
        const err = typeTracer_DumpTypes(tracer);
        if (err !== undefined) {
            return Errorf("failed to dump types for checker %d: %w", tracer.checkerIndex, err);
        }
    }
    tr.mu.Lock();
    try {
        // Close the trace file(s)
        if (tr.traceStarted.Load()) {
            // Surface any buffered flush failure before attempting the final write.
            if (tr.flushErr !== undefined) {
                tr.traceContent.Reset();
                tr.traceStarted.Store(false);
                return tr.flushErr;
            }
            // Flush any remaining buffered content and close the JSON array.
            const err = tr.fs.AppendFile(tr.tracePath, tr.traceContent.String() + "\n]\n");
            if (err !== undefined) {
                return Errorf("failed to write trace file: %w", err);
            }
            tr.traceContent.Reset();
            tr.traceStarted.Store(false);
        }
        // Sort legend entries by typesPath for deterministic output
        SortFunc(tr.legend, (a, b) => {
            return Compare(a.TypesPath, b.TypesPath);
        });
        // Write the legend file
        const legendPath = CombinePaths(tr.traceDir, "legend.json");
        const [legendData, err] = MarshalIndent(tr.legend, "", "  ");
        if (err !== undefined) {
            return Errorf("failed to marshal legend file: %w", err);
        }
        const writeErr = tr.fs.WriteFile(legendPath, bytesToString(legendData));
        if (writeErr !== undefined) {
            return Errorf("failed to write legend file: %w", writeErr);
        }
        return undefined;
    }
    finally {
        tr.mu.Unlock();
    }
}
// typeTracer satisfies the Tracer interface; this method-bearing adapter binds
// the free functions to a concrete typeTracer receiver, matching Go interface
// satisfaction (the *typeTracer methods RecordType/DumpTypes).
export function typeTracer_as_Tracer(receiver) {
    return {
        RecordType(t) {
            typeTracer_RecordType(receiver, t);
        },
        DumpTypes() {
            return typeTracer_DumpTypes(receiver);
        },
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.RecordType","kind":"method","status":"implemented","sigHash":"9cc9e8c2a24e98a39130d1a9f22f9512e83d749c4572cf5c30873db16031cc4b","bodyHash":"0758d69293f2a188784c492ff4f2e062784bc579eed5172af20bc9f5cff4c808"}
 *
 * Go source:
 * func (t *typeTracer) RecordType(typ TracedType) {
 * 	t.mu.Lock()
 * 	defer t.mu.Unlock()
 * 	t.types = append(t.types, typ)
 * }
 */
export function typeTracer_RecordType(receiver, typ) {
    const t = receiver;
    t.mu.Lock();
    try {
        t.types = [...t.types, typ];
    }
    finally {
        t.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.DumpTypes","kind":"method","status":"implemented","sigHash":"b119c267de31b5f4c742509c5db527378d5db1ac537ecaa34a7e6c346e860342","bodyHash":"56f8cb2d83dc9fbbf0c0e7c3895101938f1e8f190b34286c46a805b05d48b256"}
 *
 * Go source:
 * func (t *typeTracer) DumpTypes() error {
 * 	// Copy the types slice under lock, then release so Display() calls during
 * 	// buildTypeDescriptor don't deadlock when they create new types
 * 	t.mu.Lock()
 * 	types := slices.Clone(t.types)
 * 	t.mu.Unlock()
 *
 * 	if len(types) == 0 {
 * 		return nil
 * 	}
 *
 * 	var sb strings.Builder
 * 	// Write opening bracket (no newline so type ID matches line number)
 * 	sb.WriteString("[")
 *
 * 	recursionIdentityMap := make(map[any]int)
 *
 * 	for i, typ := range types {
 * 		descriptor := t.buildTypeDescriptor(typ, recursionIdentityMap)
 *
 * 		if err := json.MarshalWrite(&sb, descriptor); err != nil {
 * 			return fmt.Errorf("failed to marshal type %d: %w", typ.Id(), err)
 * 		}
 *
 * 		if i < len(types)-1 {
 * 			sb.WriteString(",\n")
 * 		}
 * 	}
 *
 * 	sb.WriteString("]\n")
 *
 * 	return t.fs.WriteFile(t.typesPath, sb.String())
 * }
 */
export function typeTracer_DumpTypes(receiver) {
    const t = receiver;
    // Copy the types slice under lock, then release so Display() calls during
    // buildTypeDescriptor don't deadlock when they create new types
    t.mu.Lock();
    const types = [...t.types];
    t.mu.Unlock();
    if (types.length === 0) {
        return undefined;
    }
    const sb = new Builder();
    // Write opening bracket (no newline so type ID matches line number)
    sb.WriteString("[");
    const recursionIdentityMap = new globalThis.Map();
    for (let i = 0; i < types.length; i++) {
        const typ = types[i];
        const descriptor = typeTracer_buildTypeDescriptor(t, typ, recursionIdentityMap);
        const err = MarshalWrite(sb, descriptor);
        if (err !== undefined) {
            return Errorf("failed to marshal type %d: %w", typ.Id(), err);
        }
        if (i < types.length - 1) {
            sb.WriteString(",\n");
        }
    }
    sb.WriteString("]\n");
    return t.fs.WriteFile(t.typesPath, sb.String());
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.buildTypeDescriptor","kind":"method","status":"implemented","sigHash":"04a6b82115bb4c64bc764c4e925957f93321131049d34ac7b904ba88c3294b8f","bodyHash":"358963800d018eeae6200128b36497e486790b6453e02be3d7ceecb9e8670c5c"}
 *
 * Go source:
 * func (t *typeTracer) buildTypeDescriptor(typ TracedType, recursionIdentityMap map[any]int) TypeDescriptor {
 * 	symbol := typ.Symbol()
 * 	aliasSymbol := typ.AliasSymbol()
 *
 * 	desc := TypeDescriptor{
 * 		ID:    typ.Id(),
 * 		Flags: typ.FormatFlags(),
 * 	}
 *
 * 	// Assign a unique integer token per recursion identity, matching TypeScript's behavior.
 * 	// This lets trace analysis tools detect which types share the same recursion identity.
 * 	if identity := typ.RecursionIdentity(); identity != nil {
 * 		token, ok := recursionIdentityMap[identity]
 * 		if !ok {
 * 			token = len(recursionIdentityMap)
 * 			recursionIdentityMap[identity] = token
 * 		}
 * 		desc.RecursionID = &token
 * 	}
 *
 * 	// Intrinsic name
 * 	if name := typ.IntrinsicName(); name != "" {
 * 		desc.IntrinsicName = name
 * 	}
 *
 * 	// Symbol name - escape the internal symbol name prefix for valid JSON
 * 	if sym := aliasSymbol; sym != nil {
 * 		desc.SymbolName = ast.EscapeAllInternalSymbolNames(sym.Name)
 * 	} else if symbol != nil {
 * 		desc.SymbolName = ast.EscapeAllInternalSymbolNames(symbol.Name)
 * 	}
 *
 * 	// Tuple flag
 * 	if typ.IsTuple() {
 * 		desc.IsTuple = true
 * 	}
 *
 * 	// Union types
 * 	if types := typ.UnionTypes(); len(types) > 0 {
 * 		desc.UnionTypes = mapTypeIds(types)
 * 	}
 *
 * 	// Intersection types
 * 	if types := typ.IntersectionTypes(); len(types) > 0 {
 * 		desc.IntersectionTypes = mapTypeIds(types)
 * 	}
 *
 * 	// Alias type arguments
 * 	if args := typ.AliasTypeArguments(); len(args) > 0 {
 * 		desc.AliasTypeArguments = mapTypeIds(args)
 * 	}
 *
 * 	// Index type (keyof)
 * 	if indexType := typ.IndexType(); indexType != nil {
 * 		desc.KeyofType = new(indexType.Id())
 * 	}
 *
 * 	// Indexed access type
 * 	if objType := typ.IndexedAccessObjectType(); objType != nil {
 * 		desc.IndexedAccessObjectType = new(objType.Id())
 * 	}
 * 	if idxType := typ.IndexedAccessIndexType(); idxType != nil {
 * 		desc.IndexedAccessIndexType = new(idxType.Id())
 * 	}
 *
 * 	// Conditional type
 * 	if typ.IsConditional() {
 * 		if checkType := typ.ConditionalCheckType(); checkType != nil {
 * 			desc.ConditionalCheckType = new(checkType.Id())
 * 		}
 * 		if extendsType := typ.ConditionalExtendsType(); extendsType != nil {
 * 			desc.ConditionalExtendsType = new(extendsType.Id())
 * 		}
 * 		if trueType := typ.ConditionalTrueType(); trueType != nil {
 * 			desc.ConditionalTrueType = new(int32(trueType.Id()))
 * 		} else {
 * 			desc.ConditionalTrueType = new(int32(-1))
 * 		}
 * 		if falseType := typ.ConditionalFalseType(); falseType != nil {
 * 			desc.ConditionalFalseType = new(int32(falseType.Id()))
 * 		} else {
 * 			desc.ConditionalFalseType = new(int32(-1))
 * 		}
 * 	}
 *
 * 	// Substitution type
 * 	if baseType := typ.SubstitutionBaseType(); baseType != nil {
 * 		desc.SubstitutionBaseType = new(baseType.Id())
 * 	}
 * 	if constraint := typ.SubstitutionConstraintType(); constraint != nil {
 * 		desc.ConstraintType = new(constraint.Id())
 * 	}
 *
 * 	// Reference type
 * 	if target := typ.ReferenceTarget(); target != nil {
 * 		desc.InstantiatedType = new(target.Id())
 * 	}
 * 	if args := typ.ReferenceTypeArguments(); len(args) > 0 {
 * 		desc.TypeArguments = mapTypeIds(args)
 * 	}
 * 	if node := typ.ReferenceNode(); node != nil {
 * 		desc.ReferenceLocation = getLocation(node)
 * 	}
 *
 * 	// Reverse mapped type
 * 	if sourceType := typ.ReverseMappedSourceType(); sourceType != nil {
 * 		desc.ReverseMappedSourceType = new(sourceType.Id())
 * 	}
 * 	if mappedType := typ.ReverseMappedMappedType(); mappedType != nil {
 * 		desc.ReverseMappedMappedType = new(mappedType.Id())
 * 	}
 * 	if constraintType := typ.ReverseMappedConstraintType(); constraintType != nil {
 * 		desc.ReverseMappedConstraintType = new(constraintType.Id())
 * 	}
 *
 * 	// Evolving array type
 * 	if elemType := typ.EvolvingArrayElementType(); elemType != nil {
 * 		desc.EvolvingArrayElementType = new(elemType.Id())
 * 	}
 * 	if finalType := typ.EvolvingArrayFinalType(); finalType != nil {
 * 		desc.EvolvingArrayFinalType = new(finalType.Id())
 * 	}
 *
 * 	// Pattern (destructuring)
 * 	if pattern := typ.Pattern(); pattern != nil {
 * 		desc.DestructuringPattern = getLocation(pattern)
 * 	}
 *
 * 	// First declaration - prefer aliasSymbol, matching TypeScript's `aliasSymbol ?? symbol`
 * 	firstDeclSymbol := aliasSymbol
 * 	if firstDeclSymbol == nil {
 * 		firstDeclSymbol = symbol
 * 	}
 * 	if firstDeclSymbol != nil && len(firstDeclSymbol.Declarations) > 0 {
 * 		desc.FirstDeclaration = getLocation(firstDeclSymbol.Declarations[0])
 * 	}
 *
 * 	// Display text
 * 	if display := typ.Display(); display != "" {
 * 		desc.Display = display
 * 	}
 *
 * 	return desc
 * }
 */
export function typeTracer_buildTypeDescriptor(receiver, typ, recursionIdentityMap) {
    const symbol = typ.Symbol();
    const aliasSymbol = typ.AliasSymbol();
    const desc = {
        ID: typ.Id(),
        Flags: typ.FormatFlags(),
        IntrinsicName: "",
        SymbolName: "",
        RecursionID: undefined,
        IsTuple: false,
        UnionTypes: [],
        IntersectionTypes: [],
        AliasTypeArguments: [],
        KeyofType: undefined,
        IndexedAccessObjectType: undefined,
        IndexedAccessIndexType: undefined,
        ConditionalCheckType: undefined,
        ConditionalExtendsType: undefined,
        ConditionalTrueType: undefined,
        ConditionalFalseType: undefined,
        SubstitutionBaseType: undefined,
        ConstraintType: undefined,
        InstantiatedType: undefined,
        TypeArguments: [],
        ReferenceLocation: undefined,
        ReverseMappedSourceType: undefined,
        ReverseMappedMappedType: undefined,
        ReverseMappedConstraintType: undefined,
        EvolvingArrayElementType: undefined,
        EvolvingArrayFinalType: undefined,
        DestructuringPattern: undefined,
        FirstDeclaration: undefined,
        Display: "",
    };
    // Assign a unique integer token per recursion identity, matching TypeScript's behavior.
    if (typ.RecursionIdentity() !== undefined && typ.RecursionIdentity() !== null) {
        const identity = typ.RecursionIdentity();
        let token = recursionIdentityMap.get(identity);
        const ok = recursionIdentityMap.has(identity);
        if (!ok) {
            token = recursionIdentityMap.size;
            recursionIdentityMap.set(identity, token);
        }
        desc.RecursionID = token;
    }
    // Intrinsic name
    const intrinsicName = typ.IntrinsicName();
    if (intrinsicName !== "") {
        desc.IntrinsicName = intrinsicName;
    }
    // Symbol name - escape the internal symbol name prefix for valid JSON
    if (aliasSymbol !== undefined) {
        desc.SymbolName = EscapeAllInternalSymbolNames(aliasSymbol.Name);
    }
    else if (symbol !== undefined) {
        desc.SymbolName = EscapeAllInternalSymbolNames(symbol.Name);
    }
    // Tuple flag
    if (typ.IsTuple()) {
        desc.IsTuple = true;
    }
    // Union types
    const unionTypes = typ.UnionTypes();
    if (unionTypes.length > 0) {
        desc.UnionTypes = mapTypeIds(unionTypes);
    }
    // Intersection types
    const intersectionTypes = typ.IntersectionTypes();
    if (intersectionTypes.length > 0) {
        desc.IntersectionTypes = mapTypeIds(intersectionTypes);
    }
    // Alias type arguments
    const aliasArgs = typ.AliasTypeArguments();
    if (aliasArgs.length > 0) {
        desc.AliasTypeArguments = mapTypeIds(aliasArgs);
    }
    // Index type (keyof)
    const indexType = typ.IndexType();
    if (indexType !== undefined && indexType !== null) {
        desc.KeyofType = indexType.Id();
    }
    // Indexed access type
    const objType = typ.IndexedAccessObjectType();
    if (objType !== undefined && objType !== null) {
        desc.IndexedAccessObjectType = objType.Id();
    }
    const idxType = typ.IndexedAccessIndexType();
    if (idxType !== undefined && idxType !== null) {
        desc.IndexedAccessIndexType = idxType.Id();
    }
    // Conditional type
    if (typ.IsConditional()) {
        const checkType = typ.ConditionalCheckType();
        if (checkType !== undefined && checkType !== null) {
            desc.ConditionalCheckType = checkType.Id();
        }
        const extendsType = typ.ConditionalExtendsType();
        if (extendsType !== undefined && extendsType !== null) {
            desc.ConditionalExtendsType = extendsType.Id();
        }
        const trueType = typ.ConditionalTrueType();
        if (trueType !== undefined && trueType !== null) {
            desc.ConditionalTrueType = trueType.Id();
        }
        else {
            desc.ConditionalTrueType = -1;
        }
        const falseType = typ.ConditionalFalseType();
        if (falseType !== undefined && falseType !== null) {
            desc.ConditionalFalseType = falseType.Id();
        }
        else {
            desc.ConditionalFalseType = -1;
        }
    }
    // Substitution type
    const baseType = typ.SubstitutionBaseType();
    if (baseType !== undefined && baseType !== null) {
        desc.SubstitutionBaseType = baseType.Id();
    }
    const constraintType = typ.SubstitutionConstraintType();
    if (constraintType !== undefined && constraintType !== null) {
        desc.ConstraintType = constraintType.Id();
    }
    // Reference type
    const target = typ.ReferenceTarget();
    if (target !== undefined && target !== null) {
        desc.InstantiatedType = target.Id();
    }
    const refArgs = typ.ReferenceTypeArguments();
    if (refArgs.length > 0) {
        desc.TypeArguments = mapTypeIds(refArgs);
    }
    const refNode = typ.ReferenceNode();
    if (refNode !== undefined) {
        desc.ReferenceLocation = getLocation(refNode);
    }
    // Reverse mapped type
    const sourceType = typ.ReverseMappedSourceType();
    if (sourceType !== undefined && sourceType !== null) {
        desc.ReverseMappedSourceType = sourceType.Id();
    }
    const mappedType = typ.ReverseMappedMappedType();
    if (mappedType !== undefined && mappedType !== null) {
        desc.ReverseMappedMappedType = mappedType.Id();
    }
    const revConstraintType = typ.ReverseMappedConstraintType();
    if (revConstraintType !== undefined && revConstraintType !== null) {
        desc.ReverseMappedConstraintType = revConstraintType.Id();
    }
    // Evolving array type
    const elemType = typ.EvolvingArrayElementType();
    if (elemType !== undefined && elemType !== null) {
        desc.EvolvingArrayElementType = elemType.Id();
    }
    const finalType = typ.EvolvingArrayFinalType();
    if (finalType !== undefined && finalType !== null) {
        desc.EvolvingArrayFinalType = finalType.Id();
    }
    // Pattern (destructuring)
    const pattern = typ.Pattern();
    if (pattern !== undefined) {
        desc.DestructuringPattern = getLocation(pattern);
    }
    // First declaration - prefer aliasSymbol, matching TypeScript's `aliasSymbol ?? symbol`
    let firstDeclSymbol = aliasSymbol;
    if (firstDeclSymbol === undefined) {
        firstDeclSymbol = symbol;
    }
    if (firstDeclSymbol !== undefined && (firstDeclSymbol.Declarations?.length ?? 0) > 0) {
        desc.FirstDeclaration = getLocation(firstDeclSymbol.Declarations[0]);
    }
    // Display text
    const display = typ.Display();
    if (display !== "") {
        desc.Display = display;
    }
    return desc;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::mapTypeIds","kind":"func","status":"implemented","sigHash":"d19b55124c78fdf345d4bc1f8eec6bb30a47f63baf28f5ccbd9ae15e97ac8d0b","bodyHash":"e61ad13c5b60e1afa2294c3f439de116a0b00782debdd8afa766a5f92dbc201e"}
 *
 * Go source:
 * func mapTypeIds(types []TracedType) []uint32 {
 * 	if len(types) == 0 {
 * 		return nil
 * 	}
 * 	ids := make([]uint32, len(types))
 * 	for i, t := range types {
 * 		if t != nil {
 * 			ids[i] = t.Id()
 * 		}
 * 	}
 * 	return ids
 * }
 */
export function mapTypeIds(types) {
    if (types.length === 0) {
        return [];
    }
    return types.map((t) => (t !== undefined ? t.Id() : 0));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::getLocation","kind":"func","status":"implemented","sigHash":"478a29accac1440a4f12f914c0c7cf1caf54dd255362938116cddd86d8fc067b","bodyHash":"cc3ae306110e60d4bc975f3259e6219726b16162bd46355f4228ab2e51a5a277"}
 *
 * Go source:
 * func getLocation(node *ast.Node) *Location {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	file := ast.GetSourceFileOfNode(node)
 * 	if file == nil {
 * 		return nil
 * 	}
 *
 * 	startPos := scanner.GetTokenPosOfNode(node, file, false)
 * 	startLine, startChar := scanner.GetECMALineAndUTF16CharacterOfPosition(file, startPos)
 * 	endLine, endChar := scanner.GetECMALineAndUTF16CharacterOfPosition(file, node.End())
 *
 * 	return &Location{
 * 		Path: string(tspath.ToPath(file.FileName(), "", false)),
 * 		Start: &LineAndChar{
 * 			Line:      startLine + 1,
 * 			Character: int(startChar) + 1,
 * 		},
 * 		End: &LineAndChar{
 * 			Line:      endLine + 1,
 * 			Character: int(endChar) + 1,
 * 		},
 * 	}
 * }
 */
export function getLocation(node) {
    if (node === undefined) {
        return undefined;
    }
    const file = GetSourceFileOfNode(node);
    if (file === undefined) {
        return undefined;
    }
    // Build a SourceFileLike adapter so the scanner position functions can accept it.
    const sourceFileLike = {
        Text: () => SourceFile_Text(file),
        ECMALineMap: () => SourceFile_ECMALineMap(file),
    };
    const startPos = GetTokenPosOfNode(node, file, false);
    const [startLine, startChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFileLike, startPos);
    const [endLine, endChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFileLike, Node_End(node));
    return {
        Path: ToPath(SourceFile_FileName(file), "", false),
        Start: {
            Line: (startLine + 1),
            Character: (startChar + 1),
        },
        End: {
            Line: (endLine + 1),
            Character: (endChar + 1),
        },
    };
}
//# sourceMappingURL=tracing.js.map
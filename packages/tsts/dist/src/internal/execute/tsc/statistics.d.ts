import type { bool, int, ulong } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Writer } from "../../../go/io.js";
import type { MemStats } from "../../../go/runtime.js";
import type { Duration } from "../../../go/time.js";
import type { Program } from "../../compiler/program.js";
import type { CommandLineTesting, CompileTimes } from "./compile.js";
import type { EmitInput } from "./emit.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::type::tableRow","kind":"type","status":"implemented","sigHash":"8a3043eda386dc1a36fa9805876121254bfa574c99fffdcb1e3ad0fdd939860b","bodyHash":"ffbea9d1516844522509e299c37f2cba4263255f428e8a56af22027e47e19c39"}
 *
 * Go source:
 * tableRow struct {
 * 	name  string
 * 	value string
 * }
 */
export interface tableRow {
    name: string;
    value: string;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::type::table","kind":"type","status":"implemented","sigHash":"39b5170ce0714793f1db7661bd29a89e9b3eb03a66e70093ca35ace8e0cb1710","bodyHash":"37f49ebd52921993995cd8a2d67055d186ae9ecb195763c49da5604f59569d81"}
 *
 * Go source:
 * table struct {
 * 	rows []tableRow
 * }
 */
export interface table {
    rows: GoSlice<tableRow>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::method::table.add","kind":"method","status":"implemented","sigHash":"c830d461e2869a4ef32e3f62dd111abd4c84f105afa3c50d6d405f16ee0b8c64","bodyHash":"b0208c50794a00932fb4e590be5a3f4a3a6f2aa1bc2c4dbd2b364b398cc06def"}
 *
 * Go source:
 * func (t *table) add(name string, value any) {
 * 	if d, ok := value.(time.Duration); ok {
 * 		value = formatDuration(d)
 * 	}
 * 	t.rows = append(t.rows, tableRow{name, fmt.Sprint(value)})
 * }
 */
export declare function table_add(receiver: GoPtr<table>, name: string, value: unknown): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::method::table.print","kind":"method","status":"implemented","sigHash":"f21ee718a409133deef41cdd2d17790dc07f478b574cd2e68034bccd6a5e2cef","bodyHash":"0542b5b84fdc4244afe44a0953f0c3c71b3d04fa74538b55ec0286a5adb5a46c"}
 *
 * Go source:
 * func (t *table) print(w io.Writer) {
 * 	nameWidth := 0
 * 	valueWidth := 0
 * 	for _, r := range t.rows {
 * 		nameWidth = max(nameWidth, len(r.name))
 * 		valueWidth = max(valueWidth, len(r.value))
 * 	}
 *
 * 	for _, r := range t.rows {
 * 		fmt.Fprintf(w, "%-*s %*s\n", nameWidth+1, r.name+":", valueWidth, r.value)
 * 	}
 * }
 */
export declare function table_print(receiver: GoPtr<table>, w: Writer): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::func::formatDuration","kind":"func","status":"implemented","sigHash":"ecf74712c0471fca0c4fd13690b3a6d6aa81dc0e1c8cab27f788862c78ee138d","bodyHash":"e66dca4a6892f26aa15708cc8d66a41e7ef6725cda4b0a287401b59e67214e1d"}
 *
 * Go source:
 * func formatDuration(d time.Duration) string {
 * 	return fmt.Sprintf("%.3fs", d.Seconds())
 * }
 */
export declare function formatDuration(d: Duration): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::func::identifierCount","kind":"func","status":"implemented","sigHash":"2d5a60f778c07070280a6f4a13da13dac2bf574364b24cce9449f51ebbce35f8","bodyHash":"bfa3a5508653d2d11e50b3eee1e417abb6714ad23eb90902978096475c9e6e80"}
 *
 * Go source:
 * func identifierCount(p *compiler.Program) int {
 * 	count := 0
 * 	for _, file := range p.SourceFiles() {
 * 		count += file.IdentifierCount
 * 	}
 * 	return count
 * }
 */
export declare function identifierCount(p: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::type::Statistics","kind":"type","status":"implemented","sigHash":"d0df0f19c8630255df4d184704be6a41ad893ce2a4b2143188780d8e426a7ffc","bodyHash":"8b2d34a76ebfbf7f05e760d8e4cdd9e3326d2bb1da5a5e7565315b13e498bcd0"}
 *
 * Go source:
 * Statistics struct {
 * 	isAggregate      bool
 * 	Projects         int
 * 	ProjectsBuilt    int
 * 	TimestampUpdates int
 * 	files            int
 * 	lines            int
 * 	identifiers      int
 * 	symbols          int
 * 	types            int
 * 	instantiations   int
 * 	memoryUsed       uint64
 * 	memoryAllocs     uint64
 * 	compileTimes     *CompileTimes
 * }
 */
export interface Statistics {
    isAggregate: bool;
    Projects: int;
    ProjectsBuilt: int;
    TimestampUpdates: int;
    files: int;
    lines: int;
    identifiers: int;
    symbols: int;
    types: int;
    instantiations: int;
    memoryUsed: ulong;
    memoryAllocs: ulong;
    compileTimes: GoPtr<CompileTimes>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::func::statisticsFromProgram","kind":"func","status":"implemented","sigHash":"208eaa2cb0fc8e5430f172905e763d2cc1bc58013f9b4c8fe31bb251eccb656f","bodyHash":"2ece966aedfc5b1db74874e01cb7f6ec48a719deeef056b121758e9f5b15ac07"}
 *
 * Go source:
 * func statisticsFromProgram(input EmitInput, memStats *runtime.MemStats) *Statistics {
 * 	return &Statistics{
 * 		files:          len(input.Program.SourceFiles()),
 * 		lines:          input.Program.LineCount(),
 * 		identifiers:    input.Program.IdentifierCount(),
 * 		symbols:        input.Program.SymbolCount(),
 * 		types:          input.Program.TypeCount(),
 * 		instantiations: input.Program.InstantiationCount(),
 * 		memoryUsed:     memStats.Alloc,
 * 		memoryAllocs:   memStats.Mallocs,
 * 		compileTimes:   input.CompileTimes,
 * 	}
 * }
 */
export declare function statisticsFromProgram(input: EmitInput, memStats: GoPtr<MemStats>): GoPtr<Statistics>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::method::Statistics.Report","kind":"method","status":"implemented","sigHash":"db86f4afaa75ae469bba85e3e3a28572e5287e6eb891b0268621be8477d61741","bodyHash":"b7a9329129c4f007328ce0096718d96886937ea1e02c43376292c6d2b65527f8"}
 *
 * Go source:
 * func (s *Statistics) Report(w io.Writer, testing CommandLineTesting) {
 * 	if testing != nil {
 * 		testing.OnStatisticsStart(w)
 * 		defer testing.OnStatisticsEnd(w)
 * 	}
 * 	var table table
 * 	var prefix string
 *
 * 	if s.isAggregate {
 * 		prefix = "Aggregate "
 * 		table.add("Projects in scope", s.Projects)
 * 		table.add("Projects built", s.ProjectsBuilt)
 * 		table.add("Timestamps only updates", s.TimestampUpdates)
 * 	}
 * 	table.add(prefix+"Files", s.files)
 * 	table.add(prefix+"Lines", s.lines)
 * 	table.add(prefix+"Identifiers", s.identifiers)
 * 	table.add(prefix+"Symbols", s.symbols)
 * 	table.add(prefix+"Types", s.types)
 * 	table.add(prefix+"Instantiations", s.instantiations)
 * 	table.add(prefix+"Memory used", fmt.Sprintf("%vK", s.memoryUsed/1024))
 * 	table.add(prefix+"Memory allocs", strconv.FormatUint(s.memoryAllocs, 10))
 * 	if s.compileTimes.ConfigTime != 0 {
 * 		table.add(prefix+"Config time", s.compileTimes.ConfigTime)
 * 	}
 * 	if s.compileTimes.BuildInfoReadTime != 0 {
 * 		table.add(prefix+"BuildInfo read time", s.compileTimes.BuildInfoReadTime)
 * 	}
 * 	table.add(prefix+"Parse time", s.compileTimes.ParseTime)
 * 	if s.compileTimes.bindTime != 0 {
 * 		table.add(prefix+"Bind time", s.compileTimes.bindTime)
 * 	}
 * 	if s.compileTimes.checkTime != 0 {
 * 		table.add(prefix+"Check time", s.compileTimes.checkTime)
 * 	}
 * 	if s.compileTimes.emitTime != 0 {
 * 		table.add(prefix+"Emit time", s.compileTimes.emitTime)
 * 	}
 * 	if s.compileTimes.ChangesComputeTime != 0 {
 * 		table.add(prefix+"Changes compute time", s.compileTimes.ChangesComputeTime)
 * 	}
 * 	table.add(prefix+"Total time", s.compileTimes.totalTime)
 * 	table.print(w)
 * }
 */
export declare function Statistics_Report(receiver: GoPtr<Statistics>, w: Writer, testing: CommandLineTesting | undefined): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::method::Statistics.Aggregate","kind":"method","status":"implemented","sigHash":"99b823a13e642ccd4a1d8c859eba6c0b672f51d16ee2ad9cce1407f7dce1a342","bodyHash":"d78353881a5d36bf56113ad8779d68249d9e59b57f3433a8a1c8713a56fa7a18"}
 *
 * Go source:
 * func (s *Statistics) Aggregate(stat *Statistics) {
 * 	s.isAggregate = true
 * 	if s.compileTimes == nil {
 * 		s.compileTimes = &CompileTimes{}
 * 	}
 * 	// Aggregate statistics
 * 	s.files += stat.files
 * 	s.lines += stat.lines
 * 	s.identifiers += stat.identifiers
 * 	s.symbols += stat.symbols
 * 	s.types += stat.types
 * 	s.instantiations += stat.instantiations
 * 	s.memoryUsed += stat.memoryUsed
 * 	s.memoryAllocs += stat.memoryAllocs
 * 	s.compileTimes.ConfigTime += stat.compileTimes.ConfigTime
 * 	s.compileTimes.BuildInfoReadTime += stat.compileTimes.BuildInfoReadTime
 * 	s.compileTimes.ParseTime += stat.compileTimes.ParseTime
 * 	s.compileTimes.bindTime += stat.compileTimes.bindTime
 * 	s.compileTimes.checkTime += stat.compileTimes.checkTime
 * 	s.compileTimes.emitTime += stat.compileTimes.emitTime
 * 	s.compileTimes.ChangesComputeTime += stat.compileTimes.ChangesComputeTime
 * }
 */
export declare function Statistics_Aggregate(receiver: GoPtr<Statistics>, stat: GoPtr<Statistics>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/tsc/statistics.go::method::Statistics.SetTotalTime","kind":"method","status":"implemented","sigHash":"760d319622f8b322bafc237804cc170ac53a1002ec0e02643e7f2636dcd22702","bodyHash":"bed86dc159cca4c64011d6656e55a1a7795781a4837e0f80e6cace29824ad069"}
 *
 * Go source:
 * func (s *Statistics) SetTotalTime(totalTime time.Duration) {
 * 	if s.compileTimes == nil {
 * 		s.compileTimes = &CompileTimes{}
 * 	}
 * 	s.compileTimes.totalTime = totalTime
 * }
 */
export declare function Statistics_SetTotalTime(receiver: GoPtr<Statistics>, totalTime: Duration): void;
//# sourceMappingURL=statistics.d.ts.map
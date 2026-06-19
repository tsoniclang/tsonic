import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Context } from "../../go/context.js";
import { Mutex, Once, OnceFunc } from "../../go/sync.js";
import type { SourceFile } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { NewChecker } from "../checker/checker/state.js";
import type { Checker } from "../checker/checker/state.js";
import { Checker_GetGlobalDiagnostics } from "../checker/checker/diagnostics.js";
import { NewTracer } from "../checker/tracer.js";
import { NewWorkGroup } from "../core/workgroup.js";
import type { Tracing } from "../tracing/tracing.js";
import { Concat, Index } from "../../go/slices.js";
import type { Program } from "./program.js";
import { Program_as_checker_Program, Program_Options, Program_SingleThreaded, SortAndDeduplicateDiagnostics } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::type::CheckerPool","kind":"type","status":"implemented","sigHash":"0ae9932ac5eea7302f43fdaded6b82addcb4d06b9f9209ed8ff2be51bb7f7d16","bodyHash":"c982af3c817df71dc9ae1af140208863183d3eaa1e11d94bfdcf98a350318845"}
 *
 * Go source:
 * CheckerPool interface {
 * 	GetChecker(ctx context.Context, file *ast.SourceFile) (*checker.Checker, func())
 * }
 */
export interface CheckerPool {
  GetChecker(ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::type::checkerPool","kind":"type","status":"implemented","sigHash":"d37f5b7033c0ac566bfcbd9a2b4cdeda82ec5bb8ce63f72a6bfd20b94d11f46d","bodyHash":"1586bb5506912830f0532ac797eda4f3701bf2b9daa7da79ac8f2b61ca699bbf"}
 *
 * Go source:
 * checkerPool struct {
 * 	program *Program
 * 	tracing *tracing.Tracing
 * 
 * 	createCheckersOnce sync.Once
 * 	checkers           []*checker.Checker
 * 	locks              []*sync.Mutex
 * 	fileAssociations   map[*ast.SourceFile]*checker.Checker
 * }
 */
export interface checkerPool {
  program: GoPtr<Program>;
  tracing: GoPtr<Tracing>;
  createCheckersOnce: Once;
  checkers: GoSlice<GoPtr<Checker>>;
  locks: GoSlice<GoPtr<Mutex>>;
  fileAssociations: GoMap<GoPtr<SourceFile>, GoPtr<Checker>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"9e7f04f88e8b76eb738dbbc027136b53c2f0ac505b2ff525d29d3d5233e3713f"}
 *
 * Go source:
 * var _ CheckerPool = (*checkerPool)(nil)
 */
export let __34031131_0: CheckerPool = checkerPool_as_compiler_CheckerPool(undefined);

export function checkerPool_as_compiler_CheckerPool(receiver: GoPtr<checkerPool>): CheckerPool {
  return {
    GetChecker: (ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void] => checkerPool_GetChecker(receiver, ctx, file),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::func::newCheckerPool","kind":"func","status":"implemented","sigHash":"166e4959543a17d547b22ee4264d922ed4cabd9adeaa8a75759e6f7392883bdf","bodyHash":"8889d04f05490b17ee812701674dde250bb3c02bd6bc663f542f2fd7033faf19"}
 *
 * Go source:
 * func newCheckerPool(program *Program) *checkerPool {
 * 	return newCheckerPoolWithTracing(program, nil)
 * }
 */
export function newCheckerPool(program: GoPtr<Program>): GoPtr<checkerPool> {
  return newCheckerPoolWithTracing(program, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::func::newCheckerPoolWithTracing","kind":"func","status":"implemented","sigHash":"9953910d49bd820792eabe9a00a2ed76d566e8c7b5bc474574cc454fed7a1624","bodyHash":"5a3ab48b396da0cd3ede9420f73f5db5e323d26d874b7024eb2f69fb43dd3c03"}
 *
 * Go source:
 * func newCheckerPoolWithTracing(program *Program, tr *tracing.Tracing) *checkerPool {
 * 	checkerCount := 4
 * 	if program.SingleThreaded() {
 * 		checkerCount = 1
 * 	} else if c := program.Options().Checkers; c != nil {
 * 		checkerCount = *c
 * 	}
 * 
 * 	checkerCount = max(min(checkerCount, len(program.files), 256), 1)
 * 
 * 	pool := &checkerPool{
 * 		program:  program,
 * 		checkers: make([]*checker.Checker, checkerCount),
 * 		locks:    make([]*sync.Mutex, checkerCount),
 * 		tracing:  tr,
 * 	}
 * 
 * 	return pool
 * }
 */
export function newCheckerPoolWithTracing(program: GoPtr<Program>, tr: GoPtr<Tracing>): GoPtr<checkerPool> {
  let checkerCount = 4;
  if (Program_SingleThreaded(program)) {
    checkerCount = 1;
  } else {
    const c = Program_Options(program)!.Checkers;
    if (c !== undefined) {
      checkerCount = c;
    }
  }
  const files = program!.__tsgoEmbedded0!.files;
  checkerCount = Math.max(Math.min(checkerCount, files.length, 256), 1);
  const pool: checkerPool = {
    program,
    tracing: tr,
    createCheckersOnce: new Once(),
    checkers: new globalThis.Array(checkerCount).fill(undefined) as GoSlice<GoPtr<Checker>>,
    locks: new globalThis.Array(checkerCount).fill(undefined) as GoSlice<GoPtr<Mutex>>,
    fileAssociations: new globalThis.Map<GoPtr<SourceFile>, GoPtr<Checker>>(),
  };
  return pool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.GetChecker","kind":"method","status":"implemented","sigHash":"119c49bcd6ab8793332baa807b9cdaa84c7bf198b3c5e782244c6c15cd2751db","bodyHash":"342a290ef024e733b3dc34d1f3465877ea34a1daf91287360af8fcfae8e93288"}
 *
 * Go source:
 * func (p *checkerPool) GetChecker(ctx context.Context, file *ast.SourceFile) (*checker.Checker, func()) {
 * 	if file != nil {
 * 		return p.getCheckerForFileExclusive(ctx, file)
 * 	}
 * 	p.createCheckers()
 * 	c := p.checkers[0]
 * 	p.locks[0].Lock()
 * 	return c, sync.OnceFunc(func() {
 * 		p.locks[0].Unlock()
 * 	})
 * }
 */
export function checkerPool_GetChecker(receiver: GoPtr<checkerPool>, ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void] {
  if (file !== undefined) {
    return checkerPool_getCheckerForFileExclusive(receiver, ctx, file);
  }
  checkerPool_createCheckers(receiver);
  const c = receiver!.checkers[0];
  receiver!.locks[0]!.Lock();
  return [c, OnceFunc((): void => {
    receiver!.locks[0]!.Unlock();
  })];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.getCheckerForFileNonExclusive","kind":"method","status":"implemented","sigHash":"7cdf572d19ca34636db31ffb8217b952f0ebc3482c940ac234eb1182dcef0075","bodyHash":"094bb0e6e3adc351d25c684f825d564e462bf7e1c8e974c1d14f6cf178fe6097"}
 *
 * Go source:
 * func (p *checkerPool) getCheckerForFileNonExclusive(file *ast.SourceFile) (*checker.Checker, func()) {
 * 	p.createCheckers()
 * 	return p.fileAssociations[file], noop
 * }
 */
export function checkerPool_getCheckerForFileNonExclusive(receiver: GoPtr<checkerPool>, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void] {
  checkerPool_createCheckers(receiver);
  return [receiver!.fileAssociations.get(file), noop];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.getCheckerForFileExclusive","kind":"method","status":"implemented","sigHash":"83eebee60ea64c4c19a3821bc9da72d2850e90e1d8433511273e446dabbd729b","bodyHash":"2bae2c25ab185bf31148bf4e7bb1840f4621544e4e2e36ea495145beb2813b8a"}
 *
 * Go source:
 * func (p *checkerPool) getCheckerForFileExclusive(ctx context.Context, file *ast.SourceFile) (*checker.Checker, func()) {
 * 	p.createCheckers()
 * 	c := p.fileAssociations[file]
 * 	idx := slices.Index(p.checkers, c)
 * 	p.locks[idx].Lock()
 * 	return c, sync.OnceFunc(func() {
 * 		p.locks[idx].Unlock()
 * 	})
 * }
 */
export function checkerPool_getCheckerForFileExclusive(receiver: GoPtr<checkerPool>, ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void] {
  checkerPool_createCheckers(receiver);
  const c = receiver!.fileAssociations.get(file);
  const idx = Index(receiver!.checkers, c);
  receiver!.locks[idx]!.Lock();
  return [c, OnceFunc((): void => {
    receiver!.locks[idx]!.Unlock();
  })];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.getCheckerNonExclusive","kind":"method","status":"implemented","sigHash":"ae08dbdaed275afb2e2412654bd618522caea2db06ae92f991f32ed1d2445973","bodyHash":"e10cc58e6d45616db657e2b251bcda41b3550c8683967f05922274882d224b04"}
 *
 * Go source:
 * func (p *checkerPool) getCheckerNonExclusive() (*checker.Checker, func()) {
 * 	p.createCheckers()
 * 	return p.checkers[0], noop
 * }
 */
export function checkerPool_getCheckerNonExclusive(receiver: GoPtr<checkerPool>): [GoPtr<Checker>, () => void] {
  checkerPool_createCheckers(receiver);
  return [receiver!.checkers[0], noop];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.createCheckers","kind":"method","status":"implemented","sigHash":"19230b9f77ae2328d885f0532415a4cffa41067f50bf4e1450779f8f28f22c43","bodyHash":"d20af42727eaf14e9c4750d174397bbb1ae7e0a78604b1c95a6036a32383bdc5"}
 *
 * Go source:
 * func (p *checkerPool) createCheckers() {
 * 	p.createCheckersOnce.Do(func() {
 * 		checkerCount := len(p.checkers)
 * 		wg := core.NewWorkGroup(p.program.SingleThreaded())
 * 		for i := range checkerCount {
 * 			wg.Queue(func() {
 * 				var tracer *checker.Tracer
 * 				if p.tracing != nil {
 * 					tracer = checker.NewTracer(p.tracing, i)
 * 				}
 * 				p.checkers[i], p.locks[i] = checker.NewChecker(p.program, tracer)
 * 			})
 * 		}
 * 
 * 		wg.RunAndWait()
 * 
 * 		p.fileAssociations = make(map[*ast.SourceFile]*checker.Checker, len(p.program.files))
 * 		for i, file := range p.program.files {
 * 			p.fileAssociations[file] = p.checkers[i%checkerCount]
 * 		}
 * 	})
 * }
 */
export function checkerPool_createCheckers(receiver: GoPtr<checkerPool>): void {
  receiver!.createCheckersOnce.Do((): void => {
    const checkerCount = receiver!.checkers.length;
    const wg = NewWorkGroup(Program_SingleThreaded(receiver!.program));
    for (let i = 0; i < checkerCount; i++) {
      const idx = i;
      wg.Queue((): void => {
        let tracer = undefined;
        if (receiver!.tracing !== undefined) {
          tracer = NewTracer(receiver!.tracing, idx as int);
        }
        const [c, lock] = NewChecker(Program_as_checker_Program(receiver!.program), tracer);
        receiver!.checkers[idx] = c;
        receiver!.locks[idx] = lock;
      });
    }
    wg.RunAndWait();
    receiver!.fileAssociations = new globalThis.Map<GoPtr<SourceFile>, GoPtr<Checker>>();
    const files = receiver!.program!.__tsgoEmbedded0!.files;
    for (let i = 0; i < files.length; i++) {
      receiver!.fileAssociations.set(files[i], receiver!.checkers[i % checkerCount]);
    }
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.forEachCheckerParallel","kind":"method","status":"implemented","sigHash":"6d0cfadcfb89a399bd2c11f56daee7a702b3c1781d9836028967cdae9cefa936","bodyHash":"c7364f18cb77e4db31e7788ee2d5cf740df8f5620eaba4824b4616c9c85ee6e1"}
 *
 * Go source:
 * func (p *checkerPool) forEachCheckerParallel(cb func(idx int, c *checker.Checker)) {
 * 	p.createCheckers()
 * 	wg := core.NewWorkGroup(p.program.SingleThreaded())
 * 	for idx, checker := range p.checkers {
 * 		wg.Queue(func() {
 * 			p.locks[idx].Lock()
 * 			defer p.locks[idx].Unlock()
 * 			cb(idx, checker)
 * 		})
 * 	}
 * 	wg.RunAndWait()
 * }
 */
export function checkerPool_forEachCheckerParallel(receiver: GoPtr<checkerPool>, cb: (idx: int, c: GoPtr<Checker>) => void): void {
  checkerPool_createCheckers(receiver);
  const wg = NewWorkGroup(Program_SingleThreaded(receiver!.program));
  for (let idx = 0; idx < receiver!.checkers.length; idx++) {
    const checkerIdx = idx;
    const checkerVal = receiver!.checkers[idx];
    wg.Queue((): void => {
      receiver!.locks[checkerIdx]!.Lock();
      try {
        cb(checkerIdx as int, checkerVal);
      } finally {
        receiver!.locks[checkerIdx]!.Unlock();
      }
    });
  }
  wg.RunAndWait();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.GetGlobalDiagnostics","kind":"method","status":"implemented","sigHash":"410fa0340cbce64a38248739a4536a44f70f45c4d9210e984dc35a650a1b4bd6","bodyHash":"d6cb8aeb0c5ba82ebec06f96763ba7958812fd8f8d3bb216abdeffb55072c676"}
 *
 * Go source:
 * func (p *checkerPool) GetGlobalDiagnostics() []*ast.Diagnostic {
 * 	p.createCheckers()
 * 	globalDiagnostics := make([][]*ast.Diagnostic, len(p.checkers))
 * 	p.forEachCheckerParallel(func(idx int, checker *checker.Checker) {
 * 		globalDiagnostics[idx] = checker.GetGlobalDiagnostics()
 * 	})
 * 	return SortAndDeduplicateDiagnostics(slices.Concat(globalDiagnostics...))
 * }
 */
export function checkerPool_GetGlobalDiagnostics(receiver: GoPtr<checkerPool>): GoSlice<GoPtr<Diagnostic>> {
  checkerPool_createCheckers(receiver);
  const globalDiagnostics: GoSlice<GoSlice<GoPtr<Diagnostic>>> = new globalThis.Array(receiver!.checkers.length).fill([]);
  checkerPool_forEachCheckerParallel(receiver, (idx: int, checker: GoPtr<Checker>): void => {
    globalDiagnostics[idx] = Checker_GetGlobalDiagnostics(checker);
  });
  return SortAndDeduplicateDiagnostics(Concat(...globalDiagnostics));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::method::checkerPool.forEachCheckerGroupDo","kind":"method","status":"implemented","sigHash":"38ea917bcaf07ccc4803e64418618de966a670835de8500ab9ce1704d0dd052f","bodyHash":"6fb52a2bf4d5091db947cdb7ac11b0f76ca302edc3cfa34587d68d8eedc08df6"}
 *
 * Go source:
 * func (p *checkerPool) forEachCheckerGroupDo(ctx context.Context, files []*ast.SourceFile, singleThreaded bool, cb func(c *checker.Checker, fileIndex int, file *ast.SourceFile)) {
 * 	p.createCheckers()
 * 
 * 	checkerCount := len(p.checkers)
 * 	wg := core.NewWorkGroup(singleThreaded)
 * 	for checkerIdx := range checkerCount {
 * 		wg.Queue(func() {
 * 			p.locks[checkerIdx].Lock()
 * 			defer p.locks[checkerIdx].Unlock()
 * 			for i, file := range files {
 * 				if checker := p.checkers[checkerIdx]; checker == p.fileAssociations[file] {
 * 					cb(checker, i, file)
 * 				}
 * 			}
 * 		})
 * 	}
 * 	wg.RunAndWait()
 * }
 */
export function checkerPool_forEachCheckerGroupDo(receiver: GoPtr<checkerPool>, ctx: Context, files: GoSlice<GoPtr<SourceFile>>, singleThreaded: bool, cb: (c: GoPtr<Checker>, fileIndex: int, file: GoPtr<SourceFile>) => void): void {
  checkerPool_createCheckers(receiver);
  const checkerCount = receiver!.checkers.length;
  const wg = NewWorkGroup(singleThreaded);
  for (let checkerIdx = 0; checkerIdx < checkerCount; checkerIdx++) {
    const ci = checkerIdx;
    wg.Queue((): void => {
      receiver!.locks[ci]!.Lock();
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const checker = receiver!.checkers[ci];
          if (checker === receiver!.fileAssociations.get(file)) {
            cb(checker, i as int, file);
          }
        }
      } finally {
        receiver!.locks[ci]!.Unlock();
      }
    });
  }
  wg.RunAndWait();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/checkerpool.go::func::noop","kind":"func","status":"implemented","sigHash":"6be010a04bb0d20312c767db86bb1c06ec0eae1e2858ba2d9aaba7aae566927f","bodyHash":"09d613a4bf8143477ac9bfbc1af14d982f0f4eb87bf1698279c4f6df7fc2c750"}
 *
 * Go source:
 * func noop() {}
 */
export function noop(): void {}

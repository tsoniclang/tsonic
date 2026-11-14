// The Origins domain of BodyAnalysis has no public operation (low/COMPONENTS.md section 10, rows 1410-1416; S2-24):
// it runs only inside the body round, `analyzeBodyRound`, whose contract is the BodyAnalysis box's. The separately
// wired per-round port this file used to declare (`OriginsDeps`, `AnalyzeOrigins`) is replaced by that one operation.
// The domain's kernel and its records are private to this component (`analyze.ts`), named by no wiring member.
export {};

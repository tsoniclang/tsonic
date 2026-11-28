import type { MemberSelectionKey, ParseTir, PrintTir, TirOperationsOf, VerifyTir, VerifyTirModule } from "./contract.js";
import type { IsLayoutOperandBody, LayoutArgumentSlots, LayoutBindingOf, LayoutObservationOf, RawValueTypeOf } from "./contract.js";
import type { AdmitFormalInitializer, BodyOccurrenceSlots, ChapterStatementSyntax, ChapterSyntaxSlots, FormalInitializerSlot, FormalInitializerSyntax, IndexChapterSyntax, ReadChapterSyntaxSlot, TirBodySyntaxOf } from "./contract.js";
import { admitFormalInitializer as admitInitializer, bodyOccurrenceSlots as occurrenceSlots,
  chapterStatementSyntax as statementSyntax, chapterSyntaxSlots as chapterSlots, chapterTransportSlots as transportSlots,
  formalInitializerSlot as initializerSlot, isLayoutOperandBody as layoutOperandBody,
  formalInitializerSyntax as initializerSyntax, indexChapterSyntax as indexChapter,
  layoutArgumentSlots as argumentSlots, layoutBindingOf as layoutBinding, layoutObservationOf as layoutObservation, rawValueTypeOf as rawValueType,
  readChapterSyntaxSlot as readChapterSlot, tirBodySyntaxOf as bodySyntaxOf } from "./chapter-syntax.js";
import { parseTypedBody } from "./parse.js";
import { printTypedBody } from "./print.js";
import { selectionKey } from "./selection-key.js";
import type { TupleArgumentOperation } from "./contract.js";
import { tupleArgumentOperation as argumentOperation } from "./verify-applications.js";
import { tirOperationsOf as operationsOf, verifyTypedBody, verifyTypedModule } from "./verify.js";

export const printTir: PrintTir = printTypedBody;
export const parseTir: ParseTir = parseTypedBody;
export const layoutArgumentSlots: LayoutArgumentSlots = argumentSlots;
export const verifyTir: VerifyTir = verifyTypedBody;
export const verifyTirModule: VerifyTirModule = verifyTypedModule;
export const memberSelectionKey: MemberSelectionKey = selectionKey;
export const tirOperationsOf: TirOperationsOf = operationsOf;
export const chapterSyntaxSlots: ChapterSyntaxSlots = chapterSlots;
export const chapterTransportSlots: ChapterSyntaxSlots = transportSlots;
export const isLayoutOperandBody: IsLayoutOperandBody = layoutOperandBody;
export const tirBodySyntaxOf: TirBodySyntaxOf = bodySyntaxOf;
export const indexChapterSyntax: IndexChapterSyntax = indexChapter;
export const bodyOccurrenceSlots: BodyOccurrenceSlots = occurrenceSlots;
export const readChapterSyntaxSlot: ReadChapterSyntaxSlot = readChapterSlot;
export const chapterStatementSyntax: ChapterStatementSyntax = statementSyntax;
export const admitFormalInitializer: AdmitFormalInitializer = admitInitializer;
export const formalInitializerSlot: FormalInitializerSlot = initializerSlot;
export const formalInitializerSyntax: FormalInitializerSyntax = initializerSyntax;
export const layoutBindingOf: LayoutBindingOf = layoutBinding;
export const layoutObservationOf: LayoutObservationOf = layoutObservation;
export const rawValueTypeOf: RawValueTypeOf = rawValueType;
export const tupleArgumentOperation: TupleArgumentOperation = argumentOperation;

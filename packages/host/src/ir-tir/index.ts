import type { MemberSelectionKey, ParseTir, PrintTir, TirOperationsOf, VerifyTir, VerifyTirModule } from "./contract.js";
import type { AdmitFormalInitializer, BodyOccurrenceSlots, ChapterStatementSyntax, ChapterSyntaxSlots, FormalInitializerSyntax, IndexChapterSyntax, ReadChapterSyntaxSlot, TirBodySyntaxOf } from "./contract.js";
import { admitFormalInitializer as admitInitializer, bodyOccurrenceSlots as occurrenceSlots,
  chapterStatementSyntax as statementSyntax, chapterSyntaxSlots as chapterSlots, formalInitializerSyntax as initializerSyntax, indexChapterSyntax as indexChapter,
  readChapterSyntaxSlot as readChapterSlot, tirBodySyntaxOf as bodySyntaxOf } from "./chapter-syntax.js";
import { parseTypedBody } from "./parse.js";
import { printTypedBody } from "./print.js";
import { selectionKey } from "./selection-key.js";
import { tirOperationsOf as operationsOf, verifyTypedBody, verifyTypedModule } from "./verify.js";

export const printTir: PrintTir = printTypedBody;
export const parseTir: ParseTir = parseTypedBody;
export const verifyTir: VerifyTir = verifyTypedBody;
export const verifyTirModule: VerifyTirModule = verifyTypedModule;
export const memberSelectionKey: MemberSelectionKey = selectionKey;
export const tirOperationsOf: TirOperationsOf = operationsOf;
export const chapterSyntaxSlots: ChapterSyntaxSlots = chapterSlots;
export const tirBodySyntaxOf: TirBodySyntaxOf = bodySyntaxOf;
export const indexChapterSyntax: IndexChapterSyntax = indexChapter;
export const bodyOccurrenceSlots: BodyOccurrenceSlots = occurrenceSlots;
export const readChapterSyntaxSlot: ReadChapterSyntaxSlot = readChapterSlot;
export const chapterStatementSyntax: ChapterStatementSyntax = statementSyntax;
export const admitFormalInitializer: AdmitFormalInitializer = admitInitializer;
export const formalInitializerSyntax: FormalInitializerSyntax = initializerSyntax;

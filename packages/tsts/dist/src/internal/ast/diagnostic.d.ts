import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Mutex } from "../../go/sync.js";
import type { Set } from "../collections/set.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import type { TextRange } from "../core/text.js";
import type { Category as Category_6dba7ba3, Key, Message } from "../diagnostics/diagnostics.js";
import type { Locale } from "../locale/locale.js";
import type { SourceFile } from "./ast.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::type::RepopulateDiagnosticKind","kind":"type","status":"implemented","sigHash":"e446e2627ed7552a68f1faf1b75bec5da05f7746b8d9b63980046b95de21abaa","bodyHash":"824f8b278d2c9039fd919bb01959d81e8502e97c5fb2b0d2c0fdf4648b66e8ab"}
 *
 * Go source:
 * RepopulateDiagnosticKind int
 */
export type RepopulateDiagnosticKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::constGroup::RepopulateModeMismatch+RepopulateModuleNotFound","kind":"constGroup","status":"implemented","sigHash":"60871857debbaad6e38790496dfd40acfc9fe5c693f3813ef677e4d4631aa6a0","bodyHash":"67af603ca47f090863f40143f672b2863ce198c797565b46a87510075715948c"}
 *
 * Go source:
 * const (
 * 	RepopulateModeMismatch   RepopulateDiagnosticKind = 1
 * 	RepopulateModuleNotFound RepopulateDiagnosticKind = 2
 * )
 */
export declare const RepopulateModeMismatch: RepopulateDiagnosticKind;
export declare const RepopulateModuleNotFound: RepopulateDiagnosticKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::type::RepopulateDiagnosticInfo","kind":"type","status":"implemented","sigHash":"7b46f46b9b33431e76f60166501d9eeeab67d3f6f1a0a4359683f9c381faa2b9","bodyHash":"199757b91f7428dc192b2f19c862e9ad52ddbabf5cb825207f0d370e83426a17"}
 *
 * Go source:
 * RepopulateDiagnosticInfo struct {
 * 	Kind            RepopulateDiagnosticKind
 * 	ModuleReference string
 * 	Mode            core.ResolutionMode
 * 	PackageName     string
 * }
 */
export interface RepopulateDiagnosticInfo {
    Kind: RepopulateDiagnosticKind;
    ModuleReference: string;
    Mode: ResolutionMode;
    PackageName: string;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::type::Diagnostic","kind":"type","status":"implemented","sigHash":"a5b00a0f8bdac227f5ce3780ba60734fc8a87398b12243e7e9f5ba3a03f69a70","bodyHash":"145ecc24e74158d3b1ca8007194e3e9af0c99f8acf5249a1685f91de746193f0"}
 *
 * Go source:
 * Diagnostic struct {
 * 	file     *SourceFile
 * 	loc      core.TextRange
 * 	code     int32
 * 	category diagnostics.Category
 * 	// Original message; may be nil.
 * 	message            *diagnostics.Message
 * 	messageKey         diagnostics.Key
 * 	messageArgs        []string
 * 	messageChain       []*Diagnostic
 * 	relatedInformation []*Diagnostic
 * 	reportsUnnecessary bool
 * 	reportsDeprecated  bool
 * 	skippedOnNoEmit    bool
 * 	repopulateInfo     *RepopulateDiagnosticInfo
 * }
 */
export interface Diagnostic {
    file: GoPtr<SourceFile>;
    loc: TextRange;
    code: int;
    category: Category_6dba7ba3;
    message: GoPtr<Message>;
    messageKey: Key;
    messageArgs: GoSlice<string>;
    messageChain: GoSlice<GoPtr<Diagnostic>>;
    relatedInformation: GoSlice<GoPtr<Diagnostic>>;
    reportsUnnecessary: bool;
    reportsDeprecated: bool;
    skippedOnNoEmit: bool;
    repopulateInfo: GoPtr<RepopulateDiagnosticInfo>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.File","kind":"method","status":"implemented","sigHash":"95a3ebae18635f0d7ffb9ea3a0c8387997e11c06dfa8069e53dd379fae72121c","bodyHash":"4b75b1e35c17d7524f586f72a48885847fc6f5d27c9c687367de086454e86e1f"}
 *
 * Go source:
 * func (d *Diagnostic) File() *SourceFile                         { return d.file }
 */
export declare function Diagnostic_File(receiver: GoPtr<Diagnostic>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Pos","kind":"method","status":"implemented","sigHash":"a531f4a3c00a75a689c0e0232cb1c5f14681ec9c9c869b6544e6e245430a6247","bodyHash":"8a150043f04f3d55940a61438c8a9d0e5492e8202b4b33e05fcca81d077467e7"}
 *
 * Go source:
 * func (d *Diagnostic) Pos() int                                  { return d.loc.Pos() }
 */
export declare function Diagnostic_Pos(receiver: GoPtr<Diagnostic>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.End","kind":"method","status":"implemented","sigHash":"3d69cb5556ae8d49b7cf7cd330e1f0ef30abbc39896fe35319957c994d44b6ff","bodyHash":"c4bbf8ccb5dff80bf2f1d644f2c07c3ee2faffc546bcbccdec13d09a1c1b999f"}
 *
 * Go source:
 * func (d *Diagnostic) End() int                                  { return d.loc.End() }
 */
export declare function Diagnostic_End(receiver: GoPtr<Diagnostic>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Len","kind":"method","status":"implemented","sigHash":"cc5e46572b07177c1ced13d4ecb11904ad06246c248038510a07c891a23d36b0","bodyHash":"797c8d96da5be7b0b1e5fc1fa1aa962e866c249d4cc9a62607c41a58437a23ec"}
 *
 * Go source:
 * func (d *Diagnostic) Len() int                                  { return d.loc.Len() }
 */
export declare function Diagnostic_Len(receiver: GoPtr<Diagnostic>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Loc","kind":"method","status":"implemented","sigHash":"15482af74c3579c8ef8255af5390cd606b409ae03d2c8bd074f9635b7ef3e463","bodyHash":"030915a890d2a0af1e98c3b989ddd6634689aa951be12b62ab9656ddb83f690a"}
 *
 * Go source:
 * func (d *Diagnostic) Loc() core.TextRange                       { return d.loc }
 */
export declare function Diagnostic_Loc(receiver: GoPtr<Diagnostic>): TextRange;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Code","kind":"method","status":"implemented","sigHash":"828cce2268c68f1bfde5bc1bcefdb82d17c6db2b4ccbdf2c0f64db2f650e0614","bodyHash":"f638335c1771d6e55ee7982160e193f19424e719dc97bf5f5124c6711771937d"}
 *
 * Go source:
 * func (d *Diagnostic) Code() int32                               { return d.code }
 */
export declare function Diagnostic_Code(receiver: GoPtr<Diagnostic>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Category","kind":"method","status":"implemented","sigHash":"fe6ac33905fc24ca89f24403cb38eccf6ce72c813c00749f9d70fd45b0bb1710","bodyHash":"4db39ded1a0466de4583da8ef4577fed3b1cc27307719830a927184c9f9fef76"}
 *
 * Go source:
 * func (d *Diagnostic) Category() diagnostics.Category            { return d.category }
 */
export declare function Diagnostic_Category(receiver: GoPtr<Diagnostic>): Category_6dba7ba3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.MessageKey","kind":"method","status":"implemented","sigHash":"603a9711d7ed48733f897220dad62a6e2a11329ba44c8c6f348681734efe19a9","bodyHash":"0d6d36999fff44af16c513ed79db0acfb60096474360af327f4f30f7613e086e"}
 *
 * Go source:
 * func (d *Diagnostic) MessageKey() diagnostics.Key               { return d.messageKey }
 */
export declare function Diagnostic_MessageKey(receiver: GoPtr<Diagnostic>): Key;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.MessageArgs","kind":"method","status":"implemented","sigHash":"d80a70bc2902477eff851aa608a75a231ab02b23ab26606b2558a2c8140efe96","bodyHash":"7b6c85026a91d124073220cb874aa8d053dfb4f33ccb2f5066b2b53a78fd6613"}
 *
 * Go source:
 * func (d *Diagnostic) MessageArgs() []string                     { return d.messageArgs }
 */
export declare function Diagnostic_MessageArgs(receiver: GoPtr<Diagnostic>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.MessageChain","kind":"method","status":"implemented","sigHash":"e92709ae1abf681500eb614bd394ee31fbcc38c286d63a7fa79015f3f4d933e8","bodyHash":"571bc5a8fdb97a98ab973ec982d85cc17380c9401fe9bc2f65d6738761344053"}
 *
 * Go source:
 * func (d *Diagnostic) MessageChain() []*Diagnostic               { return d.messageChain }
 */
export declare function Diagnostic_MessageChain(receiver: GoPtr<Diagnostic>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.RelatedInformation","kind":"method","status":"implemented","sigHash":"808be7b8c40dcf10c2382e5994e87e6767960b080a9e59731f9ba17c43ddf0e7","bodyHash":"0c2ad162b7fc5984a62f6a7032d2da9ee4c3b9f7ad93095c025fb07c4f1b19f7"}
 *
 * Go source:
 * func (d *Diagnostic) RelatedInformation() []*Diagnostic         { return d.relatedInformation }
 */
export declare function Diagnostic_RelatedInformation(receiver: GoPtr<Diagnostic>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.ReportsUnnecessary","kind":"method","status":"implemented","sigHash":"3baadf761aea80cfac0eac68299b8ffcedff3c1fe984b4b2db98127ed483b866","bodyHash":"937a66bcf07715ea118700b937794889169e8a7b99c280af814b733fdd8028aa"}
 *
 * Go source:
 * func (d *Diagnostic) ReportsUnnecessary() bool                  { return d.reportsUnnecessary }
 */
export declare function Diagnostic_ReportsUnnecessary(receiver: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.ReportsDeprecated","kind":"method","status":"implemented","sigHash":"d4fa5abfbb88ffe4850e16c71b6f7a531a74bc10ededa60c08bb08c20cd49fd4","bodyHash":"b163bc76617c102657eb5fa058fe602480aefb76c1051e26ac24ecfe93f77e11"}
 *
 * Go source:
 * func (d *Diagnostic) ReportsDeprecated() bool                   { return d.reportsDeprecated }
 */
export declare function Diagnostic_ReportsDeprecated(receiver: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SkippedOnNoEmit","kind":"method","status":"implemented","sigHash":"de12ff900de089c687d089c468696d6ee29ea8020a4f5bfd0c2d475388a32b86","bodyHash":"00bcfa3866c2b4d729b0c08eeb12bb22ac39f512900059089c4d1ee257474156"}
 *
 * Go source:
 * func (d *Diagnostic) SkippedOnNoEmit() bool                     { return d.skippedOnNoEmit }
 */
export declare function Diagnostic_SkippedOnNoEmit(receiver: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.RepopulateInfo","kind":"method","status":"implemented","sigHash":"e470a4dd747b2e90177b0b5034e6ce4b62071c289ebc71d6039c80e4534681c4","bodyHash":"4e02d816acce40438c912f786c46da3d0a313848737511aaf3e083ad7f1b84a9"}
 *
 * Go source:
 * func (d *Diagnostic) RepopulateInfo() *RepopulateDiagnosticInfo { return d.repopulateInfo }
 */
export declare function Diagnostic_RepopulateInfo(receiver: GoPtr<Diagnostic>): GoPtr<RepopulateDiagnosticInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetFile","kind":"method","status":"implemented","sigHash":"7e10d631ab1cf3cda7c1345933ba1cea6895c2449dce8d8e5ce884330254fd48","bodyHash":"f2ad25b0f1c585777c04e308a7a85463087556d81d15ed150cf60c897f8d3fff"}
 *
 * Go source:
 * func (d *Diagnostic) SetFile(file *SourceFile)                         { d.file = file }
 */
export declare function Diagnostic_SetFile(receiver: GoPtr<Diagnostic>, file: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetLocation","kind":"method","status":"implemented","sigHash":"bbd0047c75e1c35e0bff4fefb2e69b0e597271722fa5b932d273214b58b120b1","bodyHash":"9f52597eac2edfd2fd7053adea60df01722dff6cf97316c3bd39ddbb5d252c35"}
 *
 * Go source:
 * func (d *Diagnostic) SetLocation(loc core.TextRange)                   { d.loc = loc }
 */
export declare function Diagnostic_SetLocation(receiver: GoPtr<Diagnostic>, loc: TextRange): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetCategory","kind":"method","status":"implemented","sigHash":"fd24fd3b3800d5fb756338eaad8848ce83c603cd61e6d03a715e8bbbaa704014","bodyHash":"fcef832290def28078756e52220f7b77db7b1b508048160187e6b3b8639af947"}
 *
 * Go source:
 * func (d *Diagnostic) SetCategory(category diagnostics.Category)        { d.category = category }
 */
export declare function Diagnostic_SetCategory(receiver: GoPtr<Diagnostic>, category: Category_6dba7ba3): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetSkippedOnNoEmit","kind":"method","status":"implemented","sigHash":"acbb842d51c88ffd5fa92e305be33cf951b6a001b6921e611e9a5b641cdfab71","bodyHash":"3fccd97380c62a30317756068f9816e42a62eed5f80576cca2e61375c2b14f27"}
 *
 * Go source:
 * func (d *Diagnostic) SetSkippedOnNoEmit()                              { d.skippedOnNoEmit = true }
 */
export declare function Diagnostic_SetSkippedOnNoEmit(receiver: GoPtr<Diagnostic>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetRepopulateInfo","kind":"method","status":"implemented","sigHash":"ec9a067d4394a0935d87069b9305a7230a3d88df3851ca1a2576b9dd5de49336","bodyHash":"a3f7c8a5c77a1256c68070f201ffd1180c92b79a6f0c90484a88f4582abf061a"}
 *
 * Go source:
 * func (d *Diagnostic) SetRepopulateInfo(info *RepopulateDiagnosticInfo) { d.repopulateInfo = info }
 */
export declare function Diagnostic_SetRepopulateInfo(receiver: GoPtr<Diagnostic>, info: GoPtr<RepopulateDiagnosticInfo>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetMessageChain","kind":"method","status":"implemented","sigHash":"d6a7bd239d145ed6994172e32d9eb994f21336a6a1625835b35e81605a6fcfa9","bodyHash":"9c5a4d1cf88946a24b525263ef28c834232a587b681c8660a3db185c4286b617"}
 *
 * Go source:
 * func (d *Diagnostic) SetMessageChain(messageChain []*Diagnostic) *Diagnostic {
 * 	d.messageChain = messageChain
 * 	return d
 * }
 */
export declare function Diagnostic_SetMessageChain(receiver: GoPtr<Diagnostic>, messageChain: GoSlice<GoPtr<Diagnostic>>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.AddMessageChain","kind":"method","status":"implemented","sigHash":"0553d7437be4e51d76ef7383156823f31cd9dedd38d2e63f86b9c0dcba5e99e0","bodyHash":"39709df4216b00272d81cdd24376e2c3d220260e4a1907e5b7fd269b0b4d6d78"}
 *
 * Go source:
 * func (d *Diagnostic) AddMessageChain(messageChain *Diagnostic) *Diagnostic {
 * 	if messageChain != nil {
 * 		d.messageChain = append(d.messageChain, messageChain)
 * 	}
 * 	return d
 * }
 */
export declare function Diagnostic_AddMessageChain(receiver: GoPtr<Diagnostic>, messageChain: GoPtr<Diagnostic>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.SetRelatedInfo","kind":"method","status":"implemented","sigHash":"c52dc14dc015229cfee360d2512c926ac34b77ba142fc8092c7a4ddfcaeaa4d9","bodyHash":"34ee1445f1121ff7efa4f8b0d014d29372799ef5320bea3723b1a6706ab7796b"}
 *
 * Go source:
 * func (d *Diagnostic) SetRelatedInfo(relatedInformation []*Diagnostic) *Diagnostic {
 * 	d.relatedInformation = relatedInformation
 * 	return d
 * }
 */
export declare function Diagnostic_SetRelatedInfo(receiver: GoPtr<Diagnostic>, relatedInformation: GoSlice<GoPtr<Diagnostic>>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.AddRelatedInfo","kind":"method","status":"implemented","sigHash":"5bae9703cc3f3f2262a9f72c3d56802860d6ef884641a48e2e8a4e531cfd6989","bodyHash":"b7066504ee89b39991f8f5a3f8376900bcba9bfb5bc96c1903feaeb761842cc2"}
 *
 * Go source:
 * func (d *Diagnostic) AddRelatedInfo(relatedInformation *Diagnostic) *Diagnostic {
 * 	if relatedInformation != nil {
 * 		d.relatedInformation = append(d.relatedInformation, relatedInformation)
 * 	}
 * 	return d
 * }
 */
export declare function Diagnostic_AddRelatedInfo(receiver: GoPtr<Diagnostic>, relatedInformation: GoPtr<Diagnostic>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Clone","kind":"method","status":"implemented","sigHash":"5a53f080cd5b8226ac985f5a3e95d13687dc18d00adf5506ca940643d563b4ab","bodyHash":"6f6d8ebb820266a8cd697ead849eee52ce024212379e9bf4820e3c46efd2df72"}
 *
 * Go source:
 * func (d *Diagnostic) Clone() *Diagnostic {
 * 	result := *d
 * 	return &result
 * }
 */
export declare function Diagnostic_Clone(receiver: GoPtr<Diagnostic>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.Localize","kind":"method","status":"implemented","sigHash":"2eb0cc1842aca0bab21ac0b740ea4543fd5ff8f9822c1759e5fabc9a3b9a68b2","bodyHash":"8df072e7589792ac017c0f3e2c4f828088af7033e4f9fd0e793695534c496387"}
 *
 * Go source:
 * func (d *Diagnostic) Localize(locale locale.Locale) string {
 * 	return diagnostics.Localize(locale, d.message, d.messageKey, d.messageArgs...)
 * }
 */
export declare function Diagnostic_Localize(receiver: GoPtr<Diagnostic>, locale_: Locale): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::Diagnostic.String","kind":"method","status":"implemented","sigHash":"7420e160bfc4dad817c3d461a0db37d466d4b3bbfff64960fc2254be4984434d","bodyHash":"00f8c59156e1157481bf04304bc1e79f25fe07f2950e143ae20e41d02cb17868"}
 *
 * Go source:
 * func (d *Diagnostic) String() string {
 * 	return diagnostics.Localize(locale.Default, d.message, d.messageKey, d.messageArgs...)
 * }
 */
export declare function Diagnostic_String(receiver: GoPtr<Diagnostic>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::NewDiagnosticFromSerialized","kind":"func","status":"implemented","sigHash":"4e1087957f5355432a4ecb3942df315fad35b4463a2765d94c2db391cb479b50","bodyHash":"59ca7ebbed490ecd14ee3a2271be0131182af7c03bf2c67bc996082ff3372af3"}
 *
 * Go source:
 * func NewDiagnosticFromSerialized(
 * 	file *SourceFile,
 * 	loc core.TextRange,
 * 	code int32,
 * 	category diagnostics.Category,
 * 	messageKey diagnostics.Key,
 * 	messageArgs []string,
 * 	messageChain []*Diagnostic,
 * 	relatedInformation []*Diagnostic,
 * 	reportsUnnecessary bool,
 * 	reportsDeprecated bool,
 * 	skippedOnNoEmit bool,
 * ) *Diagnostic {
 * 	return &Diagnostic{
 * 		file:               file,
 * 		loc:                loc,
 * 		code:               code,
 * 		category:           category,
 * 		messageKey:         messageKey,
 * 		messageArgs:        messageArgs,
 * 		messageChain:       messageChain,
 * 		relatedInformation: relatedInformation,
 * 		reportsUnnecessary: reportsUnnecessary,
 * 		reportsDeprecated:  reportsDeprecated,
 * 		skippedOnNoEmit:    skippedOnNoEmit,
 * 	}
 * }
 */
export declare function NewDiagnosticFromSerialized(file: GoPtr<SourceFile>, loc: TextRange, code: int, category: Category_6dba7ba3, messageKey: Key, messageArgs: GoSlice<string>, messageChain: GoSlice<GoPtr<Diagnostic>>, relatedInformation: GoSlice<GoPtr<Diagnostic>>, reportsUnnecessary: bool, reportsDeprecated: bool, skippedOnNoEmit: bool): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::NewDiagnostic","kind":"func","status":"implemented","sigHash":"54b371623dde4732725166adfa4d34cf19990571fd6623a4497cbce848d7374f","bodyHash":"cdd4812d61a689e77abe2c27f10337e2169f491954d3a8c926740228e050e5ec"}
 *
 * Go source:
 * func NewDiagnostic(file *SourceFile, loc core.TextRange, message *diagnostics.Message, args ...any) *Diagnostic {
 * 	return &Diagnostic{
 * 		file:               file,
 * 		loc:                loc,
 * 		code:               message.Code(),
 * 		category:           message.Category(),
 * 		message:            message,
 * 		messageKey:         message.Key(),
 * 		messageArgs:        diagnostics.StringifyArgs(args),
 * 		reportsUnnecessary: message.ReportsUnnecessary(),
 * 		reportsDeprecated:  message.ReportsDeprecated(),
 * 	}
 * }
 */
export declare function NewDiagnostic(file: GoPtr<SourceFile>, loc: TextRange, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::NewDiagnosticChain","kind":"func","status":"implemented","sigHash":"44ee8410aab4efa65413b7848ef0f8912d111b76d1767ee9043535a3ff58c587","bodyHash":"e4c6014edb6fa474781b5b5c21bc74a2483b095b6f10e2bca1d126916272db1b"}
 *
 * Go source:
 * func NewDiagnosticChain(chain *Diagnostic, message *diagnostics.Message, args ...any) *Diagnostic {
 * 	if chain != nil {
 * 		return NewDiagnostic(chain.file, chain.loc, message, args...).AddMessageChain(chain).SetRelatedInfo(chain.relatedInformation)
 * 	}
 * 	return NewDiagnostic(nil, core.TextRange{}, message, args...)
 * }
 */
export declare function NewDiagnosticChain(chain: GoPtr<Diagnostic>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::NewCompilerDiagnostic","kind":"func","status":"implemented","sigHash":"f209587733b09dc8857622fcd72da4c9e050d4208055fc36efcefd87a81c713c","bodyHash":"0c2a5ecea1117ef0488af50424ae2bffeef9475da1179b6430e1fd4915e00cb6"}
 *
 * Go source:
 * func NewCompilerDiagnostic(message *diagnostics.Message, args ...any) *Diagnostic {
 * 	return NewDiagnostic(nil, core.UndefinedTextRange(), message, args...)
 * }
 */
export declare function NewCompilerDiagnostic(message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::type::DiagnosticsCollection","kind":"type","status":"implemented","sigHash":"6af6dc38cffd6413df4919b9db48f4d4c9e5cb3d583ae0e0b4658950969bd37d","bodyHash":"df743d2beea00760ad323d41282c388270b3f53ebb0f0fad1a6e44698177da8b"}
 *
 * Go source:
 * DiagnosticsCollection struct {
 * 	mu                       sync.Mutex
 * 	count                    int
 * 	fileDiagnostics          map[string][]*Diagnostic
 * 	fileDiagnosticsSorted    collections.Set[string]
 * 	nonFileDiagnostics       []*Diagnostic
 * 	nonFileDiagnosticsSorted bool
 * }
 */
export interface DiagnosticsCollection {
    mu: Mutex;
    count: int;
    fileDiagnostics: GoMap<string, GoSlice<GoPtr<Diagnostic>>> | undefined;
    fileDiagnosticsSorted: Set<string>;
    nonFileDiagnostics: GoSlice<GoPtr<Diagnostic>> | undefined;
    nonFileDiagnosticsSorted: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.Add","kind":"method","status":"implemented","sigHash":"fababb9d4f4399d114604cd831dd1bdfe08bdd32901d4a14930530c0834e296d","bodyHash":"4b28e88de6a45758b3deefdba88befb4dc42ea11029eedc228953976bc82bdee"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) Add(diagnostic *Diagnostic) {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 *
 * 	c.count++
 *
 * 	if diagnostic.File() != nil {
 * 		fileName := diagnostic.File().FileName()
 * 		if c.fileDiagnostics == nil {
 * 			c.fileDiagnostics = make(map[string][]*Diagnostic)
 * 		}
 * 		c.fileDiagnostics[fileName] = append(c.fileDiagnostics[fileName], diagnostic)
 * 		c.fileDiagnosticsSorted.Delete(fileName)
 * 	} else {
 * 		c.nonFileDiagnostics = append(c.nonFileDiagnostics, diagnostic)
 * 		c.nonFileDiagnosticsSorted = false
 * 	}
 * }
 */
export declare function DiagnosticsCollection_Add(receiver: GoPtr<DiagnosticsCollection>, diagnostic: GoPtr<Diagnostic>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.Lookup","kind":"method","status":"implemented","sigHash":"6593dbfe9df3d2f2b55bb67feef58184c9d0208660f24d3292779158b220e95c","bodyHash":"4cc501b2cce01c652ea2874412902ccce00c8dfbf8696eb52665f2dd64f50c89"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) Lookup(diagnostic *Diagnostic) *Diagnostic {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 *
 * 	var diagnostics []*Diagnostic
 * 	if diagnostic.File() != nil {
 * 		diagnostics = c.getDiagnosticsForFileLocked(diagnostic.File().FileName())
 * 	} else {
 * 		diagnostics = c.getGlobalDiagnosticsLocked()
 * 	}
 * 	if i, ok := slices.BinarySearchFunc(diagnostics, diagnostic, CompareDiagnostics); ok {
 * 		return diagnostics[i]
 * 	}
 * 	return nil
 * }
 */
export declare function DiagnosticsCollection_Lookup(receiver: GoPtr<DiagnosticsCollection>, diagnostic: GoPtr<Diagnostic>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.GetGlobalDiagnostics","kind":"method","status":"implemented","sigHash":"9645490ce555ad51f5214d5520bfe47225a4cb49ad5d022085affd47c067826f","bodyHash":"ac305485947f160ab22143c2d1043f938995daabc58933d59a1255a31dd3edc5"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) GetGlobalDiagnostics() []*Diagnostic {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 *
 * 	return c.getGlobalDiagnosticsLocked()
 * }
 */
export declare function DiagnosticsCollection_GetGlobalDiagnostics(receiver: GoPtr<DiagnosticsCollection>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.getGlobalDiagnosticsLocked","kind":"method","status":"implemented","sigHash":"5a25e36931ee42ff7698bc616538d4296ab9afc437374f5d7cf7dbd594cb0d6b","bodyHash":"32fab3c8153b70e1bfe67784d67649d2fac8b05311433cba3a419460cb6e1153"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) getGlobalDiagnosticsLocked() []*Diagnostic {
 * 	if !c.nonFileDiagnosticsSorted {
 * 		slices.SortStableFunc(c.nonFileDiagnostics, CompareDiagnostics)
 * 		c.nonFileDiagnosticsSorted = true
 * 	}
 * 	return slices.Clone(c.nonFileDiagnostics)
 * }
 */
export declare function DiagnosticsCollection_getGlobalDiagnosticsLocked(receiver: GoPtr<DiagnosticsCollection>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.GetDiagnosticsForFile","kind":"method","status":"implemented","sigHash":"0f8b58b670ab7a032f8098b817ce3db133f1428b1a28fde34abcb3e4ef54da0a","bodyHash":"f78e1a708cdcbadca844753a29c01b7eff5a16aecf846480758e5c067f719aaf"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) GetDiagnosticsForFile(fileName string) []*Diagnostic {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 *
 * 	return c.getDiagnosticsForFileLocked(fileName)
 * }
 */
export declare function DiagnosticsCollection_GetDiagnosticsForFile(receiver: GoPtr<DiagnosticsCollection>, fileName: string): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.getDiagnosticsForFileLocked","kind":"method","status":"implemented","sigHash":"dd48dcb146d58d275f9a21f1ef9f223bd0c4bef536846e8cfc03dda787faed35","bodyHash":"ca3076a0e39235064b3fd78a882ce7a8592c68f25131ee79c7b72365dd7c6ed6"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) getDiagnosticsForFileLocked(fileName string) []*Diagnostic {
 * 	if !c.fileDiagnosticsSorted.Has(fileName) {
 * 		slices.SortStableFunc(c.fileDiagnostics[fileName], CompareDiagnostics)
 * 		c.fileDiagnosticsSorted.Add(fileName)
 * 	}
 * 	return slices.Clone(c.fileDiagnostics[fileName])
 * }
 */
export declare function DiagnosticsCollection_getDiagnosticsForFileLocked(receiver: GoPtr<DiagnosticsCollection>, fileName: string): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::method::DiagnosticsCollection.GetDiagnostics","kind":"method","status":"implemented","sigHash":"740b6bbcd96149753912c2b42f99283e046f6fdfce11fff7da60a624ae4ec59b","bodyHash":"5e82484615d1eab57b3ee825608f6e9c10587fc637769b8665e5efc91453bace"}
 *
 * Go source:
 * func (c *DiagnosticsCollection) GetDiagnostics() []*Diagnostic {
 * 	c.mu.Lock()
 * 	defer c.mu.Unlock()
 *
 * 	diagnostics := make([]*Diagnostic, 0, c.count)
 * 	diagnostics = append(diagnostics, c.nonFileDiagnostics...)
 * 	for _, diags := range c.fileDiagnostics {
 * 		diagnostics = append(diagnostics, diags...)
 * 	}
 * 	slices.SortFunc(diagnostics, CompareDiagnostics)
 * 	return diagnostics
 * }
 */
export declare function DiagnosticsCollection_GetDiagnostics(receiver: GoPtr<DiagnosticsCollection>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::getDiagnosticPath","kind":"func","status":"implemented","sigHash":"12fe84b42764c20b2e71a827e71a5250078926b3396bc7b2eb0383faad08af62","bodyHash":"d4159b9ed4116af72d8ea2471cbe7538aa513e83c49d30a2b59cd6c818441200"}
 *
 * Go source:
 * func getDiagnosticPath(d *Diagnostic) string {
 * 	if d.File() != nil {
 * 		return d.File().FileName()
 * 	}
 * 	return ""
 * }
 */
export declare function getDiagnosticPath(d: GoPtr<Diagnostic>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::EqualDiagnostics","kind":"func","status":"implemented","sigHash":"7d15dc2e944c719b6e887a4d1bf390bcf4ce7cac5f452909f80cc55d7d31f2e3","bodyHash":"1acae3cd3c58358e2c9d52f3fef090e6ec05e7986d28efad341c66912808c121"}
 *
 * Go source:
 * func EqualDiagnostics(d1, d2 *Diagnostic) bool {
 * 	if d1 == d2 {
 * 		return true
 * 	}
 * 	return EqualDiagnosticsNoRelatedInfo(d1, d2) &&
 * 		slices.EqualFunc(d1.RelatedInformation(), d2.RelatedInformation(), EqualDiagnostics)
 * }
 */
export declare function EqualDiagnostics(d1: GoPtr<Diagnostic>, d2: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::EqualDiagnosticsNoRelatedInfo","kind":"func","status":"implemented","sigHash":"0d5b2ece4a399be566ec12ea05a40b6100ab6a922ebb207ea674e5a95f62782f","bodyHash":"26dd658123a96491737cb978f29b00079bd65ab91f227e9bc1841b6b9c364ac4"}
 *
 * Go source:
 * func EqualDiagnosticsNoRelatedInfo(d1, d2 *Diagnostic) bool {
 * 	if d1 == d2 {
 * 		return true
 * 	}
 * 	return getDiagnosticPath(d1) == getDiagnosticPath(d2) &&
 * 		d1.Loc() == d2.Loc() &&
 * 		d1.Code() == d2.Code() &&
 * 		slices.Equal(d1.MessageArgs(), d2.MessageArgs()) &&
 * 		slices.EqualFunc(d1.MessageChain(), d2.MessageChain(), equalMessageChain)
 * }
 */
export declare function EqualDiagnosticsNoRelatedInfo(d1: GoPtr<Diagnostic>, d2: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::equalMessageChain","kind":"func","status":"implemented","sigHash":"c77fe2cb1bca142d4ed50e6b0f6ac0dfe81ac4a2d35e7eb0fdaa039bdb7d626f","bodyHash":"710778c73b95477e36cdaf7085b3d3133730258c939ace801d8a2ed2f29333cf"}
 *
 * Go source:
 * func equalMessageChain(c1, c2 *Diagnostic) bool {
 * 	if c1 == c2 {
 * 		return true
 * 	}
 * 	return c1.Code() == c2.Code() &&
 * 		slices.Equal(c1.MessageArgs(), c2.MessageArgs()) &&
 * 		slices.EqualFunc(c1.MessageChain(), c2.MessageChain(), equalMessageChain)
 * }
 */
export declare function equalMessageChain(c1: GoPtr<Diagnostic>, c2: GoPtr<Diagnostic>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::compareMessageChainSize","kind":"func","status":"implemented","sigHash":"4db4788d2b1dd4c55d217c8c016697ca8058e83de8343b5acb22e4f1f749fe79","bodyHash":"b2435b15413ca4ffd0a24678a326a70046ad8ab94980fa03b71495e07c98c946"}
 *
 * Go source:
 * func compareMessageChainSize(c1, c2 []*Diagnostic) int {
 * 	c := len(c2) - len(c1)
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	for i := range c1 {
 * 		c = compareMessageChainSize(c1[i].MessageChain(), c2[i].MessageChain())
 * 		if c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	return 0
 * }
 */
export declare function compareMessageChainSize(c1: GoSlice<GoPtr<Diagnostic>>, c2: GoSlice<GoPtr<Diagnostic>>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::compareMessageChainContent","kind":"func","status":"implemented","sigHash":"4b3e8b3e19951cf7d08671be789119b587e3c3d763bc8f99059c0a03ad0abcb1","bodyHash":"4f3982b24ac082341b165480e9a8a2d389fd000e47e15366f9719d4ca0a0babd"}
 *
 * Go source:
 * func compareMessageChainContent(c1, c2 []*Diagnostic) int {
 * 	for i := range c1 {
 * 		c := slices.Compare(c1[i].MessageArgs(), c2[i].MessageArgs())
 * 		if c != 0 {
 * 			return c
 * 		}
 * 		if c1[i].MessageChain() != nil {
 * 			c = compareMessageChainContent(c1[i].MessageChain(), c2[i].MessageChain())
 * 			if c != 0 {
 * 				return c
 * 			}
 * 		}
 * 	}
 * 	return 0
 * }
 */
export declare function compareMessageChainContent(c1: GoSlice<GoPtr<Diagnostic>>, c2: GoSlice<GoPtr<Diagnostic>>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::compareRelatedInfo","kind":"func","status":"implemented","sigHash":"82bc99e0105314bdaf910250b250a9ead42822c6e4b0aaa29577262aa31a9fcd","bodyHash":"9f5648d8b76b8644fe3af517a0809c7837995c596940db75e061c642a0ab9a75"}
 *
 * Go source:
 * func compareRelatedInfo(r1, r2 []*Diagnostic) int {
 * 	c := len(r2) - len(r1)
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	for i := range r1 {
 * 		c = CompareDiagnostics(r1[i], r2[i])
 * 		if c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	return 0
 * }
 */
export declare function compareRelatedInfo(r1: GoSlice<GoPtr<Diagnostic>>, r2: GoSlice<GoPtr<Diagnostic>>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/diagnostic.go::func::CompareDiagnostics","kind":"func","status":"implemented","sigHash":"98ad270ea65fc1a2ba00d20a7c91aac15f3ffba05d922277b30134da416b7558","bodyHash":"5f2bd296ce0ea84b3fb1cbb4a2cc9d8383dee90ed1f9183a4ec350a2fb5e2d3d"}
 *
 * Go source:
 * func CompareDiagnostics(d1, d2 *Diagnostic) int {
 * 	if d1 == d2 {
 * 		return 0
 * 	}
 * 	c := strings.Compare(getDiagnosticPath(d1), getDiagnosticPath(d2))
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = d1.Loc().Pos() - d2.Loc().Pos()
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = d1.Loc().End() - d2.Loc().End()
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = int(d1.Code()) - int(d2.Code())
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = slices.Compare(d1.MessageArgs(), d2.MessageArgs())
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = compareMessageChainSize(d1.MessageChain(), d2.MessageChain())
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	c = compareMessageChainContent(d1.MessageChain(), d2.MessageChain())
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	return compareRelatedInfo(d1.RelatedInformation(), d2.RelatedInformation())
 * }
 */
export declare function CompareDiagnostics(d1: GoPtr<Diagnostic>, d2: GoPtr<Diagnostic>): int;
//# sourceMappingURL=diagnostic.d.ts.map
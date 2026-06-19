package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/parser"
	"github.com/microsoft/typescript-go/internal/tspath"
)

type dumpFile struct {
	SchemaVersion int             `json:"schemaVersion"`
	Compiler      string          `json:"compiler"`
	FileName      string          `json:"fileName"`
	ScriptKind    string          `json:"scriptKind"`
	ScriptKindID  int32           `json:"scriptKindId"`
	SourceFile    dumpSourceFile  `json:"sourceFile"`
	Diagnostics   dumpDiagnostics `json:"diagnostics"`
	Root          *dumpNode       `json:"root"`
}

type dumpSourceFile struct {
	IsDeclarationFile bool   `json:"isDeclarationFile"`
	ContainsNonASCII  bool   `json:"containsNonAscii"`
	NodeCount         int    `json:"nodeCount"`
	TextCount         int    `json:"textCount"`
	IdentifierCount   int    `json:"identifierCount"`
	Path              string `json:"path"`
}

type dumpDiagnostics struct {
	Parse []dumpDiagnostic `json:"parse"`
	JS    []dumpDiagnostic `json:"js"`
	JSDoc []dumpDiagnostic `json:"jsdoc"`
}

type dumpDiagnostic struct {
	Code int32 `json:"code"`
	Pos  int   `json:"pos"`
	End  int   `json:"end"`
}

type dumpNode struct {
	Kind       string      `json:"kind"`
	KindID     int16       `json:"kindId"`
	Pos        int         `json:"pos"`
	End        int         `json:"end"`
	Flags      uint32      `json:"flags"`
	Text       *string     `json:"text,omitempty"`
	RawText    *string     `json:"rawText,omitempty"`
	Children   []*dumpNode `json:"children"`
	JSDoc      []*dumpNode `json:"jsdoc,omitempty"`
	ChildCount int         `json:"childCount"`
	JSDocCount int         `json:"jsdocCount,omitempty"`
}

func main() {
	fileName := flag.String("file", "", "source file to parse")
	logicalName := flag.String("logical", "", "logical file name/path used by the parser")
	outName := flag.String("out", "", "output JSON path; stdout when omitted")
	pretty := flag.Bool("pretty", false, "pretty-print JSON")
	flag.Parse()

	if *fileName == "" {
		fatalf("--file is required")
	}

	sourceBytes, err := os.ReadFile(*fileName)
	if err != nil {
		fatalf("read %s: %v", *fileName, err)
	}

	parserFileName := *logicalName
	if parserFileName == "" {
		parserFileName = filepath.ToSlash(*fileName)
	}

	sourceText := string(sourceBytes)
	scriptKind := core.GetScriptKindFromFileName(parserFileName)
	path := tspath.ToPath(parserFileName, "/", true)
	sourceFile := parser.ParseSourceFile(ast.SourceFileParseOptions{
		FileName: parserFileName,
		Path:     path,
	}, sourceText, scriptKind)

	dump := dumpFile{
		SchemaVersion: 1,
		Compiler:      "tsgo",
		FileName:      parserFileName,
		ScriptKind:    scriptKind.String(),
		ScriptKindID:  int32(scriptKind),
		SourceFile: dumpSourceFile{
			IsDeclarationFile: sourceFile.IsDeclarationFile,
			ContainsNonASCII:  sourceFile.ContainsNonASCII,
			NodeCount:         sourceFile.NodeCount,
			TextCount:         sourceFile.TextCount,
			IdentifierCount:   sourceFile.IdentifierCount,
			Path:              string(sourceFile.Path()),
		},
		Diagnostics: dumpDiagnostics{
			Parse: dumpDiagnosticList(sourceFile.Diagnostics()),
			JS:    dumpDiagnosticList(sourceFile.JSDiagnostics()),
			JSDoc: dumpDiagnosticList(sourceFile.JSDocDiagnostics()),
		},
		Root: dumpAstNode(sourceFile.AsNode(), sourceFile),
	}

	var output []byte
	if *pretty {
		output, err = json.MarshalIndent(dump, "", "  ")
	} else {
		output, err = json.Marshal(dump)
	}
	if err != nil {
		fatalf("marshal AST dump: %v", err)
	}
	output = append(output, '\n')

	if *outName == "" {
		_, _ = os.Stdout.Write(output)
		return
	}
	if err := os.MkdirAll(filepath.Dir(*outName), 0o755); err != nil {
		fatalf("create output directory: %v", err)
	}
	if err := os.WriteFile(*outName, output, 0o644); err != nil {
		fatalf("write %s: %v", *outName, err)
	}
}

func dumpAstNode(node *ast.Node, sourceFile *ast.SourceFile) *dumpNode {
	if node == nil {
		return nil
	}

	result := &dumpNode{
		Kind:   node.Kind.String(),
		KindID: int16(node.Kind),
		Pos:    node.Loc.Pos(),
		End:    node.Loc.End(),
		Flags:  uint32(node.Flags),
	}

	if text, ok := safeText(node); ok {
		result.Text = &text
	}
	if rawText, ok := safeRawText(node); ok {
		result.RawText = &rawText
	}

	node.ForEachChild(func(child *ast.Node) bool {
		result.Children = append(result.Children, dumpAstNode(child, sourceFile))
		return false
	})
	result.ChildCount = len(result.Children)

	for _, jsdoc := range node.JSDoc(sourceFile) {
		result.JSDoc = append(result.JSDoc, dumpAstNode(jsdoc, sourceFile))
	}
	result.JSDocCount = len(result.JSDoc)
	if result.JSDocCount == 0 {
		result.JSDoc = nil
	}

	return result
}

func dumpDiagnosticList(diags []*ast.Diagnostic) []dumpDiagnostic {
	if len(diags) == 0 {
		return nil
	}
	result := make([]dumpDiagnostic, 0, len(diags))
	for _, diag := range diags {
		if diag == nil {
			continue
		}
		result = append(result, dumpDiagnostic{
			Code: diag.Code(),
			Pos:  diag.Pos(),
			End:  diag.End(),
		})
	}
	return result
}

func safeText(node *ast.Node) (text string, ok bool) {
	defer func() {
		if recover() != nil {
			text = ""
			ok = false
		}
	}()
	return node.Text(), true
}

func safeRawText(node *ast.Node) (text string, ok bool) {
	defer func() {
		if recover() != nil {
			text = ""
			ok = false
		}
	}()
	return node.RawText(), true
}

func fatalf(format string, args ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

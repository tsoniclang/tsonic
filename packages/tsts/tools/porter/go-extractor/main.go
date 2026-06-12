package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type Snapshot struct {
	SchemaVersion int          `json:"schemaVersion"`
	GeneratedAt   string       `json:"generatedAt"`
	SourceRoot    string       `json:"sourceRoot"`
	ModulePath    string       `json:"modulePath"`
	GitRevision   string       `json:"gitRevision"`
	Summary       Summary      `json:"summary"`
	Files         []FileReport `json:"files"`
}

type Summary struct {
	FileCount       int            `json:"fileCount"`
	GoFileCount     int            `json:"goFileCount"`
	GeneratedFiles  int            `json:"generatedFiles"`
	LineCount       int            `json:"lineCount"`
	UnitCount       int            `json:"unitCount"`
	UnitKindCounts  map[string]int `json:"unitKindCounts"`
	NodeKindCounts  map[string]int `json:"nodeKindCounts"`
	BuildTagCounts  map[string]int `json:"buildTagCounts"`
	PackageCounts   map[string]int `json:"packageCounts"`
	ImportPathCount int            `json:"importPathCount"`
}

type FileReport struct {
	Path              string            `json:"path"`
	PackageName       string            `json:"packageName"`
	ImportPath        string            `json:"importPath"`
	LineCount         int               `json:"lineCount"`
	Generated         bool              `json:"generated"`
	BuildTags         []string          `json:"buildTags"`
	ImplicitBuildTags []string          `json:"implicitBuildTags"`
	Imports           []ImportReport    `json:"imports"`
	Units             []UnitReport      `json:"units"`
	NodeKindCounts    map[string]int    `json:"nodeKindCounts"`
	FeatureCounts     map[string]int    `json:"featureCounts"`
	ParseError        string            `json:"parseError,omitempty"`
	Metadata          map[string]string `json:"metadata"`
}

type ImportReport struct {
	Name string `json:"name,omitempty"`
	Path string `json:"path"`
}

type UnitReport struct {
	ID                   string                `json:"id"`
	Kind                 string                `json:"kind"`
	Name                 string                `json:"name"`
	QualifiedName        string                `json:"qualifiedName"`
	Receiver             string                `json:"receiver,omitempty"`
	ReceiverMode         string                `json:"receiverMode,omitempty"`
	ReceiverType         *TypeExprReport       `json:"receiverType,omitempty"`
	TypeKind             string                `json:"typeKind,omitempty"`
	Exported             bool                  `json:"exported"`
	Generated            bool                  `json:"generated"`
	StartLine            int                   `json:"startLine"`
	EndLine              int                   `json:"endLine"`
	Signature            string                `json:"signature"`
	SigHash              string                `json:"sigHash"`
	BodyHash             string                `json:"bodyHash"`
	Snippet              string                `json:"snippet"`
	TypeParameters       []string              `json:"typeParameters,omitempty"`
	TypeParameterDetails []TypeParameterReport `json:"typeParameterDetails,omitempty"`
	Parameters           []ParamReport         `json:"parameters,omitempty"`
	Results              []ParamReport         `json:"results,omitempty"`
	TypeExpression       *TypeExprReport       `json:"typeExpression,omitempty"`
	ValueSpecs           []ValueSpecReport     `json:"valueSpecs,omitempty"`
	Members              []MemberReport        `json:"members,omitempty"`
	ExternalRefs         []ExternalRefReport   `json:"externalRefs,omitempty"`
	NodeKindCounts       map[string]int        `json:"nodeKindCounts"`
	FeatureCounts        map[string]int        `json:"featureCounts"`
	Metadata             map[string]string     `json:"metadata"`
}

type ExternalRefReport struct {
	ImportPath string `json:"importPath"`
	Package    string `json:"package"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	Count      int    `json:"count"`
}

type MemberReport struct {
	Kind     string          `json:"kind"`
	Name     string          `json:"name"`
	Type     string          `json:"type,omitempty"`
	TypeExpr *TypeExprReport `json:"typeExpr,omitempty"`
}

type ParamReport struct {
	Names    []string        `json:"names,omitempty"`
	Type     *TypeExprReport `json:"type"`
	Variadic bool            `json:"variadic,omitempty"`
}

type TypeParameterReport struct {
	Name       string          `json:"name"`
	Constraint *TypeExprReport `json:"constraint,omitempty"`
}

type ValueSpecReport struct {
	Names              []string          `json:"names"`
	Type               *TypeExprReport   `json:"type,omitempty"`
	Values             []string          `json:"values,omitempty"`
	InferredValueTypes []*TypeExprReport `json:"inferredValueTypes,omitempty"`
}

type TypeExprReport struct {
	Kind       string           `json:"kind"`
	Text       string           `json:"text"`
	Name       string           `json:"name,omitempty"`
	Package    string           `json:"package,omitempty"`
	Op         string           `json:"op,omitempty"`
	Direction  string           `json:"direction,omitempty"`
	Length     string           `json:"length,omitempty"`
	Element    *TypeExprReport  `json:"element,omitempty"`
	Key        *TypeExprReport  `json:"key,omitempty"`
	Value      *TypeExprReport  `json:"value,omitempty"`
	Left       *TypeExprReport  `json:"left,omitempty"`
	Right      *TypeExprReport  `json:"right,omitempty"`
	TypeArgs   []TypeExprReport `json:"typeArgs,omitempty"`
	Parameters []ParamReport    `json:"parameters,omitempty"`
	Results    []ParamReport    `json:"results,omitempty"`
	Members    []MemberReport   `json:"members,omitempty"`
}

func main() {
	root := flag.String("root", "", "path to a TypeScript-Go checkout")
	modulePath := flag.String("module", "github.com/microsoft/typescript-go", "Go module path")
	flag.Parse()

	if *root == "" {
		fatalf("missing required -root")
	}

	absRoot, err := filepath.Abs(*root)
	if err != nil {
		fatalf("resolve root: %v", err)
	}
	if info, err := os.Stat(absRoot); err != nil || !info.IsDir() {
		fatalf("root is not a directory: %s", absRoot)
	}

	snapshot := Snapshot{
		SchemaVersion: 1,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		SourceRoot:    filepath.ToSlash(absRoot),
		ModulePath:    *modulePath,
		GitRevision:   gitRevision(absRoot),
		Summary: Summary{
			UnitKindCounts: make(map[string]int),
			NodeKindCounts: make(map[string]int),
			BuildTagCounts: make(map[string]int),
			PackageCounts:  make(map[string]int),
		},
	}

	importPaths := map[string]bool{}
	err = filepath.WalkDir(absRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		name := entry.Name()
		if entry.IsDir() {
			if shouldSkipDir(name, path, absRoot) {
				return filepath.SkipDir
			}
			return nil
		}
		snapshot.Summary.FileCount++
		if !strings.HasSuffix(name, ".go") {
			return nil
		}
		report := scanGoFile(absRoot, path, *modulePath)
		snapshot.Files = append(snapshot.Files, report)
		snapshot.Summary.GoFileCount++
		snapshot.Summary.LineCount += report.LineCount
		if report.Generated {
			snapshot.Summary.GeneratedFiles++
		}
		snapshot.Summary.PackageCounts[report.PackageName]++
		importPaths[report.ImportPath] = true
		for _, tag := range append(report.BuildTags, report.ImplicitBuildTags...) {
			snapshot.Summary.BuildTagCounts[tag]++
		}
		for kind, count := range report.NodeKindCounts {
			snapshot.Summary.NodeKindCounts[kind] += count
		}
		for _, unit := range report.Units {
			snapshot.Summary.UnitCount++
			snapshot.Summary.UnitKindCounts[unit.Kind]++
		}
		return nil
	})
	if err != nil {
		fatalf("walk root: %v", err)
	}

	sort.Slice(snapshot.Files, func(left, right int) bool {
		return snapshot.Files[left].Path < snapshot.Files[right].Path
	})
	snapshot.Summary.ImportPathCount = len(importPaths)

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(snapshot); err != nil {
		fatalf("encode snapshot: %v", err)
	}
}

func shouldSkipDir(name string, path string, root string) bool {
	if name == ".git" || name == "node_modules" || name == "built" || name == "coverage" {
		return true
	}
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	rel = filepath.ToSlash(rel)
	return rel == "_submodules/TypeScript/.git"
}

func scanGoFile(root string, path string, modulePath string) FileReport {
	rel := mustRel(root, path)
	source, err := os.ReadFile(path)
	if err != nil {
		return FileReport{Path: rel, ParseError: err.Error()}
	}
	lineCount := countLines(source)
	fileSet := token.NewFileSet()
	parsed, err := parser.ParseFile(fileSet, path, source, parser.ParseComments)
	report := FileReport{
		Path:              rel,
		LineCount:         lineCount,
		Generated:         isGenerated(source),
		BuildTags:         explicitBuildTags(source),
		ImplicitBuildTags: implicitBuildTags(rel),
		Imports:           []ImportReport{},
		Units:             []UnitReport{},
		NodeKindCounts:    make(map[string]int),
		FeatureCounts:     make(map[string]int),
		Metadata: map[string]string{
			"basename": filepath.Base(rel),
		},
	}
	report.ImportPath = importPathFor(modulePath, rel)
	if err != nil {
		report.ParseError = err.Error()
		return report
	}
	report.PackageName = parsed.Name.Name
	report.Imports = importsOf(parsed)
	report.NodeKindCounts = nodeCounts(parsed)
	report.FeatureCounts = featureCounts(parsed)
	report.Units = unitsOf(fileSet, parsed, source, rel, modulePath, report.Generated, report.Imports)
	return report
}

func unitsOf(fileSet *token.FileSet, parsed *ast.File, source []byte, rel string, modulePath string, generated bool, imports []ImportReport) []UnitReport {
	units := []UnitReport{}
	seenIDs := map[string]int{}
	for _, decl := range parsed.Decls {
		switch typed := decl.(type) {
		case *ast.FuncDecl:
			units = append(units, funcUnit(fileSet, typed, source, rel, modulePath, generated, seenIDs, imports))
		case *ast.GenDecl:
			units = append(units, genDeclUnit(fileSet, typed, source, rel, modulePath, generated, seenIDs, imports))
			if typed.Tok == token.TYPE {
				for _, spec := range typed.Specs {
					if typeSpec, ok := spec.(*ast.TypeSpec); ok {
						units = append(units, typeUnit(fileSet, typeSpec, source, rel, modulePath, generated, seenIDs, imports))
					}
				}
			}
		}
	}
	sort.Slice(units, func(left, right int) bool {
		if units[left].StartLine == units[right].StartLine {
			return units[left].ID < units[right].ID
		}
		return units[left].StartLine < units[right].StartLine
	})
	return units
}

func funcUnit(fileSet *token.FileSet, decl *ast.FuncDecl, source []byte, rel string, modulePath string, generated bool, seenIDs map[string]int, imports []ImportReport) UnitReport {
	name := decl.Name.Name
	kind := "func"
	receiver := ""
	receiverMode := ""
	if decl.Recv != nil && len(decl.Recv.List) > 0 {
		kind = "method"
		receiver, receiverMode = receiverName(decl.Recv.List[0].Type)
		name = receiver + "." + name
	}
	signature := printed(funcSignatureOnly(decl))
	snippet := snippetOf(fileSet, source, decl.Pos(), decl.End())
	unit := baseUnit(fileSet, decl, source, rel, modulePath, kind, name, generated, seenIDs)
	unit.Name = decl.Name.Name
	unit.QualifiedName = name
	unit.Receiver = receiver
	unit.ReceiverMode = receiverMode
	if decl.Recv != nil && len(decl.Recv.List) > 0 {
		unit.ReceiverType = typeExpr(decl.Recv.List[0].Type)
	}
	unit.Signature = signature
	unit.SigHash = hashText(signature)
	unit.BodyHash = hashText(printed(decl))
	unit.Snippet = snippet
	unit.TypeParameters = fieldNames(decl.Type.TypeParams)
	unit.TypeParameterDetails = typeParameters(decl.Type.TypeParams)
	unit.Parameters = paramsOf(decl.Type.Params)
	unit.Results = paramsOf(decl.Type.Results)
	unit.Exported = ast.IsExported(decl.Name.Name)
	unit.NodeKindCounts = nodeCounts(decl)
	unit.FeatureCounts = featureCounts(decl)
	unit.ExternalRefs = externalRefsOf(decl, imports)
	return unit
}

func genDeclUnit(fileSet *token.FileSet, decl *ast.GenDecl, source []byte, rel string, modulePath string, generated bool, seenIDs map[string]int, imports []ImportReport) UnitReport {
	name := genDeclName(decl)
	kind := strings.ToLower(decl.Tok.String()) + "Group"
	signature := decl.Tok.String() + " " + name
	unit := baseUnit(fileSet, decl, source, rel, modulePath, kind, name, generated, seenIDs)
	unit.Name = name
	unit.QualifiedName = name
	unit.Signature = signature
	unit.SigHash = hashText(signature)
	unit.BodyHash = hashText(printed(decl))
	unit.Snippet = snippetOf(fileSet, source, decl.Pos(), decl.End())
	unit.ValueSpecs = valueSpecsOf(decl)
	unit.Exported = hasExportedSpec(decl)
	unit.NodeKindCounts = nodeCounts(decl)
	unit.FeatureCounts = featureCounts(decl)
	unit.ExternalRefs = externalRefsOf(decl, imports)
	return unit
}

func typeUnit(fileSet *token.FileSet, spec *ast.TypeSpec, source []byte, rel string, modulePath string, generated bool, seenIDs map[string]int, imports []ImportReport) UnitReport {
	name := spec.Name.Name
	unit := baseUnit(fileSet, spec, source, rel, modulePath, "type", name, generated, seenIDs)
	unit.Name = name
	unit.QualifiedName = name
	unit.TypeKind = typeKind(spec)
	unit.Signature = typeSignature(spec)
	unit.SigHash = hashText(unit.Signature)
	unit.BodyHash = hashText(printed(spec))
	unit.Snippet = snippetOf(fileSet, source, spec.Pos(), spec.End())
	unit.TypeParameters = fieldNames(spec.TypeParams)
	unit.TypeParameterDetails = typeParameters(spec.TypeParams)
	unit.TypeExpression = typeExpr(spec.Type)
	unit.Members = typeMembers(spec)
	unit.Exported = ast.IsExported(name)
	unit.NodeKindCounts = nodeCounts(spec)
	unit.FeatureCounts = featureCounts(spec)
	unit.ExternalRefs = externalRefsOf(spec, imports)
	return unit
}

func baseUnit(fileSet *token.FileSet, node ast.Node, source []byte, rel string, modulePath string, kind string, name string, generated bool, seenIDs map[string]int) UnitReport {
	start := fileSet.Position(node.Pos())
	end := fileSet.Position(node.End())
	idBase := modulePath + "::" + rel + "::" + kind + "::" + name
	seenIDs[idBase]++
	id := idBase
	if seenIDs[idBase] > 1 {
		id = idBase + "::#" + strconv.Itoa(seenIDs[idBase])
	}
	return UnitReport{
		ID:             id,
		Kind:           kind,
		Generated:      generated,
		StartLine:      start.Line,
		EndLine:        end.Line,
		NodeKindCounts: make(map[string]int),
		FeatureCounts:  make(map[string]int),
		Metadata: map[string]string{
			"goPath": rel,
		},
	}
}

func funcSignatureOnly(decl *ast.FuncDecl) *ast.FuncDecl {
	copyDecl := *decl
	copyDecl.Body = nil
	return &copyDecl
}

func genDeclName(decl *ast.GenDecl) string {
	var names []string
	for _, spec := range decl.Specs {
		switch typed := spec.(type) {
		case *ast.TypeSpec:
			names = append(names, typed.Name.Name)
		case *ast.ValueSpec:
			for _, name := range typed.Names {
				names = append(names, name.Name)
			}
		case *ast.ImportSpec:
			importName := strings.Trim(typed.Path.Value, `"`)
			if typed.Name != nil {
				importName = typed.Name.Name + ":" + importName
			}
			names = append(names, importName)
		}
	}
	if len(names) == 0 {
		return "anonymous"
	}
	return strings.Join(names, "+")
}

func hasExportedSpec(decl *ast.GenDecl) bool {
	for _, spec := range decl.Specs {
		switch typed := spec.(type) {
		case *ast.TypeSpec:
			if ast.IsExported(typed.Name.Name) {
				return true
			}
		case *ast.ValueSpec:
			for _, name := range typed.Names {
				if ast.IsExported(name.Name) {
					return true
				}
			}
		}
	}
	return false
}

func receiverName(expr ast.Expr) (string, string) {
	switch typed := expr.(type) {
	case *ast.Ident:
		return typed.Name, "value"
	case *ast.StarExpr:
		name, _ := receiverName(typed.X)
		return name, "pointer"
	case *ast.IndexExpr:
		name, mode := receiverName(typed.X)
		return name, mode
	case *ast.IndexListExpr:
		name, mode := receiverName(typed.X)
		return name, mode
	default:
		return printed(expr), "unknown"
	}
}

func typeKind(spec *ast.TypeSpec) string {
	if spec.Assign.IsValid() {
		return "alias"
	}
	switch spec.Type.(type) {
	case *ast.StructType:
		return "struct"
	case *ast.InterfaceType:
		return "interface"
	case *ast.FuncType:
		return "func"
	default:
		return "named"
	}
}

func typeSignature(spec *ast.TypeSpec) string {
	var builder strings.Builder
	builder.WriteString("type ")
	builder.WriteString(spec.Name.Name)
	if spec.TypeParams != nil {
		builder.WriteString("[")
		for index, field := range spec.TypeParams.List {
			if index > 0 {
				builder.WriteString(", ")
			}
			var names []string
			for _, name := range field.Names {
				names = append(names, name.Name)
			}
			builder.WriteString(strings.Join(names, ", "))
			if len(names) > 0 {
				builder.WriteString(" ")
			}
			builder.WriteString(printed(field.Type))
		}
		builder.WriteString("]")
	}
	if spec.Assign.IsValid() {
		builder.WriteString(" =")
	}
	builder.WriteString(" ")
	builder.WriteString(typeKind(spec))
	return builder.String()
}

func typeMembers(spec *ast.TypeSpec) []MemberReport {
	var members []MemberReport
	switch typed := spec.Type.(type) {
	case *ast.StructType:
		if typed.Fields != nil {
			for _, field := range typed.Fields.List {
				fieldType := printed(field.Type)
				fieldExpr := typeExpr(field.Type)
				if len(field.Names) == 0 {
					members = append(members, MemberReport{Kind: "embeddedField", Name: fieldType, Type: fieldType, TypeExpr: fieldExpr})
					continue
				}
				for _, name := range field.Names {
					members = append(members, MemberReport{Kind: "field", Name: name.Name, Type: fieldType, TypeExpr: fieldExpr})
				}
			}
		}
	case *ast.InterfaceType:
		if typed.Methods != nil {
			for _, field := range typed.Methods.List {
				fieldType := printed(field.Type)
				fieldExpr := typeExpr(field.Type)
				if len(field.Names) == 0 {
					members = append(members, MemberReport{Kind: "embeddedInterface", Name: fieldType, Type: fieldType, TypeExpr: fieldExpr})
					continue
				}
				for _, name := range field.Names {
					members = append(members, MemberReport{Kind: "method", Name: name.Name, Type: fieldType, TypeExpr: fieldExpr})
				}
			}
		}
	}
	return members
}

func paramsOf(fields *ast.FieldList) []ParamReport {
	if fields == nil {
		return nil
	}
	params := []ParamReport{}
	for _, field := range fields.List {
		param := ParamReport{
			Type: typeExpr(field.Type),
		}
		if ellipsis, ok := field.Type.(*ast.Ellipsis); ok {
			param.Type = typeExpr(ellipsis.Elt)
			param.Variadic = true
		}
		for _, name := range field.Names {
			param.Names = append(param.Names, name.Name)
		}
		params = append(params, param)
	}
	return params
}

func typeParameters(fields *ast.FieldList) []TypeParameterReport {
	if fields == nil {
		return nil
	}
	params := []TypeParameterReport{}
	for _, field := range fields.List {
		constraint := typeExpr(field.Type)
		for _, name := range field.Names {
			params = append(params, TypeParameterReport{Name: name.Name, Constraint: constraint})
		}
	}
	return params
}

func valueSpecsOf(decl *ast.GenDecl) []ValueSpecReport {
	if decl.Tok != token.CONST && decl.Tok != token.VAR {
		return nil
	}
	specs := []ValueSpecReport{}
	var previousConstValues []ast.Expr
	var previousConstType ast.Expr
	for _, spec := range decl.Specs {
		valueSpec, ok := spec.(*ast.ValueSpec)
		if !ok {
			continue
		}
		report := ValueSpecReport{}
		for _, name := range valueSpec.Names {
			report.Names = append(report.Names, name.Name)
		}
		if valueSpec.Type != nil {
			report.Type = typeExpr(valueSpec.Type)
		}
		values := valueSpec.Values
		if decl.Tok == token.CONST {
			if len(values) == 0 {
				values = previousConstValues
				if valueSpec.Type == nil && previousConstType != nil {
					report.Type = typeExpr(previousConstType)
				}
			} else {
				previousConstValues = values
				previousConstType = valueSpec.Type
			}
		}
		for _, value := range values {
			report.Values = append(report.Values, printed(value))
			report.InferredValueTypes = append(report.InferredValueTypes, inferredValueType(value))
		}
		specs = append(specs, report)
	}
	return specs
}

func inferredValueType(expr ast.Expr) *TypeExprReport {
	if expr == nil {
		return nil
	}
	switch typed := expr.(type) {
	case *ast.BasicLit:
		switch typed.Kind {
		case token.STRING:
			return identTypeExpr("string")
		case token.CHAR:
			return identTypeExpr("rune")
		case token.INT:
			return identTypeExpr("int")
		case token.FLOAT:
			return identTypeExpr("float64")
		case token.IMAG:
			return identTypeExpr("complex128")
		default:
			return nil
		}
	case *ast.Ident:
		switch typed.Name {
		case "true", "false":
			return identTypeExpr("bool")
		case "iota":
			return identTypeExpr("int")
		default:
			return nil
		}
	case *ast.ParenExpr:
		return inferredValueType(typed.X)
	case *ast.UnaryExpr:
		if typed.Op == token.AND {
			if composite, ok := typed.X.(*ast.CompositeLit); ok && composite.Type != nil {
				element := typeExpr(composite.Type)
				if element != nil {
					return &TypeExprReport{Kind: "pointer", Text: "*" + element.Text, Element: element}
				}
			}
			return nil
		}
		return inferredValueType(typed.X)
	case *ast.BinaryExpr:
		if isComparisonOp(typed.Op) {
			return identTypeExpr("bool")
		}
		left := inferredValueType(typed.X)
		right := inferredValueType(typed.Y)
		if left != nil && right != nil {
			if left.Name == "string" || right.Name == "string" {
				if typed.Op == token.ADD {
					return identTypeExpr("string")
				}
				return nil
			}
			if isNumericTypeName(left.Name) && isNumericTypeName(right.Name) {
				return widerNumericType(left.Name, right.Name)
			}
		}
		if typed.Op == token.SHL || typed.Op == token.SHR || typed.Op == token.AND || typed.Op == token.OR || typed.Op == token.XOR || typed.Op == token.AND_NOT {
			return identTypeExpr("int")
		}
		return nil
	case *ast.CompositeLit:
		return typeExpr(typed.Type)
	case *ast.FuncLit:
		return typeExpr(typed.Type)
	case *ast.CallExpr:
		if ident, ok := typed.Fun.(*ast.Ident); ok {
			switch ident.Name {
			case "make":
				if len(typed.Args) > 0 {
					return typeExpr(typed.Args[0])
				}
			case "new":
				if len(typed.Args) > 0 {
					element := typeExpr(typed.Args[0])
					if !isUsableTypeExpr(element) {
						element = inferredValueType(typed.Args[0])
					}
					if element != nil {
						return &TypeExprReport{Kind: "pointer", Text: "*" + element.Text, Element: element}
					}
				}
			case "complex":
				return identTypeExpr("complex128")
			}
			if isPrimitiveTypeName(ident.Name) {
				return identTypeExpr(ident.Name)
			}
		}
		if selector, ok := typed.Fun.(*ast.SelectorExpr); ok {
			if printed(selector.X) == "errors" && selector.Sel.Name == "New" {
				return identTypeExpr("error")
			}
		}
		return nil
	default:
		return nil
	}
}

func identTypeExpr(name string) *TypeExprReport {
	return &TypeExprReport{Kind: "ident", Text: name, Name: name}
}

func isUsableTypeExpr(expr *TypeExprReport) bool {
	if expr == nil {
		return false
	}
	if strings.HasPrefix(expr.Kind, "*ast.") {
		return false
	}
	if expr.Kind == "ident" && (expr.Name == "true" || expr.Name == "false" || expr.Name == "nil") {
		return false
	}
	return true
}

func isComparisonOp(op token.Token) bool {
	return op == token.EQL || op == token.NEQ || op == token.LSS || op == token.LEQ || op == token.GTR || op == token.GEQ
}

func isPrimitiveTypeName(name string) bool {
	switch name {
	case "any", "bool", "byte", "complex64", "complex128", "error", "float32", "float64", "int", "int8", "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr":
		return true
	default:
		return false
	}
}

func isNumericTypeName(name string) bool {
	switch name {
	case "byte", "complex64", "complex128", "float32", "float64", "int", "int8", "int16", "int32", "int64", "rune", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr":
		return true
	default:
		return false
	}
}

func widerNumericType(left string, right string) *TypeExprReport {
	ranks := map[string]int{
		"byte":       1,
		"int8":       1,
		"uint8":      1,
		"int16":      2,
		"uint16":     2,
		"int32":      3,
		"rune":       3,
		"uint32":     3,
		"int":        4,
		"uint":       4,
		"uintptr":    4,
		"int64":      5,
		"uint64":     5,
		"float32":    6,
		"float64":    7,
		"complex64":  8,
		"complex128": 9,
	}
	if ranks[right] > ranks[left] {
		return identTypeExpr(right)
	}
	return identTypeExpr(left)
}

func typeExpr(expr ast.Expr) *TypeExprReport {
	if expr == nil {
		return nil
	}
	report := &TypeExprReport{
		Kind: typeExprKind(expr),
		Text: printed(expr),
	}
	switch typed := expr.(type) {
	case *ast.Ident:
		report.Name = typed.Name
	case *ast.SelectorExpr:
		report.Name = typed.Sel.Name
		report.Package = printed(typed.X)
	case *ast.StarExpr:
		report.Element = typeExpr(typed.X)
	case *ast.ArrayType:
		report.Element = typeExpr(typed.Elt)
		if typed.Len != nil {
			report.Length = printed(typed.Len)
		}
	case *ast.MapType:
		report.Key = typeExpr(typed.Key)
		report.Value = typeExpr(typed.Value)
	case *ast.FuncType:
		report.Parameters = paramsOf(typed.Params)
		report.Results = paramsOf(typed.Results)
	case *ast.InterfaceType:
		report.Members = interfaceMembers(typed)
	case *ast.StructType:
		report.Members = structMembers(typed)
	case *ast.Ellipsis:
		report.Element = typeExpr(typed.Elt)
	case *ast.IndexExpr:
		report.Element = typeExpr(typed.X)
		if typed.Index != nil {
			report.TypeArgs = append(report.TypeArgs, *typeExpr(typed.Index))
		}
	case *ast.IndexListExpr:
		report.Element = typeExpr(typed.X)
		for _, index := range typed.Indices {
			report.TypeArgs = append(report.TypeArgs, *typeExpr(index))
		}
	case *ast.ParenExpr:
		report.Element = typeExpr(typed.X)
	case *ast.ChanType:
		report.Element = typeExpr(typed.Value)
		report.Direction = chanDirection(typed.Dir)
	case *ast.UnaryExpr:
		report.Op = typed.Op.String()
		report.Element = typeExpr(typed.X)
	case *ast.BinaryExpr:
		report.Op = typed.Op.String()
		report.Left = typeExpr(typed.X)
		report.Right = typeExpr(typed.Y)
	}
	return report
}

func typeExprKind(expr ast.Expr) string {
	switch typed := expr.(type) {
	case *ast.Ident:
		return "ident"
	case *ast.SelectorExpr:
		return "selector"
	case *ast.StarExpr:
		return "pointer"
	case *ast.ArrayType:
		if typed.Len == nil {
			return "slice"
		}
		return "array"
	case *ast.MapType:
		return "map"
	case *ast.FuncType:
		return "func"
	case *ast.InterfaceType:
		return "interface"
	case *ast.StructType:
		return "struct"
	case *ast.Ellipsis:
		return "ellipsis"
	case *ast.IndexExpr, *ast.IndexListExpr:
		return "instantiation"
	case *ast.ParenExpr:
		return "paren"
	case *ast.ChanType:
		return "channel"
	case *ast.UnaryExpr:
		return "unary"
	case *ast.BinaryExpr:
		return "binary"
	default:
		return fmt.Sprintf("%T", expr)
	}
}

func interfaceMembers(expr *ast.InterfaceType) []MemberReport {
	if expr.Methods == nil {
		return nil
	}
	members := []MemberReport{}
	for _, field := range expr.Methods.List {
		fieldText := printed(field.Type)
		fieldExpr := typeExpr(field.Type)
		if len(field.Names) == 0 {
			members = append(members, MemberReport{Kind: "embeddedInterface", Name: fieldText, Type: fieldText, TypeExpr: fieldExpr})
			continue
		}
		for _, name := range field.Names {
			members = append(members, MemberReport{Kind: "method", Name: name.Name, Type: fieldText, TypeExpr: fieldExpr})
		}
	}
	return members
}

func structMembers(expr *ast.StructType) []MemberReport {
	if expr.Fields == nil {
		return nil
	}
	members := []MemberReport{}
	for _, field := range expr.Fields.List {
		fieldText := printed(field.Type)
		fieldExpr := typeExpr(field.Type)
		if len(field.Names) == 0 {
			members = append(members, MemberReport{Kind: "embeddedField", Name: fieldText, Type: fieldText, TypeExpr: fieldExpr})
			continue
		}
		for _, name := range field.Names {
			members = append(members, MemberReport{Kind: "field", Name: name.Name, Type: fieldText, TypeExpr: fieldExpr})
		}
	}
	return members
}

func chanDirection(direction ast.ChanDir) string {
	switch direction {
	case ast.SEND:
		return "send"
	case ast.RECV:
		return "receive"
	default:
		return "bidirectional"
	}
}

func fieldNames(fields *ast.FieldList) []string {
	if fields == nil {
		return nil
	}
	var names []string
	for _, field := range fields.List {
		for _, name := range field.Names {
			names = append(names, name.Name)
		}
	}
	return names
}

func importsOf(parsed *ast.File) []ImportReport {
	imports := []ImportReport{}
	for _, imp := range parsed.Imports {
		report := ImportReport{Path: strings.Trim(imp.Path.Value, `"`)}
		if imp.Name != nil {
			report.Name = imp.Name.Name
		}
		imports = append(imports, report)
	}
	sort.Slice(imports, func(left, right int) bool {
		if imports[left].Path == imports[right].Path {
			return imports[left].Name < imports[right].Name
		}
		return imports[left].Path < imports[right].Path
	})
	return imports
}

func externalRefsOf(node ast.Node, imports []ImportReport) []ExternalRefReport {
	aliases := map[string]string{}
	for _, item := range imports {
		if item.Name == "_" || item.Name == "." {
			continue
		}
		alias := item.Name
		if alias == "" {
			alias = pathBase(item.Path)
		}
		aliases[alias] = item.Path
	}
	if len(aliases) == 0 {
		return nil
	}

	refs := map[string]*ExternalRefReport{}
	record := func(packageName string, name string, role string) {
		importPath, ok := aliases[packageName]
		if !ok {
			return
		}
		key := importPath + "." + name + ":" + role
		ref := refs[key]
		if ref == nil {
			ref = &ExternalRefReport{ImportPath: importPath, Package: packageName, Name: name, Role: role}
			refs[key] = ref
		}
		ref.Count++
	}

	ast.Inspect(node, func(current ast.Node) bool {
		call, ok := current.(*ast.CallExpr)
		if !ok {
			return true
		}
		if selector, ok := call.Fun.(*ast.SelectorExpr); ok {
			if ident, ok := selector.X.(*ast.Ident); ok {
				record(ident.Name, selector.Sel.Name, "call")
			}
		}
		return true
	})
	ast.Inspect(node, func(current ast.Node) bool {
		selector, ok := current.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		if ident, ok := selector.X.(*ast.Ident); ok {
			record(ident.Name, selector.Sel.Name, "value")
		}
		return true
	})

	output := make([]ExternalRefReport, 0, len(refs))
	for _, ref := range refs {
		output = append(output, *ref)
	}
	sort.Slice(output, func(left, right int) bool {
		if output[left].ImportPath == output[right].ImportPath {
			if output[left].Name == output[right].Name {
				return output[left].Role < output[right].Role
			}
			return output[left].Name < output[right].Name
		}
		return output[left].ImportPath < output[right].ImportPath
	})
	return output
}

func pathBase(importPath string) string {
	index := strings.LastIndex(importPath, "/")
	if index < 0 {
		return importPath
	}
	return importPath[index+1:]
}

func nodeCounts(node ast.Node) map[string]int {
	counts := make(map[string]int)
	ast.Inspect(node, func(current ast.Node) bool {
		if current == nil {
			return true
		}
		name := fmt.Sprintf("%T", current)
		name = strings.TrimPrefix(name, "*ast.")
		counts[name]++
		return true
	})
	return counts
}

func featureCounts(node ast.Node) map[string]int {
	counts := make(map[string]int)
	ast.Inspect(node, func(current ast.Node) bool {
		switch current.(type) {
		case *ast.GoStmt:
			counts["goStmt"]++
		case *ast.DeferStmt:
			counts["deferStmt"]++
		case *ast.SelectStmt:
			counts["selectStmt"]++
		case *ast.TypeSwitchStmt:
			counts["typeSwitchStmt"]++
		case *ast.SwitchStmt:
			counts["switchStmt"]++
		case *ast.RangeStmt:
			counts["rangeStmt"]++
		case *ast.ForStmt:
			counts["forStmt"]++
		case *ast.SendStmt:
			counts["sendStmt"]++
		case *ast.ChanType:
			counts["chanType"]++
		case *ast.FuncLit:
			counts["funcLit"]++
		}
		if call, ok := current.(*ast.CallExpr); ok {
			if ident, ok := call.Fun.(*ast.Ident); ok {
				if ident.Name == "panic" {
					counts["panicCall"]++
				}
				if ident.Name == "recover" {
					counts["recoverCall"]++
				}
			}
		}
		return true
	})
	return counts
}

func printed(node any) string {
	var buffer bytes.Buffer
	if err := printer.Fprint(&buffer, token.NewFileSet(), node); err != nil {
		return fmt.Sprintf("<printer-error:%v>", err)
	}
	return strings.TrimSpace(buffer.String())
}

func snippetOf(fileSet *token.FileSet, source []byte, start token.Pos, end token.Pos) string {
	file := fileSet.File(start)
	if file == nil {
		return ""
	}
	startOffset := file.Offset(start)
	endOffset := file.Offset(end)
	if startOffset < 0 || endOffset > len(source) || startOffset > endOffset {
		return ""
	}
	return strings.TrimSpace(string(source[startOffset:endOffset]))
}

func countLines(source []byte) int {
	if len(source) == 0 {
		return 0
	}
	count := bytes.Count(source, []byte{'\n'})
	if source[len(source)-1] != '\n' {
		count++
	}
	return count
}

func isGenerated(source []byte) bool {
	limit := string(source)
	if len(limit) > 4096 {
		limit = limit[:4096]
	}
	upper := strings.ToUpper(limit)
	return strings.Contains(limit, "Code generated") && strings.Contains(upper, "DO NOT EDIT")
}

func explicitBuildTags(source []byte) []string {
	var tags []string
	lines := strings.Split(string(source), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if !strings.HasPrefix(trimmed, "//") {
			break
		}
		if strings.HasPrefix(trimmed, "//go:build") {
			tags = append(tags, strings.TrimSpace(strings.TrimPrefix(trimmed, "//go:build")))
		}
		if strings.HasPrefix(trimmed, "// +build") {
			tags = append(tags, strings.TrimSpace(strings.TrimPrefix(trimmed, "// +build")))
		}
	}
	return uniqueSorted(tags)
}

func implicitBuildTags(rel string) []string {
	base := strings.TrimSuffix(filepath.Base(rel), ".go")
	parts := strings.Split(base, "_")
	if len(parts) < 2 {
		return nil
	}
	known := map[string]bool{
		"aix": true, "android": true, "darwin": true, "dragonfly": true, "freebsd": true,
		"hurd": true, "illumos": true, "ios": true, "js": true, "linux": true,
		"netbsd": true, "openbsd": true, "plan9": true, "solaris": true, "wasip1": true, "windows": true,
		"386": true, "amd64": true, "amd64p32": true, "arm": true, "arm64": true, "loong64": true,
		"mips": true, "mipsle": true, "mips64": true, "mips64le": true, "ppc64": true, "ppc64le": true,
		"riscv64": true, "s390x": true, "sparc64": true, "wasm": true,
	}
	var tags []string
	for _, part := range parts[1:] {
		if known[part] {
			tags = append(tags, part)
		}
	}
	return uniqueSorted(tags)
}

func uniqueSorted(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := map[string]bool{}
	var output []string
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		output = append(output, value)
	}
	sort.Strings(output)
	return output
}

func importPathFor(modulePath string, rel string) string {
	dir := filepath.Dir(filepath.ToSlash(rel))
	if dir == "." {
		return modulePath
	}
	return modulePath + "/" + dir
}

func mustRel(root string, path string) string {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		fatalf("rel path: %v", err)
	}
	return filepath.ToSlash(rel)
}

func hashText(value string) string {
	normalized := strings.ReplaceAll(value, "\r\n", "\n")
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

func gitRevision(root string) string {
	command := exec.Command("git", "-C", root, "rev-parse", "HEAD")
	out, err := command.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

func init() {
	_ = unicode.IsUpper
}

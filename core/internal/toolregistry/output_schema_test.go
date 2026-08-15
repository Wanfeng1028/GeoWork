// GeoWork Go Core - Output schema validation tests

package toolregistry

import (
	"context"
	"strings"
	"testing"

	"go.uber.org/zap"
)

func TestValidateOutput_NoSchemaPasses(t *testing.T) {
	if err := validateOutput(nil, map[string]any{"anything": 1}); err != nil {
		t.Errorf("nil schema should pass, got: %v", err)
	}
	if err := validateOutput(map[string]any{}, map[string]any{"anything": 1}); err != nil {
		t.Errorf("empty schema should pass, got: %v", err)
	}
}

func TestValidateOutput_TypeChecks(t *testing.T) {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"name":    map[string]any{"type": "string"},
			"size":    map[string]any{"type": "integer"},
			"ratio":   map[string]any{"type": "number"},
			"isDir":   map[string]any{"type": "boolean"},
			"tags":    map[string]any{"type": "array"},
			"meta":    map[string]any{"type": "object"},
		},
	}

	valid := map[string]any{
		"name":  "a.txt",
		"size":  int64(42), // native Go int64, as tools return
		"ratio": 3.14,
		"isDir": false,
		"tags":  []string{"x"},
		"meta":  map[string]any{"k": "v"},
	}
	if err := validateOutput(schema, valid); err != nil {
		t.Errorf("valid output rejected: %v", err)
	}

	// JSON-roundtripped integer arrives as float64 with no fraction.
	if err := validateOutput(schema, map[string]any{"size": float64(42)}); err != nil {
		t.Errorf("float64(42) should satisfy integer, got: %v", err)
	}

	// Fractional float must NOT satisfy integer.
	if err := validateOutput(schema, map[string]any{"size": 42.5}); err == nil {
		t.Error("42.5 should violate integer")
	}

	// Wrong type on a declared property.
	if err := validateOutput(schema, map[string]any{"name": 123}); err == nil {
		t.Error("name=123 should violate string")
	}
}

func TestValidateOutput_RequiredFields(t *testing.T) {
	schema := map[string]any{
		"type":     "object",
		"required": []string{"content"},
	}
	if err := validateOutput(schema, map[string]any{"content": "x"}); err != nil {
		t.Errorf("required field present, got: %v", err)
	}
	err := validateOutput(schema, map[string]any{"other": "x"})
	if err == nil {
		t.Fatal("missing required field should fail")
	}
	if !strings.Contains(err.Error(), "content") {
		t.Errorf("error should name the missing field, got: %v", err)
	}

	// required built as []any (JSON round-trip shape) must also work.
	schemaAny := map[string]any{
		"type":     "object",
		"required": []any{"content"},
	}
	if err := validateOutput(schemaAny, map[string]any{}); err == nil {
		t.Error("[]any required should be enforced too")
	}
}

func TestValidateOutput_NestedArrayItems(t *testing.T) {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"files": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name":  map[string]any{"type": "string"},
						"isDir": map[string]any{"type": "boolean"},
					},
					"required": []string{"name"},
				},
			},
		},
	}

	// Native []map[string]any as list_files returns it.
	valid := map[string]any{"files": []map[string]any{
		{"name": "a", "isDir": false},
	}}
	if err := validateOutput(schema, valid); err != nil {
		t.Errorf("valid nested array rejected: %v", err)
	}

	// []any shape (JSON round-trip) also accepted.
	validAny := map[string]any{"files": []any{
		map[string]any{"name": "a"},
	}}
	if err := validateOutput(schema, validAny); err != nil {
		t.Errorf("[]any nested array rejected: %v", err)
	}

	// A bad item deep in the array must fail with a path hint.
	bad := map[string]any{"files": []map[string]any{
		{"name": "a"},
		{"isDir": true}, // missing required "name"
	}}
	err := validateOutput(schema, bad)
	if err == nil {
		t.Fatal("bad array item should fail")
	}
	if !strings.Contains(err.Error(), "[1]") {
		t.Errorf("error should point at index 1, got: %v", err)
	}
}

func TestValidateOutput_UnknownKeywordsIgnored(t *testing.T) {
	schema := map[string]any{
		"type":        "object",
		"description": "extra metadata must not break validation",
		"properties": map[string]any{
			"x": map[string]any{"type": "string", "description": "a field"},
		},
	}
	if err := validateOutput(schema, map[string]any{"x": "ok"}); err != nil {
		t.Errorf("unknown keywords should be ignored, got: %v", err)
	}
}

// TestRegistryExecute_RejectsSchemaViolation proves validation is wired
// into the execution path: a tool whose result contradicts its declared
// OutputSchema is rejected, and the violation is surfaced as an error.
func TestRegistryExecute_RejectsSchemaViolation(t *testing.T) {
	reg := NewRegistry(zap.NewNop())
	err := reg.Register(NewBuilder("lying_tool").
		Description("returns a number where the schema says string").
		OutputSchema(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"value": map[string]any{"type": "string"},
			},
			"required": []string{"value"},
		}).
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			return map[string]any{"value": 123}, nil
		}).Build())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	_, err = reg.Execute(context.Background(), "lying_tool", map[string]any{}, ModeDeterministic)
	if err == nil {
		t.Fatal("schema-violating output should be rejected")
	}
	if !strings.Contains(err.Error(), "output rejected") {
		t.Errorf("error should mention output rejection, got: %v", err)
	}
}

// TestRegistryExecute_AcceptsConformingOutput is the positive control for
// the rejection test above.
func TestRegistryExecute_AcceptsConformingOutput(t *testing.T) {
	reg := NewRegistry(zap.NewNop())
	err := reg.Register(NewBuilder("honest_tool").
		OutputSchema(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"value": map[string]any{"type": "string"},
			},
		}).
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			return map[string]any{"value": "ok"}, nil
		}).Build())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	result, err := reg.Execute(context.Background(), "honest_tool", map[string]any{}, ModeDeterministic)
	if err != nil {
		t.Fatalf("conforming output rejected: %v", err)
	}
	if result["value"] != "ok" {
		t.Errorf("result = %v, want value=ok", result)
	}
}

// TestRegistryExecute_NoSchemaSkipsValidation covers dynamically
// registered tools (e.g. Python Worker tools) that declare no
// OutputSchema — they must keep working unchanged.
func TestRegistryExecute_NoSchemaSkipsValidation(t *testing.T) {
	reg := NewRegistry(zap.NewNop())
	err := reg.Register(NewBuilder("schemaless_tool").
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			return map[string]any{"anything": []int{1, 2, 3}}, nil
		}).Build())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	if _, err := reg.Execute(context.Background(), "schemaless_tool", map[string]any{}, ModeDeterministic); err != nil {
		t.Fatalf("schemaless tool should not be validated: %v", err)
	}
}

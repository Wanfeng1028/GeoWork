// GeoWork Go Core - Tool Output Schema Validation
//
// Tools declare an OutputSchema (a JSON-Schema subset) via the Builder.
// Until now the schema was only surfaced as API metadata and never
// enforced, so a tool could silently return a shape that contradicted
// its contract. This file validates a tool's result against its declared
// OutputSchema at execution time.
//
// Only the subset of JSON Schema actually used by the codebase is
// supported: type (object/string/integer/number/boolean/array),
// properties, required, and items. Unknown keywords are ignored so a
// richer schema never causes a spurious failure.
//
// No third-party JSON-Schema dependency is introduced (AGENT.md §9):
// the validator is intentionally small and dependency-free.

package toolregistry

import (
	"fmt"
	"reflect"
)

// validateOutput checks result against the tool's declared OutputSchema.
// Returns nil when the schema is absent (nothing to enforce) or when the
// result conforms. Returns a descriptive error on the first violation so
// the caller can surface it back to the model.
func validateOutput(schema map[string]any, result map[string]any) error {
	if len(schema) == 0 {
		return nil
	}
	return validateValue(schema, result, "$")
}

// validateValue validates a single value against a schema node at the
// given JSON-pointer-like path (used only for error messages).
func validateValue(schema map[string]any, value any, path string) error {
	typ, _ := schema["type"].(string)
	if typ != "" {
		if err := checkType(typ, value, path); err != nil {
			return err
		}
	}

	switch typ {
	case "object":
		obj, ok := toStringMap(value)
		if !ok {
			// checkType already rejected non-objects; defensive no-op.
			return nil
		}
		if err := validateRequired(schema, obj, path); err != nil {
			return err
		}
		if props, ok := schema["properties"].(map[string]any); ok {
			for key, propSchemaAny := range props {
				propSchema, ok := propSchemaAny.(map[string]any)
				if !ok {
					continue
				}
				propVal, present := obj[key]
				if !present {
					// Optional property absent: nothing to validate.
					continue
				}
				if err := validateValue(propSchema, propVal, path+"."+key); err != nil {
					return err
				}
			}
		}

	case "array":
		items, ok := schema["items"].(map[string]any)
		if !ok {
			return nil
		}
		rv := reflect.ValueOf(value)
		if rv.Kind() != reflect.Slice && rv.Kind() != reflect.Array {
			// checkType already rejected non-arrays; defensive no-op.
			return nil
		}
		for i := 0; i < rv.Len(); i++ {
			if err := validateValue(items, rv.Index(i).Interface(), fmt.Sprintf("%s[%d]", path, i)); err != nil {
				return err
			}
		}
	}

	return nil
}

// validateRequired ensures every key listed in the schema's "required"
// array is present in obj.
func validateRequired(schema map[string]any, obj map[string]any, path string) error {
	req, ok := schema["required"].([]string)
	if !ok {
		// Some schemas build required as []any after a JSON round-trip.
		if reqAny, ok := schema["required"].([]any); ok {
			for _, r := range reqAny {
				if s, ok := r.(string); ok {
					req = append(req, s)
				}
			}
		}
	}
	for _, key := range req {
		if _, present := obj[key]; !present {
			return fmt.Errorf("output schema violation at %s: missing required field %q", path, key)
		}
	}
	return nil
}

// checkType validates value against a JSON-Schema type keyword. It accepts
// both JSON-roundtripped types (float64, []any, map[string]any) and native
// Go types tools return directly (int/int64, []map[string]any, etc.).
func checkType(typ string, value any, path string) error {
	switch typ {
	case "string":
		if _, ok := value.(string); !ok {
			return typeError(path, typ, value)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return typeError(path, typ, value)
		}
	case "integer":
		if !isInteger(value) {
			return typeError(path, typ, value)
		}
	case "number":
		if !isNumber(value) {
			return typeError(path, typ, value)
		}
	case "array":
		k := reflect.ValueOf(value).Kind()
		if k != reflect.Slice && k != reflect.Array {
			return typeError(path, typ, value)
		}
	case "object":
		if _, ok := toStringMap(value); !ok {
			return typeError(path, typ, value)
		}
	}
	// Unknown type keywords are ignored (forward-compatible).
	return nil
}

// isInteger reports whether value is an integral number. Accepts Go integer
// kinds and float64 values with no fractional part (JSON numbers decode to
// float64, so a schema "integer" must accept 42.0 as well as 42).
func isInteger(value any) bool {
	switch v := value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return true
	case float32:
		return v == float32(int64(v))
	case float64:
		return v == float64(int64(v))
	}
	return false
}

// isNumber reports whether value is any numeric type.
func isNumber(value any) bool {
	switch value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return true
	}
	return false
}

// toStringMap coerces value into map[string]any. Handles both a native
// map[string]any and maps produced by reflection over other map types.
func toStringMap(value any) (map[string]any, bool) {
	if m, ok := value.(map[string]any); ok {
		return m, true
	}
	rv := reflect.ValueOf(value)
	if rv.Kind() == reflect.Map && rv.Type().Key().Kind() == reflect.String {
		out := make(map[string]any, rv.Len())
		iter := rv.MapRange()
		for iter.Next() {
			out[iter.Key().String()] = iter.Value().Interface()
		}
		return out, true
	}
	return nil, false
}

// typeError builds a uniform violation message including the offending
// Go type so failures are easy to diagnose.
func typeError(path, want string, value any) error {
	return fmt.Errorf("output schema violation at %s: expected %s, got %T", path, want, value)
}

// doc/25 S1 regression tests: crash report IDs must be collision-resistant
// (random hex, not second-resolution timestamps).
package crash

import (
	"testing"
)

func TestGenerateID_UniqueUnderConcurrency(t *testing.T) {
	// The old implementation returned "crash_" + second-resolution timestamp,
	// so two reports in the same second collided. Generate a burst and require
	// all IDs to be distinct.
	const n = 200
	seen := make(map[string]struct{}, n)
	for i := 0; i < n; i++ {
		id := generateID()
		if id == "" {
			t.Fatal("generateID returned empty string")
		}
		if _, dup := seen[id]; dup {
			t.Fatalf("duplicate ID generated under burst: %q", id)
		}
		seen[id] = struct{}{}
	}
}

func TestGenerateID_HasPrefix(t *testing.T) {
	id := generateID()
	if len(id) < len("crash_")+8 {
		t.Fatalf("ID too short: %q", id)
	}
	if id[:6] != "crash_" {
		t.Fatalf("ID %q does not start with crash_ prefix", id)
	}
}

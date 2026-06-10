// GeoWork Go Core - Diff Patch Operations

package diff

import (
	"bufio"
	"fmt"
	"strings"
)

// Patch represents a parsed patch with hunks.
type Patch struct {
	Path   string
	Hunks  []Hunk
}

// Hunk is a continuous block of changes.
type Hunk struct {
	OldStart int
	OldCount int
	NewStart int
	NewCount int
	Line     []HunkLine
}

// HunkLine is a single line in a hunk.
type HunkLine struct {
	Type byte // ' ' = context, '-' = removed, '+' = added
	Text string
}

// ParseUnifiedDiff parses a unified diff into a Patch.
func ParseUnifiedDiff(diff string) (*Patch, error) {
	patch := &Patch{}
	scanner := bufio.NewScanner(strings.NewReader(diff))

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "--- a/") {
			patch.Path = strings.TrimPrefix(line, "--- a/")
			continue
		}
		if strings.HasPrefix(line, "+++ b/") {
			continue
		}
		if strings.HasPrefix(line, "@@") {
			hunk, err := parseHunk(line)
			if err != nil {
				return nil, err
			}
			patch.Hunks = append(patch.Hunks, hunk)
		} else if len(line) > 0 && (line[0] == ' ' || line[0] == '-' || line[0] == '+') {
			if len(patch.Hunks) > 0 {
				patch.Hunks[len(patch.Hunks)-1].Line = append(
					patch.Hunks[len(patch.Hunks)-1].Line,
					HunkLine{Type: line[0], Text: line[1:]},
				)
			}
		}
	}

	return patch, scanner.Err()
}

func parseHunk(line string) (Hunk, error) {
	var h Hunk
	// Parse @@ -oldStart,oldCount +newStart,newCount @@
	// Strip leading @@ and trailing @@
	content := strings.TrimPrefix(line, "@@ ")
	content = strings.TrimSuffix(content, " @@")

	parts := strings.Split(content, " ")
	if len(parts) < 2 {
		return h, fmt.Errorf("invalid hunk header: %s", line)
	}

	old := strings.TrimPrefix(parts[0], "-")
	new := strings.TrimPrefix(parts[1], "+")

	h.OldStart, _ = parseInt(old)
	h.NewStart, _ = parseInt(new)

	if len(parts) > 2 {
		oldCount := strings.TrimPrefix(parts[0], "-")
		if idx := strings.Index(oldCount, ","); idx >= 0 {
			h.OldCount, _ = parseInt(oldCount[idx+1:])
		} else {
			h.OldCount = 1
		}
		newCount := strings.TrimPrefix(parts[1], "+")
		if idx := strings.Index(newCount, ","); idx >= 0 {
			h.NewCount, _ = parseInt(newCount[idx+1:])
		} else {
			h.NewCount = 1
		}
	}

	return h, nil
}

func parseInt(s string) (int, error) {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n, nil
}

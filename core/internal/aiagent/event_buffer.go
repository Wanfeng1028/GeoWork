// GeoWork Go Core - SSE Event Buffer
//
// P1-3 §4.5: per-run ring buffer of recent SSE events. The buffer backs
// the Last-Event-ID reconnect protocol — when a client's EventSource
// drops and reconnects with `Last-Event-ID: run_abc:42`, the server
// replays every buffered event whose seq > 42 before streaming live
// events. Without this buffer, a momentary network blip during a
// critical tool call would silently lose tool_call/tool_result events
// and leave the UI in an inconsistent state.
//
// Design:
//   - One EventBuffer per RunContext (created lazily on first Append).
//   - Fixed capacity (default 500). Overflow overwrites the oldest entry
//     so the buffer never grows unbounded for long-running agents.
//   - Each event carries a Run-local sequence number. The composite
//     `{runID}:{seq}` is the SSE `id:` field, which EventSource echoes
//     back as the `Last-Event-ID` request header on reconnect.
//   - When the requested seq is older than the oldest buffered event
//     (i.e. the client was disconnected longer than the buffer holds),
//     Replay returns ErrBufferOverflow so the caller can emit a
//     `state_snapshot` event instead of a partial replay.

package aiagent

import (
	"errors"
	"fmt"
	"sync"
)

// ErrBufferOverflow is returned by Replay when the requested start seq
// is older than the oldest event in the buffer. Callers should emit a
// state_snapshot event so the client can rebuild its UI from scratch.
var ErrBufferOverflow = errors.New("event buffer overflow: requested seq older than oldest buffered")

// DefaultEventBufferCapacity is the per-run ring buffer size.
// 500 is enough to cover ~50 ReAct turns with ~10 events each, which
// matches the maxTurns=50 default in the orchestrator.
const DefaultEventBufferCapacity = 500

// BufferedEvent is one entry in the ring buffer. Seq is Run-local and
// monotonically increasing; the SSE `id:` field is `{runID}:{seq}`.
type BufferedEvent struct {
	Seq  int    `json:"seq"`
	Type string `json:"type"`
	Data string `json:"data"` // pre-marshalled JSON payload
}

// EventBuffer is a per-run ring buffer of recent SSE events.
// All methods are safe for concurrent use.
type EventBuffer struct {
	mu     sync.RWMutex
	events []BufferedEvent
	cap    int
	head   int // index of oldest event
	size   int // current count
	next   int // next seq to assign
}

// NewEventBuffer constructs an empty buffer with the given capacity.
// cap <= 0 falls back to DefaultEventBufferCapacity.
func NewEventBuffer(capacity int) *EventBuffer {
	if capacity <= 0 {
		capacity = DefaultEventBufferCapacity
	}
	return &EventBuffer{
		events: make([]BufferedEvent, capacity),
		cap:    capacity,
	}
}

// Append adds an event to the buffer and returns the assigned seq.
// When the buffer is full, the oldest event is overwritten.
func (b *EventBuffer) Append(eventType, data string) int {
	b.mu.Lock()
	defer b.mu.Unlock()

	seq := b.next
	b.next++

	ev := BufferedEvent{Seq: seq, Type: eventType, Data: data}
	if b.size < b.cap {
		// Buffer not yet full: write at the next free slot.
		idx := (b.head + b.size) % b.cap
		b.events[idx] = ev
		b.size++
	} else {
		// Buffer full: overwrite the oldest entry and advance head.
		b.events[b.head] = ev
		b.head = (b.head + 1) % b.cap
	}
	return seq
}

// Replay returns all buffered events with seq > afterSeq, in order.
// Returns ErrBufferOverflow if afterSeq is older than the oldest
// buffered event (caller should emit state_snapshot instead).
// afterSeq < 0 returns the entire buffer (used for fresh clients
// that want a brief history before live streaming).
func (b *EventBuffer) Replay(afterSeq int) ([]BufferedEvent, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.size == 0 {
		return nil, nil
	}

	oldestSeq := b.events[b.head].Seq
	if afterSeq >= 0 && afterSeq < oldestSeq-1 {
		// The client missed events that have already been overwritten.
		// Tell the caller to send a state_snapshot instead.
		return nil, ErrBufferOverflow
	}

	out := make([]BufferedEvent, 0, b.size)
	for i := 0; i < b.size; i++ {
		idx := (b.head + i) % b.cap
		ev := b.events[idx]
		if ev.Seq > afterSeq {
			out = append(out, ev)
		}
	}
	return out, nil
}

// LatestSeq returns the highest seq assigned so far, or -1 if empty.
// Used by the SSE handler to construct the `id:` field for live events.
func (b *EventBuffer) LatestSeq() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.size == 0 {
		return -1
	}
	return b.next - 1
}

// OldestSeq returns the seq of the oldest buffered event, or -1 if empty.
// Used to decide whether a Last-Event-ID is still recoverable.
func (b *EventBuffer) OldestSeq() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.size == 0 {
		return -1
	}
	return b.events[b.head].Seq
}

// Size returns the current number of buffered events.
func (b *EventBuffer) Size() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.size
}

// parseLastEventID splits a `Last-Event-ID: run_abc:42` header value
// into runID and seq. Returns ok=false if the value is malformed.
// An empty value returns ok=false (no replay requested).
func parseLastEventID(value string) (runID string, seq int, ok bool) {
	if value == "" {
		return "", 0, false
	}
	// Find the last colon — runIDs themselves never contain colons
	// (they're generated by idgen.NewPrefixed as run_XXXXX).
	for i := len(value) - 1; i >= 0; i-- {
		if value[i] == ':' {
			runID = value[:i]
			_, err := fmt.Sscanf(value[i+1:], "%d", &seq)
			if err != nil {
				return "", 0, false
			}
			return runID, seq, true
		}
	}
	return "", 0, false
}

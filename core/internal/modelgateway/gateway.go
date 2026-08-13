// GeoWork Go Core - Model Gateway Interface

package modelgateway

import "context"

// ModelGateway is the abstraction for model gateway providers.
// Orchestrator depends on this interface rather than a concrete implementation
// (OpenAICompatibleClient), so that P2-5's Router can seamlessly replace it
// with multi-provider routing.
type ModelGateway interface {
	// Chat sends a non-streaming chat completion request and returns the full response.
	Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error)

	// StreamChat sends a streaming chat completion request, returning a channel of StreamChunk.
	StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error)

	// ProviderID returns the current provider's identifier (for audit/routing logs).
	ProviderID() string
}

// Compile-time assertion: OpenAICompatibleClient must implement ModelGateway.
var _ ModelGateway = (*OpenAICompatibleClient)(nil)

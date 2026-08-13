// GeoWork Go Core - Conversation Summarizer (P3-4 §5.3)
//
// Summarizer generates a compact summary of the conversation history
// using the model gateway. This implements L4 of the 5-layer context
// compression strategy: when L1-L3 (tool result trimming, message
// count trimming, token budget trimming) still leave the prompt over
// budget, the Summarizer replaces the conversation history with a
// model-generated summary so the agent can continue without hitting
// the token ceiling.
//
// L5 (memory solidification) builds on L4: when even the summarized
// messages are still too large, the summary is written to Memory and
// the chat history is cleared — the agent restarts the conversation
// from the memory summary alone.

package aiagent

import (
	"context"
	"fmt"
	"time"

	"geowork/core/internal/modelgateway"

	"go.uber.org/zap"
)

// Summarizer generates conversation summaries via the model gateway.
type Summarizer struct {
	gateway modelgateway.ModelGateway
	log     *zap.Logger
}

// NewSummarizer builds a Summarizer bound to a gateway. When the
// gateway is nil, SummarizeConversation returns an error and the
// caller falls back to L3-only trimming.
func NewSummarizer(gateway modelgateway.ModelGateway, log *zap.Logger) *Summarizer {
	return &Summarizer{gateway: gateway, log: log}
}

// SummarizeConversation asks the model to compress a conversation
// history into a concise summary. The summary preserves:
//  1. The user's core request
//  2. Completed actions and their results
//  3. Pending tasks
//  4. Important file paths and data
//
// Returns the summary text. When the gateway call fails, returns an
// error so the caller can fall back to L3 trimming (no L4 applied).
// P3-4 §5.3.
func (s *Summarizer) SummarizeConversation(ctx context.Context, messages []modelgateway.ChatMessage) (string, error) {
	if s == nil || s.gateway == nil {
		return "", fmt.Errorf("summarizer not configured (no gateway)")
	}

	// Build the summary prompt from the conversation (skip system).
	summaryPrompt := "请将以下对话历史压缩为简洁的摘要，保留：\n" +
		"1. 用户的核心需求\n" +
		"2. 已完成的关键操作和结果\n" +
		"3. 未完成的任务\n" +
		"4. 重要的文件路径和数据\n\n" +
		"对话历史：\n"

	for _, msg := range messages {
		if msg.Role == "system" {
			continue
		}
		summaryPrompt += fmt.Sprintf("\n[%s] %s", msg.Role, msg.Content)
	}

	summaryRequest := []modelgateway.ChatMessage{
		{Role: "system", Content: "你是一个对话摘要助手，输出简洁的中文摘要。"},
		{Role: "user", Content: summaryPrompt},
	}

	// Use a short timeout so a slow summary call doesn't stall the
	// ReAct loop indefinitely. 30s is generous for a short summary.
	sumCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	resp, err := s.gateway.Chat(sumCtx, summaryRequest, nil, false)
	if err != nil {
		if s.log != nil {
			s.log.Warn("conversation summarization failed",
				zap.Int("inputMessages", len(messages)),
				zap.Error(err),
			)
		}
		return "", fmt.Errorf("summarize conversation: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices in summary response")
	}

	summary := resp.Choices[0].Message.Content
	if s.log != nil {
		s.log.Info("conversation summarized",
			zap.Int("inputMessages", len(messages)),
			zap.Int("summaryLength", len(summary)),
		)
	}
	return summary, nil
}

// SolidifyMemory writes the conversation summary into the RunContext's
// Memory so the agent can continue from a compact representation.
// This is L5 of the 5-layer compression: the chat history is cleared
// (by the caller) and the summary becomes the new task context.
// P3-4 §5.4.
func (o *Orchestrator) SolidifyMemory(rc *RunContext, summary string) {
	if rc == nil || rc.Memory == nil {
		return
	}

	// Write the summary as the task summary so Memory.Summary()
	// includes it in subsequent context builds.
	rc.Memory.SetTaskSummary(summary)

	o.emitEvent(rc, Event{
		Type:      "memory_solidified",
		Timestamp: time.Now(),
		RunID:     rc.Run.ID,
		Data: map[string]any{
			"summaryLength": len(summary),
			"layer":         "L5",
		},
	})
	if o.log != nil {
		o.log.Info("memory solidified (L5 compression)",
			zap.String("runId", rc.Run.ID),
			zap.Int("summaryLength", len(summary)),
		)
	}
}

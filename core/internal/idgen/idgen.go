package idgen

import "github.com/google/uuid"

// New 生成完整 UUID v4 字符串
func New() string {
	return uuid.New().String()
}

// NewShort 生成 8 字符短 ID（UUID 前缀）
func NewShort() string {
	return uuid.New().String()[:8]
}

// NewPrefixed 生成带前缀的 ID
func NewPrefixed(prefix string) string {
	return prefix + uuid.New().String()[:8]
}

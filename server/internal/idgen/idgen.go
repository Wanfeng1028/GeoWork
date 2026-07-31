package idgen

import (
	"crypto/rand"
	"encoding/hex"
)

// New 生成带前缀的随机 ID
func New(prefix string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

// NewShort 生成较短的 ID（8 字节 hex = 16 字符）
func NewShort() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// NewPrefixed 生成带前缀的 ID（如 "usr_xxxx"）
func NewPrefixed(prefix string) string {
	return prefix + "_" + NewShort()
}

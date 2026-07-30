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

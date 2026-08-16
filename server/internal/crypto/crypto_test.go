// Package crypto tests for AES-256-GCM helpers.
package crypto

import (
	"bytes"
	"encoding/hex"
	"strings"
	"testing"
)

func testKey(t *testing.T) []byte {
	t.Helper()
	key := bytes.Repeat([]byte{0x42}, 32)
	return key
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := testKey(t)
	plaintexts := []string{
		"",
		"hello",
		"sk-1234567890abcdef",
		strings.Repeat("long secret payload ", 1000),
		"unicode: 密钥管理 🔑",
	}
	for _, pt := range plaintexts {
		ct, err := Encrypt(pt, key)
		if err != nil {
			t.Fatalf("Encrypt(%q): %v", pt, err)
		}
		if ct == pt {
			t.Fatalf("ciphertext equals plaintext for %q", pt)
		}
		got, err := Decrypt(ct, key)
		if err != nil {
			t.Fatalf("Decrypt(%q): %v", pt, err)
		}
		if got != pt {
			t.Fatalf("round trip = %q, want %q", got, pt)
		}
	}
}

func TestEncryptIsRandomized(t *testing.T) {
	key := testKey(t)
	a, err := Encrypt("same plaintext", key)
	if err != nil {
		t.Fatal(err)
	}
	b, err := Encrypt("same plaintext", key)
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two encryptions of the same plaintext produced identical ciphertext; nonce must be random")
	}
}

func TestEncryptOutputLayout(t *testing.T) {
	key := testKey(t)
	ct, err := Encrypt("x", key)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := hex.DecodeString(ct)
	if err != nil {
		t.Fatalf("ciphertext is not hex: %v", err)
	}
	// 12-byte nonce + 1-byte plaintext + 16-byte GCM tag.
	if want := 12 + 1 + 16; len(raw) != want {
		t.Fatalf("ciphertext length = %d, want %d (nonce+plaintext+tag)", len(raw), want)
	}
}

func TestDecryptWrongKeyFails(t *testing.T) {
	ct, err := Encrypt("secret", testKey(t))
	if err != nil {
		t.Fatal(err)
	}
	otherKey := bytes.Repeat([]byte{0x99}, 32)
	if _, err := Decrypt(ct, otherKey); err == nil {
		t.Fatal("Decrypt with wrong key should fail (GCM auth tag)")
	}
}

func TestDecryptTamperedCiphertextFails(t *testing.T) {
	key := testKey(t)
	ct, err := Encrypt("secret", key)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := hex.DecodeString(ct)
	raw[len(raw)-1] ^= 0xFF // flip a bit in the auth tag
	if _, err := Decrypt(hex.EncodeToString(raw), key); err == nil {
		t.Fatal("Decrypt of tampered ciphertext should fail")
	}
}

func TestDecryptInvalidInputs(t *testing.T) {
	key := testKey(t)

	t.Run("not hex", func(t *testing.T) {
		if _, err := Decrypt("zz-not-hex", key); err == nil {
			t.Fatal("want error for non-hex input")
		}
	})

	t.Run("too short", func(t *testing.T) {
		if _, err := Decrypt(hex.EncodeToString([]byte{1, 2, 3}), key); err == nil {
			t.Fatal("want error for ciphertext shorter than nonce")
		}
	})

	t.Run("wrong key size", func(t *testing.T) {
		if _, err := Encrypt("x", []byte("short")); err == nil {
			t.Fatal("want error for non-32-byte key")
		}
	})
}

func TestGetEncryptionKey(t *testing.T) {
	t.Run("unset", func(t *testing.T) {
		t.Setenv("GEOWORK_ENCRYPTION_KEY", "")
		if _, err := GetEncryptionKey(); err == nil {
			t.Fatal("want error when env var is empty")
		}
	})

	t.Run("not hex", func(t *testing.T) {
		t.Setenv("GEOWORK_ENCRYPTION_KEY", strings.Repeat("zz", 32))
		if _, err := GetEncryptionKey(); err == nil {
			t.Fatal("want error for non-hex value")
		}
	})

	t.Run("wrong length", func(t *testing.T) {
		t.Setenv("GEOWORK_ENCRYPTION_KEY", hex.EncodeToString([]byte("only16byteskey!!")))
		if _, err := GetEncryptionKey(); err == nil {
			t.Fatal("want error for 16-byte key")
		}
	})

	t.Run("valid", func(t *testing.T) {
		want := bytes.Repeat([]byte{0xAB}, 32)
		t.Setenv("GEOWORK_ENCRYPTION_KEY", hex.EncodeToString(want))
		got, err := GetEncryptionKey()
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Fatalf("key = %x, want %x", got, want)
		}
	})
}

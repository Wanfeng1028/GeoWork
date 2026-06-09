package api

import (
  "encoding/json"
  "net/http"
)

func HealthHandler(w http.ResponseWriter, r *http.Request) {
  w.Header().Set("Content-Type", "application/json")
  _ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","service":"geowork-runtime"})
}

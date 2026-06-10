// GeoWork Go Core - Safety Routes

package safety

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	guardrail *Guardrail
	policy    *Policy
}

func NewRoutes(guardrail *Guardrail, policy *Policy) *Routes {
	return &Routes{guardrail: guardrail, policy: policy}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/safety/policy", r.handleGetPolicy)
	mux.HandleFunc("POST /api/safety/validate", r.handleValidate)
}

func (r *Routes) handleGetPolicy(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.policy)
}

func (r *Routes) handleValidate(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		Path     string `json:"path"`
		Size     int64  `json:"size"`
		MimeType string `json:"mimeType"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := r.guardrail.ValidateWrite(req.Context(), reqBody.Path, reqBody.Size, reqBody.MimeType)
	result := map[string]interface{}{
		"allowed": err == nil,
	}
	if err != nil {
		result["error"] = err.Error()
	}

	writeJSON(w, result)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

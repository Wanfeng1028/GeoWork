// GeoWork Go Core - Plugin Routes

package plugins

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	registry  *Registry
	installer *Installer
}

func NewRoutes(registry *Registry, installer *Installer) *Routes {
	return &Routes{registry: registry, installer: installer}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/plugins", r.handleList)
	mux.HandleFunc("GET /api/plugins/{id}", r.handleGet)
	mux.HandleFunc("POST /api/plugins/install", r.handleInstall)
	mux.HandleFunc("DELETE /api/plugins/{id}", r.handleRemove)
	mux.HandleFunc("POST /api/plugins/{id}/enable", r.handleEnable)
	mux.HandleFunc("POST /api/plugins/{id}/disable", r.handleDisable)
	mux.HandleFunc("POST /api/plugins/update", r.handleUpdate)
	mux.HandleFunc("GET /api/plugins/marketplace/{id}/manifest", r.handleMarketplace)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.registry.List())
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	m, ok := r.registry.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "plugin not found")
		return
	}
	writeJSON(w, m)
}

func (r *Routes) handleInstall(w http.ResponseWriter, req *http.Request) {
	var in struct {
		ID         string `json:"id"`
		FromMarketplace bool `json:"fromMarketplace"`
		FromDir   string `json:"fromDir,omitempty"`
	}
	json.NewDecoder(req.Body).Decode(&in)

	var manifest *Manifest
	var err error

	if in.FromMarketplace {
		manifest, err = r.installer.InstallFromMarketplace(in.ID)
	} else if in.FromDir != "" {
		manifest, err = r.installer.InstallFromDir(in.FromDir)
	} else {
		manifest, err = r.installer.InstallFromMarketplace(in.ID)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	r.registry.Register(manifest)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, manifest)
}

func (r *Routes) handleRemove(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.registry.Remove(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "removed"})
}

func (r *Routes) handleEnable(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	plugins, err := r.registry.Enable(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, plugins)
}

func (r *Routes) handleDisable(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	plugins, err := r.registry.Disable(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, plugins)
}

func (r *Routes) handleUpdate(w http.ResponseWriter, req *http.Request) {
	var in struct {
		ID      string `json:"id"`
		Version string `json:"version"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	if err := r.installer.Update(in.ID, in.Version); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "updated"})
}

func (r *Routes) handleMarketplace(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	manifest, err := DownloadManifest("https://marketplace.geowork.dev", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, manifest)
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

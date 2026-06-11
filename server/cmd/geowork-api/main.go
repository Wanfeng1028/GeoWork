// Package main starts the GeoWork Cloud API server.
//
// This server handles cloud-side capabilities:
// - Auth (login, logout, refresh, me)
// - Account management
// - Teams and RBAC
// - Usage tracking
// - Billing (plans, credits)
// - Model proxy
// - Sync (multi-device)
// - Marketplace
// - Telemetry & crash reporting
// - Collaboration
// - Channels (webhooks)
//
// Storage: SQLite-backed (v0.5.0)
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"server/internal/accounts"
	"server/internal/api"
	"server/internal/auth"
	"server/internal/billing"
	"server/internal/channels"
	"server/internal/collaboration"
	"server/internal/crash"
	"server/internal/marketplace"
	"server/internal/modelproxy"
	"server/internal/rbac"
	"server/internal/storage"
	"server/internal/sync"
	"server/internal/teams"
	"server/internal/telemetry"
	"server/internal/usage"

	"github.com/gin-gonic/gin"
)

type Server struct {
	Port   int
	Engine *gin.Engine
	Store  *storage.Store
}

func NewServer() *Server {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.Default()

	// CORS middleware
	engine.Use(func() gin.HandlerFunc {
		return func(c *gin.Context) {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Telemetry-Opt-In, X-Crash-Opt-In")
			if c.Request.Method == "OPTIONS" {
				c.AbortWithStatus(204)
				return
			}
			c.Next()
		}
	}())

	// Health check
	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "v0.5.0"})
	})

	s := &Server{
		Port:   8767,
		Engine: engine,
	}

	if p := os.Getenv("GEOWORK_SERVER_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &s.Port)
	}

	return s
}

func (s *Server) Setup() {
	// 1. Create SQLite store — runs migrations automatically
	dbPath := os.Getenv("GEOWORK_DB_PATH")
	s.Store = storage.NewStore(dbPath)
	if s.Store.DBErr() != nil {
		log.Fatalf("Failed to open database: %v", s.Store.DBErr())
	}
	defer s.Store.Close() // close immediately after setup; re-open for lifetime

	// 2. Seed defaults (billing plans, marketplace items)
	if err := s.Store.EnsureDefaults(); err != nil {
		log.Fatalf("Failed to seed defaults: %v", err)
	}

	// 3. Initialize modules — each service uses s.Store which is now SQLite-backed
	authSvc := auth.NewService(s.Store)
	accountSvc := accounts.NewService(s.Store)
	teamSvc := teams.NewService(s.Store)
	rbacSvc := rbac.NewService(s.Store)
	usageSvc := usage.NewService(s.Store)
	billingSvc := billing.NewService(s.Store)
	modelProxySvc := modelproxy.NewService(s.Store)
	syncSvc := sync.NewService(s.Store)
	marketplaceSvc := marketplace.NewService(s.Store)
	telemetrySvc := telemetry.NewService(s.Store)
	crashSvc := crash.NewService(s.Store)
	collabSvc := collaboration.NewService(s.Store)
	channelSvc := channels.NewService(s.Store)

	// 5. Register routes
	api.SetupRoutes(s.Engine, authSvc, accountSvc, teamSvc, rbacSvc,
		usageSvc, billingSvc, modelProxySvc, syncSvc, marketplaceSvc,
		telemetrySvc, crashSvc, collabSvc, channelSvc)
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("127.0.0.1:%d", s.Port)
	log.Printf("GeoWork Cloud API v0.5.0 starting on %s", addr)

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt)
		<-sigCh
		log.Println("Shutting down...")
		if s.Store != nil {
			s.Store.Close()
		}
	}()

	return s.Engine.Run(addr)
}

func main() {
	s := NewServer()
	s.Setup()
	if err := s.Start(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// Package main starts the GeoWork Cloud API server.
//
// This server handles cloud-side capabilities:
// - Auth (login, logout, refresh, me)
// - Account management
// - Teams and RBAC
// - Usage tracking
// - Billing (plans, credits)
// - Model proxy
// - Sync
// - Marketplace
// - Telemetry & crash reporting
// - Collaboration
// - Channels (webhooks)
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
}

func NewServer() *Server {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.Default()

	// CORS middleware
	engine.Use(func() gin.HandlerFunc {
		return func(c *gin.Context) {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if c.Request.Method == "OPTIONS" {
				c.AbortWithStatus(204)
				return
			}
			c.Next()
		}
	}())

	// Health check
	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "v0.4.0"})
	})

	s := &Server{
		Port:   8767,
		Engine: engine,
	}

	// Parse port from env
	if p := os.Getenv("GEOWORK_SERVER_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &s.Port)
	}

	return s
}

func (s *Server) Setup() {
	// Initialize storage (in-memory for v0.4.0, will migrate to SQLite later)
	store := storage.NewStore()

	// Initialize modules
	authSvc := auth.NewService(store)
	accountSvc := accounts.NewService(store)
	teamSvc := teams.NewService(store)
	rbacSvc := rbac.NewService(store)
	usageSvc := usage.NewService(store)
	billingSvc := billing.NewService(store)
	modelProxySvc := modelproxy.NewService(store)
	syncSvc := sync.NewService(store)
	marketplaceSvc := marketplace.NewService(store)
	telemetrySvc := telemetry.NewService(store)
	crashSvc := crash.NewService(store)
	collabSvc := collaboration.NewService(store)
	channelSvc := channels.NewService(store)

	// Setup routes
	api.SetupRoutes(s.Engine, authSvc, accountSvc, teamSvc, rbacSvc,
		usageSvc, billingSvc, modelProxySvc, syncSvc, marketplaceSvc,
		telemetrySvc, crashSvc, collabSvc, channelSvc)
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("127.0.0.1:%d", s.Port)
	log.Printf("GeoWork Cloud API starting on %s", addr)

	// Graceful shutdown (simplified for v0.4.0)
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt)
		<-sigCh
		log.Println("Shutting down...")
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

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
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"server/internal/accounts"
	"server/internal/api"
	"server/internal/apierrors"
	"server/internal/auth"
	"server/internal/billing"
	"server/internal/channels"
	"server/internal/collaboration"
	"server/internal/conversations"
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

	// Recovery middleware — catch panics and return unified 500 JSON
	engine.Use(apierrors.Recovery())

	// CORS middleware — origin whitelist from GEOWORK_ALLOWED_ORIGINS env var
	engine.Use(func() gin.HandlerFunc {
		whitelist := allowedOrigins()
		return func(c *gin.Context) {
			origin := c.GetHeader("Origin")
			if isOriginAllowed(origin, whitelist) {
				c.Header("Access-Control-Allow-Origin", origin)
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
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
	conversationSvc := conversations.NewService(s.Store)

	// 5. Register routes
	api.SetupRoutes(s.Engine, authSvc, accountSvc, teamSvc, rbacSvc,
		usageSvc, billingSvc, modelProxySvc, syncSvc, marketplaceSvc,
		telemetrySvc, crashSvc, collabSvc, channelSvc, conversationSvc)
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("127.0.0.1:%d", s.Port)
	log.Printf("GeoWork Cloud API v0.5.0 starting on %s", addr)

	// 显式 http.Server 替代 Engine.Run（P6 韧性加固）：
	// - ReadHeaderTimeout 防 slowloris 式慢头发连接耗尽；
	// - 不设 WriteTimeout——/api/model/stream 是 SSE 长响应，写超时会
	//   切断流式连接；IdleTimeout 只回收空闲 keep-alive，不影响活跃流。
	srv := &http.Server{
		Addr:              addr,
		Handler:           s.Engine,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// 优雅停机：先停接收新连接，给在途请求 10s 收尾，最后关库
	// （关库顺序在 Shutdown 之后，避免在途请求写已关闭的 DB）。
	idleConnsClosed := make(chan struct{})
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("forced shutdown: %v", err)
		}
		if s.Store != nil {
			s.Store.Close()
		}
		close(idleConnsClosed)
	}()

	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	<-idleConnsClosed
	return nil
}

// allowedOrigins returns the whitelist of allowed origins from the
// GEOWORK_ALLOWED_ORIGINS environment variable. Falls back to localhost defaults.
func allowedOrigins() []string {
	env := os.Getenv("GEOWORK_ALLOWED_ORIGINS")
	if env == "" {
		env = "http://localhost:5173,http://127.0.0.1:5173"
	}
	parts := strings.Split(env, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}

// isOriginAllowed checks whether origin is in the whitelist. file:// origins
// (Electron) are only accepted in dev mode (GEOWORK_DEV=1): a blanket
// file:// allow lets any local HTML file opened in a webview talk to the
// cloud API (doc/25 S1). Production Electron builds send no Origin on IPC
// fetches, so this does not break the desktop client.
func isOriginAllowed(origin string, whitelist []string) bool {
	if strings.HasPrefix(origin, "file://") {
		return os.Getenv("GEOWORK_DEV") == "1"
	}
	for _, allowed := range whitelist {
		if origin == allowed {
			return true
		}
	}
	return false
}

func main() {
	s := NewServer()
	s.Setup()
	if err := s.Start(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

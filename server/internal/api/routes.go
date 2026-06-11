// Package api sets up all routes for the cloud API server.
package api

import (
	"server/internal/accounts"
	"server/internal/auth"
	"server/internal/billing"
	"server/internal/channels"
	"server/internal/collaboration"
	"server/internal/crash"
	"server/internal/marketplace"
	"server/internal/modelproxy"
	"server/internal/rbac"
	"server/internal/sync"
	"server/internal/teams"
	"server/internal/telemetry"
	"server/internal/usage"

	"github.com/gin-gonic/gin"
)

// SetupRoutes registers all API routes on the Gin engine.
func SetupRoutes(
	r *gin.Engine,
	authSvc *auth.Service,
	accountSvc *accounts.Service,
	teamSvc *teams.Service,
	rbacSvc *rbac.Service,
	usageSvc *usage.Service,
	billingSvc *billing.Service,
	modelProxySvc *modelproxy.Service,
	syncSvc *sync.Service,
	marketplaceSvc *marketplace.Service,
	telemetrySvc *telemetry.Service,
	crashSvc *crash.Service,
	collabSvc *collaboration.Service,
	channelSvc *channels.Service,
) {
	// API v1 root
	api := r.Group("/api")
	{
		// Auth routes (no auth required for login/logout/refresh)
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/login", authSvc.Login)
			authGroup.POST("/logout", authSvc.Logout)
			authGroup.POST("/refresh", authSvc.Refresh)
			authGroup.GET("/me", authSvc.Middleware(), authSvc.Me)
		}

		// Account routes (auth required)
		account := api.Group("/account")
		account.Use(authSvc.Middleware())
		{
			account.GET("/profile", accountSvc.GetProfile)
			account.PATCH("/profile", accountSvc.UpdateProfile)
			account.GET("/subscription", accountSvc.GetSubscription)
			account.GET("/permissions", rbacSvc.GetPermissions)
		}

		// Team routes (auth required)
		teamGroup := api.Group("/teams")
		teamGroup.Use(authSvc.Middleware())
		{
			teamGroup.POST("", teamSvc.CreateTeam)
			teamGroup.GET("", teamSvc.ListTeams)
			teamGroup.POST("/:id/invite", teamSvc.InviteMember)
			teamGroup.PATCH("/:id/members/:userid", teamSvc.UpdateMember)
			teamGroup.GET("/:id/workspaces", teamSvc.GetTeamWorkspaces)
		}

		// RBAC routes (auth required)
		rbacGroup := api.Group("/rbac")
		rbacGroup.Use(authSvc.Middleware())
		{
			rbacGroup.POST("/check", rbacSvc.CheckPermission)
			rbacGroup.GET("/roles", rbacSvc.GetRoles)
		}

		// Usage routes (auth required)
		usageGroup := api.Group("/usage")
		usageGroup.Use(authSvc.Middleware())
		{
			usageGroup.POST("/events", usageSvc.ReportEvents)
			usageGroup.GET("/summary", usageSvc.GetSummary)
			usageGroup.GET("/models", usageSvc.GetModels)
		}

		// Billing routes (auth required)
		billingGroup := api.Group("/billing")
		billingGroup.Use(authSvc.Middleware())
		{
			billingGroup.GET("/plan", billingSvc.GetPlan)
			billingGroup.GET("/usage", billingSvc.GetUsage)
			billingGroup.GET("/credits", billingSvc.GetCredits)
			billingGroup.GET("/invoices", billingSvc.GetInvoices)
			billingGroup.POST("/checkout/mock", billingSvc.CheckoutSession)
		}

		// Model proxy routes (auth required)
		modelGroup := api.Group("/model")
		modelGroup.Use(authSvc.Middleware())
		{
			modelGroup.POST("/providers", modelProxySvc.AddProvider)
			modelGroup.GET("/providers", modelProxySvc.ListProviders)
			modelGroup.GET("/models", modelProxySvc.ListModels)
			modelGroup.POST("/chat", modelProxySvc.Chat)
			modelGroup.POST("/stream", modelProxySvc.Stream)
		}

		// Sync routes (auth required)
		syncGroup := api.Group("/sync")
		syncGroup.Use(authSvc.Middleware())
		{
			syncGroup.GET("/state", syncSvc.GetState)
			syncGroup.POST("/push", syncSvc.Push)
			syncGroup.GET("/pull", syncSvc.Pull)
			syncGroup.POST("/resolve-conflict", syncSvc.ResolveConflict)
		}

		// Marketplace routes (no auth required for reading)
		marketplaceGroup := api.Group("/marketplace")
		{
			marketplaceGroup.GET("/plugins", marketplaceSvc.ListPlugins)
			marketplaceGroup.GET("/skills", marketplaceSvc.ListSkills)
			marketplaceGroup.GET("/connectors", marketplaceSvc.ListConnectors)
			marketplaceGroup.GET("/items/:id", marketplaceSvc.GetItem)
		}

		// Telemetry routes (auth required, opt-in)
		telemetryGroup := api.Group("/telemetry")
		telemetryGroup.Use(authSvc.Middleware())
		{
			telemetryGroup.POST("/events", telemetrySvc.ReportEvent)
			telemetryGroup.POST("/batch", telemetrySvc.ReportBatch)
		}

		// Crash reporting routes (opt-in)
		crashGroup := api.Group("/crash")
		{
			crashGroup.POST("/report", crashSvc.Report)
		}

		// Collaboration routes (auth required)
		collabGroup := api.Group("")
		collabGroup.Use(authSvc.Middleware())
		{
			collabGroup.GET("/workspaces/:id/activity", collabSvc.GetActivity)
			collabGroup.POST("/workspaces/:id/share", collabSvc.Share)
			collabGroup.POST("/tasks/:id/comments", collabSvc.AddComment)
			collabGroup.POST("/tasks/:id/assign", collabSvc.AssignTask)
		}

		// Channels routes (auth required)
		channelsGroup := api.Group("/channels")
		channelsGroup.Use(authSvc.Middleware())
		{
			channelsGroup.GET("", channelSvc.ListChannels)
			channelsGroup.POST("", channelSvc.CreateChannel)
		}

		// Webhook receiver (no auth, signed requests in production)
		webhook := api.Group("/channels/webhook")
		{
			webhook.POST("/:channelId", channelSvc.WebhookReceiver)
		}
	}
}

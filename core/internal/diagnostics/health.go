package diagnostics

import (
	"sync"
	"time"
)

// HealthStatus represents the overall health state of the application.
type HealthStatus struct {
	Status    string            `json:"status"`
	Services  map[string]string `json:"services"`
	Uptime    string            `json:"uptime"`
	Timestamp time.Time         `json:"timestamp"`
}

// HealthChecker monitors the health status of services.
type HealthChecker struct {
	mu        sync.RWMutex
	services  map[string]string
	startTime time.Time
}

// NewHealthChecker creates a new health checker with a known start time.
func NewHealthChecker() *HealthChecker {
	return &HealthChecker{
		services:  make(map[string]string),
		startTime: time.Now(),
	}
}

// AddService registers a service and its current status.
func (hc *HealthChecker) AddService(name string, status string) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if hc.services == nil {
		hc.services = make(map[string]string)
	}
	hc.services[name] = status
}

// RemoveService removes a service from the health check registry.
func (hc *HealthChecker) RemoveService(name string) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	delete(hc.services, name)
}

// UpdateService updates the status of an existing service.
func (hc *HealthChecker) UpdateService(name string, status string) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.services[name] = status
}

// Check returns the overall health status of all registered services.
func (hc *HealthChecker) Check() HealthStatus {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	status := "healthy"
	servicesCopy := make(map[string]string, len(hc.services))
	for name, svcStatus := range hc.services {
		servicesCopy[name] = svcStatus
		if svcStatus == "unhealthy" || svcStatus == "critical" {
			status = "unhealthy"
		} else if svcStatus == "degraded" && status != "unhealthy" {
			status = "degraded"
		}
	}

	return HealthStatus{
		Status:    status,
		Services:  servicesCopy,
		Uptime:    hc.Uptime().String(),
		Timestamp: time.Now(),
	}
}

// IsHealthy returns true if all services are healthy.
func (hc *HealthChecker) IsHealthy() bool {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	for _, svcStatus := range hc.services {
		if svcStatus == "unhealthy" || svcStatus == "critical" {
			return false
		}
	}
	return true
}

// Uptime returns the duration since the health checker was created.
func (hc *HealthChecker) Uptime() time.Duration {
	return time.Since(hc.startTime)
}

// GetServiceStatus returns the status of a specific service.
func (hc *HealthChecker) GetServiceStatus(name string) string {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	return hc.services[name]
}

// GetServiceStatuses returns a copy of all service statuses.
func (hc *HealthChecker) GetServiceStatuses() map[string]string {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	cp := make(map[string]string, len(hc.services))
	for k, v := range hc.services {
		cp[k] = v
	}
	return cp
}

// GetServiceCount returns the number of registered services.
func (hc *HealthChecker) GetServiceCount() int {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return len(hc.services)
}

// GetUnhealthyServices returns the names of all unhealthy services.
func (hc *HealthChecker) GetUnhealthyServices() []string {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	var unhealthy []string
	for name, status := range hc.services {
		if status == "unhealthy" || status == "critical" {
			unhealthy = append(unhealthy, name)
		}
	}
	return unhealthy
}

// GetDegradedServices returns the names of all degraded services.
func (hc *HealthChecker) GetDegradedServices() []string {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	var degraded []string
	for name, status := range hc.services {
		if status == "degraded" {
			degraded = append(degraded, name)
		}
	}
	return degraded
}

// SetStartTime allows overriding the start time for testing purposes.
func (hc *HealthChecker) SetStartTime(t time.Time) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	hc.startTime = t
}

// HealthSummary provides a high-level summary of system health.
type HealthSummary struct {
	OverallStatus  string
	TotalServices  int
	HealthyCount   int
	UnhealthyCount int
	DegradedCount  int
	Uptime         time.Duration
}

// GetHealthSummary returns a summary of the current health state.
func (hc *HealthChecker) GetHealthSummary() HealthSummary {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	summary := HealthSummary{
		TotalServices: len(hc.services),
		Uptime:        hc.Uptime(),
	}

	for _, status := range hc.services {
		switch status {
		case "healthy":
			summary.HealthyCount++
		case "unhealthy", "critical":
			summary.UnhealthyCount++
			summary.OverallStatus = "unhealthy"
		case "degraded":
			summary.DegradedCount++
			if summary.OverallStatus != "unhealthy" {
				summary.OverallStatus = "degraded"
			}
		default:
			if summary.OverallStatus == "" {
				summary.OverallStatus = "unknown"
			}
		}
	}

	if summary.OverallStatus == "" && summary.TotalServices > 0 {
		summary.OverallStatus = "healthy"
	}
	if summary.TotalServices == 0 {
		summary.OverallStatus = "no-services"
	}

	return summary
}

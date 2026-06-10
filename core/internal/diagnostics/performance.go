package diagnostics

import (
	"fmt"
	"sync"
	"time"
)

// PerfMetric holds a single performance measurement.
type PerfMetric struct {
	Name      string    `json:"name"`
	Value     float64   `json:"value"`
	Unit      string    `json:"unit"`
	Timestamp time.Time `json:"timestamp"`
}

// PerfMonitor collects and aggregates performance metrics.
type PerfMonitor struct {
	mu      sync.RWMutex
	metrics map[string][]PerfMetric
}

// NewPerfMonitor creates a new performance monitor.
func NewPerfMonitor() *PerfMonitor {
	return &PerfMonitor{
		metrics: make(map[string][]PerfMetric),
	}
}

// RecordMetric records a new performance measurement.
func (pm *PerfMonitor) RecordMetric(name string, value float64, unit string) error {
	if name == "" {
		return fmt.Errorf("metric name is required")
	}

	pm.mu.Lock()
	defer pm.mu.Unlock()

	metric := PerfMetric{
		Name:      name,
		Value:     value,
		Unit:      unit,
		Timestamp: time.Now(),
	}

	pm.metrics[name] = append(pm.metrics[name], metric)

	// Keep at most 10000 measurements per metric name
	if len(pm.metrics[name]) > 10000 {
		pm.metrics[name] = pm.metrics[name][len(pm.metrics[name])-10000:]
	}

	return nil
}

// GetMetrics returns all recorded metrics.
func (pm *PerfMonitor) GetMetrics() ([]PerfMetric, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var all []PerfMetric
	for _, metrics := range pm.metrics {
		all = append(all, metrics...)
	}
	return all, nil
}

// GetMetricByName returns all measurements for a specific metric name.
func (pm *PerfMonitor) GetMetricByName(name string) ([]PerfMetric, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	metrics, exists := pm.metrics[name]
	if !exists {
		return []PerfMetric{}, nil
	}

	cp := make([]PerfMetric, len(metrics))
	copy(cp, metrics)
	return cp, nil
}

// GetAvgMetric returns the average value for a specific metric.
func (pm *PerfMonitor) GetAvgMetric(name string) (float64, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	metrics, exists := pm.metrics[name]
	if !exists || len(metrics) == 0 {
		return 0, fmt.Errorf("no metrics found for name: %s", name)
	}

	var sum float64
	for _, m := range metrics {
		sum += m.Value
	}

	return sum / float64(len(metrics)), nil
}

// GetPeakMetric returns the maximum value for a specific metric.
func (pm *PerfMonitor) GetPeakMetric(name string) (float64, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	metrics, exists := pm.metrics[name]
	if !exists || len(metrics) == 0 {
		return 0, fmt.Errorf("no metrics found for name: %s", name)
	}

	peak := metrics[0].Value
	for _, m := range metrics[1:] {
		if m.Value > peak {
			peak = m.Value
		}
	}

	return peak, nil
}

// GetMinMetric returns the minimum value for a specific metric.
func (pm *PerfMonitor) GetMinMetric(name string) (float64, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	metrics, exists := pm.metrics[name]
	if !exists || len(metrics) == 0 {
		return 0, fmt.Errorf("no metrics found for name: %s", name)
	}

	minVal := metrics[0].Value
	for _, m := range metrics[1:] {
		if m.Value < minVal {
			minVal = m.Value
		}
	}

	return minVal, nil
}

// ResetMetrics clears all recorded metrics.
func (pm *PerfMonitor) ResetMetrics() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.metrics = make(map[string][]PerfMetric)
	return nil
}

// ResetMetricByName clears metrics for a specific name.
func (pm *PerfMonitor) ResetMetricByName(name string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	delete(pm.metrics, name)
}

// GetMetricNames returns all recorded metric names.
func (pm *PerfMonitor) GetMetricNames() []string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	names := make([]string, 0, len(pm.metrics))
	for name := range pm.metrics {
		names = append(names, name)
	}
	return names
}

// GetMetricCount returns the number of recorded metrics for a name.
func (pm *PerfMonitor) GetMetricCount(name string) int {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return len(pm.metrics[name])
}

// GetTotalMetricCount returns the total number of all recorded metrics.
func (pm *PerfMonitor) GetTotalMetricCount() int {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	total := 0
	for _, metrics := range pm.metrics {
		total += len(metrics)
	}
	return total
}

// GetStatistics returns statistical summary for a specific metric.
func (pm *PerfMonitor) GetStatistics(name string) (MetricStatistics, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	metrics, exists := pm.metrics[name]
	if !exists || len(metrics) == 0 {
		return MetricStatistics{}, fmt.Errorf("no metrics found for name: %s", name)
	}

	stats := MetricStatistics{
		Name:      name,
		Unit:      metrics[0].Unit,
		Count:     len(metrics),
		Min:       metrics[0].Value,
		Max:       metrics[0].Value,
		Total:     0,
		Timestamp: metrics[len(metrics)-1].Timestamp,
	}

	for _, m := range metrics {
		stats.Total += m.Value
		if m.Value < stats.Min {
			stats.Min = m.Value
		}
		if m.Value > stats.Max {
			stats.Max = m.Value
		}
	}

	stats.Avg = stats.Total / float64(stats.Count)
	return stats, nil
}

// MetricStatistics holds aggregated statistics for a metric.
type MetricStatistics struct {
	Name      string
	Unit      string
	Count     int
	Min       float64
	Max       float64
	Avg       float64
	Total     float64
	Timestamp time.Time
}

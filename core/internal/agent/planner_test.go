package agent

import (
	"testing"
)

func TestCreatePlanResearch(t *testing.T) {
	planner := Planner{}
	steps := planner.CreatePlan("论文 NDVI 综述")
	if len(steps) != 3 {
		t.Fatalf("expected 3 steps for research, got %d", len(steps))
	}
	if steps[1].ToolName != "research.openalex.search" {
		t.Fatalf("expected research tool, got %s", steps[1].ToolName)
	}
	if steps[2].ToolName != "geo.office.write_report" {
		t.Fatalf("expected write_report tool, got %s", steps[2].ToolName)
	}
}

func TestCreatePlanGIS(t *testing.T) {
	planner := Planner{}
	steps := planner.CreatePlan("GIS 裁剪和缓冲分析")
	if len(steps) != 3 {
		t.Fatalf("expected 3 steps for GIS, got %d", len(steps))
	}
	if steps[1].ToolName != "geo.gdal.inspect_dataset" {
		t.Fatalf("expected gdal tool, got %s", steps[1].ToolName)
	}
}

func TestCreatePlanNDVI(t *testing.T) {
	planner := Planner{}
	steps := planner.CreatePlan("NDVI 实验报告")
	if len(steps) != 3 {
		t.Fatalf("expected 3 steps for NDVI, got %d", len(steps))
	}
	if steps[1].ToolName != "geo.gee.generate_ndvi_script" {
		t.Fatalf("expected gee tool, got %s", steps[1].ToolName)
	}
}

func TestCreatePlanEmpty(t *testing.T) {
	planner := Planner{}
	steps := planner.CreatePlan("")
	if len(steps) < 2 {
		t.Fatalf("expected at least 2 steps for empty prompt, got %d", len(steps))
	}
}

# Sprint 0-9 Implementation Coverage

## Sprint 0: 基础骨架

- Electron main/preload/runtime launcher: `apps/desktop/electron/`
- Go Runtime: `core/cmd/geowork-runtime`
- Go-managed Python Worker process lifecycle: `core/internal/worker/process.go`
- Health APIs: `/api/health`, `/api/worker/geo/check`
- Python Worker health: `workers/geo-python/app/main.py`

## Sprint 1: 主界面

- Top bar, 15-module sidebar, workbench three columns, bottom event log: `apps/desktop/src/app/App.tsx`
- Map preview surfaces: workbench context panel and map page
- No Tailwind/shadcn; Ant Design + SCSS Modules

## Sprint 2: 任务系统

- Task API: `/api/tasks`, `/api/tasks/:id/run|pause|cancel`
- Planner: `core/internal/agent/planner.go`
- Executor and SSE: `core/internal/runtime/runtime.go`
- Event history and streaming: `/api/tasks/:id/events`

## Sprint 3: Python Worker 工具

- GEE script generation: `/tools/gee/generate-ndvi-script`
- Word/Markdown report generation: `/tools/office/write-report`
- Go Worker client: `core/internal/worker/client.go`
- Tool execution path: Go Core Runtime -> Worker Client -> Python Worker -> artifacts

## Sprint 4: 项目工作区与安全

- Projects: `/api/projects`, `/api/projects/:id/files`
- Workspace directories: `data`, `artifacts`, `reports`, `logs`, `scripts`, `knowledge`
- Workspace whitelist and path guard: `ProjectFiles` and settings security block
- Risk approval records: `/api/security/decisions`

## Sprint 5: Skill 系统

- File-system Skill loader: `LoadSkills`
- 12 official Skill manifests under `skills/`
- Skill UI and run endpoint: `/api/skills`, `/api/skills/:id/run`

## Sprint 6: 模型与 API

- Provider registry: DeepSeek, Qwen, Kimi, Doubao, Zhipu, OpenAI, Claude, Ollama, vLLM, custom OpenAI-compatible
- Model APIs: `/api/models`, `/api/models/test`
- Usage summary: `/api/usage/summary`

## Sprint 7: 论文搜索与知识库

- Paper APIs: `/api/papers`
- Knowledge APIs: `/api/knowledge`
- Worker tools: `/tools/papers/openalex-search`, `/tools/papers/parse-pdf`, `/tools/knowledge/index`
- UI pages: papers and knowledge

## Sprint 8: 插件和市场

- Plugin manifests under `plugins/`
- Marketplace index: `marketplace/index.json`
- Plugin APIs: `/api/plugins`, `/api/plugins/:id/enable`
- Permission display in UI

## Sprint 9: 自动化与定时任务

- Automation APIs: `/api/automations`, `/api/automations/:id/trigger`, `/api/automation-runs`
- Cron/file-watch rule model
- Triggered automation creates a task record and run history

#!/usr/bin/env python3
"""Go 增量覆盖率门禁（P4）。

对 `go test -coverprofile` 的产物与 git diff 求交集，计算本次变更新增的
可执行 Go 行的覆盖率，低于阈值即失败。

用法（core 为例）：
    python scripts/ci/go_diff_coverage.py \
        --profile core/coverage.out \
        --module geowork/core --repo-dir core \
        --base HEAD~1 --threshold 50

规则（与 doc/16 §9 一致）：
- 分母 = 新增行中落在 coverprofile 任一语句块内的行（可执行行）；
  注释/空行/非可执行行不进分母，`_test.go` 的新增行不计入。
- 分子 = 其中落在 count > 0 块内的行。
- 无新增可执行行时按 100% 处理（无门禁意义）。
- 基线 commit 无法解析（shallow clone 等）时跳过门禁并说明，不算失败。
- 在 GitHub Actions 中运行时（GITHUB_STEP_SUMMARY 存在）追加 markdown 摘要。
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
BLOCK_RE = re.compile(r"^(.+?):(\d+)\.\d+,(\d+)\.\d+\s+(\d+)\s+(\d+)\s*$")


def run_git(args: list[str], cwd: str | None = None) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8"
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def resolve_base(base: str) -> str | None:
    """返回可用的基线 commit SHA；无法解析则 None（跳过门禁）。"""
    for candidate in [base, "HEAD~1"]:
        try:
            sha = run_git(["rev-parse", "--verify", f"{candidate}^{{commit}}"]).strip()
            if sha:
                return sha
        except RuntimeError:
            continue
    return None


def added_lines_by_file(base: str, repo_dir: str) -> dict[str, set[int]]:
    """git diff 中新增的行号，按仓库相对文件路径分组（只保留非 _test.go 的 .go）。"""
    diff = run_git(
        ["diff", "--unified=0", "--no-color", base, "HEAD", "--", repo_dir],
    )
    files: dict[str, set[int]] = {}
    current: str | None = None
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            path = line[6:]
            # 测试基础设施（testutil）与 _test.go 一样服务于测试本身，
            # 不计入门禁分母（doc/16 §9.1 豁免）。
            if (
                not path.endswith(".go")
                or path.endswith("_test.go")
                or "/internal/testutil/" in path
            ):
                current = None
                continue
            current = path
            files.setdefault(current, set())
        elif current and (m := HUNK_RE.match(line)):
            start = int(m.group(1))
            count = int(m.group(2) or 1)
            files[current].update(range(start, start + count))
    return files


def parse_profile(profile: str, module: str, repo_dir: str) -> dict[str, list[tuple[int, int, int]]]:
    """coverprofile → {仓库相对路径: [(起始行, 结束行, count), ...]}"""
    blocks: dict[str, list[tuple[int, int, int]]] = {}
    prefix = module + "/"
    with open(profile, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("mode:"):
                continue
            m = BLOCK_RE.match(line)
            if not m:
                continue
            name, start, end, _stmts, count = m.groups()
            if not name.startswith(prefix):
                continue
            repo_path = repo_dir + "/" + name[len(prefix):]
            blocks.setdefault(repo_path, []).append((int(start), int(end), int(count)))
    return blocks


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--profile", required=True, help="go test -coverprofile 产物路径")
    ap.add_argument("--module", required=True, help="Go 模块名（coverprofile 文件名前缀）")
    ap.add_argument("--repo-dir", required=True, help="模块在仓库中的目录")
    ap.add_argument("--base", default="HEAD~1", help="diff 基线（commit/ref）")
    ap.add_argument("--threshold", type=float, default=50.0, help="最低增量覆盖率百分比")
    args = ap.parse_args()

    base = resolve_base(args.base)
    if base is None:
        print("::warning::无法解析 diff 基线（shallow clone？），跳过增量覆盖率门禁")
        return 0

    added = added_lines_by_file(base, args.repo_dir)
    if not added:
        print(f"基线 {base[:8]} 之后没有新增 Go 行，增量覆盖率视为 100%")
        return 0

    try:
        blocks = parse_profile(args.profile, args.module, args.repo_dir)
    except FileNotFoundError:
        print(f"::error::coverprofile 不存在：{args.profile}（测试步骤失败或未跑？）")
        return 1

    total = covered = 0
    uncovered_report: list[str] = []
    per_file: dict[str, tuple[int, int]] = {}  # path -> (分母, 分子)
    for path, lines in sorted(added.items()):
        for lineno in sorted(lines):
            hits = [b for b in blocks.get(path, []) if b[0] <= lineno <= b[1]]
            if not hits:
                continue  # 非可执行行，不进分母
            f_total, f_cov = per_file.get(path, (0, 0))
            total += 1
            if any(b[2] > 0 for b in hits):
                covered += 1
                per_file[path] = (f_total + 1, f_cov + 1)
            else:
                uncovered_report.append(f"{path}:{lineno}")
                per_file[path] = (f_total + 1, f_cov)

    pct = 100.0 if total == 0 else covered * 100.0 / total
    verdict = "PASS" if pct >= args.threshold else "FAIL"

    print(f"\n增量覆盖率（{args.repo_dir}，基线 {base[:8]}）：{covered}/{total} 行 = {pct:.1f}%（门禁 {args.threshold:g}%）")
    for path, (f_total, f_cov) in sorted(per_file.items()):
        print(f"  {path}: {f_cov}/{f_total}")
    if uncovered_report:
        preview = "\n    ".join(uncovered_report[:20])
        more = "" if len(uncovered_report) <= 20 else f"\n    ...（共 {len(uncovered_report)} 行未覆盖）"
        print(f"  未覆盖的新增可执行行：\n    {preview}{more}")

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write(
                f"\n### 增量覆盖率门禁（{args.repo_dir}） — {verdict}\n\n"
                f"`{covered}/{total}` 新增可执行行被测试覆盖 = **{pct:.1f}%**（门禁 {args.threshold:g}%）\n\n"
                + (
                    "| 文件 | 覆盖 |\n|---|---|\n"
                    + "\n".join(
                        f"| `{p}` | {c}/{t} |" for p, (t, c) in sorted(per_file.items())
                    )
                    + "\n"
                    if per_file
                    else ""
                )
            )

    if pct < args.threshold:
        print(
            f"::error::增量覆盖率 {pct:.1f}% 低于门禁 {args.threshold:g}%，"
            "请为本提交新增的 Go 代码补充测试（规则见 doc/16 §9）"
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

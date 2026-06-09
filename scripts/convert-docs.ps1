# GeoWork 文档转换脚本
# 将 docx/v0.1.0 下的所有 .docx 和 .pdf 转换为 .md 文件
# 依赖：pandoc（安装：winget install Pandoc）

$ErrorActionPreference = "Stop"
$baseDir = Join-Path $PSScriptRoot "..\docx\v0.1.0"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GeoWork 文档转换工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 pandoc 是否安装
Write-Host "[检查] 正在检查 pandoc..." -ForegroundColor Yellow
$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Host "[错误] 未找到 pandoc，请先安装：" -ForegroundColor Red
    Write-Host "  winget install Pandoc" -ForegroundColor Red
    Write-Host ""
    Write-Host "  或从 https://pandoc.org/installing.html 下载" -ForegroundColor Red
    exit 1
}
$pandocVersion = pandoc --version | Select-String "pandoc" | Select-Object -First 1
Write-Host "[通过] pandoc 已安装: $pandocVersion" -ForegroundColor Green

# 统计文件
$docxFiles = Get-ChildItem $baseDir -Recurse -Filter *.docx
$pdfFiles = Get-ChildItem $baseDir -Recurse -Filter *.pdf

$docxCount = ($docxFiles | Where-Object { $_.Extension -eq ".docx" }).Count
$pdfCount = ($pdfFiles | Where-Object { $_.Extension -eq ".pdf" }).Count
$totalCount = $docxCount + $pdfCount

Write-Host ""
Write-Host "[统计] 找到 $docxCount 个 .docx 文件和 $pdfCount 个 .pdf 文件，共 $totalCount 个文件" -ForegroundColor Yellow
Write-Host ""

# 转换 docx
if ($docxCount -gt 0) {
    Write-Host "[1/2] 正在转换 .docx 文件..." -ForegroundColor Cyan
    $docxConverted = 0
    $docxFailed = 0
    
    foreach ($file in $docxFiles) {
        $outFile = $file.FullName -replace '\.docx$', '.md'
        try {
            pandoc $file.FullName -o $outFile --wrap=auto --standalone 2>$null
            if ($?) {
                $docxConverted++
                Write-Host "  [+] $($file.Name)" -ForegroundColor Green
            } else {
                $docxFailed++
                Write-Host "  [-] $($file.Name) - 转换失败" -ForegroundColor Red
            }
        } catch {
            $docxFailed++
            Write-Host "  [-] $($file.Name) - 错误: $_" -ForegroundColor Red
        }
    }
    Write-Host "[完成] .docx: 成功 $docxConverted, 失败 $docxFailed" -ForegroundColor Yellow
} else {
    Write-Host "[跳过] 没有 .docx 文件" -ForegroundColor Gray
}

Write-Host ""

# 转换 pdf
if ($pdfCount -gt 0) {
    Write-Host "[2/2] 正在转换 .pdf 文件..." -ForegroundColor Cyan
    $pdfConverted = 0
    $pdfFailed = 0
    
    foreach ($file in $pdfFiles) {
        $outFile = $file.FullName -replace '\.pdf$', '.md'
        try {
            pandoc $file.FullName -o $outFile --wrap=auto --standalone 
            if ($?) {
                $pdfConverted++
                Write-Host "  [+] $($file.Name)" -ForegroundColor Green
            } else {
                $pdfFailed++
                Write-Host "  [-] $($file.Name) - 转换失败" -ForegroundColor Red
            }
        } catch {
            $pdfFailed++
            Write-Host "  [-] $($file.Name) - 错误: $_" -ForegroundColor Red
        }
    }
    Write-Host "[完成] .pdf: 成功 $pdfConverted, 失败 $pdfFailed" -ForegroundColor Yellow
} else {
    Write-Host "[跳过] 没有 .pdf 文件" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  转换完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 列出新生成的 md 文件
$newMdFiles = Get-ChildItem $baseDir -Recurse -Filter *.md | Where-Object {
    $_.DirectoryName -notmatch '(?i)(md|docs|extras|samples|licenses|prompts|references|scaffold)' -or
    $_.Name -match '^(README|SKILL|COMMERCIAL|REFERENCES|ALL_PHASE)'
}

$totalNewMd = (Get-ChildItem $baseDir -Recurse -Filter *.md).Count
Write-Host "[提示] docx/v0.1.0 下现在共有 $totalNewMd 个 .md 文件" -ForegroundColor Yellow
Write-Host ""
Write-Host "下一步：重新运行此对话，我将读取所有 .md 文件并制定开发计划。" -ForegroundColor Cyan

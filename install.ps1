<#
.SYNOPSIS
    把本仓库 skills/ 下的所有 skill 安装到本机 AI Agent 的 skills 目录。

.DESCRIPTION
    逐个复制 skills/<name>/ 到 -Target 指定的目录。
    默认目标为 ~/.claude/skills；DSH 请用 -Target "$HOME\.agents\skills"。
    目标已存在同名 skill 时，默认跳过；加 -Force 才覆盖。
    安装后按 skills.json 检查各 skill 的 env 与 pythonDependencies 并提示。

.PARAMETER Target
    安装目标目录。默认 "$HOME\.claude\skills"。

.PARAMETER Force
    覆盖已存在的同名 skill。不加此项时跳过并提示。

.PARAMETER DryRun
    只打印将要执行的操作，不实际写入任何文件。

.PARAMETER InstallDeps
    按 skills.json 里各 skill 的 pythonDependencies 自动执行 pip 安装。

.EXAMPLE
    .\install.ps1
    安装到默认目录 ~/.claude/skills

.EXAMPLE
    .\install.ps1 -Target "$HOME\.agents\skills"
    安装到 DSH 读取的目录（注意不是 ~/.dsh/skills）

.EXAMPLE
    .\install.ps1 -Force
    强制覆盖已存在的 skill

.EXAMPLE
    .\install.ps1 -DryRun
    预览操作，不做修改

.EXAMPLE
    .\install.ps1 -InstallDeps
    安装 skill 并自动 pip 安装其 Python 依赖
#>
[CmdletBinding()]
param(
    [string]$Target = (Join-Path $HOME ".claude\skills"),
    [switch]$Force,
    [switch]$DryRun,
    [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$srcRoot  = Join-Path $repoRoot "skills"

if (-not (Test-Path -LiteralPath $srcRoot)) {
    throw "找不到 skills 目录：$srcRoot"
}

$skillDirs = @(Get-ChildItem -LiteralPath $srcRoot -Directory -ErrorAction SilentlyContinue)

Write-Host ""
Write-Host "Skill Vault - 安装程序" -ForegroundColor Cyan
Write-Host ("目标目录 : {0}" -f $Target)
Write-Host ("发现 skill: {0} 个" -f $skillDirs.Count)
if ($DryRun) { Write-Host "模式     : 预览（不写入）" -ForegroundColor Yellow }
Write-Host ""

if ($skillDirs.Count -eq 0) {
    Write-Host "skills/ 目录为空，没有可安装的 skill。" -ForegroundColor Yellow
    Write-Host "提示：把 skill 文件夹放进 skills/ 后重新运行本脚本。" -ForegroundColor DarkGray
    exit 0
}

if (-not $DryRun -and -not (Test-Path -LiteralPath $Target)) {
    Write-Host ("创建目标目录：{0}" -f $Target) -ForegroundColor DarkGray
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
}

$installed = 0
$skipped   = 0

foreach ($dir in $skillDirs) {
    $name    = $dir.Name
    $dest    = Join-Path $Target $name
    $exists  = Test-Path -LiteralPath $dest

    # 校验必备的 SKILL.md
    $hasSkillMd = Test-Path -LiteralPath (Join-Path $dir.FullName "SKILL.md")
    if (-not $hasSkillMd) {
        Write-Host ("  [警告] {0} 缺少 SKILL.md，已跳过" -f $name) -ForegroundColor Yellow
        $skipped++
        continue
    }

    if ($exists -and -not $Force) {
        Write-Host ("  [跳过] {0} 已存在（用 -Force 覆盖）" -f $name) -ForegroundColor DarkGray
        $skipped++
        continue
    }

    if ($DryRun) {
        $action = if ($exists) { "覆盖" } else { "安装" }
        Write-Host ("  [预览] 将{0} {1}  ->  {2}" -f $action, $name, $dest) -ForegroundColor Yellow
        $installed++
        continue
    }

    if ($exists) {
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    Copy-Item -LiteralPath $dir.FullName -Destination $dest -Recurse -Force
    Write-Host ("  [完成] {0}" -f $name) -ForegroundColor Green
    $installed++
}

Write-Host ""
Write-Host ("安装 {0} 个，跳过 {1} 个。" -f $installed, $skipped) -ForegroundColor Cyan

# ---- 按 skills.json 检查环境变量与 Python 依赖 ----
$manifest = Join-Path $repoRoot "skills.json"
if (Test-Path -LiteralPath $manifest) {
    try {
        $json = Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json

        $needEnv = @()
        $depOwners = [ordered]@{}
        foreach ($s in $json.skills) {
            if ($s.env) {
                foreach ($e in $s.env) {
                    if (-not [string]::IsNullOrWhiteSpace($e)) {
                        $needEnv += ("  {0}  ->  {1}" -f $s.name, $e)
                    }
                }
            }
            if ($s.pythonDependencies) {
                foreach ($p in $s.pythonDependencies) {
                    if (-not [string]::IsNullOrWhiteSpace($p)) {
                        if (-not $depOwners.Contains($p)) { $depOwners[$p] = @() }
                        $depOwners[$p] += $s.name
                    }
                }
            }
        }

        if ($needEnv.Count -gt 0) {
            Write-Host ""
            Write-Host "以下 skill 需要先配置环境变量才能正常使用：" -ForegroundColor Yellow
            $needEnv | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        }

        if ($depOwners.Count -gt 0) {
            $pkgs = @($depOwners.Keys)
            Write-Host ""
            Write-Host "以下 skill 需要 Python 依赖（缺包会直接报错）：" -ForegroundColor Yellow
            foreach ($p in $pkgs) {
                Write-Host ("  {0}  <-  {1}" -f $p, ($depOwners[$p] -join ", ")) -ForegroundColor Yellow
            }

            $pipCmd = "pip install " + ($pkgs -join " ")
            if ($InstallDeps -and -not $DryRun) {
                Write-Host ""
                Write-Host ("正在安装 Python 依赖：{0}" -f ($pkgs -join " ")) -ForegroundColor Cyan
                $py = Get-Command python -ErrorAction SilentlyContinue
                if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
                if (-not $py) {
                    Write-Host ("找不到 python，请手动执行：{0}" -f $pipCmd) -ForegroundColor Red
                } else {
                    & $py.Source -m pip install @pkgs
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "Python 依赖安装完成。" -ForegroundColor Green
                    } else {
                        Write-Host ("pip 返回码 {0}，请手动执行：{1}" -f $LASTEXITCODE, $pipCmd) -ForegroundColor Red
                    }
                }
            } else {
                Write-Host ""
                Write-Host ("提示：加 -InstallDeps 可自动安装，或手动执行：{0}" -f $pipCmd) -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host "（未能解析 skills.json，跳过依赖检查）" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "完成。重启 AI Agent 后即可使用新的 skill。" -ForegroundColor Green

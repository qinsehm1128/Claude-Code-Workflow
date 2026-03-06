[CmdletBinding()]
param(
  [string]$TargetBranch = "main",
  [string]$UpstreamRemote = "upstream",
  [string]$OriginRemote = "origin",
  [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [string]$ErrorMessage = ""
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    if ([string]::IsNullOrWhiteSpace($ErrorMessage)) {
      throw "git $($Args -join ' ') 执行失败。"
    }
    throw $ErrorMessage
  }
}

function Get-TrimmedOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $output = (& git @Args 2>$null)
  if ($LASTEXITCODE -ne 0) {
    return ""
  }

  return ($output | Out-String).Trim()
}

Write-Host "==> 检查 Git 仓库状态..."
$repoRoot = Get-TrimmedOutput -Args @("rev-parse", "--show-toplevel")
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "当前目录不是 Git 仓库，请在仓库目录执行脚本。"
}
Set-Location $repoRoot

$workTreeDirty = (& git status --porcelain)
if ($LASTEXITCODE -ne 0) {
  throw "无法读取 Git 状态。"
}
if (-not [string]::IsNullOrWhiteSpace(($workTreeDirty | Out-String).Trim())) {
  throw "检测到未提交改动。请先提交或暂存后再执行合并。"
}

$remotes = (& git remote)
if ($LASTEXITCODE -ne 0) {
  throw "无法读取远程仓库配置。"
}
if (-not ($remotes -contains $UpstreamRemote)) {
  throw "未找到远程 '$UpstreamRemote'。请先执行: git remote add $UpstreamRemote <url>"
}
if (-not ($remotes -contains $OriginRemote)) {
  throw "未找到远程 '$OriginRemote'。请先检查 remote 配置。"
}

Write-Host "==> 更新远程引用..."
Invoke-Git -Args @("fetch", $OriginRemote, "--prune")
Invoke-Git -Args @("fetch", $UpstreamRemote, "--prune", "--tags")

$currentBranch = Get-TrimmedOutput -Args @("rev-parse", "--abbrev-ref", "HEAD")
if ([string]::IsNullOrWhiteSpace($currentBranch) -or $currentBranch -eq "HEAD") {
  throw "当前是 detached HEAD，无法自动切换和合并。"
}
if ($currentBranch -ne $TargetBranch) {
  Write-Host "==> 切换分支: $currentBranch -> $TargetBranch"
  Invoke-Git -Args @("checkout", $TargetBranch) -ErrorMessage "切换到分支 '$TargetBranch' 失败。"
}

$upstreamHeadRef = Get-TrimmedOutput -Args @("symbolic-ref", "--quiet", "--short", "refs/remotes/$UpstreamRemote/HEAD")
if ([string]::IsNullOrWhiteSpace($upstreamHeadRef)) {
  $remoteShow = (& git remote show $UpstreamRemote)
  if ($LASTEXITCODE -eq 0) {
    $headLine = $remoteShow | Where-Object { $_ -match "HEAD branch:" } | Select-Object -First 1
    if ($headLine -match "HEAD branch:\s*(\S+)") {
      $upstreamHeadRef = "$UpstreamRemote/$($Matches[1])"
    }
  }
}
if ([string]::IsNullOrWhiteSpace($upstreamHeadRef)) {
  $upstreamHeadRef = "$UpstreamRemote/main"
}

Write-Host "==> 合并来源: $upstreamHeadRef -> $TargetBranch"
$before = Get-TrimmedOutput -Args @("rev-parse", "--short", "HEAD")

try {
  Invoke-Git -Args @("merge", $upstreamHeadRef, "--no-edit") -ErrorMessage "合并失败，请手动解决冲突后执行 git commit。"
} catch {
  Write-Host ""
  Write-Host "检测到合并失败。常见处理："
  Write-Host "1) 解决冲突后执行: git add <files> && git commit"
  Write-Host "2) 放弃本次合并: git merge --abort"
  throw
}

$after = Get-TrimmedOutput -Args @("rev-parse", "--short", "HEAD")
if ($before -eq $after) {
  Write-Host "==> 当前分支已是最新，无需新增提交。"
} else {
  Write-Host "==> 合并完成，新提交: $after"
}

if ($Push) {
  Write-Host "==> 推送到 $OriginRemote/$TargetBranch ..."
  Invoke-Git -Args @("push", $OriginRemote, $TargetBranch) -ErrorMessage "推送失败，请检查权限或分支保护规则。"
  Write-Host "==> 推送完成。"
} else {
  Write-Host "==> 未自动推送。如需推送请执行: git push $OriginRemote $TargetBranch"
}

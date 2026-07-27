param(
    [switch]$NoBuild
)

Write-Host "=== Sync Audio Relay Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check / Install .NET SDK
$dotnetPath = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetOk = $false
if ($dotnetPath) {
    try {
        $ver = & $dotnetPath.Source --version 2>$null
        if ($ver -and $ver.StartsWith('8')) {
            $dotnetOk = $true
            Write-Host "✅ .NET SDK found: v$ver" -ForegroundColor Green
        }
    } catch {}
}

if (-not $dotnetOk) {
    Write-Host "📥 .NET SDK 8.0 not found. Downloading..." -ForegroundColor Yellow
    $installerUrl = "https://dotnet.microsoft.com/download/dotnet/scripts/v1/dotnet-install.ps1"
    $installerPath = "$env:TEMP\dotnet-install.ps1"

    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        & $installerPath -Channel 8.0 -InstallDir "$env:USERPROFILE\.dotnet" -Verbose

        $env:PATH = "$env:USERPROFILE\.dotnet;$env:PATH"
        [Environment]::SetEnvironmentVariable("PATH", "$env:USERPROFILE\.dotnet;$env:PATH", [EnvironmentVariableTarget]::User)

        $ver = & "$env:USERPROFILE\.dotnet\dotnet" --version
        Write-Host "✅ .NET SDK installed: v$ver" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to install .NET SDK: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Install manually: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
        Write-Host "Then run this script again." -ForegroundColor Yellow
        exit 1
    }
}

# Step 2: Restore NuGet packages
Write-Host ""
Write-Host "📦 Restoring packages..." -ForegroundColor Cyan
try {
    & dotnet restore "$PSScriptRoot\LocalRelay.csproj"
    if ($LASTEXITCODE -ne 0) { throw "Restore failed" }
    Write-Host "✅ Packages restored" -ForegroundColor Green
}
catch {
    Write-Host "❌ Package restore failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Build
if (-not $NoBuild) {
    Write-Host ""
    Write-Host "🔨 Building relay..." -ForegroundColor Cyan
    try {
        & dotnet publish "$PSScriptRoot\LocalRelay.csproj" -c Release -r win-x64 -p:PublishSingleFile=true --self-contained true -o "$PSScriptRoot\dist"
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Host "✅ Build complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Relay executable: $PSScriptRoot\dist\SyncAudioRelay.exe" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Run it once — it lives in your system tray." -ForegroundColor White
        Write-Host "Select an audio source (Spotify, Chrome, etc.) and it streams to your room." -ForegroundColor White
    }
    catch {
        Write-Host "❌ Build failed: $_" -ForegroundColor Red
        exit 1
    }
}

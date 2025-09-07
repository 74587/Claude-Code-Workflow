#!/usr/bin/env pwsh
# Claude Code Workflow (CCW) - Remote Installation Script
# One-liner remote installation for Claude Code Workflow system

[CmdletBinding()]
param(
    [switch]$Global,
    [string]$Directory = "",
    [switch]$Force,
    [switch]$NoBackup,
    [switch]$NonInteractive,
    [switch]$BackupAll,
    [string]$Branch = "main"
)

# Set encoding for proper Unicode support
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
} else {
    # Windows PowerShell 5.1
    $OutputEncoding = [System.Text.Encoding]::UTF8
    chcp 65001 | Out-Null
}

# Script metadata
$ScriptName = "Claude Code Workflow (CCW) Remote Installer"
$Version = "2.1.1"

# Colors for output
$ColorSuccess = "Green"
$ColorInfo = "Cyan"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Show-Header {
    Write-ColorOutput "==== $ScriptName v$Version ====" $ColorInfo
    Write-ColorOutput "========================================================" $ColorInfo
    Write-Host ""
}

function Test-Prerequisites {
    # Test PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-ColorOutput "ERROR: PowerShell 5.1 or higher is required" $ColorError
        Write-ColorOutput "Current version: $($PSVersionTable.PSVersion)" $ColorError
        return $false
    }
    
    # Test internet connectivity
    try {
        $null = Invoke-WebRequest -Uri "https://github.com" -Method Head -TimeoutSec 10 -UseBasicParsing
        Write-ColorOutput "Network connection OK" $ColorSuccess
    } catch {
        Write-ColorOutput "ERROR: Cannot connect to GitHub" $ColorError
        Write-ColorOutput "Please check your network connection: $($_.Exception.Message)" $ColorError
        return $false
    }
    
    return $true
}

function Get-TempDirectory {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "claude-code-workflow-install"
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
    return $tempDir
}

function Download-Repository {
    param(
        [string]$TempDir,
        [string]$Branch = "main"
    )
    
    $repoUrl = "https://github.com/catlog22/Claude-Code-Workflow"
    $zipUrl = "$repoUrl/archive/refs/heads/$Branch.zip"
    $zipPath = Join-Path $TempDir "repo.zip"
    
    Write-ColorOutput "Downloading from GitHub..." $ColorInfo
    Write-ColorOutput "Source: $repoUrl" $ColorInfo
    Write-ColorOutput "Branch: $Branch" $ColorInfo
    
    try {
        # Download with progress
        $progressPreference = $ProgressPreference
        $ProgressPreference = 'SilentlyContinue'
        
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
        
        $ProgressPreference = $progressPreference
        
        if (Test-Path $zipPath) {
            $fileSize = (Get-Item $zipPath).Length
            Write-ColorOutput "Download complete ($([math]::Round($fileSize/1024/1024, 2)) MB)" $ColorSuccess
            return $zipPath
        } else {
            throw "Downloaded file does not exist"
        }
    } catch {
        Write-ColorOutput "Download failed: $($_.Exception.Message)" $ColorError
        return $null
    }
}

function Extract-Repository {
    param(
        [string]$ZipPath,
        [string]$TempDir
    )
    
    Write-ColorOutput "Extracting files..." $ColorInfo
    
    try {
        # Use .NET to extract zip
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TempDir)
        
        # Find the extracted directory (usually repo-name-branch)
        $extractedDirs = Get-ChildItem -Path $TempDir -Directory
        $repoDir = $extractedDirs | Where-Object { $_.Name -like "Claude-Code-Workflow-*" } | Select-Object -First 1
        
        if ($repoDir) {
            Write-ColorOutput "Extraction complete: $($repoDir.FullName)" $ColorSuccess
            return $repoDir.FullName
        } else {
            throw "Could not find extracted repository directory"
        }
    } catch {
        Write-ColorOutput "Extraction failed: $($_.Exception.Message)" $ColorError
        return $null
    }
}

function Invoke-LocalInstaller {
    param(
        [string]$RepoDir
    )
    
    $installerPath = Join-Path $RepoDir "Install-Claude.ps1"
    
    if (-not (Test-Path $installerPath)) {
        Write-ColorOutput "ERROR: Install-Claude.ps1 not found" $ColorError
        return $false
    }
    
    Write-ColorOutput "Running local installer..." $ColorInfo
    Write-Host ""
    
    # Build parameters for local installer
    $params = @{}
    if ($Global) { $params["InstallMode"] = "Global" }
    if ($Directory) { 
        $params["InstallMode"] = "Custom"
        $params["TargetPath"] = $Directory
    }
    if ($Force) { $params["Force"] = $Force }
    if ($NoBackup) { $params["NoBackup"] = $NoBackup }
    if ($NonInteractive) { $params["NonInteractive"] = $NonInteractive }
    if ($BackupAll) { $params["BackupAll"] = $BackupAll }
    
    try {
        # Change to repo directory and run installer
        Push-Location $RepoDir
        
        if ($params.Count -gt 0) {
            $paramList = ($params.GetEnumerator() | ForEach-Object { "-$($_.Key) $($_.Value)" }) -join " "
            Write-ColorOutput "Executing: & `"$installerPath`" $paramList" $ColorInfo
            & $installerPath @params
        } else {
            Write-ColorOutput "Executing: & `"$installerPath`"" $ColorInfo
            & $installerPath
        }
        
        Pop-Location
        return $true
    } catch {
        Pop-Location
        Write-ColorOutput "Installation script failed: $($_.Exception.Message)" $ColorError
        return $false
    }
}

function Cleanup-TempFiles {
    param(
        [string]$TempDir
    )
    
    if (Test-Path $TempDir) {
        try {
            Remove-Item -Path $TempDir -Recurse -Force
            Write-ColorOutput "Temporary files cleaned up" $ColorInfo
        } catch {
            Write-ColorOutput "WARNING: Failed to clean temporary files: $($_.Exception.Message)" $ColorWarning
        }
    }
}

function Wait-ForUserConfirmation {
    param(
        [string]$Message = "Press any key to continue...",
        [switch]$ExitAfter
    )
    
    if (-not $NonInteractive) {
        Write-Host ""
        Write-ColorOutput $Message $ColorInfo
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Write-Host ""
    }
    
    if ($ExitAfter) {
        exit 0
    }
}

function Main {
    Show-Header
    
    Write-ColorOutput "This will download and install Claude Code Workflow System from GitHub." $ColorInfo
    Write-Host ""
    
    # Test prerequisites
    Write-ColorOutput "Checking system requirements..." $ColorInfo
    if (-not (Test-Prerequisites)) {
        Wait-ForUserConfirmation "System check failed! Press any key to exit..." -ExitAfter
    }
    
    # Confirm installation
    if (-not $NonInteractive -and -not $Force) {
        Write-Host ""
        Write-ColorOutput "SECURITY NOTE:" $ColorWarning
        Write-Host "- This script will download and execute Claude Code Workflow from GitHub"
        Write-Host "- Repository: https://github.com/catlog22/Claude-Code-Workflow"  
        Write-Host "- Branch: $Branch (latest stable version)"
        Write-Host "- Features: Intelligent workflow orchestration with multi-agent coordination"
        Write-Host "- Please ensure you trust this source"
        Write-Host ""
        
        $choice = Read-Host "Continue with installation? (y/N)"
        if ($choice -notmatch '^[Yy]') {
            Write-ColorOutput "Installation cancelled" $ColorWarning
            Wait-ForUserConfirmation -ExitAfter
        }
    }
    
    # Create temp directory
    $tempDir = Get-TempDirectory
    Write-ColorOutput "Temporary directory: $tempDir" $ColorInfo
    
    try {
        # Download repository
        $zipPath = Download-Repository $tempDir $Branch
        if (-not $zipPath) {
            throw "Download failed"
        }
        
        # Extract repository
        $repoDir = Extract-Repository $zipPath $tempDir
        if (-not $repoDir) {
            throw "Extraction failed"
        }
        
        # Run local installer
        $success = Invoke-LocalInstaller $repoDir
        if (-not $success) {
            throw "Installation script failed"
        }
        
        Write-Host ""
        Write-ColorOutput "Remote installation completed successfully!" $ColorSuccess
        
    } catch {
        Write-Host ""
        Write-ColorOutput "Remote installation failed: $($_.Exception.Message)" $ColorError
        Wait-ForUserConfirmation "Installation failed! Press any key to exit..." -ExitAfter
    } finally {
        # Cleanup
        Cleanup-TempFiles $tempDir
    }
    
    Write-Host ""
    Write-ColorOutput "Next steps:" $ColorInfo
    Write-Host "1. Review CLAUDE.md for project-specific guidelines"
    Write-Host "2. Try /workflow commands for Agent coordination"
    Write-Host "3. Use /update-memory to manage distributed documentation"
    
    Wait-ForUserConfirmation "Remote installation done! Press any key to exit..." -ExitAfter
}

# Run main function
try {
    Main
} catch {
    Write-ColorOutput "CRITICAL ERROR: $($_.Exception.Message)" $ColorError
    Write-Host ""
    Wait-ForUserConfirmation "A critical error occurred! Press any key to exit..." -ExitAfter
}
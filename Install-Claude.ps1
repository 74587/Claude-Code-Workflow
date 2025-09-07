#Requires -Version 5.1

<#
.SYNOPSIS
    Claude Code Workflow System Interactive Installer

.DESCRIPTION
    Installation script for Claude Code Workflow System with Agent coordination and distributed memory system.
    Installs globally to user profile directory (~/.claude) by default.

.PARAMETER InstallMode
    Installation mode: "Global" (default and only supported mode)

.PARAMETER TargetPath
    Target path for Custom installation mode

.PARAMETER Force
    Skip confirmation prompts

.PARAMETER NonInteractive
    Run in non-interactive mode with default options

.PARAMETER BackupAll
    Automatically backup all existing files without confirmation prompts (enabled by default)

.PARAMETER NoBackup
    Disable automatic backup functionality

.EXAMPLE
    .\Install-Claude.ps1
    Interactive installation with mode selection

.EXAMPLE
    .\Install-Claude.ps1 -InstallMode Global -Force
    Global installation without prompts

.EXAMPLE
    .\Install-Claude.ps1 -Force -NonInteractive
    Global installation without prompts

.EXAMPLE
    .\Install-Claude.ps1 -BackupAll
    Global installation with automatic backup of all existing files

.EXAMPLE
    .\Install-Claude.ps1 -NoBackup
    Installation without any backup (overwrite existing files)
#>

param(
    [ValidateSet("Global")]
    [string]$InstallMode = "Global",
    
    [switch]$Force,
    
    [switch]$NonInteractive,
    
    [switch]$BackupAll,
    
    [switch]$NoBackup
)

# Set encoding for proper Unicode support
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
} else {
    # For Windows PowerShell 5.1
    chcp 65001 | Out-Null
}

# Script metadata
$ScriptName = "Claude Code Workflow System Installer"
$Version = "2.1.0"

# Initialize backup behavior - backup is enabled by default unless NoBackup is specified
if (-not $BackupAll -and -not $NoBackup) {
    $BackupAll = $true
    Write-Verbose "Auto-backup enabled by default. Use -NoBackup to disable."
}

# Colors for output
$ColorSuccess = "Green"
$ColorInfo = "Cyan"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorPrompt = "Magenta"

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
    if ($NoBackup) {
        Write-ColorOutput "WARNING: Backup disabled - existing files will be overwritten without backup!" $ColorWarning
    } else {
        Write-ColorOutput "Auto-backup enabled - existing files will be backed up before replacement" $ColorSuccess
    }
    Write-Host ""
}

function Test-Prerequisites {
    # Test PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-ColorOutput "ERROR: PowerShell 5.1 or higher is required" $ColorError
        Write-ColorOutput "Current version: $($PSVersionTable.PSVersion)" $ColorError
        return $false
    }
    
    # Test source files exist
    $sourceDir = $PSScriptRoot
    $claudeDir = Join-Path $sourceDir ".claude"
    $claudeMd = Join-Path $sourceDir "CLAUDE.md"
    
    if (-not (Test-Path $claudeDir)) {
        Write-ColorOutput "ERROR: .claude directory not found in $sourceDir" $ColorError
        return $false
    }
    
    if (-not (Test-Path $claudeMd)) {
        Write-ColorOutput "ERROR: CLAUDE.md file not found in $sourceDir" $ColorError
        return $false
    }
    
    Write-ColorOutput "Prerequisites check passed" $ColorSuccess
    return $true
}

function Get-UserChoice {
    param(
        [string]$Prompt,
        [string[]]$Options,
        [string]$Default = $null
    )
    
    if ($NonInteractive -and $Default) {
        Write-ColorOutput "Non-interactive mode: Using default '$Default'" $ColorInfo
        return $Default
    }
    
    Write-ColorOutput $Prompt $ColorPrompt
    for ($i = 0; $i -lt $Options.Count; $i++) {
        if ($Default -and $Options[$i] -eq $Default) {
            $marker = " (default)"
        } else {
            $marker = ""
        }
        Write-Host "  $($i + 1). $($Options[$i])$marker"
    }
    
    do {
        $input = Read-Host "Please select (1-$($Options.Count))"
        if ([string]::IsNullOrWhiteSpace($input) -and $Default) {
            return $Default
        }
        
        $index = $null
        if ([int]::TryParse($input, [ref]$index) -and $index -ge 1 -and $index -le $Options.Count) {
            return $Options[$index - 1]
        }
        
        Write-ColorOutput "Invalid selection. Please enter a number between 1 and $($Options.Count)" $ColorWarning
    } while ($true)
}

function Confirm-Action {
    param(
        [string]$Message,
        [switch]$DefaultYes
    )
    
    if ($Force) {
        Write-ColorOutput "Force mode: Proceeding with '$Message'" $ColorInfo
        return $true
    }
    
    if ($NonInteractive) {
        if ($DefaultYes) {
            $result = $true
        } else {
            $result = $false
        }
        if ($result) {
            $resultText = 'Yes'
        } else {
            $resultText = 'No'
        }
        Write-ColorOutput "Non-interactive mode: $Message - $resultText" $ColorInfo
        return $result
    }
    
    if ($DefaultYes) {
        $defaultChar = "Y"
        $prompt = "(Y/n)"
    } else {
        $defaultChar = "N"
        $prompt = "(y/N)"
    }
    
    do {
        $response = Read-Host "$Message $prompt"
        if ([string]::IsNullOrWhiteSpace($response)) {
            return $DefaultYes
        }
        
        switch ($response.ToLower()) {
            { $_ -in @('y', 'yes') } { return $true }
            { $_ -in @('n', 'no') } { return $false }
            default {
                Write-ColorOutput "Please answer 'y' or 'n'" $ColorWarning
            }
        }
    } while ($true)
}

function Get-BackupDirectory {
    param(
        [string]$TargetDirectory
    )
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDirName = "claude-backup-$timestamp"
    $backupPath = Join-Path $TargetDirectory $backupDirName
    
    # Ensure backup directory exists
    if (-not (Test-Path $backupPath)) {
        New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
    }
    
    return $backupPath
}

function Backup-FileToFolder {
    param(
        [string]$FilePath,
        [string]$BackupFolder
    )
    
    if (-not (Test-Path $FilePath)) {
        return $false
    }
    
    try {
        $fileName = Split-Path $FilePath -Leaf
        $relativePath = ""
        
        # Try to determine relative path structure for better organization
        $fileDir = Split-Path $FilePath -Parent
        if ($fileDir -match '\.claude') {
            # Extract path relative to .claude directory
            $claudeIndex = $fileDir.LastIndexOf('.claude')
            if ($claudeIndex -ge 0) {
                $relativePath = $fileDir.Substring($claudeIndex + 7) # +7 for ".claude\"
                if ($relativePath.StartsWith('\')) {
                    $relativePath = $relativePath.Substring(1)
                }
            }
        }
        
        # Create subdirectory structure in backup if needed
        $backupSubDir = $BackupFolder
        if (-not [string]::IsNullOrEmpty($relativePath)) {
            $backupSubDir = Join-Path $BackupFolder $relativePath
            if (-not (Test-Path $backupSubDir)) {
                New-Item -ItemType Directory -Path $backupSubDir -Force | Out-Null
            }
        }
        
        $backupFilePath = Join-Path $backupSubDir $fileName
        Copy-Item -Path $FilePath -Destination $backupFilePath -Force
        
        Write-ColorOutput "Backed up: $fileName" $ColorInfo
        return $true
    } catch {
        Write-ColorOutput "WARNING: Failed to backup file $FilePath`: $($_.Exception.Message)" $ColorWarning
        return $false
    }
}

function Backup-DirectoryToFolder {
    param(
        [string]$DirectoryPath,
        [string]$BackupFolder
    )
    
    if (-not (Test-Path $DirectoryPath)) {
        return $false
    }
    
    try {
        $dirName = Split-Path $DirectoryPath -Leaf
        $backupDirPath = Join-Path $BackupFolder $dirName
        
        Copy-Item -Path $DirectoryPath -Destination $backupDirPath -Recurse -Force
        Write-ColorOutput "Backed up directory: $dirName" $ColorInfo
        return $true
    } catch {
        Write-ColorOutput "WARNING: Failed to backup directory $DirectoryPath`: $($_.Exception.Message)" $ColorWarning
        return $false
    }
}

function Copy-DirectoryRecursive {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    if (-not (Test-Path $Source)) {
        throw "Source directory does not exist: $Source"
    }
    
    # Create destination directory if it doesn't exist
    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
    
    try {
        # Copy all items recursively
        Copy-Item -Path "$Source\*" -Destination $Destination -Recurse -Force
        Write-ColorOutput "Directory copied: $Source -> $Destination" $ColorSuccess
    } catch {
        throw "Failed to copy directory: $($_.Exception.Message)"
    }
}

function Copy-FileToDestination {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description = "file",
        [string]$BackupFolder = $null
    )
    
    if (Test-Path $Destination) {
        # Use BackupAll mode for automatic backup without confirmation (default behavior)
        if ($BackupAll -and -not $NoBackup) {
            if ($BackupFolder -and (Backup-FileToFolder -FilePath $Destination -BackupFolder $BackupFolder)) {
                Write-ColorOutput "Auto-backed up: $Description" $ColorSuccess
            }
            Copy-Item -Path $Source -Destination $Destination -Force
            Write-ColorOutput "$Description updated (with backup)" $ColorSuccess
            return $true
        } elseif ($NoBackup) {
            # No backup mode - ask for confirmation
            if (Confirm-Action "$Description already exists. Replace it? (NO BACKUP)" -DefaultYes:$false) {
                Copy-Item -Path $Source -Destination $Destination -Force
                Write-ColorOutput "$Description updated (no backup)" $ColorWarning
                return $true
            } else {
                Write-ColorOutput "Skipping $Description installation" $ColorWarning
                return $false
            }
        } elseif (Confirm-Action "$Description already exists. Replace it?" -DefaultYes:$false) {
            if ($BackupFolder -and (Backup-FileToFolder -FilePath $Destination -BackupFolder $BackupFolder)) {
                Write-ColorOutput "Existing $Description backed up" $ColorSuccess
            }
            Copy-Item -Path $Source -Destination $Destination -Force
            Write-ColorOutput "$Description updated" $ColorSuccess
            return $true
        } else {
            Write-ColorOutput "Skipping $Description installation" $ColorWarning
            return $false
        }
    } else {
        # Ensure destination directory exists
        $destinationDir = Split-Path $Destination -Parent
        if (-not (Test-Path $destinationDir)) {
            New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        }
        Copy-Item -Path $Source -Destination $Destination -Force
        Write-ColorOutput "$Description installed" $ColorSuccess
        return $true
    }
}

function Merge-DirectoryContents {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description = "directory contents",
        [string]$BackupFolder = $null
    )
    
    if (-not (Test-Path $Source)) {
        Write-ColorOutput "WARNING: Source $Description not found: $Source" $ColorWarning
        return $false
    }
    
    # Create destination directory if it doesn't exist
    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        Write-ColorOutput "Created destination directory: $Destination" $ColorInfo
    }
    
    # Get all items in source directory
    $sourceItems = Get-ChildItem -Path $Source -Recurse -File
    $mergedCount = 0
    $skippedCount = 0
    
    foreach ($item in $sourceItems) {
        # Calculate relative path from source
        $relativePath = $item.FullName.Substring($Source.Length + 1)
        $destinationPath = Join-Path $Destination $relativePath
        
        # Ensure destination directory exists
        $destinationDir = Split-Path $destinationPath -Parent
        if (-not (Test-Path $destinationDir)) {
            New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        }
        
        # Handle file merging
        if (Test-Path $destinationPath) {
            $fileName = Split-Path $relativePath -Leaf
            # Use BackupAll mode for automatic backup without confirmation (default behavior)
            if ($BackupAll -and -not $NoBackup) {
                if ($BackupFolder -and (Backup-FileToFolder -FilePath $destinationPath -BackupFolder $BackupFolder)) {
                    Write-ColorOutput "Auto-backed up: $fileName" $ColorInfo
                }
                Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                $mergedCount++
            } elseif ($NoBackup) {
                # No backup mode - ask for confirmation
                if (Confirm-Action "File '$relativePath' already exists. Replace it? (NO BACKUP)" -DefaultYes:$false) {
                    Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                    $mergedCount++
                } else {
                    Write-ColorOutput "Skipped $fileName (no backup)" $ColorWarning
                    $skippedCount++
                }
            } elseif (Confirm-Action "File '$relativePath' already exists. Replace it?" -DefaultYes:$false) {
                if ($BackupFolder -and (Backup-FileToFolder -FilePath $destinationPath -BackupFolder $BackupFolder)) {
                    Write-ColorOutput "Backed up existing $fileName" $ColorInfo
                }
                Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                $mergedCount++
            } else {
                Write-ColorOutput "Skipped $fileName" $ColorWarning
                $skippedCount++
            }
        } else {
            Copy-Item -Path $item.FullName -Destination $destinationPath -Force
            $mergedCount++
        }
    }
    
    Write-ColorOutput "Merged $mergedCount files, skipped $skippedCount files" $ColorSuccess
    return $true
}

function Install-Global {
    Write-ColorOutput "Installing Claude Code Workflow System globally..." $ColorInfo
    
    # Determine user profile directory
    $userProfile = [Environment]::GetFolderPath("UserProfile")
    $globalClaudeDir = Join-Path $userProfile ".claude"
    $globalClaudeMd = Join-Path $globalClaudeDir "CLAUDE.md"
    
    Write-ColorOutput "Global installation path: $userProfile" $ColorInfo
    
    # Source paths
    $sourceDir = $PSScriptRoot
    $sourceClaudeDir = Join-Path $sourceDir ".claude"
    $sourceClaudeMd = Join-Path $sourceDir "CLAUDE.md"
    
    # Create backup folder if needed (default behavior unless NoBackup is specified)
    $backupFolder = $null
    if (-not $NoBackup) {
        if (Test-Path $globalClaudeDir) {
            $existingFiles = Get-ChildItem $globalClaudeDir -Recurse -File -ErrorAction SilentlyContinue
            if (($existingFiles -and ($existingFiles | Measure-Object).Count -gt 0)) {
                $backupFolder = Get-BackupDirectory -TargetDirectory $userProfile
                Write-ColorOutput "Backup folder created: $backupFolder" $ColorInfo
            }
        } elseif (Test-Path $globalClaudeMd) {
            # Create backup folder even if .claude directory doesn't exist but CLAUDE.md does
            $backupFolder = Get-BackupDirectory -TargetDirectory $userProfile
            Write-ColorOutput "Backup folder created: $backupFolder" $ColorInfo
        }
    }
    
    # Merge .claude directory contents (don't replace entire directory)
    Write-ColorOutput "Merging .claude directory contents..." $ColorInfo
    $claudeMerged = Merge-DirectoryContents -Source $sourceClaudeDir -Destination $globalClaudeDir -Description ".claude directory contents" -BackupFolder $backupFolder
    
    # Handle CLAUDE.md file in .claude directory
    Write-ColorOutput "Installing CLAUDE.md to global .claude directory..." $ColorInfo
    $claudeMdInstalled = Copy-FileToDestination -Source $sourceClaudeMd -Destination $globalClaudeMd -Description "CLAUDE.md" -BackupFolder $backupFolder
    
    if ($backupFolder -and (Test-Path $backupFolder)) {
        $backupFiles = Get-ChildItem $backupFolder -Recurse -File -ErrorAction SilentlyContinue
        if (-not $backupFiles -or ($backupFiles | Measure-Object).Count -eq 0) {
            # Remove empty backup folder
            Remove-Item -Path $backupFolder -Force
            Write-ColorOutput "Removed empty backup folder" $ColorInfo
        }
    }
    
    return $true
}


function Get-InstallationMode {
    Write-ColorOutput "Installation mode: Global (installing to user profile ~/.claude/)" $ColorInfo
    return "Global"
}


function Show-Summary {
    param(
        [string]$Mode,
        [string]$Path,
        [bool]$Success
    )
    
    Write-Host ""
    if ($Success) {
        Write-ColorOutput "Installation completed successfully!" $ColorSuccess
    } else {
        Write-ColorOutput "Installation completed with warnings" $ColorWarning
    }
    
    Write-ColorOutput "Installation Details:" $ColorInfo
    Write-Host "  Mode: $Mode"
    Write-Host "  Path: $Path"
    if ($NoBackup) {
        Write-Host "  Backup: Disabled (no backup created)"
    } elseif ($BackupAll) {
        Write-Host "  Backup: Enabled (automatic backup of all existing files)"
    } else {
        Write-Host "  Backup: Enabled (default behavior)"
    }
    
    Write-Host ""
    Write-ColorOutput "Next steps:" $ColorInfo
    Write-Host "1. Review CLAUDE.md - Customize guidelines for your project"
    Write-Host "2. Configure settings - Edit .claude/settings.local.json as needed"
    Write-Host "3. Start using Claude Code with Agent workflow coordination!"
    Write-Host "4. Use /workflow commands for task execution"
    Write-Host "5. Use /update_dms commands for memory system management"
    
    Write-Host ""
    Write-ColorOutput "Documentation: https://github.com/catlog22/Claude-CCW" $ColorInfo
    Write-ColorOutput "Features: Unified workflow system with comprehensive file output generation" $ColorInfo
}

function Main {
    Show-Header
    
    # Test prerequisites
    Write-ColorOutput "Checking system requirements..." $ColorInfo
    if (-not (Test-Prerequisites)) {
        Write-ColorOutput "Prerequisites check failed!" $ColorError
        return 1
    }
    
    try {
        # Get installation mode
        $mode = Get-InstallationMode
        $installPath = ""
        $success = $false
        
        $installPath = [Environment]::GetFolderPath("UserProfile")
        $success = Install-Global
        
        Show-Summary -Mode $mode -Path $installPath -Success $success
        
        # Wait for user confirmation before exit in interactive mode
        if (-not $NonInteractive) {
            Write-Host ""
            Write-ColorOutput "Installation completed. Press any key to exit..." $ColorPrompt
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        
        if ($success) {
            return 0
        } else {
            return 1
        }
        
    } catch {
        Write-ColorOutput "CRITICAL ERROR: $($_.Exception.Message)" $ColorError
        
        # Wait for user confirmation before exit in interactive mode
        if (-not $NonInteractive) {
            Write-Host ""
            Write-ColorOutput "An error occurred. Press any key to exit..." $ColorPrompt
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        
        return 1
    }
}

# Run main function
exit (Main)
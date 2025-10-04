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
    [ValidateSet("Global", "Path")]
    [string]$InstallMode = "",

    [string]$TargetPath = "",

    [switch]$Force,

    [switch]$NonInteractive,

    [switch]$BackupAll,

    [switch]$NoBackup,

    [string]$SourceVersion = "",

    [string]$SourceBranch = "",

    [string]$SourceCommit = ""
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
$ScriptVersion = "2.2.0"  # Installer script version

# Default version (will be overridden by -SourceVersion from install-remote.ps1)
$DefaultVersion = "unknown"

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

function Show-Banner {
    Write-Host ""
    # CLAUDE - Cyan color
    Write-Host '  ______   __                            __                   ' -ForegroundColor Cyan
    Write-Host ' /      \ |  \                          |  \                 ' -ForegroundColor Cyan
    Write-Host '|  $$$$$$\| $$  ______   __    __   ____| $$  ______        ' -ForegroundColor Cyan
    Write-Host '| $$   \$$| $$ |      \ |  \  |  \ /      $$ /      \       ' -ForegroundColor Cyan
    Write-Host '| $$      | $$  \$$$$$$\| $$  | $$|  $$$$$$$|  $$$$$$\      ' -ForegroundColor Cyan
    Write-Host '| $$   __ | $$ /      $$| $$  | $$| $$  | $$| $$    $$      ' -ForegroundColor Cyan
    Write-Host '| $$__/  \| $$|  $$$$$$$| $$__/ $$| $$__| $$| $$$$$$$$      ' -ForegroundColor Cyan
    Write-Host ' \$$    $$| $$ \$$    $$ \$$    $$ \$$    $$ \$$     \       ' -ForegroundColor Cyan
    Write-Host '  \$$$$$$  \$$  \$$$$$$$  \$$$$$$   \$$$$$$$  \$$$$$$$        ' -ForegroundColor Cyan
    Write-Host ""

    # CODE - Green color
    Write-Host ' ______                   __                  ' -ForegroundColor Green
    Write-Host '/      \                 |  \                ' -ForegroundColor Green
    Write-Host '|  $$$$$$\  ______    ____| $$  ______        ' -ForegroundColor Green
    Write-Host '| $$   \$$ /      \  /      $$ /      \       ' -ForegroundColor Green
    Write-Host '| $$      |  $$$$$$\|  $$$$$$$|  $$$$$$\      ' -ForegroundColor Green
    Write-Host '| $$   __ | $$  | $$| $$  | $$| $$    $$      ' -ForegroundColor Green
    Write-Host '| $$__/  \| $$__/ $$| $$__| $$| $$$$$$$$      ' -ForegroundColor Green
    Write-Host ' \$$    $$ \$$    $$ \$$    $$ \$$     \      ' -ForegroundColor Green
    Write-Host '  \$$$$$$   \$$$$$$   \$$$$$$$  \$$$$$$$       ' -ForegroundColor Green
    Write-Host ""

    # WORKFLOW - Yellow color
    Write-Host '__       __                      __         ______   __                         ' -ForegroundColor Yellow
    Write-Host '|  \  _  |  \                    |  \       /      \ |  \                        ' -ForegroundColor Yellow
    Write-Host '| $$ / \ | $$  ______    ______  | $$   __ |  $$$$$$\| $$  ______   __   __   __ ' -ForegroundColor Yellow
    Write-Host '| $$/  $\| $$ /      \  /      \ | $$  /  \| $$_  \$$| $$ /      \ |  \ |  \ |  \' -ForegroundColor Yellow
    Write-Host '| $$  $$$\ $$|  $$$$$$\|  $$$$$$\| $$_/  $$| $$ \    | $$|  $$$$$$\| $$ | $$ | $$' -ForegroundColor Yellow
    Write-Host '| $$ $$\$$\$$| $$  | $$| $$   \$$| $$   $$ | $$$$    | $$| $$  | $$| $$ | $$ | $$' -ForegroundColor Yellow
    Write-Host '| $$$$  \$$$$| $$__/ $$| $$      | $$$$$$\ | $$      | $$| $$__/ $$| $$_/ $$_/ $$' -ForegroundColor Yellow
    Write-Host '| $$$    \$$$ \$$    $$| $$      | $$  \$$\| $$      | $$ \$$    $$ \$$   $$   $$' -ForegroundColor Yellow
    Write-Host ' \$$      \$$  \$$$$$$  \$$       \$$   \$$ \$$       \$$  \$$$$$$   \$$$$$\$$$$' -ForegroundColor Yellow
    Write-Host ""
}

function Show-Header {
    param(
        [string]$InstallVersion = $DefaultVersion
    )

    Show-Banner
    Write-ColorOutput "    $ScriptName v$ScriptVersion" $ColorInfo
    if ($InstallVersion -ne "unknown") {
        Write-ColorOutput "    Installing Claude Code Workflow v$InstallVersion" $ColorInfo
    }
    Write-ColorOutput "    Unified workflow system with comprehensive coordination" $ColorInfo
    Write-ColorOutput "========================================================================" $ColorInfo
    if ($NoBackup) {
        Write-ColorOutput "WARNING: Backup disabled - existing files will be overwritten!" $ColorWarning
    } else {
        Write-ColorOutput "Auto-backup enabled - existing files will be backed up" $ColorSuccess
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
    $codexDir = Join-Path $sourceDir ".codex"
    $geminiDir = Join-Path $sourceDir ".gemini"
    $qwenDir = Join-Path $sourceDir ".qwen"

    if (-not (Test-Path $claudeDir)) {
        Write-ColorOutput "ERROR: .claude directory not found in $sourceDir" $ColorError
        return $false
    }

    if (-not (Test-Path $claudeMd)) {
        Write-ColorOutput "ERROR: CLAUDE.md file not found in $sourceDir" $ColorError
        return $false
    }

    if (-not (Test-Path $codexDir)) {
        Write-ColorOutput "ERROR: .codex directory not found in $sourceDir" $ColorError
        return $false
    }

    if (-not (Test-Path $geminiDir)) {
        Write-ColorOutput "ERROR: .gemini directory not found in $sourceDir" $ColorError
        return $false
    }

    if (-not (Test-Path $qwenDir)) {
        Write-ColorOutput "ERROR: .qwen directory not found in $sourceDir" $ColorError
        return $false
    }

    Write-ColorOutput "Prerequisites check passed" $ColorSuccess
    return $true
}

function Get-UserChoiceWithArrows {
    param(
        [string]$Prompt,
        [string[]]$Options,
        [int]$DefaultIndex = 0
    )

    if ($NonInteractive) {
        Write-ColorOutput "Non-interactive mode: Using default '$($Options[$DefaultIndex])'" $ColorInfo
        return $Options[$DefaultIndex]
    }

    # Test if we can use console features (interactive terminal)
    $canUseConsole = $true
    try {
        $null = [Console]::CursorVisible
        $null = $Host.UI.RawUI.ReadKey
    }
    catch {
        $canUseConsole = $false
    }

    # Fallback to simple numbered menu if console not available
    if (-not $canUseConsole) {
        Write-ColorOutput "Arrow navigation not available in this environment. Using numbered menu." $ColorWarning
        return Get-UserChoice -Prompt $Prompt -Options $Options -Default $Options[$DefaultIndex]
    }

    $selectedIndex = $DefaultIndex
    $cursorVisible = $true

    try {
        $cursorVisible = [Console]::CursorVisible
        [Console]::CursorVisible = $false
    }
    catch {
        # Silently continue if cursor control fails
    }

    try {
        Write-Host ""
        Write-ColorOutput $Prompt $ColorPrompt
        Write-Host ""

        while ($true) {
            # Display options
            for ($i = 0; $i -lt $Options.Count; $i++) {
                $prefix = if ($i -eq $selectedIndex) { "  > " } else { "    " }
                $color = if ($i -eq $selectedIndex) { $ColorSuccess } else { "White" }

                # Clear line and write option
                Write-Host "`r$prefix$($Options[$i])".PadRight(80) -ForegroundColor $color
            }

            Write-Host ""
            Write-Host "  Use " -NoNewline -ForegroundColor DarkGray
            Write-Host "UP/DOWN" -NoNewline -ForegroundColor Yellow
            Write-Host " arrows to navigate, " -NoNewline -ForegroundColor DarkGray
            Write-Host "ENTER" -NoNewline -ForegroundColor Yellow
            Write-Host " to select, or type " -NoNewline -ForegroundColor DarkGray
            Write-Host "1-$($Options.Count)" -NoNewline -ForegroundColor Yellow
            Write-Host "" -ForegroundColor DarkGray

            # Read key
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

            # Handle arrow keys
            if ($key.VirtualKeyCode -eq 38) {
                # Up arrow
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $Options.Count - 1 }
            }
            elseif ($key.VirtualKeyCode -eq 40) {
                # Down arrow
                $selectedIndex = if ($selectedIndex -lt ($Options.Count - 1)) { $selectedIndex + 1 } else { 0 }
            }
            elseif ($key.VirtualKeyCode -eq 13) {
                # Enter key
                Write-Host ""
                return $Options[$selectedIndex]
            }
            elseif ($key.Character -match '^\d$') {
                # Number key
                $num = [int]::Parse($key.Character)
                if ($num -ge 1 -and $num -le $Options.Count) {
                    Write-Host ""
                    return $Options[$num - 1]
                }
            }

            # Move cursor back up to redraw menu
            $linesToMove = $Options.Count + 2
            try {
                for ($i = 0; $i -lt $linesToMove; $i++) {
                    [Console]::SetCursorPosition(0, [Console]::CursorTop - 1)
                }
            }
            catch {
                # If cursor positioning fails, just continue
                break
            }
        }
    }
    finally {
        try {
            [Console]::CursorVisible = $cursorVisible
        }
        catch {
            # Silently continue if cursor control fails
        }
    }
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

function Create-VersionJson {
    param(
        [string]$TargetClaudeDir,
        [string]$InstallationMode
    )

    # Determine version from source parameter (passed from install-remote.ps1)
    $versionNumber = if ($SourceVersion) { $SourceVersion } else { $DefaultVersion }
    $sourceBranch = if ($SourceBranch) { $SourceBranch } else { "unknown" }
    $commitSha = if ($SourceCommit) { $SourceCommit } else { "unknown" }

    # Create version.json content
    $versionInfo = @{
        version = $versionNumber
        commit_sha = $commitSha
        installation_mode = $InstallationMode
        installation_path = $TargetClaudeDir
        installation_date_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        source_branch = $sourceBranch
        installer_version = $ScriptVersion
    }

    $versionJsonPath = Join-Path $TargetClaudeDir "version.json"

    try {
        $versionInfo | ConvertTo-Json | Out-File -FilePath $versionJsonPath -Encoding utf8 -Force
        Write-ColorOutput "Created version.json: $versionNumber ($commitSha) - $InstallationMode" $ColorSuccess
        return $true
    } catch {
        Write-ColorOutput "WARNING: Failed to create version.json: $($_.Exception.Message)" $ColorWarning
        return $false
    }
}

function Install-Global {
    Write-ColorOutput "Installing Claude Code Workflow System globally..." $ColorInfo

    # Determine user profile directory
    $userProfile = [Environment]::GetFolderPath("UserProfile")
    $globalClaudeDir = Join-Path $userProfile ".claude"
    $globalClaudeMd = Join-Path $globalClaudeDir "CLAUDE.md"
    $globalCodexDir = Join-Path $userProfile ".codex"
    $globalGeminiDir = Join-Path $userProfile ".gemini"
    $globalQwenDir = Join-Path $userProfile ".qwen"

    Write-ColorOutput "Global installation path: $userProfile" $ColorInfo

    # Source paths
    $sourceDir = $PSScriptRoot
    $sourceClaudeDir = Join-Path $sourceDir ".claude"
    $sourceClaudeMd = Join-Path $sourceDir "CLAUDE.md"
    $sourceCodexDir = Join-Path $sourceDir ".codex"
    $sourceGeminiDir = Join-Path $sourceDir ".gemini"
    $sourceQwenDir = Join-Path $sourceDir ".qwen"

    # Create backup folder if needed (default behavior unless NoBackup is specified)
    $backupFolder = $null
    if (-not $NoBackup) {
        if ((Test-Path $globalClaudeDir) -or (Test-Path $globalCodexDir) -or (Test-Path $globalGeminiDir) -or (Test-Path $globalQwenDir)) {
            $existingFiles = @()
            if (Test-Path $globalClaudeDir) {
                $existingFiles += Get-ChildItem $globalClaudeDir -Recurse -File -ErrorAction SilentlyContinue
            }
            if (Test-Path $globalCodexDir) {
                $existingFiles += Get-ChildItem $globalCodexDir -Recurse -File -ErrorAction SilentlyContinue
            }
            if (Test-Path $globalGeminiDir) {
                $existingFiles += Get-ChildItem $globalGeminiDir -Recurse -File -ErrorAction SilentlyContinue
            }
            if (Test-Path $globalQwenDir) {
                $existingFiles += Get-ChildItem $globalQwenDir -Recurse -File -ErrorAction SilentlyContinue
            }
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

    # Merge .codex directory contents
    Write-ColorOutput "Merging .codex directory contents..." $ColorInfo
    $codexMerged = Merge-DirectoryContents -Source $sourceCodexDir -Destination $globalCodexDir -Description ".codex directory contents" -BackupFolder $backupFolder

    # Merge .gemini directory contents
    Write-ColorOutput "Merging .gemini directory contents..." $ColorInfo
    $geminiMerged = Merge-DirectoryContents -Source $sourceGeminiDir -Destination $globalGeminiDir -Description ".gemini directory contents" -BackupFolder $backupFolder

    # Merge .qwen directory contents
    Write-ColorOutput "Merging .qwen directory contents..." $ColorInfo
    $qwenMerged = Merge-DirectoryContents -Source $sourceQwenDir -Destination $globalQwenDir -Description ".qwen directory contents" -BackupFolder $backupFolder

    # Create version.json in global .claude directory
    Write-ColorOutput "Creating version.json..." $ColorInfo
    Create-VersionJson -TargetClaudeDir $globalClaudeDir -InstallationMode "Global"

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

function Install-Path {
    param(
        [string]$TargetDirectory
    )

    Write-ColorOutput "Installing Claude Code Workflow System in hybrid mode..." $ColorInfo
    Write-ColorOutput "Local path: $TargetDirectory" $ColorInfo

    # Determine user profile directory for global files
    $userProfile = [Environment]::GetFolderPath("UserProfile")
    $globalClaudeDir = Join-Path $userProfile ".claude"

    Write-ColorOutput "Global path: $userProfile" $ColorInfo

    # Source paths
    $sourceDir = $PSScriptRoot
    $sourceClaudeDir = Join-Path $sourceDir ".claude"
    $sourceClaudeMd = Join-Path $sourceDir "CLAUDE.md"
    $sourceCodexDir = Join-Path $sourceDir ".codex"
    $sourceGeminiDir = Join-Path $sourceDir ".gemini"
    $sourceQwenDir = Join-Path $sourceDir ".qwen"

    # Local paths - for agents, commands, output-styles, .codex, .gemini, .qwen
    $localClaudeDir = Join-Path $TargetDirectory ".claude"
    $localCodexDir = Join-Path $TargetDirectory ".codex"
    $localGeminiDir = Join-Path $TargetDirectory ".gemini"
    $localQwenDir = Join-Path $TargetDirectory ".qwen"

    # Create backup folder if needed
    $backupFolder = $null
    if (-not $NoBackup) {
        if ((Test-Path $localClaudeDir) -or (Test-Path $localCodexDir) -or (Test-Path $localGeminiDir) -or (Test-Path $localQwenDir) -or (Test-Path $globalClaudeDir)) {
            $backupFolder = Get-BackupDirectory -TargetDirectory $TargetDirectory
            Write-ColorOutput "Backup folder created: $backupFolder" $ColorInfo
        }
    }

    # Create local .claude directory
    if (-not (Test-Path $localClaudeDir)) {
        New-Item -ItemType Directory -Path $localClaudeDir -Force | Out-Null
        Write-ColorOutput "Created local .claude directory" $ColorSuccess
    }

    # Local folders to install (agents, commands, output-styles)
    $localFolders = @("agents", "commands", "output-styles")

    Write-ColorOutput "Installing local components (agents, commands, output-styles)..." $ColorInfo
    foreach ($folder in $localFolders) {
        $sourceFolderPath = Join-Path $sourceClaudeDir $folder
        $destFolderPath = Join-Path $localClaudeDir $folder

        if (Test-Path $sourceFolderPath) {
            if (Test-Path $destFolderPath) {
                if ($backupFolder) {
                    Backup-DirectoryToFolder -DirectoryPath $destFolderPath -BackupFolder $backupFolder
                }
            }

            Copy-DirectoryRecursive -Source $sourceFolderPath -Destination $destFolderPath
            Write-ColorOutput "Installed local folder: $folder" $ColorSuccess
        } else {
            Write-ColorOutput "WARNING: Source folder not found: $folder" $ColorWarning
        }
    }

    # Global components - exclude local folders
    Write-ColorOutput "Installing global components to $globalClaudeDir..." $ColorInfo

    # Get all items from source, excluding local folders
    $sourceItems = Get-ChildItem -Path $sourceClaudeDir -Recurse -File | Where-Object {
        $relativePath = $_.FullName.Substring($sourceClaudeDir.Length + 1)
        $topFolder = $relativePath.Split([System.IO.Path]::DirectorySeparatorChar)[0]
        $topFolder -notin $localFolders
    }

    $mergedCount = 0
    foreach ($item in $sourceItems) {
        $relativePath = $item.FullName.Substring($sourceClaudeDir.Length + 1)
        $destinationPath = Join-Path $globalClaudeDir $relativePath

        # Ensure destination directory exists
        $destinationDir = Split-Path $destinationPath -Parent
        if (-not (Test-Path $destinationDir)) {
            New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        }

        # Handle file merging
        if (Test-Path $destinationPath) {
            if ($BackupAll -and -not $NoBackup) {
                if ($backupFolder) {
                    Backup-FileToFolder -FilePath $destinationPath -BackupFolder $backupFolder
                }
                Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                $mergedCount++
            } elseif ($NoBackup) {
                if (Confirm-Action "File '$relativePath' already exists in global location. Replace it? (NO BACKUP)" -DefaultYes:$false) {
                    Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                    $mergedCount++
                }
            } elseif (Confirm-Action "File '$relativePath' already exists in global location. Replace it?" -DefaultYes:$false) {
                if ($backupFolder) {
                    Backup-FileToFolder -FilePath $destinationPath -BackupFolder $backupFolder
                }
                Copy-Item -Path $item.FullName -Destination $destinationPath -Force
                $mergedCount++
            }
        } else {
            Copy-Item -Path $item.FullName -Destination $destinationPath -Force
            $mergedCount++
        }
    }

    Write-ColorOutput "Merged $mergedCount files to global location" $ColorSuccess

    # Handle CLAUDE.md file in global .claude directory
    $globalClaudeMd = Join-Path $globalClaudeDir "CLAUDE.md"
    Write-ColorOutput "Installing CLAUDE.md to global .claude directory..." $ColorInfo
    Copy-FileToDestination -Source $sourceClaudeMd -Destination $globalClaudeMd -Description "CLAUDE.md" -BackupFolder $backupFolder

    # Merge .codex directory contents to local location
    Write-ColorOutput "Merging .codex directory contents to local location..." $ColorInfo
    $codexMerged = Merge-DirectoryContents -Source $sourceCodexDir -Destination $localCodexDir -Description ".codex directory contents" -BackupFolder $backupFolder

    # Merge .gemini directory contents to local location
    Write-ColorOutput "Merging .gemini directory contents to local location..." $ColorInfo
    $geminiMerged = Merge-DirectoryContents -Source $sourceGeminiDir -Destination $localGeminiDir -Description ".gemini directory contents" -BackupFolder $backupFolder

    # Merge .qwen directory contents to local location
    Write-ColorOutput "Merging .qwen directory contents to local location..." $ColorInfo
    $qwenMerged = Merge-DirectoryContents -Source $sourceQwenDir -Destination $localQwenDir -Description ".qwen directory contents" -BackupFolder $backupFolder

    # Create version.json in local .claude directory
    Write-ColorOutput "Creating version.json in local directory..." $ColorInfo
    Create-VersionJson -TargetClaudeDir $localClaudeDir -InstallationMode "Path"

    # Also create version.json in global .claude directory
    Write-ColorOutput "Creating version.json in global directory..." $ColorInfo
    Create-VersionJson -TargetClaudeDir $globalClaudeDir -InstallationMode "Global"

    if ($backupFolder -and (Test-Path $backupFolder)) {
        $backupFiles = Get-ChildItem $backupFolder -Recurse -File -ErrorAction SilentlyContinue
        if (-not $backupFiles -or ($backupFiles | Measure-Object).Count -eq 0) {
            Remove-Item -Path $backupFolder -Force
            Write-ColorOutput "Removed empty backup folder" $ColorInfo
        }
    }

    return $true
}


function Get-InstallationMode {
    if ($InstallMode) {
        Write-ColorOutput "Installation mode: $InstallMode" $ColorInfo
        return $InstallMode
    }

    $modes = @(
        "Global - Install to user profile (~/.claude/)",
        "Path - Install to custom directory (partial local + global)"
    )

    Write-Host ""
    $selection = Get-UserChoiceWithArrows -Prompt "Choose installation mode:" -Options $modes -DefaultIndex 0

    if ($selection -like "Global*") {
        return "Global"
    } elseif ($selection -like "Path*") {
        return "Path"
    }

    return "Global"
}

function Get-InstallationPath {
    param(
        [string]$Mode
    )

    if ($Mode -eq "Global") {
        return [Environment]::GetFolderPath("UserProfile")
    }

    if ($TargetPath) {
        if (Test-Path $TargetPath) {
            return $TargetPath
        }
        Write-ColorOutput "WARNING: Specified target path does not exist: $TargetPath" $ColorWarning
    }

    # Interactive path selection
    do {
        Write-Host ""
        Write-ColorOutput "Enter the target directory path for installation:" $ColorPrompt
        Write-ColorOutput "(This will install agents, commands, output-styles locally, other files globally)" $ColorInfo
        $path = Read-Host "Path"

        if ([string]::IsNullOrWhiteSpace($path)) {
            Write-ColorOutput "Path cannot be empty" $ColorWarning
            continue
        }

        # Expand environment variables and relative paths
        $expandedPath = [System.Environment]::ExpandEnvironmentVariables($path)
        $expandedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($expandedPath)

        if (Test-Path $expandedPath) {
            return $expandedPath
        }

        Write-ColorOutput "Path does not exist: $expandedPath" $ColorWarning
        if (Confirm-Action "Create this directory?" -DefaultYes) {
            try {
                New-Item -ItemType Directory -Path $expandedPath -Force | Out-Null
                Write-ColorOutput "Directory created successfully" $ColorSuccess
                return $expandedPath
            } catch {
                Write-ColorOutput "Failed to create directory: $($_.Exception.Message)" $ColorError
            }
        }
    } while ($true)
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

    if ($Mode -eq "Path") {
        Write-Host "  Local Path: $Path"
        Write-Host "  Global Path: $([Environment]::GetFolderPath('UserProfile'))"
        Write-Host "  Local Components: agents, commands, output-styles, .codex, .gemini, .qwen"
        Write-Host "  Global Components: workflows, scripts, python_script, etc."
    } else {
        Write-Host "  Path: $Path"
        Write-Host "  Global Components: .claude, .codex, .gemini, .qwen"
    }

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
    Write-Host "2. Review .codex/Agent.md - Codex agent execution protocol"
    Write-Host "3. Review .gemini/CLAUDE.md - Gemini agent execution protocol"
    Write-Host "4. Review .qwen/QWEN.md - Qwen agent execution protocol"
    Write-Host "5. Configure settings - Edit .claude/settings.local.json as needed"
    Write-Host "6. Start using Claude Code with Agent workflow coordination!"
    Write-Host "7. Use /workflow commands for task execution"
    Write-Host "8. Use /update-memory commands for memory system management"

    Write-Host ""
    Write-ColorOutput "Documentation: https://github.com/catlog22/Claude-CCW" $ColorInfo
    Write-ColorOutput "Features: Unified workflow system with comprehensive file output generation" $ColorInfo
}

function Main {
    # Use SourceVersion parameter if provided, otherwise use default
    $installVersion = if ($SourceVersion) { $SourceVersion } else { $DefaultVersion }

    Show-Header -InstallVersion $installVersion

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

        if ($mode -eq "Global") {
            $installPath = [Environment]::GetFolderPath("UserProfile")
            $result = Install-Global
            $success = $result -eq $true
        }
        elseif ($mode -eq "Path") {
            $installPath = Get-InstallationPath -Mode $mode
            $result = Install-Path -TargetDirectory $installPath
            $success = $result -eq $true
        }

        Show-Summary -Mode $mode -Path $installPath -Success ([bool]$success)

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
        Write-ColorOutput "Stack trace: $($_.ScriptStackTrace)" $ColorError

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
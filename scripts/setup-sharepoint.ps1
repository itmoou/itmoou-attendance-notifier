# SharePoint Folder Setup Script
# Encoding: UTF-8 with BOM

$SiteUrl = "https://itmoou.sharepoint.com/sites/itmoou-groupware"
$DocumentLibrary = "Shared Documents"

Write-Host "SharePoint Folder Setup Starting..." -ForegroundColor Cyan

# Check PnP PowerShell module
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "Installing PnP.PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name PnP.PowerShell -Force -AllowClobber -Scope CurrentUser
}

# Connect to SharePoint
Write-Host "Connecting to SharePoint..." -ForegroundColor Yellow
Write-Host "Please login in the browser window." -ForegroundColor Cyan

try {
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Host "Connected successfully!" -ForegroundColor Green
} catch {
    Write-Host "Connection failed: $_" -ForegroundColor Red
    exit 1
}

# Folder structure
$folders = @(
    "attendance_reports",
    "attendance_reports/2025",
    "attendance_reports/2025/01",
    "attendance_reports/2025/02",
    "vacation_status",
    "vacation_status/2025",
    "monthly_summary",
    "monthly_summary/2025",
    "employee_documents"
)

Write-Host "Creating folders..." -ForegroundColor Yellow

$created = 0
$skipped = 0

foreach ($folder in $folders) {
    try {
        $existing = Get-PnPFolder -Url "$DocumentLibrary/$folder" -ErrorAction SilentlyContinue

        if ($null -eq $existing) {
            Add-PnPFolder -Name $folder -Folder $DocumentLibrary | Out-Null
            Write-Host "Created: $folder" -ForegroundColor Green
            $created++
        } else {
            Write-Host "Already exists: $folder" -ForegroundColor Gray
            $skipped++
        }
    } catch {
        Write-Host "Failed: $folder - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Complete!" -ForegroundColor Green
Write-Host "Created: $created folders" -ForegroundColor Green
Write-Host "Skipped: $skipped folders" -ForegroundColor Yellow
Write-Host ""
Write-Host "Site URL: $SiteUrl" -ForegroundColor Cyan

Disconnect-PnPOnline

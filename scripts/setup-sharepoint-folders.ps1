# SharePoint 폴더 구조 자동 생성 스크립트
# ITMOOU 그룹웨어 문서 관리 시스템

# SharePoint 사이트 정보
$SiteUrl = "https://itmoou.sharepoint.com/sites/itmoou-groupware"
$DocumentLibrary = "Shared Documents"  # 기본 문서 라이브러리

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SharePoint 폴더 구조 자동 생성" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# PnP PowerShell 모듈 설치 확인
Write-Host "1. PnP PowerShell 모듈 확인 중..." -ForegroundColor Yellow
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "   PnP.PowerShell 모듈을 설치합니다..." -ForegroundColor Yellow
    Install-Module -Name PnP.PowerShell -Force -AllowClobber -Scope CurrentUser
    Write-Host "   ✓ 설치 완료!" -ForegroundColor Green
} else {
    Write-Host "   ✓ 이미 설치되어 있습니다." -ForegroundColor Green
}

Write-Host ""
Write-Host "2. SharePoint에 연결 중..." -ForegroundColor Yellow
Write-Host "   브라우저 창이 열리면 Microsoft 계정으로 로그인하세요." -ForegroundColor Cyan

try {
    # SharePoint 연결 (브라우저 인증)
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Host "   ✓ 연결 성공!" -ForegroundColor Green
} catch {
    Write-Host "   ✗ 연결 실패: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. 폴더 구조 생성 중..." -ForegroundColor Yellow

# 생성할 폴더 구조
$folders = @(
    "근태_리포트",
    "근태_리포트/2025",
    "근태_리포트/2025/01월",
    "근태_리포트/2025/02월",
    "근태_리포트/2025/03월",
    "근태_리포트/2025/04월",
    "근태_리포트/2025/05월",
    "근태_리포트/2025/06월",
    "근태_리포트/2025/07월",
    "근태_리포트/2025/08월",
    "근태_리포트/2025/09월",
    "근태_리포트/2025/10월",
    "근태_리포트/2025/11월",
    "근태_리포트/2025/12월",
    "근태_리포트/2024",
    "휴가_현황",
    "휴가_현황/2025",
    "휴가_현황/2025/01월",
    "휴가_현황/2025/02월",
    "휴가_현황/2025/03월",
    "휴가_현황/2025/04월",
    "휴가_현황/2025/05월",
    "휴가_현황/2025/06월",
    "휴가_현황/2025/07월",
    "휴가_현황/2025/08월",
    "휴가_현황/2025/09월",
    "휴가_현황/2025/10월",
    "휴가_현황/2025/11월",
    "휴가_현황/2025/12월",
    "휴가_현황/2024",
    "월간_요약",
    "월간_요약/2025",
    "월간_요약/2024",
    "직원별_문서"
)

$createdCount = 0
$skippedCount = 0

foreach ($folder in $folders) {
    try {
        # 폴더가 이미 존재하는지 확인
        $existingFolder = Get-PnPFolder -Url "$DocumentLibrary/$folder" -ErrorAction SilentlyContinue

        if ($null -eq $existingFolder) {
            # 폴더 생성
            Add-PnPFolder -Name $folder -Folder $DocumentLibrary | Out-Null
            Write-Host "   ✓ 생성: $folder" -ForegroundColor Green
            $createdCount++
        } else {
            Write-Host "   ○ 이미 존재: $folder" -ForegroundColor Gray
            $skippedCount++
        }
    } catch {
        Write-Host "   ✗ 실패: $folder - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "생성된 폴더: $createdCount 개" -ForegroundColor Green
Write-Host "이미 존재: $skippedCount 개" -ForegroundColor Yellow
Write-Host ""
Write-Host "SharePoint 사이트 URL:" -ForegroundColor Cyan
Write-Host "$SiteUrl" -ForegroundColor White
Write-Host ""
Write-Host "이제 문서 라이브러리를 확인해보세요!" -ForegroundColor Cyan

# 연결 해제
Disconnect-PnPOnline

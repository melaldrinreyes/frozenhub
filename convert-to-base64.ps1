# Firebase Service Account to Base64 Converter
Write-Host "Firebase Service Account to Base64 Converter" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Get the JSON file path
$jsonFile = Read-Host "Enter the path to your firebase service account JSON file (or drag and drop it here)"

# Remove quotes if user dragged and dropped
$jsonFile = $jsonFile.Trim("`"")

# Check if file exists
if (-not (Test-Path $jsonFile)) {
    Write-Host "ERROR: File not found at: $jsonFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure you:" -ForegroundColor Yellow
    Write-Host "1. Downloaded the JSON file from Firebase Console" -ForegroundColor Yellow
    Write-Host "2. Entered the correct file path" -ForegroundColor Yellow
    Write-Host "3. Or drag and drop the file into this window" -ForegroundColor Yellow
    pause
    exit
}

Write-Host "File found!" -ForegroundColor Green
Write-Host ""

# Read the JSON file
try {
    $content = Get-Content -Path $jsonFile -Raw
    
    # Convert to base64
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $base64 = [System.Convert]::ToBase64String($bytes)
    
    # Copy to clipboard
    $base64 | Set-Clipboard
    
    Write-Host "SUCCESS! Base64 string copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open your .env file" -ForegroundColor White
    Write-Host "2. Add this line:" -ForegroundColor White
    Write-Host "   FIREBASE_SERVICE_ACCOUNT_KEY=<paste-the-base64-here>" -ForegroundColor Yellow
    Write-Host "3. Save the .env file" -ForegroundColor White
    Write-Host ""
    Write-Host "The base64 string is now in your clipboard - just paste it!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
catch {
    Write-Host "ERROR converting file: $_" -ForegroundColor Red
    pause
}

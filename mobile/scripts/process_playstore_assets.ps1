# Script to generate exact Play Store and Expo assets using .NET System.Drawing
Add-Type -AssemblyName System.Drawing

$brainDir = "C:\Users\john\.gemini\antigravity-ide\brain\8c99542d-d4b3-4a32-a719-3d4f6614bb07"
$iconSource = Join-Path $brainDir "privadin_icon_clean_1789251588920.jpg"
$featureBannerSource = Join-Path $brainDir "privadin_feature_banner_1789251611230.jpg"
$screenTimerSource = Join-Path $brainDir "playstore_screen_timer_1789251707155.jpg"
$screenRankingSource = Join-Path $brainDir "playstore_screen_ranking_1789251734719.jpg"
$screenPoopcoinsSource = Join-Path $brainDir "playstore_screen_poopcoins_1789251765074.jpg"
$screenLojaSource = Join-Path $brainDir "playstore_screen_loja_1789251797978.jpg"

$assetsDir = "c:\Users\john\Documents\Projetos\PrivadIn\mobile\assets"
$playstoreDir = Join-Path $assetsDir "playstore"

if (-not (Test-Path $playstoreDir)) {
    New-Item -ItemType Directory -Path $playstoreDir -Force | Out-Null
}

function Resize-And-Save($sourceFile, $targetFile, [int]$width, [int]$height) {
    Write-Output "Processing $targetFile ($width x $height)..."
    $srcImg = [System.Drawing.Image]::FromFile($sourceFile)
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($srcImg, 0, 0, $width, $height)
    
    $graphics.Dispose()
    $srcImg.Dispose()
    
    $destBmp.Save($targetFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved: $targetFile"
}

function Create-Adaptive-Foreground($sourceFile, $targetFile, [int]$size) {
    Write-Output "Processing Adaptive Foreground $targetFile ($size x $size)..."
    $srcImg = [System.Drawing.Image]::FromFile($sourceFile)
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    # Android adaptive icon safe zone is the central ~72%
    $innerSize = [int]($size * 0.72)
    $offset = [int](($size - $innerSize) / 2)
    
    $graphics.DrawImage($srcImg, $offset, $offset, $innerSize, $innerSize)
    
    $graphics.Dispose()
    $srcImg.Dispose()
    
    $destBmp.Save($targetFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved: $targetFile"
}

function Create-Solid-Color($targetFile, [int]$width, [int]$height, $hexColor) {
    Write-Output "Processing Solid Color $targetFile ($width x $height)..."
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    $color = [System.Drawing.ColorTranslator]::FromHtml($hexColor)
    $graphics.Clear($color)
    $graphics.Dispose()
    $destBmp.Save($targetFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved: $targetFile"
}

# 1. Google Play Store Assets (Play Console Requirements)
Resize-And-Save $iconSource (Join-Path $playstoreDir "playstore_icon_512x512.png") 512 512
Resize-And-Save $featureBannerSource (Join-Path $playstoreDir "playstore_feature_graphic_1024x500.png") 1024 500
Resize-And-Save $screenTimerSource (Join-Path $playstoreDir "screenshot_1_trono_1080x2400.png") 1080 2400
Resize-And-Save $screenRankingSource (Join-Path $playstoreDir "screenshot_2_ranking_1080x2400.png") 1080 2400
Resize-And-Save $screenPoopcoinsSource (Join-Path $playstoreDir "screenshot_3_poopcoins_1080x2400.png") 1080 2400
Resize-And-Save $screenLojaSource (Join-Path $playstoreDir "screenshot_4_loja_1080x2400.png") 1080 2400

# 2. Mobile App Build Assets (Expo / Android EAS Build)
Resize-And-Save $iconSource (Join-Path $assetsDir "icon.png") 1024 1024
Create-Adaptive-Foreground $iconSource (Join-Path $assetsDir "android-icon-foreground.png") 1024
Create-Solid-Color (Join-Path $assetsDir "android-icon-background.png") 1024 1024 "#020617"
Resize-And-Save $iconSource (Join-Path $assetsDir "splash-icon.png") 1024 1024
Resize-And-Save $iconSource (Join-Path $assetsDir "favicon.png") 48 48

Write-Output "=== ALL PLAY STORE AND APP ASSETS GENERATED SUCCESSFULLY! ==="

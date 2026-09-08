Add-Type -AssemblyName System.Drawing

function Resize-SquareImage($srcPath, $dstPath, $size) {
    $src = [System.Drawing.Bitmap]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $ratioX = $size / $src.Width
    $ratioY = $size / $src.Height
    $ratio = [Math]::Min($ratioX, $ratioY)
    $newWidth = [int]($src.Width * $ratio)
    $newHeight = [int]($src.Height * $ratio)
    $posX = [int](($size - $newWidth) / 2)
    $posY = [int](($size - $newHeight) / 2)

    $graphics.DrawImage($src, $posX, $posY, $newWidth, $newHeight)
    $graphics.Dispose()
    $src.Dispose()

    $dir = [System.IO.Path]::GetDirectoryName($dstPath)
    if (-not (Test-Path $dir)) { [System.IO.Directory]::CreateDirectory($dir) | Out-Null }

    $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$logo = "C:\Users\saim_\Downloads\ssmart-pos-main\ssmart-pos-main\src\assets\ss_mart_logo.png"
$assets = "C:\Users\saim_\Downloads\ssmart-pos-main\ssmart-pos-main\assets"
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets | Out-Null }

Resize-SquareImage $logo (Join-Path $assets "icon.png") 512
Resize-SquareImage $logo (Join-Path $assets "icon-256.png") 256
Resize-SquareImage $logo (Join-Path $assets "icon-128.png") 128
Resize-SquareImage $logo (Join-Path $assets "icon-64.png") 64
Resize-SquareImage $logo (Join-Path $assets "icon-48.png") 48
Resize-SquareImage $logo (Join-Path $assets "icon-32.png") 32
Resize-SquareImage $logo (Join-Path $assets "icon-16.png") 16
Write-Host "Desktop PNG icons generated successfully."

# Also generate iOS AppIcon assets for flutter_admin_app and flutter_admin_app_iphone7
$iosSizes = @(
    @{ name = "Icon-App-20x20@1x.png"; size = 20 },
    @{ name = "Icon-App-20x20@2x.png"; size = 40 },
    @{ name = "Icon-App-20x20@3x.png"; size = 60 },
    @{ name = "Icon-App-29x29@1x.png"; size = 29 },
    @{ name = "Icon-App-29x29@2x.png"; size = 58 },
    @{ name = "Icon-App-29x29@3x.png"; size = 87 },
    @{ name = "Icon-App-40x40@1x.png"; size = 40 },
    @{ name = "Icon-App-40x40@2x.png"; size = 80 },
    @{ name = "Icon-App-40x40@3x.png"; size = 120 },
    @{ name = "Icon-App-60x60@2x.png"; size = 120 },
    @{ name = "Icon-App-60x60@3x.png"; size = 180 },
    @{ name = "Icon-App-76x76@1x.png"; size = 76 },
    @{ name = "Icon-App-76x76@2x.png"; size = 152 },
    @{ name = "Icon-App-83.5x83.5@2x.png"; size = 167 },
    @{ name = "Icon-App-1024x1024@1x.png"; size = 1024 }
)

$iosAppIconSet1 = "C:\Users\saim_\Downloads\ssmart-pos-main\ssmart-pos-main\flutter_admin_app\ios\Runner\Assets.xcassets\AppIcon.appiconset"
$iosAppIconSet2 = "C:\Users\saim_\Downloads\ssmart-pos-main\ssmart-pos-main\flutter_admin_app_iphone7\ios\Runner\Assets.xcassets\AppIcon.appiconset"

foreach ($item in $iosSizes) {
    $out1 = Join-Path $iosAppIconSet1 $item.name
    $out2 = Join-Path $iosAppIconSet2 $item.name
    Resize-SquareImage $logo $out1 $item.size
    Resize-SquareImage $logo $out2 $item.size
}
Write-Host "iOS AppIcon assets generated successfully."

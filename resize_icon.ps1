
Add-Type -AssemblyName System.Drawing
$SourceFile = "c:\Users\Nishant\Desktop\Hackrust\EdgePay\assets\EdgePay_Icon.png"
$BaseDir = "c:\Users\Nishant\Desktop\Hackrust\EdgePay\android\app\src\main\res"

$Sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$Image = [System.Drawing.Image]::FromFile($SourceFile)

foreach ($Dir in $Sizes.Keys) {
    $Width = $Sizes[$Dir]
    $Height = $Width
    $DestPath = Join-Path $BaseDir $Dir
    if (-not (Test-Path $DestPath)) {
        New-Item -ItemType Directory -Path $DestPath
    }
    
    $Bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.DrawImage($Image, 0, 0, $Width, $Height)
    
    $SavePath = Join-Path $DestPath "ic_launcher.png"
    $SavePathRound = Join-Path $DestPath "ic_launcher_round.png"
    
    $Bitmap.Save($SavePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $Bitmap.Save($SavePathRound, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $Graphics.Dispose()
    $Bitmap.Dispose()
    Write-Host "Created icons for $Dir using $SourceFile"
}

$Image.Dispose()

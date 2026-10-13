Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

function Export-PwaIcon {
    param(
        [int]$size,
        [double]$scaleRatio,
        [string]$outputPath,
        [bool]$hasBackground = $true
    )

    $dv = New-Object System.Windows.Media.DrawingVisual
    $dc = $dv.RenderOpen()

    if ($hasBackground) {
        $bgBrush = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(12, 16, 28))
        $dc.DrawRectangle($bgBrush, $null, (New-Object System.Windows.Rect(0, 0, $size, $size)))
    }

    $pathData = "M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
    $geom = ([System.Windows.Media.Geometry]::Parse($pathData)).Clone()

    $bounds = $geom.Bounds
    $targetDim = $size * $scaleRatio
    $scale = $targetDim / [Math]::Max($bounds.Width, $bounds.Height)

    $transX = (($size - ($bounds.Width * $scale)) / 2.0) - ($bounds.X * $scale)
    $transY = (($size - ($bounds.Height * $scale)) / 2.0) - ($bounds.Y * $scale)

    $tg = New-Object System.Windows.Media.TransformGroup
    $tg.Children.Add((New-Object System.Windows.Media.ScaleTransform($scale, $scale)))
    $tg.Children.Add((New-Object System.Windows.Media.TranslateTransform($transX, $transY)))
    $geom.Transform = $tg

    $gradBrush = New-Object System.Windows.Media.LinearGradientBrush(
        [System.Windows.Media.Color]::FromRgb(134, 59, 255),
        [System.Windows.Media.Color]::FromRgb(71, 191, 255),
        (New-Object System.Windows.Point(0, 0)),
        (New-Object System.Windows.Point(1, 1))
    )

    $dc.DrawGeometry($gradBrush, $null, $geom)
    $dc.Close()

    $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($size, $size, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
    $rtb.Render($dv)

    $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))

    $fs = [System.IO.File]::Create($outputPath)
    $enc.Save($fs)
    $fs.Close()
    Write-Host "Created $outputPath ($size x $size)"
}

$destDir = "C:\Users\disha\Desktop\ClassMate\public"
Export-PwaIcon -size 192 -scaleRatio 0.68 -outputPath "$destDir\pwa-192x192.png" -hasBackground $true
Export-PwaIcon -size 512 -scaleRatio 0.68 -outputPath "$destDir\pwa-512x512.png" -hasBackground $true
Export-PwaIcon -size 512 -scaleRatio 0.52 -outputPath "$destDir\maskable-icon-512x512.png" -hasBackground $true
Export-PwaIcon -size 180 -scaleRatio 0.68 -outputPath "$destDir\apple-touch-icon.png" -hasBackground $true

# Run on an interactive Windows desktop: powershell -NoProfile -File ./native-ocr.test.ps1
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$fixture=New-Object System.Windows.Forms.Form
$fixture.Text='Voicela OCR test'; $fixture.ClientSize=New-Object System.Drawing.Size(800,400)
$fixture.BackColor=[System.Drawing.Color]::White
$label=New-Object System.Windows.Forms.Label
$label.Text='Local OCR verification 2468'; $label.Font=New-Object System.Drawing.Font('Arial',28)
$label.Location=New-Object System.Drawing.Point(30,100); $label.Size=New-Object System.Drawing.Size(740,80)
$fixture.Controls.Add($label)
$outside=New-Object System.Windows.Forms.Label
$outside.Text='Outside region 9876'; $outside.Font=$label.Font
$outside.Location=New-Object System.Drawing.Point(30,280); $outside.Size=$label.Size
$fixture.Controls.Add($outside)
$inputBox=New-Object System.Windows.Forms.TextBox
$inputBox.Location=New-Object System.Drawing.Point(30,350); $inputBox.Width=600
$inputBox.Text='Sensitive editable content'; $inputBox.Visible=$false; $fixture.Controls.Add($inputBox)
$helper=Join-Path $PSScriptRoot '../../../src-tauri/src/context_ocr.ps1'
$script=[IO.File]::ReadAllText((Resolve-Path $helper))
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
function Capture-Test($region,$expectedError) {
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $info.Arguments='-NoProfile -NonInteractive -EncodedCommand '+$encoded
 $info.UseShellExecute=$false; $info.CreateNoWindow=$true
 $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
 $info.StandardOutputEncoding=New-Object Text.UTF8Encoding($false)
 $info.EnvironmentVariables['VOICELA_CAPTURE']=(@{binding=('{0}:{1}:{2}' -f $fixture.Handle.ToInt64(),$PID,$fixture.Text);region=$region}|ConvertTo-Json -Compress)
 $process=[Diagnostics.Process]::Start($info)
 $timer=[Diagnostics.Stopwatch]::StartNew()
 while(!$process.HasExited) {
  [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 20
  if($timer.Elapsed.TotalSeconds -gt 25) { $process.Kill(); throw 'OCR timed out' }
 }
 $output=$process.StandardOutput.ReadToEnd(); $failure=$process.StandardError.ReadToEnd()
 if($expectedError) {
  if($process.ExitCode -eq 0 -or $failure -notmatch $expectedError) { throw "Expected privacy rejection: $failure $output" }
  return
 }
 if($process.ExitCode -ne 0) { throw $failure }
 return ($output|ConvertFrom-Json)
}
try {
 $fixture.Show(); $fixture.Update(); [System.Windows.Forms.Application]::DoEvents()
 $text=Capture-Test $null $null
 if($text -notmatch '2468' -or $text -notmatch '9876') { throw "Window OCR missing fixture text: $text" }
 Write-Host 'PASS: whole-window local OCR'
 $area=@{x=0;y=95;width=790;height=160}
 $text=Capture-Test $area $null
 if($text -notmatch '2468' -or $text -match '9876') { throw "Region escaped or missed text: $text" }
 Write-Host 'PASS: cropped region excludes outside pixels'
 $overlay=New-Object System.Windows.Forms.Form
 $overlay.Text='Obscuring window'; $overlay.StartPosition='Manual'; $overlay.Location=$fixture.Location; $overlay.Size=$fixture.Size
 try {
  $overlay.Show(); $overlay.Update(); [System.Windows.Forms.Application]::DoEvents()
  Capture-Test $area 'obscured'
  Write-Host 'PASS: obscured capture is refused'
 } finally { $overlay.Close(); $overlay.Dispose() }
 $inputBox.Visible=$true; $fixture.Update(); [System.Windows.Forms.Application]::DoEvents()
 Capture-Test $null 'Editable field'
 Write-Host 'PASS: editable field prevents whole-window pixels'
 $text=Capture-Test $area $null
 if($text -match 'Sensitive|editable') { throw 'Editable field leaked into cropped region' }
 Write-Host 'PASS: region outside editable field remains usable'
 $inputBox.UseSystemPasswordChar=$true; $fixture.Update(); [System.Windows.Forms.Application]::DoEvents()
 Capture-Test $area 'Password control'
 Write-Host 'PASS: password control refuses pixel capture'
} finally { $fixture.Close(); $fixture.Dispose() }

# Embedded local helper. No pixels or OCR text are written to disk or sent over a network.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms, UIAutomationClient, UIAutomationTypes, WindowsBase, System.Runtime.WindowsRuntime
$refs = @([System.Drawing.Bitmap].Assembly.Location, [System.Windows.Automation.AutomationElement].Assembly.Location, [System.Windows.Automation.ControlType].Assembly.Location, [System.Windows.Rect].Assembly.Location)
Add-Type -ReferencedAssemblies $refs -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Automation;
public static class ContextPixels {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
 [DllImport("user32.dll")] static extern IntPtr GetWindowDC(IntPtr h);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
 [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dst,int dx,int dy,int w,int h,IntPtr src,int x,int y,uint op);
 delegate bool EnumProc(IntPtr h,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr data);
 static void Unobscured(IntPtr target,Rectangle area) {
   bool found=false,blocked=false;
   EnumWindows(delegate(IntPtr h,IntPtr data) {
     if(h==target) { found=true; return false; }
     RECT r;
     if(IsWindowVisible(h)&&!IsIconic(h)&&GetWindowRect(h,out r)&&area.IntersectsWith(Rectangle.FromLTRB(r.L,r.T,r.R,r.B))) { blocked=true; return false; }
     return true;
   },IntPtr.Zero);
   if(blocked||!found) throw new Exception("Capture area is obscured by another window. Uncover it and retry.");
 }
 public static RECT Verify(IntPtr h, uint pid, string title) {
   if(SetThreadDpiAwarenessContext(new IntPtr(-4))==IntPtr.Zero) throw new Exception("Cannot verify physical pixel coordinates.");
   uint actual; GetWindowThreadProcessId(h, out actual);
   var s = new System.Text.StringBuilder(1024); GetWindowText(h,s,1024);
   RECT r;
   if(actual!=pid || s.ToString()!=title || !IsWindowVisible(h) || IsIconic(h) || !GetWindowRect(h,out r)) throw new Exception("Window changed, hidden or minimized. Select it again.");
   return r;
 }
 public static void Safe(IntPtr h, Rectangle area) {
   var root=AutomationElement.FromHandle(h);
   if(root==null) throw new Exception("Accessibility unavailable; cannot verify sensitive fields.");
   var queue=new System.Collections.Generic.Queue<AutomationElement>(); queue.Enqueue(root);
   int count=0;
   while(queue.Count>0) {
     if(++count>2000) throw new Exception("Window too complex to verify safely. Choose another window.");
     var e=queue.Dequeue(); var c=e.Current;
     if(c.IsOffscreen) continue;
     // Do not descend into or read names from password/edit controls.
     if(c.IsPassword) throw new Exception("Password control present; pixel capture refused.");
     var b=c.BoundingRectangle;
     bool intersects=!b.IsEmpty && b.Right>area.Left && b.Left<area.Right && b.Bottom>area.Top && b.Top<area.Bottom;
     if(intersects) {
       object pattern;
       if(c.ControlType==ControlType.Edit || (e.TryGetCurrentPattern(ValuePattern.Pattern,out pattern) && !((ValuePattern)pattern).Current.IsReadOnly)) throw new Exception("Editable field in capture area. Choose a region without inputs.");
       var name=(c.Name??"").ToLowerInvariant();
       foreach(var word in new[]{"password","passcode","credit card","card number","security code","secret key","api key","recovery phrase","verification code","one-time code"})
         if(name.Contains(word)) throw new Exception("Sensitive control in capture area. Choose a different window.");
     }
     var child=TreeWalker.RawViewWalker.GetFirstChild(e);
     while(child!=null) {
       if(queue.Count+count>=2000) throw new Exception("Accessibility traversal incomplete; capture refused.");
       queue.Enqueue(child); child=TreeWalker.RawViewWalker.GetNextSibling(child);
     }
   }
 }
 public static Bitmap Capture(IntPtr h,uint pid,string title,int x,int y,int width,int height) {
   var r=Verify(h,pid,title);
   if(width==0 && height==0) { width=r.R-r.L; height=r.B-r.T; }
   if(x<0||y<0||width<1||height<1||width>4096||height>4096||x+width>r.R-r.L||y+height>r.B-r.T) throw new Exception("Region must be inside this window, at most 4096 pixels per side.");
   var area=new Rectangle(r.L+x,r.T+y,width,height); Safe(h,area);
   Verify(h,pid,title); // UIA may change the thread DPI context; restore physical pixels.
   Unobscured(h,area);
   var bitmap=new Bitmap(width,height,PixelFormat.Format32bppArgb);
   try {
     // Rectangle-only read: pixels outside the approved area are never stored.
     using(var g=Graphics.FromImage(bitmap)) {
       var dc=g.GetHdc(); var source=GetWindowDC(h);
       try { if(source==IntPtr.Zero||!BitBlt(dc,0,0,width,height,source,x,y,0x00CC0020)) throw new Exception("Application does not support safe window capture."); }
       finally { if(source!=IntPtr.Zero) ReleaseDC(h,source); g.ReleaseHdc(dc); }
     }
     var after=Verify(h,pid,title);
     if(after.L!=r.L||after.T!=r.T||after.R!=r.R||after.B!=r.B) throw new Exception("Window moved during capture; discarded.");
     Unobscured(h,area); Safe(h,area); return bitmap;
   } catch { bitmap.Dispose(); throw; }
 }
}
"@
function Await-Result($operation, $resultType) {
 $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1 } | Select-Object -First 1
 $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
 $task.GetAwaiter().GetResult()
}
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataWriter, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$indicator=$null; $bitmap=$null; $memory=$null; $stream=$null; $writer=$null; $software=$null
try {
 $request=$env:VOICELA_CAPTURE | ConvertFrom-Json
 $parts=$request.binding -split ':',3
 $window=[IntPtr][long]::Parse($parts[0]); $processId=[uint32]::Parse($parts[1]); $title=$parts[2]
 $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
 if($null -eq $engine) { throw 'No local Windows OCR language is installed. Install a Windows language OCR pack.' }
 $indicator=New-Object System.Windows.Forms.Form
 $indicator.Text='Voicela screen capture'; $indicator.TopMost=$true; $indicator.ShowInTaskbar=$true
 $indicator.FormBorderStyle='None'; $indicator.StartPosition='Manual'
 $screen=[System.Windows.Forms.Screen]::FromHandle($window)
 $indicator.Location=New-Object System.Drawing.Point(($screen.Bounds.Right-360),($screen.Bounds.Bottom-30))
 $indicator.ClientSize=New-Object System.Drawing.Size(360,30)
 $label=New-Object System.Windows.Forms.Label
 $label.Text='Voicela is capturing this window locally'; $label.Dock='Fill'; $label.TextAlign='MiddleCenter'
 $indicator.Controls.Add($label); $indicator.Show(); $indicator.Update()
 [System.Windows.Forms.Application]::DoEvents()
 if(!$indicator.Visible) { throw 'Visible capture indicator is required.' }
 $x=0; $y=0; $w=0; $h=0
 if($null -ne $request.region) { $x=[int]$request.region.x; $y=[int]$request.region.y; $w=[int]$request.region.width; $h=[int]$request.region.height }
 $bitmap=[ContextPixels]::Capture($window,$processId,$title,$x,$y,$w,$h)
 if($bitmap.Width -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -or $bitmap.Height -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) { throw 'Selected region exceeds Windows OCR image limit.' }
 $memory=New-Object System.IO.MemoryStream
 $bitmap.Save($memory,[System.Drawing.Imaging.ImageFormat]::Png)
 $stream=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
 $writer=New-Object Windows.Storage.Streams.DataWriter($stream)
 $writer.WriteBytes($memory.ToArray())
 $null=Await-Result ($writer.StoreAsync()) ([uint32]); $stream.Seek(0)
 $decoder=Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $software=Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $result=Await-Result ($engine.RecognizeAsync($software)) ([Windows.Media.Ocr.OcrResult])
 $null=[ContextPixels]::Verify($window,$processId,$title)
 $text=[string]$result.Text
 if($text.Length -gt 24000) { $text=$text.Substring(0,24000) }
 [Console]::Out.WriteLine((ConvertTo-Json -InputObject $text -Compress))
} catch {
 [Console]::Error.WriteLine($_.Exception.Message); exit 1
} finally {
 if($software){$software.Dispose()}; if($writer){$null=$writer.DetachStream();$writer.Dispose()}; if($stream){$stream.Dispose()}
 if($memory){$memory.Dispose()}; if($bitmap){$bitmap.Dispose()}; if($indicator){$indicator.Close();$indicator.Dispose()}
}

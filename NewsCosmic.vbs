Option Explicit

Dim shell
Set shell = CreateObject("WScript.Shell")

If WScript.Arguments.Count = 0 Then
  Install
ElseIf WScript.Arguments(0) = "--check" Then
  Check
Else
  Fill WScript.Arguments(0)
End If

Sub Install
  Dim fso, dir, dest
  Set fso = CreateObject("Scripting.FileSystemObject")
  dir = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\NewsCosmic")
  If Not fso.FolderExists(dir) Then fso.CreateFolder dir
  dest = dir & "\NewsCosmic.vbs"
  If LCase(fso.GetAbsolutePathName(WScript.ScriptFullName)) <> LCase(fso.GetAbsolutePathName(dest)) Then
    fso.CopyFile WScript.ScriptFullName, dest, True
  End If
  shell.RegWrite "HKCU\Software\Classes\newss\", "URL:NEWS till Cosmic", "REG_SZ"
  shell.RegWrite "HKCU\Software\Classes\newss\URL Protocol", "", "REG_SZ"
  shell.RegWrite "HKCU\Software\Classes\newss\shell\open\command\", "wscript.exe """ & dest & """ ""%1""", "REG_SZ"
  MsgBox "Appen ar installerad." & vbCrLf & vbCrLf & "Ga till newss.se, fyll i vardena och klicka Fyll i Cosmic." & vbCrLf & "Om Edge fragar om appen far oppnas: valj Oppna.", vbInformation, "NEWS till Cosmic"
End Sub

Sub Check
  Dim parts, values, i, tabs, report
  If WScript.Arguments.Count < 3 Then WScript.Quit 2
  parts = Decode(WScript.Arguments(1))
  If IsEmpty(parts) Then
    WriteReport WScript.Arguments(2), "error=invalid"
    WScript.Quit 2
  End If
  tabs = UBound(parts)
  values = ""
  For i = 0 To UBound(parts)
    If Len(parts(i)) > 0 Then
      If Len(values) > 0 Then values = values & "|"
      values = values & parts(i)
    End If
  Next
  report = "tabs=" & tabs & vbLf & "values=" & values
  WriteReport WScript.Arguments(2), report
End Sub

Sub WriteReport(path, text)
  Dim fso, file
  Set fso = CreateObject("Scripting.FileSystemObject")
  Set file = fso.CreateTextFile(path, True)
  file.Write text
  file.Close
End Sub

Sub Fill(raw)
  Dim parts, result, i, j, ch
  parts = Decode(raw)
  If IsEmpty(parts) Then
    MsgBox "Vardena kunde inte lasas. Forsok igen fran newss.se.", vbExclamation, "NEWS till Cosmic"
    WScript.Quit 2
  End If
  result = MsgBox("Dessa varden skrivs in:" & vbCrLf & Preview(parts) & vbCrLf & vbCrLf & "Klicka OK. Du har sedan 5 sekunder pa dig att klicka i rutan Andningsfrekvens i Cosmic." & vbCrLf & "Ror inte musen eller tangentbordet efter det.", vbOKCancel + vbInformation, "Fyll i Cosmic")
  If result <> vbOK Then WScript.Quit 0
  WScript.Sleep 5000
  For i = 0 To UBound(parts)
    For j = 1 To Len(parts(i))
      ch = Mid(parts(i), j, 1)
      shell.SendKeys SendKey(ch)
      WScript.Sleep 40
    Next
    If IsAcvpu(parts(i)) Then WScript.Sleep 250
    If i < UBound(parts) Then
      shell.SendKeys "{TAB}"
      WScript.Sleep 120
    End If
  Next
  MsgBox "Klart. Kontrollera vardena i Cosmic innan du sparar.", vbInformation, "Fyll i Cosmic"
End Sub

Function Decode(raw)
  Dim text, i
  Decode = Empty
  raw = Trim(raw)
  If Left(raw, 1) = """" And Right(raw, 1) = """" Then raw = Mid(raw, 2, Len(raw) - 2)
  If LCase(Left(raw, 6)) = "newss:" Then raw = Mid(raw, 7)
  Do While Left(raw, 1) = "/"
    raw = Mid(raw, 2)
  Loop
  If LCase(Left(raw, 5)) = "fill/" Then raw = Mid(raw, 6)
  text = UrlDecode(raw)
  If Len(text) = 0 Or Len(text) > 200 Then Exit Function
  For i = 1 To Len(text)
    If Not IsAllowed(Mid(text, i, 1)) Then Exit Function
  Next
  Decode = Split(text, vbTab)
End Function

Function UrlDecode(s)
  Dim i, out, hexv, ch
  out = ""
  i = 1
  Do While i <= Len(s)
    ch = Mid(s, i, 1)
    If ch = "%" And i + 2 <= Len(s) Then
      hexv = "&H" & Mid(s, i + 1, 2)
      If Not IsNumeric(hexv) Then
        UrlDecode = ""
        Exit Function
      End If
      out = out & Chr(CLng(hexv))
      i = i + 3
    Else
      out = out & ch
      i = i + 1
    End If
  Loop
  UrlDecode = out
End Function

Function IsAllowed(ch)
  IsAllowed = (ch = vbTab Or ch = "," Or (ch >= "0" And ch <= "9") Or (ch >= "A" And ch <= "Z") Or (ch >= "a" And ch <= "z"))
End Function

Function Preview(parts)
  Dim i, values
  values = ""
  For i = 0 To UBound(parts)
    If Len(parts(i)) > 0 Then
      If Len(values) > 0 Then values = values & "   "
      values = values & parts(i)
    End If
  Next
  Preview = values
End Function

Function IsAcvpu(part)
  IsAcvpu = (part = "Alert" Or part = "Confusion" Or part = "Voice" Or part = "Pain" Or part = "Unresponsive")
End Function

Function SendKey(ch)
  If InStr("+^%~(){}[]", ch) > 0 Then
    SendKey = "{" & ch & "}"
  Else
    SendKey = ch
  End If
End Function

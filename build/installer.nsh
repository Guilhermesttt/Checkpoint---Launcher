!macro customFinishPage
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Iniciar o Checkpoint automaticamente com o Windows"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION StartWithWindows
!macroend

Function StartWithWindows
  WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "Checkpoint Launcher" '"$INSTDIR\Checkpoint Launcher.exe"'
FunctionEnd

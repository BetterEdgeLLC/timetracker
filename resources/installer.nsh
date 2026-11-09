!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Timetracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Zeittracker"
!macroend

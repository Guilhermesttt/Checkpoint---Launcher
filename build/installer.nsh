!include "LogicLib.nsh"

!define MUI_BGCOLOR "0E1015"
!define MUI_TEXTCOLOR "FFFFFF"

!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.myGuiInit
  Function un.myGuiInit
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i 1, i 4)'
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w 0)'
    SetCtlColors $HWNDPARENT "FFFFFF" "0E1015"
  FunctionEnd
!else
  !define MUI_CUSTOMFUNCTION_GUIINIT myGuiInit
  Function myGuiInit
    ; 1. Ativa Dark Mode na barra de título do Windows 10/11
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 19, *i 1, i 4)'

    ; 2. Aplica tema escuro nos controles
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w 0)'

    ; 3. Fundo escuro na janela principal (área dos botões inferiores)
    SetCtlColors $HWNDPARENT "FFFFFF" "0E1015"

    ; 4. Texto da versão / branding no rodapé
    GetDlgItem $0 $HWNDPARENT 1028
    ${If} $0 != 0
      SetCtlColors $0 "88909A" "0E1015"
    ${EndIf}

    ; 5. Linha divisória horizontal
    GetDlgItem $0 $HWNDPARENT 1035
    ${If} $0 != 0
      SetCtlColors $0 "" "0E1015"
    ${EndIf}
  FunctionEnd
!endif

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Instalador do Pherielium"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente guiará você pela instalação do Pherielium no seu computador.$\r$\n$\r$\nRecomendamos fechar outros aplicativos antes de iniciar.$\r$\n$\r$\nClique em Próximo para continuar."
  !define MUI_FINISHPAGE_TITLE "Instalação Concluída"
  !define MUI_FINISHPAGE_TEXT "O Pherielium foi instalado com sucesso!$\r$\n$\r$\nObrigado por escolher o Pherielium Launcher."
!macroend

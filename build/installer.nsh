!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Instalador do Pherielium"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente guiará você pela instalação do Pherielium no seu computador.$\r$\n$\r$\nRecomendamos fechar outros aplicativos antes de iniciar.$\r$\n$\r$\nClique em Próximo para continuar."
  !define MUI_FINISHPAGE_TITLE "Instalação Concluída"
  !define MUI_FINISHPAGE_TEXT "O Pherielium foi instalado com sucesso!$\r$\n$\r$\nObrigado por escolher o Pherielium Launcher."
!macroend

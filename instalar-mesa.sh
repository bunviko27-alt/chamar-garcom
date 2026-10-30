#!/bin/bash
# Transforma um Raspberry Pi (Raspberry Pi OS with desktop) na tela de uma mesa.
#
#   bash instalar-mesa.sh 5 https://SEU-SITE.vercel.app 123456
#                         |  |                          └ código da equipe
#                         |  └ endereço do site
#                         └ número da mesa
#
# Não precisa de servidor no Pi: a tela abre o site online em modo kiosk.
set -e

MESA="${1:?Uso: bash instalar-mesa.sh NUMERO_DA_MESA ENDERECO_DO_SITE CODIGO}"
SITE="${2:?Informe o endereço do site, ex.: https://chamar-garcom.vercel.app}"
CODIGO="${3:?Informe o código da equipe (6 dígitos)}"
SITE="${SITE%/}"

echo "==> Instalando fonte de emoji e ocultador do cursor..."
sudo apt-get update -qq
sudo apt-get install -y fonts-noto-color-emoji unclutter

NAVEGADOR=$(command -v chromium-browser || command -v chromium)
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/mesa.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Mesa $MESA
Exec=sh -c 'sleep 8; unclutter -idle 0.5 & $NAVEGADOR --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000 --user-data-dir=$HOME/.config/mesa-kiosk "$SITE/mesa/$MESA?codigo=$CODIGO"'
X-GNOME-Autostart-enabled=true
EOF

if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || true         # tela nunca apaga
  sudo raspi-config nonint do_boot_behaviour B4 || true  # entra direto na área de trabalho
fi

echo
echo "Pronto! Mesa $MESA configurada. Reinicie com:  sudo reboot"

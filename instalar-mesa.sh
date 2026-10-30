#!/bin/bash
# Instala a tela da mesa NO PRÓPRIO Raspberry Pi (Raspberry Pi OS with desktop).
#
#   bash instalar-mesa.sh 5 123456
#                         |  └ código da equipe do restaurante
#                         └ número da mesa
#
# Os arquivos da tela ficam no Pi (~/bunviko-mesa), servidos só para ele mesmo
# (localhost:8080). O Pi precisa de internet para falar com o banco (Supabase).
# Rode de dentro da pasta do projeto (a que tem a pasta web/).
set -e

MESA="${1:?Uso: bash instalar-mesa.sh NUMERO_DA_MESA CODIGO_DA_EQUIPE}"
CODIGO="${2:?Informe o código da equipe (6 dígitos)}"
ORIGEM="$(cd "$(dirname "$0")" && pwd)/web"
DESTINO="$HOME/bunviko-mesa"

echo "==> Instalando dependências..."
sudo apt-get update -qq
sudo apt-get install -y python3 fonts-noto-color-emoji unclutter

echo "==> Copiando a tela da mesa para $DESTINO..."
rm -rf "$DESTINO"
cp -r "$ORIGEM" "$DESTINO"

echo "==> Servidor local da tela (inicia sozinho com o Pi)..."
sudo tee /etc/systemd/system/bunviko-mesa.service >/dev/null <<EOF
[Unit]
Description=Bunviko - tela da mesa
After=network.target

[Service]
User=$USER
ExecStart=/usr/bin/python3 -m http.server 8080 --bind 127.0.0.1 -d $DESTINO
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now bunviko-mesa

echo "==> Abrindo a tela em modo kiosk ao ligar..."
NAVEGADOR=$(command -v chromium-browser || command -v chromium)
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/mesa.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Bunviko Mesa $MESA
Exec=sh -c 'sleep 8; unclutter -idle 0.5 & $NAVEGADOR --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000 --user-data-dir=$HOME/.config/mesa-kiosk "http://localhost:8080/mesa.html?n=$MESA&codigo=$CODIGO"'
X-GNOME-Autostart-enabled=true
EOF

if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || true         # tela nunca apaga
  sudo raspi-config nonint do_boot_behaviour B4 || true  # entra direto na área de trabalho
fi

echo
echo "Pronto! Mesa $MESA instalada. Reinicie com:  sudo reboot"
echo "Para atualizar depois: baixe a versão nova do projeto e rode este script de novo."

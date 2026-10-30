#!/bin/bash
# Instala a tela da mesa NO PRÓPRIO Raspberry Pi 3B (1 GB de RAM).
#
#   bash instalar-mesa.sh 5 123456          5 = número da mesa, 123456 = código da equipe
#   bash instalar-mesa.sh 5 123456 leve     idem, sem animações contínuas (economiza CPU)
#
# Recomendado: Raspberry Pi OS **Lite** 32 bits (sem área de trabalho). Em vez de um
# desktop inteiro, a tela roda direto num kiosk mínimo (cage + Chromium), o que deixa
# uns 150-250 MB a mais de RAM livres. Se o Pi tiver a versão com desktop, também funciona.
#
# Os arquivos da tela ficam no Pi (~/bunviko-mesa), servidos só para ele (localhost:8080).
# O Pi precisa de internet para falar com o banco (Supabase).
# Rode de dentro da pasta do projeto (a que tem a pasta web/).
set -e

MESA="${1:?Uso: bash instalar-mesa.sh NUMERO_DA_MESA CODIGO_DA_EQUIPE [leve]}"
CODIGO="${2:?Informe o código da equipe (6 dígitos)}"
LEVE="${3:-}"
ORIGEM="$(cd "$(dirname "$0")" && pwd)/web"
DESTINO="$HOME/bunviko-mesa"
URL="http://localhost:8080/mesa/?n=$MESA&codigo=$CODIGO"
[ "$LEVE" = "leve" ] && URL="$URL&leve=1"

TEM_DESKTOP=0
if systemctl list-unit-files 2>/dev/null | grep -q '^lightdm\.service'; then TEM_DESKTOP=1; fi

echo "==> Instalando o necessário..."
sudo apt-get update -qq
PACOTES="python3 python3-gpiozero curl fonts-noto-color-emoji fonts-inter"
if [ "$TEM_DESKTOP" = 1 ]; then
  PACOTES="$PACOTES unclutter"
else
  PACOTES="$PACOTES cage"
fi
if apt-cache show chromium-browser >/dev/null 2>&1; then NAV_PKG=chromium-browser; else NAV_PKG=chromium; fi
sudo apt-get install -y --no-install-recommends $PACOTES $NAV_PKG
NAVEGADOR=$(command -v chromium-browser || command -v chromium)

echo "==> Copiando a tela da mesa para $DESTINO..."
rm -rf "$DESTINO"
cp -r "$ORIGEM" "$DESTINO"
rm -rf "$HOME/.config/mesa-kiosk"   # cache antigo do navegador: garante a versão nova

cp "$(cd "$(dirname "$0")" && pwd)/mesa-botao.py" "$DESTINO/../bunviko-mesa-botao.py"

echo "==> Servidor local da tela + botão físico no GPIO 17 (inicia sozinho, ~20 MB de RAM)..."
sudo tee /etc/systemd/system/bunviko-mesa.service >/dev/null <<EOF
[Unit]
Description=Bunviko - tela da mesa
After=network.target

[Service]
User=$USER
ExecStart=/usr/bin/python3 $HOME/bunviko-mesa-botao.py --pasta $DESTINO --porta 8080
Restart=always
Nice=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now bunviko-mesa

# Chromium enxuto para 1 GB: sem extensões, tradução, sincronização, atualizações
# em segundo plano, e com no máximo 2 processos de página e cache pequeno.
FLAGS="--kiosk --noerrdialogs --disable-infobars --no-first-run --disable-pinch \
--overscroll-history-navigation=0 --disable-extensions --disable-sync \
--disable-translate --disable-default-apps --disable-component-update \
--disable-background-networking --disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication \
--renderer-process-limit=2 --disk-cache-size=33554432 --password-store=basic \
--check-for-update-interval=31536000 --user-data-dir=$HOME/.config/mesa-kiosk"

echo "==> Abrindo a tela em modo kiosk ao ligar..."
if [ "$TEM_DESKTOP" = 1 ]; then
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/mesa.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Bunviko Mesa $MESA
Exec=sh -c 'sleep 8; unclutter -idle 0.5 & $NAVEGADOR $FLAGS "$URL"'
X-GNOME-Autostart-enabled=true
EOF
  sudo raspi-config nonint do_boot_behaviour B4 || true   # entra direto na área de trabalho
else
  # Sem desktop: login automático no terminal 1 e o cage abre só o Chromium.
  # Se o navegador fechar ou travar, abre de novo em 3 segundos.
  cat > "$HOME/.bunviko-kiosk.sh" <<EOF
#!/bin/sh
until curl -s -o /dev/null http://localhost:8080/mesa/; do sleep 1; done
while true; do
  cage -s -- $NAVEGADOR $FLAGS --ozone-platform=wayland "$URL"
  sleep 3
done
EOF
  chmod +x "$HOME/.bunviko-kiosk.sh"
  touch "$HOME/.bash_profile"
  sed -i '/bunviko-kiosk/d' "$HOME/.bash_profile"
  echo '[ "$(tty)" = /dev/tty1 ] && exec "$HOME/.bunviko-kiosk.sh"  # bunviko-kiosk' >> "$HOME/.bash_profile"
  sudo raspi-config nonint do_boot_behaviour B2 || true   # login automático no terminal
fi

echo "==> Ajustes de memória e serviços para 1 GB..."
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || true          # tela nunca apaga
fi
# Swap de 512 MB: evita travar se a memória encher (ex.: atualização do Chromium).
if [ -f /etc/dphys-swapfile ]; then
  sudo sed -i 's/^#\?CONF_SWAPSIZE=.*/CONF_SWAPSIZE=512/' /etc/dphys-swapfile
  sudo systemctl restart dphys-swapfile || true
fi
# Serviços que a mesa não usa (Bluetooth, modem, impressora, atalhos de teclado).
for s in bluetooth hciuart ModemManager cups cups-browsed triggerhappy; do
  sudo systemctl disable --now "$s" 2>/dev/null || true
done
# Reinício diário às 4h: limpa a memória do navegador, que cresce com dias ligado.
echo "0 4 * * * root /sbin/shutdown -r now" | sudo tee /etc/cron.d/bunviko-reinicio >/dev/null

echo
echo "Pronto! Mesa $MESA instalada. Reinicie com:  sudo reboot"
echo "Para atualizar depois: baixe a versão nova do projeto e rode este script de novo."

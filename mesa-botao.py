#!/usr/bin/env python3
"""Servidor local da mesa (roda no Raspberry Pi).

- Entrega a tela da mesa (pasta passada em --pasta) em http://localhost:8080.
- Escuta o botão laranja físico em cima do aparelho e avisa a tela na hora,
  por Server-Sent Events em /botao.

Ligação do botão (chave táctil 12x12): um terminal no GPIO 17 (pino físico 11)
e o outro no GND (pino físico 9). Não precisa de resistor: usamos o pull-up interno.

Sem a biblioteca gpiozero (ex.: testando no PC) o servidor funciona do mesmo jeito,
só que sem o botão físico.
"""

import argparse
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PINO_BOTAO = 17

apertos = threading.Condition()
contador = 0


def botao_apertado():
    global contador
    with apertos:
        contador += 1
        apertos.notify_all()


def ligar_gpio():
    try:
        from gpiozero import Button
    except ImportError:
        print("gpiozero não encontrado: seguindo sem o botão físico.")
        return None
    botao = Button(PINO_BOTAO, pull_up=True, bounce_time=0.08)
    botao.when_pressed = botao_apertado
    print(f"Botão físico pronto no GPIO {PINO_BOTAO}.")
    return botao   # precisa continuar referenciado para não ser desligado


class Tratador(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        # Sem cache: depois de atualizar os arquivos, a tela já pega a versão nova.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/botao":
            return self.eventos()
        return super().do_GET()

    def do_POST(self):
        # Aperto simulado, para testar sem o botão (o servidor só aceita conexões do próprio Pi).
        if self.path == "/botao":
            botao_apertado()
            self.send_response(204)
            self.end_headers()
        else:
            self.send_error(404)

    def eventos(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        visto = contador
        try:
            while True:
                with apertos:
                    apertos.wait_for(lambda: contador != visto, timeout=20)
                    novo = contador != visto
                    visto = contador
                self.wfile.write(b"event: apertou\ndata: 1\n\n" if novo else b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pasta", required=True, help="pasta com os arquivos da tela (web/)")
    p.add_argument("--porta", type=int, default=8080)
    a = p.parse_args()

    botao = ligar_gpio()  # noqa: F841 (mantém o botão vivo)
    servidor = ThreadingHTTPServer(("127.0.0.1", a.porta),
                                   functools.partial(Tratador, directory=a.pasta))
    servidor.daemon_threads = True
    print(f"Tela da mesa em http://localhost:{a.porta}/mesa/")
    servidor.serve_forever()


if __name__ == "__main__":
    main()

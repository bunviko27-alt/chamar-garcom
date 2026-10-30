// Service worker: recebe as notificações push mesmo com o celular bloqueado.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Vibração por tipo de aviso (milissegundos: vibra, pausa, vibra...).
// Mesa chamando = longa e insistente; pedido pronto = mais curta.
const VIBRACAO = {
  chamado: [500, 150, 500, 150, 900],
  pronto: [300, 120, 300],
  novo: [300, 120, 300],
};

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  const tipo = (d.tag || "").split("-")[0];
  e.waitUntil(self.registration.showNotification(d.titulo || "Bunviko", {
    body: d.corpo || "",
    tag: d.tag,
    renotify: true,              // vibra de novo mesmo se já havia aviso da mesma mesa
    requireInteraction: true,    // fica na tela até o garçom tocar
    silent: false,
    vibrate: VIBRACAO[tipo] || [300, 120, 300],
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
    const aba = abertas.find((c) => new URL(c.url).pathname === url);
    return aba ? aba.focus() : self.clients.openWindow(url);
  }));
});

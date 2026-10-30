// Service worker: recebe as notificações push mesmo com o celular bloqueado.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.titulo || "Chamar garçom", {
    body: d.corpo || "",
    tag: d.tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
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

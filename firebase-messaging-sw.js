importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const encryptedConfig = "eyJhcGlLZXkiOiJBSXphU3lEOVhWYUI0Vk1zaXBHUTRmUTQ1VFg3UHhiTTNEdTVfWEUiLCJhdXRoRG9tYWluIjoiYmN2d29ybGQtY2M0MGUuZmlyZWJhc2VhcHAuY29tIiwicHJvamVjdElkIjoiYmN2d29ybGQtY2M0MGUiLCJzdG9yYWdlQnVja2V0IjoiYmN2d29ybGQtY2M0MGUuZmlyZWJhc2VzdG9yYWdlLmFwcCIsIm1lc3NhZ2luZ1NlbmRlcklkIjoiMTA4MzI5NTgwODIyNyIsImFwcElkIjoiMToxMDgzMjk1ODA4MjI3OndlYjo4MDcwZDA4MGJlYjdlOWE4MTlhM2Q2IiwibWVhc3VyZW1lbnRJZCI6IkctRlZUU0tLTkpCSCJ9";

function decryptConfig(encrypted) {
  try {
    const decoded = atob(encrypted);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

const cfg = decryptConfig(encryptedConfig);
if (cfg) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || 'New Update';
    const body = payload.notification?.body || '';
    const icon = payload.notification?.icon || '/assets/images/web-app-manifest-192x192.png';
    // Prioritize data.url, then fcmOptions.link, then click_action, then root
    const url = payload.data?.url || payload.fcmOptions?.link || payload.notification?.click_action || '/';
    
    self.registration.showNotification(title, {
      body,
      icon,
      data: { url }
    });
  });
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});

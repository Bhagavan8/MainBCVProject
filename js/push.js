import { auth, db } from './firebase-config.js';
import { getMessaging, isSupported, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return reg;
  } catch (e) {
    return null;
  }
}

function createPrompt() {
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.top = '12px';
  wrap.style.right = '12px';
  wrap.style.zIndex = '99999';
  wrap.style.maxWidth = '360px';
  wrap.style.width = 'calc(100% - 24px)';
  wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
  wrap.style.borderRadius = '12px';
  wrap.style.background = '#fff';
  wrap.style.padding = '16px';
  wrap.style.display = 'none';
  wrap.style.transform = 'translateY(-12px)';
  wrap.style.opacity = '0';
  wrap.style.transition = 'transform 200ms ease, opacity 200ms ease';

  const title = document.createElement('div');
  title.textContent = 'Would you like to receive Push Notifications?';
  title.style.fontWeight = '700';
  title.style.fontSize = '16px';
  title.style.marginBottom = '6px';
  title.style.color = '#0f172a';

  const desc = document.createElement('div');
  desc.textContent = 'We only send relevant updates, like new jobs and alerts.';
  desc.style.fontSize = '13px';
  desc.style.color = '#475569';
  desc.style.marginBottom = '12px';

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.justifyContent = 'flex-end';

  const noBtn = document.createElement('button');
  noBtn.textContent = 'No thanks';
  noBtn.style.padding = '8px 12px';
  noBtn.style.border = '1px solid #e2e8f0';
  noBtn.style.background = '#f8fafc';
  noBtn.style.borderRadius = '8px';
  noBtn.style.color = '#334155';

  const yesBtn = document.createElement('button');
  yesBtn.textContent = 'Allow';
  yesBtn.style.padding = '8px 12px';
  yesBtn.style.border = 'none';
  yesBtn.style.background = '#2563eb';
  yesBtn.style.borderRadius = '8px';
  yesBtn.style.color = '#fff';
  yesBtn.style.fontWeight = '600';

  btnRow.appendChild(noBtn);
  btnRow.appendChild(yesBtn);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  wrap.appendChild(btnRow);
  document.body.appendChild(wrap);

  function adjustPosition() {
    const isMobile = window.innerWidth <= 520;
    if (isMobile) {
      wrap.style.left = '12px';
      wrap.style.right = '12px';
      wrap.style.maxWidth = 'unset';
      wrap.style.width = 'calc(100% - 24px)';
    } else {
      wrap.style.left = '';
      wrap.style.right = '12px';
      wrap.style.maxWidth = '360px';
      wrap.style.width = '360px';
    }
  }
  adjustPosition();
  window.addEventListener('resize', adjustPosition);

  return { wrap, noBtn, yesBtn };
}

async function saveToken(token) {
  try {
    const uid = auth.currentUser?.uid || null;
    const id = token || `anon_${Date.now()}`;
    await setDoc(doc(collection(db, 'pushTokens'), id), {
      token,
      uid,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      platform: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });
  } catch (e) {}
}

function showTokenBanner(token) {
  if (!token) return;
  const box = document.createElement('div');
  box.style.position = 'fixed';
  box.style.top = '12px';
  box.style.left = '12px';
  box.style.zIndex = '99999';
  box.style.background = '#0f172a';
  box.style.color = '#fff';
  box.style.padding = '10px 12px';
  box.style.borderRadius = '10px';
  box.style.fontSize = '12px';
  box.style.boxShadow = '0 8px 18px rgba(0,0,0,0.25)';
  box.style.maxWidth = 'calc(100% - 24px)';
  box.style.wordBreak = 'break-all';
  const label = document.createElement('div');
  label.textContent = 'Push token (copy to send test):';
  label.style.fontWeight = '700';
  label.style.marginBottom = '6px';
  const tokenEl = document.createElement('div');
  tokenEl.textContent = token;
  const btn = document.createElement('button');
  btn.textContent = 'Copy';
  btn.style.marginTop = '8px';
  btn.style.background = '#2563eb';
  btn.style.border = 'none';
  btn.style.color = '#fff';
  btn.style.padding = '6px 10px';
  btn.style.borderRadius = '8px';
  btn.style.fontWeight = '600';
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(token);
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    } catch {}
  });
  box.appendChild(label);
  box.appendChild(tokenEl);
  box.appendChild(btn);
  document.body.appendChild(box);
  setTimeout(() => { box.remove(); }, 180000); // auto remove after 3 min
}

async function init() {
  const sw = await registerServiceWorker();
  const canMessaging = await isSupported().catch(() => false);
  const needPrompt = Notification.permission === 'default';
  const { wrap, noBtn, yesBtn } = createPrompt();
  if (needPrompt) {
    wrap.style.display = 'block';
    requestAnimationFrame(() => {
      wrap.style.transform = 'translateY(0)';
      wrap.style.opacity = '1';
    });
  }

  noBtn.addEventListener('click', () => {
    wrap.style.display = 'none';
  });

  yesBtn.addEventListener('click', async () => {
    wrap.style.display = 'none';
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      if (canMessaging && sw) {
        const messaging = getMessaging();
        const vapid = (window.CONFIG && window.CONFIG.vapidPublicKey) || undefined;
        let token = null;
        try {
          token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: sw });
        } catch (e) {
          console.warn('getToken error', e);
        }
        if (token) {
          console.log('FCM token', token);
          showTokenBanner(token);
          await saveToken(token);
        } else {
          console.warn('No token returned. Ensure VAPID public key is set: window.CONFIG.vapidPublicKey');
        }
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'New Update';
          const body = payload.notification?.body || '';
          const icon = payload.notification?.icon || '/assets/icons/icon-192.png';
          new Notification(title, { body, icon });
        });
      }
    } catch (e) {}
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

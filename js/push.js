import { auth, db } from './firebase-config.js';
import { getMessaging, isSupported, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Expose status for debugging
window.PushNotifications = {
    status: 'initializing',
    logs: []
};

function log(msg, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, msg, data };
    console.log(`[Push] ${msg}`, data || '');
    window.PushNotifications.logs.push(logEntry);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
      log('Service Worker not supported in this browser');
      return null;
  }
  try {
    // Check if we are on localhost or https
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        log('Service Worker requires HTTPS or localhost');
        return null;
    }

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    log('Service Worker registered', reg);
    return reg;
  } catch (e) {
    log('Service Worker registration failed', e);
    return null;
  }
}

function createPrompt() {
  const wrap = document.createElement('div');
  wrap.id = 'push-notification-prompt'; // Add ID for easier debugging
  wrap.style.position = 'fixed';
  wrap.style.top = '12px';
  wrap.style.right = '12px';
  wrap.style.zIndex = '999999'; // Increased z-index
  wrap.style.maxWidth = '360px';
  wrap.style.width = 'calc(100% - 24px)';
  wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  wrap.style.borderRadius = '12px';
  wrap.style.background = '#fff';
  wrap.style.padding = '16px';
  wrap.style.display = 'none';
  wrap.style.transform = 'translateY(-20px)';
  wrap.style.opacity = '0';
  wrap.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease';
  wrap.style.border = '1px solid rgba(0,0,0,0.1)';

  const title = document.createElement('div');
  title.textContent = 'Enable Notifications?';
  title.style.fontWeight = '700';
  title.style.fontSize = '16px';
  title.style.marginBottom = '8px';
  title.style.color = '#0f172a';

  const desc = document.createElement('div');
  desc.textContent = 'Get instant alerts for new jobs and updates.';
  desc.style.fontSize = '14px';
  desc.style.color = '#475569';
  desc.style.marginBottom = '16px';
  desc.style.lineHeight = '1.4';

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '10px';
  btnRow.style.justifyContent = 'flex-end';

  const noBtn = document.createElement('button');
  noBtn.textContent = 'Later';
  noBtn.style.padding = '8px 16px';
  noBtn.style.border = '1px solid #cbd5e1';
  noBtn.style.background = '#f1f5f9';
  noBtn.style.borderRadius = '6px';
  noBtn.style.color = '#475569';
  noBtn.style.fontSize = '13px';
  noBtn.style.fontWeight = '500';
  noBtn.style.cursor = 'pointer';

  const yesBtn = document.createElement('button');
  yesBtn.textContent = 'Enable';
  yesBtn.style.padding = '8px 16px';
  yesBtn.style.border = 'none';
  yesBtn.style.background = '#2563eb';
  yesBtn.style.borderRadius = '6px';
  yesBtn.style.color = '#fff';
  yesBtn.style.fontWeight = '600';
  yesBtn.style.fontSize = '13px';
  yesBtn.style.cursor = 'pointer';
  yesBtn.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';

  btnRow.appendChild(noBtn);
  btnRow.appendChild(yesBtn);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  wrap.appendChild(btnRow);
  
  // Ensure we append to body, waiting if necessary
  if (document.body) {
      document.body.appendChild(wrap);
  } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wrap));
  }

  function adjustPosition() {
    const isMobile = window.innerWidth <= 520;
    if (isMobile) {
      wrap.style.left = '12px';
      wrap.style.right = '12px';
      wrap.style.maxWidth = 'unset';
      wrap.style.width = 'calc(100% - 24px)';
      wrap.style.top = '12px';
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
      platform: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      lastSeen: serverTimestamp()
    }, { merge: true });
    log('Token saved to Firestore');
  } catch (e) {
    log('Error saving token', e);
  }
}

async function handlePermissionGranted(sw) {
    if (!sw) {
        log('No Service Worker registration found during permission handling');
        return;
    }
    try {
        const messaging = getMessaging();
        const vapid = (window.CONFIG && window.CONFIG.vapidPublicKey) || undefined;
        
        if (!vapid) {
            log('WARNING: VAPID Public Key not found in window.CONFIG');
        }

        log('Requesting token...');
        let token = null;
        try {
            token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: sw });
        } catch (e) {
            log('getToken error', e);
        }
        
        if (token) {
            log('FCM token received', token.substring(0, 10) + '...');
            await saveToken(token);
        } else {
            log('No token returned');
        }
        
        onMessage(messaging, (payload) => {
            log('Message received in foreground', payload);
            const title = payload.notification?.title || 'New Update';
            const body = payload.notification?.body || '';
            const icon = payload.notification?.icon || '/assets/images/web-app-manifest-192x192.png';
            new Notification(title, { body, icon });
        });
    } catch (e) {
        log('Error in handlePermissionGranted', e);
    }
}

async function init() {
  log('Initializing Push Notifications...');
  
  const sw = await registerServiceWorker();
  const canMessaging = await isSupported().catch(e => {
      log('isSupported() check failed', e);
      return false;
  });
  
  log('Environment check', { serviceWorker: !!sw, messaging: canMessaging });

  if (!canMessaging || !sw) {
      window.PushNotifications.status = 'unsupported';
      return;
  }

  const permission = Notification.permission;
  window.PushNotifications.permission = permission;
  log('Current Notification Permission:', permission);

  if (permission === 'granted') {
      window.PushNotifications.status = 'active';
      await handlePermissionGranted(sw);
      return;
  }

  if (permission === 'denied') {
      window.PushNotifications.status = 'blocked';
      log('Notifications blocked by user');
      return;
  }

  // Permission is default, show prompt
  log('Permission is default, showing custom prompt');
  const { wrap, noBtn, yesBtn } = createPrompt();
  
  // Use a small timeout to ensure DOM is ready and transition works
  setTimeout(() => {
      wrap.style.display = 'block';
      // Force reflow
      wrap.offsetHeight; 
      wrap.style.transform = 'translateY(0)';
      wrap.style.opacity = '1';
      log('Prompt displayed');
  }, 1000);

  noBtn.addEventListener('click', () => {
    log('User clicked Later');
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(-20px)';
    setTimeout(() => wrap.style.display = 'none', 300);
  });

  yesBtn.addEventListener('click', async () => {
    log('User clicked Enable');
    wrap.style.display = 'none';
    try {
      const perm = await Notification.requestPermission();
      log('Permission request result:', perm);
      window.PushNotifications.permission = perm;
      
      if (perm === 'granted') {
        await handlePermissionGranted(sw);
      } else {
        log('User denied permission via native prompt');
      }
    } catch (e) {
        log('Error requesting permission', e);
    }
  });
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

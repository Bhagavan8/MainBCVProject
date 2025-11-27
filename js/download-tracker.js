import { db, auth } from '/js/firebase-config.js';
import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function getOrCreateAnonId(){
  try {
    const key = 'bcv_anon_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now());
      localStorage.setItem(key, id);
    }
    return id;
  } catch(e) {
    return 'anon-' + Date.now();
  }
}

export async function trackDownloadOnce(fileId){
  if (!fileId) return;
  try {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    const uid = user ? user.uid : ('anon:' + getOrCreateAnonId());
    const userDocRef = doc(db, 'userDownloads', uid);
    const fileDocRef = doc(db, 'downloadCounts', fileId);

    await runTransaction(db, async (tx) => {
      const userDoc = await tx.get(userDocRef);
      const fileDoc = await tx.get(fileDocRef);

      const files = userDoc.exists() ? (userDoc.data().files || []) : [];
      if (files.includes(fileId)) return;

      const nextFiles = files.concat(fileId);
      if (userDoc.exists()) {
        tx.update(userDocRef, { files: nextFiles, updatedAt: serverTimestamp() });
      } else {
        tx.set(userDocRef, { files: [fileId], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }

      const current = fileDoc.exists() ? (fileDoc.data().count || 0) : 0;
      if (fileDoc.exists()) {
        tx.update(fileDocRef, { count: current + 1, updatedAt: serverTimestamp() });
      } else {
        tx.set(fileDocRef, { count: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    });
  } catch (err) {
    console.error('trackDownloadOnce error', err);
  }
}

// expose for non-module inline handlers
window.trackDownloadOnce = trackDownloadOnce;

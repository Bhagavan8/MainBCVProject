const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

async function getAllTokens() {
  const snap = await admin.firestore().collection('pushTokens').get();
  const tokens = [];
  snap.forEach(d => {
    const t = d.get('token');
    if (t && typeof t === 'string' && t.length > 10) tokens.push(t);
  });
  return tokens;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s/|_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildLink(job, type, id) {
  const title = job.jobTitle || job.postName || job.title || '';
  const company = job.companyName || job.bankName || job.department || job.company || '';
  const loc = job.location || job.state || '';
  const parts = [slugify(title), slugify(company), slugify(loc)].filter(Boolean).join('-');
  const slug = `${parts}~${id}`;
  const origin = functions.config().app?.origin || 'https://bcvworld.com';
  return `${origin}/html/job-details.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&slug=${encodeURIComponent(slug)}&t=${Date.now()}`;
}

async function sendPush(job, type, id) {
  const isActive = job.isActive !== false;
  if (!isActive) return;
  const tokens = await getAllTokens();
  if (!tokens.length) return;
  const title = `${job.jobTitle || job.postName || 'New Job'} • ${job.companyName || job.bankName || job.department || ''}`.trim();
  const body = job.location || job.state || 'New opening';
  const link = buildLink(job, type, id);
  const batches = [];
  for (let i = 0; i < tokens.length; i += 500) {
    batches.push(tokens.slice(i, i + 500));
  }
  const msgBase = {
    notification: { title, body },
    webpush: {
      headers: { TTL: '300' },
      fcmOptions: { link },
      notification: { icon: '/assets/icons/icon-192.png' }
    },
    data: { url: link, type, click_action: link }
  };
  const messaging = admin.messaging();
  for (const batch of batches) {
    const message = { ...msgBase, tokens: batch };
    try {
      await messaging.sendEachForMulticast(message);
    } catch {}
  }
}

exports.onJobCreate = functions.region('asia-south1').firestore
  .document('jobs/{jobId}')
  .onCreate(async (snap, ctx) => {
    const job = snap.data() || {};
    await sendPush(job, 'private', ctx.params.jobId);
  });

exports.onBankJobCreate = functions.region('asia-south1').firestore
  .document('bankJobs/{jobId}')
  .onCreate(async (snap, ctx) => {
    const job = snap.data() || {};
    await sendPush(job, 'bank', ctx.params.jobId);
  });

exports.onGovernmentJobCreate = functions.region('asia-south1').firestore
  .document('governmentJobs/{jobId}')
  .onCreate(async (snap, ctx) => {
    const job = snap.data() || {};
    await sendPush(job, 'government', ctx.params.jobId);
  });

function parseDate(raw) {
  try {
    if (!raw) return null;
    if (raw.seconds) return new Date(raw.seconds * 1000);
    if (typeof raw === 'string') return new Date(raw);
    if (raw instanceof Date) return raw;
    return null;
  } catch {
    return null;
  }
}

exports.hourlyDigest = functions.region('asia-south1').pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
    const collections = [
      { name: 'jobs', type: 'private' },
      { name: 'bankJobs', type: 'bank' },
      { name: 'governmentJobs', type: 'government' }
    ];
    const recent = [];
    for (const c of collections) {
      try {
        const snap = await db.collection(c.name).orderBy('createdAt', 'desc').limit(100).get();
        snap.forEach(doc => {
          const data = doc.data() || {};
          const dt = parseDate(data.createdAt || data.postedAt);
          if (dt && dt >= cutoff) {
            recent.push({ id: doc.id, type: c.type, data });
          }
        });
      } catch {}
    }
    if (!recent.length) return null;
    const tokens = await getAllTokens();
    if (!tokens.length) return null;
    const first = recent[0];
    const link = buildLink(first.data, first.type, first.id);
    const title = `New jobs in the last hour (${recent.length})`;
    const body = `${(first.data.jobTitle || first.data.postName || 'Job')} • ${(first.data.companyName || first.data.bankName || first.data.department || '')}`;
    const messaging = admin.messaging();
    const msgBase = {
      notification: { title, body },
      webpush: {
        headers: { TTL: '300' },
        fcmOptions: { link },
        notification: { icon: '/assets/icons/icon-192.png' }
      },
      data: { url: link, type: first.type }
    };
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      try {
        await messaging.sendEachForMulticast({ ...msgBase, tokens: batch });
      } catch {}
    }
    return null;
  });

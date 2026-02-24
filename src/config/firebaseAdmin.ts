import * as admin from 'firebase-admin';
import { config } from './index';

if (!admin.apps.length) {
  let credential: admin.credential.Credential;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    // Tercih edilen yöntem: Tüm service account JSON'ı tek bir env var olarak
    // JSON.parse private key'deki \n karakterlerini otomatik çözer
    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Yedek: Ayrı env var'lar (FIREBASE_PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
    const { projectId, clientEmail, privateKey } = config.firebase;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin SDK credentials eksik. FIREBASE_SERVICE_ACCOUNT_JSON veya ' +
          'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env var\'larını ayarlayın.'
      );
    }
    credential = admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  admin.initializeApp({ credential });
}

export { admin };

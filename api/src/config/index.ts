import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  env: process.env.NODE_ENV || 'development',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0068493335',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCFJDSCkR-U4c0wcgKlOUWAp1r-tE76R1U',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0068493335.appspot.com',
  },
  jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'vaicar-server-jwt-production-secret-2026-auth-prod',
  email: {
    appsScriptUrl: process.env.APPS_SCRIPT_URL,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'VaiCar Notificações <nao-responda@vaicar.app>',
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_KEY || process.env.VITE_GOOGLE_MAPS_KEY || '',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  testMode: process.env.NODE_ENV === 'production'
    ? (process.env.TEST_MODE === 'true' && process.env.FORCE_TEST_MODE === 'true')
    : (process.env.TEST_MODE === 'true' || process.env.ALLOW_ANY_LOCATION === 'true'),
};

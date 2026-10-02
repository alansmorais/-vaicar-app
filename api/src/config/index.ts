import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  env: process.env.NODE_ENV || 'development',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'vaicar-app-prod',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || 'vaicar-app-prod.appspot.com',
  },
  email: {
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
};

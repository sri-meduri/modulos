import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Email/password + Google sign-in, matching the app's two sign-in methods.
 * Google requires a Cloud OAuth client (console-only setup, see project README);
 * its ID/secret are supplied as Amplify secrets, not committed to source.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile'],
      },
      // 'modulos://' is the native app's deep-link scheme (app.json "scheme").
      callbackUrls: [
        'modulos://',
        'http://localhost:3000/',
        'http://localhost:8081/',
        'https://main.d1ds52t71fj84r.amplifyapp.com/',
        'https://modulos.app/',
        'https://www.modulos.app/',
        // Test (staging) site. Each origin that starts Google sign-in must be listed here.
        'https://staging.d1ds52t71fj84r.amplifyapp.com/',
      ],
      logoutUrls: [
        'modulos://',
        'http://localhost:3000/',
        'http://localhost:8081/',
        'https://main.d1ds52t71fj84r.amplifyapp.com/',
        'https://modulos.app/',
        'https://www.modulos.app/',
        'https://staging.d1ds52t71fj84r.amplifyapp.com/',
      ],
    },
  },
});

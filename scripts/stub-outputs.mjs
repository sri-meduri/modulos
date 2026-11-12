#!/usr/bin/env node
/**
 * Creates a placeholder amplify_outputs.json if none exists, so the app can run
 * in guest / sample mode with no cloud backend (npm run dev:offline).
 * Sign-in, sync and bank connections need the real file from `npm run sandbox`,
 * which overwrites this one.
 */
import { existsSync, writeFileSync } from 'node:fs';

const file = 'amplify_outputs.json';
if (existsSync(file)) {
    console.log(`${file} already exists; leaving it alone.`);
} else {
    writeFileSync(file, JSON.stringify({
        version: '1.4',
        auth: {
            user_pool_id: 'us-east-1_offline', aws_region: 'us-east-1', user_pool_client_id: 'offline',
            identity_pool_id: 'us-east-1:00000000-0000-0000-0000-000000000000', mfa_methods: [], standard_required_attributes: ['email'],
            username_attributes: ['email'], user_verification_types: ['email'], groups: [], mfa_configuration: 'NONE',
            password_policy: { min_length: 8, require_lowercase: true, require_numbers: true, require_symbols: true, require_uppercase: true },
            unauthenticated_identities_enabled: true,
        },
        data: {
            url: 'https://offline.appsync-api.us-east-1.amazonaws.com/graphql', aws_region: 'us-east-1',
            default_authorization_type: 'AMAZON_COGNITO_USER_POOLS', authorization_types: [],
            model_introspection: { version: 1, models: {}, enums: {}, nonModels: {}, queries: {}, mutations: {} },
        },
    }, null, 2));
    console.log(`Created placeholder ${file} (offline mode: guest and sample only).`);
}

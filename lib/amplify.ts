import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

export const client = generateClient<Schema>();

/** Cognito user pool of the backend this build is wired to (shown in Profile so you can confirm you're on the sandbox). */
export const backendLabel: string =
  (outputs as { auth?: { user_pool_id?: string } }).auth?.user_pool_id ?? 'unknown';

# Testing safely: your personal cloud sandbox

Modulos runs on AWS Amplify Gen 2. `ampx sandbox` deploys a **complete private copy of the backend** for you: its own Cognito user pool (auth), its own AppSync API + DynamoDB tables (database), its own Plaid Lambda and token table, and its own secrets. The app on your laptop then talks to that copy. Nothing in the live app is read or written.

```
live app (Amplify Hosting, branch main)      your sandbox (ampx sandbox)
  own Cognito pool / DynamoDB / Lambda   ≠     own Cognito pool / DynamoDB / Lambda
  Plaid production secret                      Plaid *sandbox* secret
```

## One-time setup

1. **AWS access.** Use the same AWS account as the app (or, for stronger isolation, a separate AWS account), with credentials that can deploy CDK stacks (`aws configure sso` or an IAM user). The account/region must be CDK-bootstrapped; `ampx sandbox` tells you if not.
2. **Install:** `npm ci`
3. **Sandbox secrets** (stored per sandbox, separate from the secrets on the live branch):
   ```bash
   npx ampx sandbox secret set PLAID_CLIENT_ID
   npx ampx sandbox secret set PLAID_SECRET        # use your Plaid *Sandbox* secret, never the production one
   npx ampx sandbox secret set GOOGLE_CLIENT_ID    # optional, only for "Sign in with Google"
   npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
   ```
   Google values are required by the auth definition even if you will not test Google sign-in; any placeholder works if you only use email/password.

## Every time

```bash
npm run sandbox        # terminal 1: deploys/updates your private backend, rewrites amplify_outputs.json
npm run dev:sandbox    # terminal 2: starts the app (web, http://localhost:8081) with a SANDBOX badge
```

`amplify_outputs.json` is git-ignored and now points at the sandbox. (No AWS yet? `npm run dev:offline` creates a placeholder file so you can try guest and sample mode with no backend.) The header shows an amber **SANDBOX** badge and Profile shows the backend's user pool id, so you can always confirm which backend you are on. Backend code changes (schema, Plaid function) hot-redeploy while `npm run sandbox` runs.

## What to test

| Feature | How |
|---|---|
| Sign up / sign in | Email + password works as-is (the verification email comes from Cognito). Google needs the sandbox's Cognito domain added as a redirect URI in the Google OAuth client. |
| Database | Sign up, enter data, reload, sign in on another browser: it syncs. Data lives only in the sandbox tables. |
| Plaid | `PLAID_ENV` defaults to `sandbox`. In Plaid Link choose any bank and log in with `user_good` / `pass_good`. |
| Bank payment detection | After linking, run Refresh in Profile → Linked accounts. Plaid's sandbox data includes sample loan/credit accounts and transactions. |
| Reconnect state | In the Plaid dashboard's sandbox tools (or via the `/sandbox/item/reset_login` API) force `ITEM_LOGIN_REQUIRED`, then Refresh: the bank shows "Needs attention". |
| Guest and sample modes | No backend needed (`npm run dev:offline`). Use a private window. |
| Phone / tablet | `npm run ios` or `npm run android` (Expo). Bank linking on a device needs a development build, not Expo Go, because the Plaid SDK is native code. |

## Cleaning up

```bash
npm run sandbox:delete   # removes the sandbox stack and all its test users and data
```

## Guard rails

* Never put the production Plaid secret or `PLAID_ENV=production` in your shell when running `npm run sandbox`.
* Do not commit `amplify_outputs.json` (already git-ignored).
* The sandbox stack is named after your OS user (`amplify-modulos-<you>-sandbox-…`). Live stacks are named after the Amplify app and branch, so the two cannot overwrite each other.

## Option 2: a shared staging environment (full-stack branch deploy)

Your Amplify Hosting app already runs `ampx pipeline-deploy --branch $AWS_BRANCH` (see `amplify.yml`), which creates a **separate backend per connected branch**. To get a hosted test site:

1. In the Amplify console, connect a branch such as `staging` (or enable pull-request previews).
2. Set the branch's own secrets (`PLAID_CLIENT_ID`, `PLAID_SECRET` = Plaid *sandbox* secret, Google values).
3. Leave `PLAID_ENV` **unset** for that branch (it defaults to `sandbox`). Set `PLAID_ENV=production` only on the `main` branch's environment variables, never app-wide.
4. Add the branch URL (`https://staging.<app-id>.amplifyapp.com/`) to the callback/logout URLs in `amplify/auth/resource.ts` and to Plaid's allowed redirect URIs, and to `ALLOWED_REDIRECT_URIS` in `amplify/functions/plaid/handler.ts` if you test OAuth banks.

Merge to `main` only after the staging site checks out.

## Schema changes in this release (safe for live data)

The new features add fields and one mutation argument; nothing is renamed or removed, so existing production records keep working and deploys to `main` migrate in place:

* `Finances`: `payments`, `balanceHistory`
* `Settings`: `strategy`, `extraPayment`, `customOrder`, `targetDate`, `onboardingDone`, `bankNudgeDismissed`, `payeeRules`, `ignoredCandidates`
* `createPlaidLinkToken(itemId)` (Plaid update mode for Reconnect); `syncPlaidData` also returns `payments`, `paymentCandidates`, `attentionItemIds`

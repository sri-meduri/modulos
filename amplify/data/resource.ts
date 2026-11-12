import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { plaidFunction } from '../functions/plaid/resource';

/**
 * One record per signed-in user per model, scoped automatically via
 * allow.owner() (Cognito `sub`). This is the direct replacement for
 * Supabase RLS: schema and generated client come from this one file,
 * so there's no separate migration file that can drift out of sync
 * with what the app code actually reads/writes.
 *
 * `expenses`/`loans` stay as JSON blobs (mirroring Expense[]/Loan[] in
 * types.ts) rather than normalized models — they're small, always
 * loaded together, single-owner lists with no cross-user querying need.
 */
const schema = a.schema({
  Finances: a
    .model({
      incomeType: a.string(),
      monthlyGrossIncome: a.float(),
      monthlyNetIncome: a.float(),
      filingStatus: a.string(),
      zip: a.string(),
      monthly401kContribution: a.float(),
      annualIraContribution: a.float(),
      annualItemizedDeductions: a.float(),
      expenses: a.json(),
      loans: a.json(),
      assets: a.json(),
      // Logged + bank-detected debt payments (Progress tab).
      payments: a.json(),
      // Rolling 12-month [{month, income, expenses}] snapshots (from the
      // Plaid transaction aggregation). Must exist here or every Finances
      // create/update containing it is rejected by AppSync.
      incomeExpenseHistory: a.json(),
      // Rolling [{month, balance}] of total active debt, recorded as the app is used.
      balanceHistory: a.json(),
      // Rolling [{month, total, retirement}] of bank-linked asset balances (Assets tab performance).
      assetHistory: a.json(),
    })
    .authorization((allow) => [allow.owner()]),

  Settings: a
    .model({
      riskProfile: a.string(),
      strategy: a.string(),
      extraPayment: a.float(),
      customOrder: a.json(),
      targetDate: a.string(),
      onboardingDone: a.boolean(),
      bankNudgeDismissed: a.boolean(),
      payeeRules: a.json(),
      ignoredCandidates: a.json(),
    })
    .authorization((allow) => [allow.owner()]),

  /**
   * NOTE: Plaid access tokens are deliberately NOT a model here — they
   * live in a raw DynamoDB table defined in backend.ts that only the
   * plaid-api Lambda can touch. No AppSync/API path to them exists.
   */

  /**
   * Client-visible bank-connection metadata (no tokens). Owners can read
   * their rows; only the plaid-api Lambda creates/updates/deletes (via the
   * schema-level allow.resource grant).
   */
  PlaidItem: a
    .model({
      itemId: a.string().required(),
      institutionId: a.string(),
      institutionName: a.string(),
      connectedAt: a.datetime(),
      lastSyncedAt: a.datetime(),
      status: a.string(),
      // Explicit so the plaid-api Lambda can set it on create (owners
      // themselves only have read access and never write this model).
      owner: a.string(),
    })
    .authorization((allow) => [allow.ownerDefinedIn('owner').to(['read'])]),

  PlaidLinkTokenResult: a.customType({
    linkToken: a.string().required(),
    expiration: a.string(),
  }),
  PlaidExchangeResult: a.customType({
    itemId: a.string().required(),
    institutionName: a.string(),
  }),
  PlaidSyncResult: a.customType({
    loans: a.json().required(),
    expenses: a.json().required(),
    assets: a.json(),
    // Debt payments detected from transactions + ones we could not match.
    payments: a.json(),
    paymentCandidates: a.json(),
    // Rolling 12-month [{ month, income, expenses }] aggregated from transactions.
    incomeExpenseHistory: a.json(),
    syncedItemIds: a.string().array(),
    // Items whose bank login expired and need "Reconnect".
    attentionItemIds: a.string().array(),
    lastSyncedAt: a.datetime(),
  }),
  PlaidTransactionsResult: a.customType({
    // [{ id, date, name, amount, category, account }]; amount > 0 is money out.
    transactions: a.json().required(),
  }),

  PlaidDisconnectResult: a.customType({
    itemId: a.string().required(),
    removed: a.boolean().required(),
  }),

  createPlaidLinkToken: a
    .mutation()
    .arguments({
      // Origin-based OAuth return URL (validated against an allowlist in
      // the handler); required for banks that use OAuth-based login.
      redirectUri: a.string(),
      // Present = Link "update mode" to reconnect an expired item.
      itemId: a.string(),
    })
    .returns(a.ref('PlaidLinkTokenResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(plaidFunction)),

  exchangePlaidPublicToken: a
    .mutation()
    .arguments({
      publicToken: a.string().required(),
      institutionId: a.string(),
      institutionName: a.string(),
    })
    .returns(a.ref('PlaidExchangeResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(plaidFunction)),

  syncPlaidData: a
    .mutation()
    .arguments({
      itemId: a.string(),
    })
    .returns(a.ref('PlaidSyncResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(plaidFunction)),

  listPlaidTransactions: a
    .mutation()
    .arguments({
      days: a.integer(),
    })
    .returns(a.ref('PlaidTransactionsResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(plaidFunction)),

  disconnectPlaidItem: a
    .mutation()
    .arguments({
      itemId: a.string().required(),
    })
    .returns(a.ref('PlaidDisconnectResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(plaidFunction)),
}).authorization((allow) => [
  // Grants the plaid-api Lambda (and only it) full data access — this is
  // what lets the handler read/write PlaidToken and PlaidItem. Not a
  // user-facing rule; browsers still go through per-model rules above.
  allow.resource(plaidFunction),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

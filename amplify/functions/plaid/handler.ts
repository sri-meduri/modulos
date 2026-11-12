import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { env } from '$amplify/env/plaid-api';
import type { Schema } from '../../data/resource';
import {
  mapLiabilitiesToLoans,
  mapRecurringToExpenses,
  mapAccountsToAssets,
  mapTransactionsToMonthlyHistory,
  detectDebtPayments,
  detectRecurringExpenses,
  MappedLoan,
  MappedExpense,
  MappedAsset,
  MappedMonthlySnapshot,
} from './mapping';
import type { Transaction } from 'plaid';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const dataClient = generateClient<Schema>();

const TOKEN_TABLE = process.env.PLAID_TOKEN_TABLE!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  })
);

type PlaidArgs = {
  publicToken?: string;
  institutionId?: string;
  institutionName?: string;
  itemId?: string;
  redirectUri?: string;
  days?: number;
};

/**
 * OAuth-institution return URLs Link is allowed to redirect to. Must
 * mirror the "Allowed redirect URIs" registered in the Plaid dashboard.
 */
const ALLOWED_REDIRECT_URIS = new Set([
  'http://localhost:3000/finances',
  'https://main.d1ds52t71fj84r.amplifyapp.com/finances',
]);

/**
 * Amplify Gen 2's generated resolver invokes the function with fieldName/
 * typeName at the TOP level of the payload (not nested under `info` like a
 * raw AppSync direct-Lambda event). Accept both shapes defensively.
 */
interface PlaidEvent {
  fieldName?: string;
  typeName?: string;
  info?: { fieldName?: string };
  arguments: PlaidArgs;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  } | null;
}

interface TokenRecord {
  itemId: string;
  accessToken: string;
  userSub: string;
}

const callerSub = (event: PlaidEvent): string => {
  const sub = event.identity?.sub;
  if (!sub) {
    throw new Error('Unauthorized: no Cognito identity on request');
  }
  return sub;
};

/**
 * The value Amplify's owner-auth compares against for the PlaidItem model:
 * its rule uses identityClaim "cognito:username". For a Cognito user that's
 * `event.identity.username` (for Google-federated users, "google_<id>").
 * Writing the sub here instead makes owners unable to read their own rows.
 */
const callerOwner = (event: PlaidEvent): string => {
  const username =
    event.identity?.username ??
    (event.identity?.claims?.['cognito:username'] as string | undefined);
  if (!username) {
    throw new Error('Unauthorized: no cognito:username on request');
  }
  return username;
};

/** All Plaid token rows for this user (server-side scoping by userSub). */
async function tokensForUser(sub: string): Promise<TokenRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TOKEN_TABLE,
      IndexName: 'byUserSub',
      KeyConditionExpression: 'userSub = :sub',
      ExpressionAttributeValues: { ':sub': sub },
    })
  );
  return (result.Items ?? []) as TokenRecord[];
}

async function createLinkToken(sub: string, args: PlaidArgs) {
  const redirectUri =
    args.redirectUri && ALLOWED_REDIRECT_URIS.has(args.redirectUri)
      ? args.redirectUri
      : undefined;
  // Update mode ("Reconnect"): re-authenticate an existing item. Plaid takes the
  // item's access token and no `products`.
  if (args.itemId) {
    const token = (await tokensForUser(sub)).find((t) => t.itemId === args.itemId);
    if (!token) throw new Error('Unknown itemId for this user');
    const update = await plaid.linkTokenCreate({
      user: { client_user_id: sub },
      client_name: 'Modulos',
      country_codes: [CountryCode.Us],
      language: 'en',
      access_token: token.accessToken,
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    return { linkToken: update.data.link_token, expiration: update.data.expiration };
  }
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: sub },
    client_name: 'Modulos',
    // Transactions is the only hard requirement; Liabilities activates
    // when the user's accounts support it. Requiring Liabilities outright
    // blocks users whose bank login has no loan accounts (e.g. checking
    // only) from connecting at all.
    products: [Products.Transactions],
    required_if_supported_products: [Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: 'en',
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  };
}

async function exchangePublicToken(sub: string, owner: string, args: PlaidArgs) {
  if (!args.publicToken) throw new Error('publicToken is required');
  const exchange = await plaid.itemPublicTokenExchange({ public_token: args.publicToken });
  const itemId = exchange.data.item_id;
  const accessToken = exchange.data.access_token;

  await ddb.send(
    new PutCommand({
      TableName: TOKEN_TABLE,
      Item: { itemId, accessToken, userSub: sub } satisfies TokenRecord,
    })
  );

  const { errors: itemErrors } = await dataClient.models.PlaidItem.create({
    itemId,
    institutionId: args.institutionId,
    institutionName: args.institutionName,
    connectedAt: new Date().toISOString(),
    status: 'active',
    // Must be the cognito:username (owner-auth identityClaim), not the sub,
    // or the user cannot read their own PlaidItem via PlaidItem.list().
    owner,
  });
  if (itemErrors?.length) {
    throw new Error(`Failed to store item metadata: ${itemErrors[0].message}`);
  }

  return { itemId, institutionName: args.institutionName ?? null };
}

const YYYY_MM_DD = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Pulls every settled transaction in [startDate, endDate], paging through
 * Plaid's offset-based transactionsGet (max 500 per page).
 */
async function fetchTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  const count = 500;
  let offset = 0;
  // Hard cap on pages to avoid pathological loops (500 * 40 = 20k txns).
  for (let page = 0; page < 40; page++) {
    const resp = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count, offset },
    });
    all.push(...resp.data.transactions);
    if (all.length >= resp.data.total_transactions) break;
    offset = all.length;
  }
  return all;
}

async function syncPlaidData(sub: string, args: PlaidArgs) {
  let tokens = await tokensForUser(sub);
  if (args.itemId) {
    tokens = tokens.filter((t) => t.itemId === args.itemId);
    if (tokens.length === 0) {
      throw new Error('Unknown itemId for this user');
    }
  }
  const now = new Date().toISOString();
  if (tokens.length === 0) {
    return { loans: [], expenses: [], assets: [], payments: [], paymentCandidates: [], incomeExpenseHistory: [], syncedItemIds: [], attentionItemIds: [], lastSyncedAt: now };
  }

  const allLoans: MappedLoan[] = [];
  const allExpenses: MappedExpense[] = [];
  const allAssets: MappedAsset[] = [];
  const allTransactions: Transaction[] = [];
  const syncedItemIds: string[] = [];
  const attentionItemIds: string[] = [];

  // 12-month window: first day of the month 11 months back through today.
  const endDateObj = new Date();
  const startDateObj = new Date(
    Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth() - 11, 1)
  );
  const startDate = YYYY_MM_DD(startDateObj);
  const endDate = YYYY_MM_DD(endDateObj);

  for (const token of tokens) {
    try {
      const { data: items } = await dataClient.models.PlaidItem.list({
        filter: { itemId: { eq: token.itemId } },
      });
      const institutionName = items[0]?.institutionName ?? undefined;

      // Bank/investment balances become assets. accountsGet works for every
      // item; investment accounts only appear if the user consented to them.
      const accountsResp = await plaid.accountsGet({ access_token: token.accessToken });
      allAssets.push(...mapAccountsToAssets(accountsResp.data.accounts, token.itemId, institutionName));

      try {
        const liabilities = await plaid.liabilitiesGet({ access_token: token.accessToken });
        allLoans.push(...mapLiabilitiesToLoans(liabilities.data, token.itemId, institutionName));
      } catch (err: unknown) {
        // An item with no loan accounts (checking/savings-only logins) is a
        // normal case, not a failure — transactions still sync below.
        const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
        if (!['NO_LIABILITY_ACCOUNTS', 'PRODUCTS_NOT_SUPPORTED', 'PRODUCT_NOT_READY'].includes(code ?? '')) {
          throw err;
        }
      }

      // Prefer Plaid's ML-powered recurring streams; fall back to our own
      // cadence detection when the endpoint is gated (INVALID_PRODUCT — e.g.
      // the Trial plan) or transactions aren't ready yet.
      let recurringUnavailable = false;
      try {
        const recurring = await plaid.transactionsRecurringGet({ access_token: token.accessToken });
        allExpenses.push(
          ...mapRecurringToExpenses(recurring.data.outflow_streams, token.itemId, institutionName)
        );
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
        if (!['PRODUCT_NOT_READY', 'INVALID_PRODUCT', 'ADDITIONAL_CONSENT_REQUIRED'].includes(code ?? '')) {
          throw err;
        }
        recurringUnavailable = true;
      }

      let itemTransactions: Transaction[] = [];
      try {
        itemTransactions = await fetchTransactions(token.accessToken, startDate, endDate);
        allTransactions.push(...itemTransactions);
      } catch (err: unknown) {
        // Not-ready race right after connect: skip history this pass, retry later.
        const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
        if (code !== 'PRODUCT_NOT_READY') throw err;
      }

      if (recurringUnavailable && itemTransactions.length > 0) {
        allExpenses.push(
          ...detectRecurringExpenses(itemTransactions, token.itemId, institutionName)
        );
      }

      if (items[0]) {
        await dataClient.models.PlaidItem.update({ id: items[0].id, lastSyncedAt: now, status: 'active' });
      }
      syncedItemIds.push(token.itemId);

    } catch (err: unknown) {
      // Expired bank login: flag the item for "Reconnect" instead of failing
      // the whole sync (other banks should still refresh).
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code !== 'ITEM_LOGIN_REQUIRED') throw err;
      const { data: broken } = await dataClient.models.PlaidItem.list({
        filter: { itemId: { eq: token.itemId } },
      });
      if (broken[0]) {
        await dataClient.models.PlaidItem.update({ id: broken[0].id, status: 'needs_attention' });
      }
      attentionItemIds.push(token.itemId);
    }
  }

  // Aggregate all connected accounts into a single household 12-month history.
  // Empty when transactions weren't ready — the client keeps its prior history.
  const incomeExpenseHistory: MappedMonthlySnapshot[] = allTransactions.length
    ? mapTransactionsToMonthlyHistory(allTransactions, endDateObj)
    : [];

  const { payments: detectedPayments, candidates: paymentCandidates } = allTransactions.length
    ? detectDebtPayments(allTransactions, allLoans)
    : { payments: [], candidates: [] };

  console.log(
    `syncPlaidData result: items=${tokens.length} loans=${allLoans.length} ` +
    `expenses=${allExpenses.length} assets=${allAssets.length} txns=${allTransactions.length} ` +
    `historyMonthsWithData=${incomeExpenseHistory.filter(m => m.income > 0 || m.expenses > 0).length}`
  );

  // Return raw arrays: AWSJSON fields are serialized by AppSync itself;
  // pre-stringifying here double-encodes and the client sees a string.
  return {
    loans: allLoans,
    expenses: allExpenses,
    assets: allAssets,
    payments: detectedPayments,
    paymentCandidates,
    incomeExpenseHistory,
    syncedItemIds,
    attentionItemIds,
    lastSyncedAt: now,
  };
}

async function disconnectItem(sub: string, args: PlaidArgs) {
  if (!args.itemId) throw new Error('itemId is required');
  const tokens = await tokensForUser(sub);
  const token = tokens.find((t) => t.itemId === args.itemId);
  if (!token) throw new Error('Unknown itemId for this user');

  await plaid.itemRemove({ access_token: token.accessToken });
  await ddb.send(
    new DeleteCommand({ TableName: TOKEN_TABLE, Key: { itemId: token.itemId } })
  );

  const { data: items } = await dataClient.models.PlaidItem.list({
    filter: { itemId: { eq: token.itemId } },
  });
  if (items[0]) {
    await dataClient.models.PlaidItem.delete({ id: items[0].id });
  }

  return { itemId: token.itemId, removed: true };
}

/**
 * Recent transactions across the user's linked banks (default 60 days) for the
 * Budget transactions list. Pending transactions are skipped; amount > 0 is money out.
 */
async function listTransactions(sub: string, args: PlaidArgs) {
  const days = Math.min(Math.max(args.days ?? 60, 1), 180);
  const tokens = await tokensForUser(sub);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const out: { id: string; date: string; name: string; amount: number; category: string; account: string }[] = [];
  for (const token of tokens) {
    try {
      const accounts = await plaid.accountsGet({ access_token: token.accessToken });
      const names = new Map(accounts.data.accounts.map((a) => [a.account_id, a.name]));
      const txns = await fetchTransactions(token.accessToken, YYYY_MM_DD(start), YYYY_MM_DD(end));
      for (const t of txns) {
        if (t.pending) continue;
        out.push({
          id: t.transaction_id,
          date: t.date,
          name: t.merchant_name ?? t.name ?? 'Transaction',
          amount: t.amount,
          category: t.personal_finance_category?.primary ?? 'OTHER',
          account: names.get(t.account_id) ?? '',
        });
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      // Expired logins and not-yet-ready data are normal: skip this bank.
      if (!['ITEM_LOGIN_REQUIRED', 'PRODUCT_NOT_READY'].includes(code ?? '')) throw err;
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return { transactions: out.slice(0, 500) };
}

/** Surfaces Plaid's real error code/message instead of a bare axios 4xx. */
const rethrowPlaidError = (err: unknown): never => {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string } } })
    ?.response?.data;
  if (data?.error_code) {
    throw new Error(`Plaid ${data.error_code}: ${data.error_message ?? 'no details'}`);
  }
  throw err;
};

export const handler = async (event: PlaidEvent) => {
  const sub = callerSub(event);
  const fieldName = event.fieldName ?? event.info?.fieldName;
  try {
    switch (fieldName) {
      case 'createPlaidLinkToken':
        return await createLinkToken(sub, event.arguments);
      case 'exchangePlaidPublicToken':
        return await exchangePublicToken(sub, callerOwner(event), event.arguments);
      case 'syncPlaidData':
        return await syncPlaidData(sub, event.arguments);
      case 'listPlaidTransactions':
        return await listTransactions(sub, event.arguments);
      case 'disconnectPlaidItem':
        return await disconnectItem(sub, event.arguments);
      default:
        throw new Error(`Unknown operation: ${fieldName}`);
    }
  } catch (err) {
    console.error(`${fieldName} failed:`, err);
    rethrowPlaidError(err);
  }
};

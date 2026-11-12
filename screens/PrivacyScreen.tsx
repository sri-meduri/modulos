import React from 'react';
import { Link } from 'expo-router';
import { openUrl } from '../lib/links';
import { Screen, Section, Stack, Text, TextButton } from '../components/ui';

const EMAIL = 'sri.meduri@berkeley.edu';

const Item: React.FC<{ lead?: string; children: React.ReactNode }> = ({ lead, children }) => (
    <Text variant="small" color="textMuted">• {lead ? <Text variant="smallStrong">{lead} </Text> : null}{children}</Text>
);

/**
 * Publicly reachable at /privacy regardless of sign-in. Referenced by the Plaid
 * production application and linked from the landing page and Profile.
 */
const PrivacyScreen: React.FC = () => (
    <Screen narrow>
        <Link href="/"><Text variant="small" color="accent">‹ Back to Modulos</Text></Link>
        <Stack gap="xs">
            <Text variant="h1" color="accent" accessibilityRole="header">Privacy Policy</Text>
            <Text variant="small" color="textMuted">Effective date: July 17, 2026</Text>
        </Stack>

        <Section title="Who we are">
            <Text variant="small" color="textMuted">Modulos is a personal debt management application that helps you track loans, expenses, and build a debt payoff plan. It is operated by an individual developer. Contact: <Text variant="smallStrong" color="accent" onPress={() => openUrl(`mailto:${EMAIL}`)}>{EMAIL}</Text>.</Text>
        </Section>

        <Section title="Information we collect">
            <Stack gap="sm">
                <Item lead="Account information:">your email address, used to create and secure your account (via Amazon Cognito). If you sign in with Google, we receive your email and basic profile from Google.</Item>
                <Item lead="Financial information you enter:">income, expenses, loan details and payments you type into the app.</Item>
                <Item lead="Financial information from your bank (optional):">if you choose to connect a bank account through Plaid, we receive account balances, loan balances, interest rates, minimum payments, and transactions for the accounts you select, which we use to find your income, bills, debts and debt payments. Connecting a bank is entirely optional — every feature works with manually entered data.</Item>
            </Stack>
        </Section>

        <Section title="Bank connections and Plaid">
            <Stack gap="sm">
                <Text variant="small" color="textMuted">Bank connections are powered by Plaid Inc. You authenticate directly with your bank through Plaid — Modulos never sees or stores your bank username or password. Plaid provides us with access tokens, which are stored server-side in encrypted storage and are never accessible from your device.</Text>
                <Text variant="small" color="textMuted">Plaid's handling of your data is described in the <Text variant="smallStrong" color="accent" onPress={() => openUrl('https://plaid.com/legal/#end-user-privacy-policy')}>Plaid End User Privacy Policy</Text>.</Text>
            </Stack>
        </Section>

        <Section title="How we use your information">
            <Text variant="small" color="textMuted">Your data is used solely to provide the app's functionality: showing your overview, calculating payoff plans, checking loan affordability, and tracking your progress. We do not sell your data, show ads, or share your information with third parties other than the service providers that host the application (Amazon Web Services) and power bank connections (Plaid).</Text>
        </Section>

        <Section title="Guest mode">
            <Text variant="small" color="textMuted">In guest mode, all data stays in your device's local storage. Nothing is transmitted to or stored on our servers, and bank connections are unavailable.</Text>
        </Section>

        <Section title="Sample mode">
            <Text variant="small" color="textMuted">"Try a sample" loads a fictional household so you can explore the app. The sample data is generated on your device, stays there, and is discarded when you leave sample mode or sign in. It is never added to your account.</Text>
        </Section>

        <Section title="Storage and security">
            <Stack gap="sm">
                <Item>All data is stored on Amazon Web Services and encrypted at rest and in transit (TLS).</Item>
                <Item>Your records are isolated per-account — each user can only access their own data.</Item>
                <Item>Plaid access tokens are held in storage reachable only by our backend, never by your device.</Item>
            </Stack>
        </Section>

        <Section title="Deleting your data">
            <Stack gap="sm">
                <Item lead="Delete everything:">Profile → "Delete all my data" permanently removes your financial data from our servers.</Item>
                <Item lead="Disconnect a bank:">Profile → Linked accounts → Disconnect revokes our access with Plaid immediately, and lets you delete the data imported from that bank.</Item>
                <Item>To delete your account entirely, contact <Text variant="smallStrong" color="accent" onPress={() => openUrl(`mailto:${EMAIL}`)}>{EMAIL}</Text>.</Item>
            </Stack>
        </Section>

        <Section title="Changes to this policy">
            <Text variant="small" color="textMuted">If this policy changes materially, the effective date above will be updated. Continued use of the app after changes constitutes acceptance of the updated policy.</Text>
        </Section>
        <TextButton color="textMuted" onPress={() => openUrl(`mailto:${EMAIL}`)}>Questions? Contact us</TextButton>
    </Screen>
);

export default PrivacyScreen;

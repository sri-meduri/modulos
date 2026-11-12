import React, { useState } from 'react';
import { Link } from 'expo-router';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { BankRow, timeAgo, useBanks } from '../hooks/useBanks';
import { deleteImportedData, parseSyncResult, unlinkPlaidItem } from '../services/plaidSync';
import { Badge, Button, Card, Divider, Icon, Inline, PageTitle, Screen, Sheet, Stack, Text } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

const LinkedAccountsScreen: React.FC = () => {
    const { openAuth } = useAuth();
    const { finances, setFinances, applyBankSync } = useFinance();
    const { banks, loaded, reload, signedIn } = useBanks();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [removing, setRemoving] = useState<BankRow | null>(null);

    const refresh = async (itemId: string) => {
        setBusy(itemId); setError(null);
        try {
            const { data, errors } = await client.mutations.syncPlaidData({ itemId });
            if (errors?.length) throw new Error(errors[0].message);
            applyBankSync(parseSyncResult(data));
            await reload();
        } catch (e) { setError(e instanceof Error ? e.message : 'Refresh failed'); }
        finally { setBusy(null); }
    };

    const disconnect = async (bank: BankRow, deleteData: boolean) => {
        setBusy(bank.itemId); setError(null);
        try {
            const { errors } = await client.mutations.disconnectPlaidItem({ itemId: bank.itemId });
            if (errors?.length) throw new Error(errors[0].message);
            setFinances(prev => (deleteData ? deleteImportedData(prev, bank.itemId) : unlinkPlaidItem(prev, bank.itemId)));
            setRemoving(null);
            await reload();
        } catch (e) { setError(e instanceof Error ? e.message : 'Disconnect failed'); }
        finally { setBusy(null); }
    };

    const accountsOf = (itemId: string) => [
        ...finances.loans.filter(l => l.plaidItemId === itemId).map(l => ({ id: l.id, name: l.name, use: 'Tracked as a debt' })),
        ...(finances.assets ?? []).filter(a => a.plaidItemId === itemId).map(a => ({ id: a.id, name: a.name, use: 'Counted in net worth' })),
    ];

    return (
        <Screen narrow>
            <Link href="/profile"><Inline gap="xs"><Icon name="back" size={16} color="textMuted" /><Text variant="small" color="textMuted">Profile</Text></Inline></Link>
            <PageTitle>Linked accounts</PageTitle>

            {!signedIn ? (
                <Card tone="mint" gap="md">
                    <Text>Connecting a bank needs an account, because the connection is stored securely on our servers. Manual entry always works without one.</Text>
                    <Button size="lg" onPress={() => openAuth('signup')}>Create an account</Button>
                </Card>
            ) : null}

            {signedIn && loaded && banks.length === 0 ? <Card><Text color="textMuted">No banks connected yet.</Text></Card> : null}

            {banks.map(bank => {
                const accounts = accountsOf(bank.itemId);
                return (
                    <Card key={bank.id} gap="lg">
                        <Inline justify="space-between" gap="md">
                            <Stack gap="xs" style={{ flex: 1 }}>
                                <Text variant="h3" numberOfLines={1}>{bank.institutionName ?? 'Bank'}</Text>
                                <Text variant="label" color="textMuted">Synced {timeAgo(bank.lastSyncedAt)}</Text>
                            </Stack>
                            <Badge tone={bank.needsAttention ? 'amber' : 'mint'}>{bank.needsAttention ? 'Needs attention' : 'Connected'}</Badge>
                        </Inline>
                        {bank.needsAttention ? (
                            <>
                                <Text variant="small" color="textMuted">Sign-in expired. Reconnect to keep payments updating.</Text>
                                <PlaidLinkButton variant="secondary" size="md" itemId={bank.itemId} onImported={reload}>Reconnect</PlaidLinkButton>
                            </>
                        ) : accounts.length > 0 ? (
                            <>
                                <Divider />
                                {accounts.map(a => <Inline key={a.id} justify="space-between" gap="md"><Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{a.name}</Text><Text variant="small" color="textMuted">{a.use}</Text></Inline>)}
                            </>
                        ) : null}
                        <Inline gap="md">
                            <Button variant="secondary" compact loading={busy === bank.itemId} disabled={busy !== null} onPress={() => refresh(bank.itemId)}>Refresh</Button>
                            <Button variant="danger" compact disabled={busy !== null} onPress={() => setRemoving(bank)}>Disconnect</Button>
                        </Inline>
                    </Card>
                );
            })}

            {signedIn ? <PlaidLinkButton onImported={reload}>{banks.length ? '+ Connect another bank' : '+ Connect a bank'}</PlaidLinkButton> : null}
            {error ? <Text variant="small" color="risk" accessibilityRole="alert">{error}</Text> : null}
            <Text variant="label" color="textMuted">Read-only access through Plaid. Disconnect anytime and delete imported data; your payment history stays in Modulos.</Text>

            <Sheet open={!!removing} onClose={() => setRemoving(null)} title={`Disconnect ${removing?.institutionName ?? 'bank'}?`}>
                <Text variant="small" color="textMuted">Choose what happens to the debts, bills and balances imported from this bank.</Text>
                <Button variant="secondary" disabled={busy !== null} onPress={() => removing && disconnect(removing, false)}>Disconnect, keep imported data</Button>
                <Button variant="danger" disabled={busy !== null} onPress={() => removing && disconnect(removing, true)}>Disconnect and delete imported data</Button>
                <Button variant="ghost" onPress={() => setRemoving(null)}>Cancel</Button>
            </Sheet>
        </Screen>
    );
};

export default LinkedAccountsScreen;

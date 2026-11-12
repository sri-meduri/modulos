import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../lib/amplify';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { BankRow, timeAgo, useBanks } from '../hooks/useBanks';
import { deleteImportedData, parseSyncResult, unlinkPlaidItem } from '../services/plaidSync';
import { Badge, Button, Card, Icon, ICONS, PageTitle, Sheet } from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';

const LinkedAccountsPage: React.FC = () => {
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
        <div className="flex flex-col gap-4">
            <Link to="/profile" className="flex items-center gap-1 text-sm text-dark-text-secondary w-fit"><Icon d={ICONS.back} className="w-4 h-4" />Profile</Link>
            <PageTitle>Linked accounts</PageTitle>

            {!signedIn && (
                <Card tone="mint" className="flex flex-col gap-3">
                    <p className="text-[15px] text-[#D5DAE3]">Connecting a bank needs an account, because the connection is stored securely on our servers. Manual entry always works without one.</p>
                    <Button size="lg" onClick={() => openAuth('signup')}>Create an account</Button>
                </Card>
            )}

            {signedIn && loaded && banks.length === 0 && <Card className="text-[15px] text-dark-text-secondary">No banks connected yet.</Card>}

            {banks.map(bank => (
                <Card key={bank.id} className="flex flex-col gap-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-base font-semibold truncate">{bank.institutionName ?? 'Bank'}</span>
                            <span className="text-[13px] text-dark-text-secondary">Synced {timeAgo(bank.lastSyncedAt)}</span>
                        </div>
                        <Badge tone={bank.needsAttention ? 'amber' : 'mint'}>{bank.needsAttention ? 'Needs attention' : 'Connected'}</Badge>
                    </div>
                    {bank.needsAttention ? (
                        <>
                            <p className="text-sm text-dark-text-secondary">Sign-in expired. Reconnect to keep payments updating.</p>
                            <PlaidLinkButton variant="secondary" size="md" itemId={bank.itemId} onImported={reload}>Reconnect</PlaidLinkButton>
                        </>
                    ) : (
                        accountsOf(bank.itemId).length > 0 && (
                            <>
                                <div className="h-px bg-dark-border" />
                                {accountsOf(bank.itemId).map(a => (
                                    <div key={a.id} className="flex justify-between gap-3 text-sm text-[#D5DAE3]"><span className="truncate">{a.name}</span><span className="text-dark-text-secondary whitespace-nowrap">{a.use}</span></div>
                                ))}
                            </>
                        )
                    )}
                    <div className="flex gap-2.5">
                        <Button size="md" variant="secondary" className="flex-1" disabled={busy !== null} onClick={() => refresh(bank.itemId)}>{busy === bank.itemId ? 'Working…' : 'Refresh'}</Button>
                        <Button size="md" variant="danger" disabled={busy !== null} onClick={() => setRemoving(bank)}>Disconnect</Button>
                    </div>
                </Card>
            ))}

            {signedIn && <PlaidLinkButton onImported={reload}>+ Connect {banks.length ? 'another' : 'a'} bank</PlaidLinkButton>}
            {error && <p className="text-sm text-risk" role="alert">{error}</p>}
            <p className="text-[13px] leading-[19px] text-dark-text-secondary">Read-only access through Plaid. Disconnect anytime and delete imported data; your payment history stays in Modulos.</p>

            <Sheet open={!!removing} onClose={() => setRemoving(null)} title={`Disconnect ${removing?.institutionName ?? 'bank'}?`}>
                <p className="text-sm text-dark-text-secondary">Choose what happens to the debts, bills and balances imported from this bank.</p>
                <Button variant="secondary" disabled={busy !== null} onClick={() => removing && disconnect(removing, false)}>Disconnect, keep imported data</Button>
                <Button variant="danger" disabled={busy !== null} onClick={() => removing && disconnect(removing, true)}>Disconnect and delete imported data</Button>
                <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
            </Sheet>
        </div>
    );
};

export default LinkedAccountsPage;

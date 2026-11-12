import React from 'react';
import { View } from 'react-native';
import { colors, radius, space } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Icon, Stack, Text } from './ui';
import PlaidLinkButton from './PlaidLinkButton';

/** Tall enough that the prompt card fits inside the dimmed chart without spilling over its neighbours. */
const LOCKED_MIN_HEIGHT = 290;

interface Props {
    /** True when the real chart can't be shown yet (no linked bank). */
    locked: boolean;
    /** What this chart is, e.g. "Income vs expenses by month". */
    title: string;
    /** One line on what the user gets. */
    benefit: string;
    /** The real chart, shown when unlocked. */
    children: React.ReactNode;
    /** An illustrative version of the chart, shown dimmed behind the overlay when locked. */
    preview: React.ReactNode;
}

/**
 * Charts that need real bank data. While locked, the user sees a dimmed example of the
 * chart with a prompt on top: "Sign in" for guests and the sample, "Connect a bank" for
 * signed-in users. Once a bank is linked the real chart replaces it.
 */
const BankGate: React.FC<Props> = ({ locked, title, benefit, children, preview }) => {
    const { user, isGuest, openAuth } = useAuth();
    if (!locked) return <>{children}</>;
    const signedIn = !!user && !isGuest;
    return (
        <View style={{ position: 'relative', minHeight: LOCKED_MIN_HEIGHT, justifyContent: 'center' }}>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: 0.28 }}>{preview}</View>
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
                <Card gap="md" style={{ maxWidth: 340, width: '100%', borderColor: colors.accentTintBorder, borderRadius: radius.xl }}>
                    <Stack gap="xs" align="center">
                        <Icon name={signedIn ? 'bank' : 'lock'} color="accent" size={28} />
                        <Text variant="h3" align="center">{title}</Text>
                        <Text variant="small" color="textMuted" align="center">{benefit}</Text>
                    </Stack>
                    {signedIn ? (
                        <PlaidLinkButton size="md">Connect a bank to unlock</PlaidLinkButton>
                    ) : (
                        <>
                            <Button onPress={() => openAuth('signup')}>Sign in to unlock</Button>
                            <Text variant="caption" color="textMuted" align="center">Then connect a bank. It’s read-only and optional.</Text>
                        </>
                    )}
                </Card>
            </View>
        </View>
    );
};

export default BankGate;

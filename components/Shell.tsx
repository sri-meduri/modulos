import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Link, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, hit, IconName, layout, radius, space, useSize } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { appEnvLabel } from '../lib/env';
import { saveErrors } from '../lib/events';
import { Badge, Button, Card, Icon, Inline, Stack, Text, TextButton } from './ui';
import { Pressable } from 'react-native';
import { PressState } from './ui/press';

export const NAV: { path: string; label: string; icon: IconName }[] = [
    { path: '/overview', label: 'Overview', icon: 'overview' },
    { path: '/debts', label: 'Debts', icon: 'debts' },
    { path: '/plan', label: 'Plan', icon: 'plan' },
    { path: '/budget', label: 'Budget', icon: 'budget' },
    { path: '/assets', label: 'Assets', icon: 'assets' },
    { path: '/progress', label: 'Progress', icon: 'progress' },
];

const logo = require('../assets/logo.png');

export const Splash: React.FC = () => (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
    </View>
);

const Brand: React.FC<{ size?: number; wordmark?: boolean }> = ({ size = 32, wordmark = true }) => (
    <Link href="/overview" accessibilityLabel="Modulos home">
        <Inline gap="sm">
            <Image source={logo} style={{ width: size * 1.37, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
            {wordmark ? <Text variant="h3" color="accent">Modulos</Text> : null}
        </Inline>
    </Link>
);

const EnvBadge: React.FC = () => {
    const env = appEnvLabel();
    if (!env) return null;
    return <Badge tone="amber" solid>{env}</Badge>;
};

/** Cloud-save failures (data layer) surfaced as a dismissible banner. */
export const SaveErrorBanner: React.FC = () => {
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => saveErrors.subscribe(setMessage), []);
    if (!message) return null;
    return (
        <View accessibilityRole="alert" style={{ backgroundColor: colors.riskTint, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Text variant="small" color="risk" style={{ flex: 1 }}><Text variant="smallStrong" color="risk">Couldn't save to the cloud: </Text>{message}</Text>
            <Pressable accessibilityLabel="Dismiss" onPress={() => setMessage(null)} hitSlop={12}><Icon name="close" size={18} color="risk" /></Pressable>
        </View>
    );
};

/** Same centered column as <Screen>, for banners that sit above the page. */
export const ContentColumn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { gutter } = useSize();
    return <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}><View style={{ width: '100%', maxWidth: layout.content.max, alignSelf: 'center' }}>{children}</View></View>;
};

/** Shown while browsing the sample profile. */
export const SampleBanner: React.FC = () => {
    const { startWithOwnData, openAuth } = useAuth();
    return (
        <Card tone="mint">
            <Text variant="small"><Text variant="smallStrong" color="accent">Sample data. </Text>This is an example household. Clear it to start with your own.</Text>
            <Inline gap="lg"><TextButton onPress={startWithOwnData}>Clear sample data</TextButton><TextButton color="textMuted" onPress={() => openAuth('signup')}>Sign up</TextButton></Inline>
        </Card>
    );
};

const useActive = () => {
    const pathname = usePathname();
    return (path: string) => pathname === path || pathname.startsWith(`${path}/`);
};

const GuestActions: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const { isGuest, openAuth } = useAuth();
    if (!isGuest) return null;
    return (
        <Inline gap="sm">
            {compact ? null : <Button variant="secondary" compact onPress={() => openAuth('signin')}>Sign in</Button>}
            <Button compact onPress={() => openAuth('signup')}>Sign up</Button>
        </Inline>
    );
};

/** Desktop / large tablet: persistent left navigation. */
export const Sidebar: React.FC = () => {
    const isActive = useActive();
    const { isGuest, signOut } = useAuth();
    return (
        <View style={{ width: layout.sidebarWidth, backgroundColor: colors.nav, borderRightWidth: 1, borderRightColor: colors.border, padding: space.xl, gap: space.xxl }}>
            <Stack gap="sm"><Brand size={36} /><EnvBadge /></Stack>
            <Stack gap="xs" accessibilityLabel="Main navigation">
                {[...NAV, { path: '/profile', label: 'Profile', icon: 'profile' as IconName }].map(item => {
                    const active = isActive(item.path);
                    return (
                        <Link key={item.path} href={item.path as never} asChild>
                            <Pressable accessibilityRole="link" accessibilityState={{ selected: active }}>
                                {(state) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, height: hit.min, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: active ? colors.accentTint : (state as PressState).hovered ? colors.surface : colors.transparent }}>
                                        <Icon name={item.icon} size={22} color={active ? 'accent' : 'textMuted'} />
                                        <Text variant={active ? 'bodyStrong' : 'body'} color={active ? 'accent' : 'textMuted'}>{item.label}</Text>
                                    </View>
                                )}
                            </Pressable>
                        </Link>
                    );
                })}
            </Stack>
            <View style={{ flex: 1 }} />
            <Stack gap="sm">
                {isGuest ? <GuestActions /> : null}
                {isGuest ? <Button variant="ghost" compact onPress={() => signOut()}>Back to start</Button> : null}
            </Stack>
        </View>
    );
};

/** Phones and small tablets: slim header + bottom tabs. */
export const MobileHeader: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { isGuest, signOut } = useAuth();
    const router = useRouter();
    const isActive = useActive();
    const { width } = useSize();
    return (
        <View style={{ paddingTop: insets.top, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ minHeight: layout.headerHeight, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
                <Inline gap="sm">
                    {isGuest ? <Pressable accessibilityRole="button" accessibilityLabel="Back to start" onPress={() => signOut()} hitSlop={8}><Icon name="back" size={20} color="textMuted" /></Pressable> : null}
                    <Brand size={28} wordmark={width >= layout.gridMinColumn + 100 && !isGuest} />
                    <EnvBadge />
                </Inline>
                <Inline gap="sm">
                    <GuestActions compact />
                    <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')}
                        style={{ width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: isActive('/profile') ? colors.accent : colors.border }}>
                        <Icon name="profile" size={20} color={isActive('/profile') ? 'accent' : 'textMuted'} />
                    </Pressable>
                </Inline>
            </View>
        </View>
    );
};

export const BottomBar: React.FC = () => {
    const insets = useSafeAreaInsets();
    const isActive = useActive();
    return (
        <View accessibilityLabel="Main navigation" style={{ backgroundColor: colors.nav, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom, flexDirection: 'row', justifyContent: 'space-around' }}>
            {NAV.map(item => {
                const active = isActive(item.path);
                return (
                    <Link key={item.path} href={item.path as never} asChild>
                        <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} style={{ flex: 1 }}>
                            <View style={{ minHeight: layout.bottomBarHeight, alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
                                <Icon name={item.icon} size={24} color={active ? 'accent' : 'textMuted'} />
                                <Text variant={active ? 'captionStrong' : 'nav'} color={active ? 'accent' : 'textMuted'}>{item.label}</Text>
                            </View>
                        </Pressable>
                    </Link>
                );
            })}
        </View>
    );
};

export const useShellMode = () => {
    const { isWide } = useSize();
    return isWide ? 'sidebar' : 'tabs';
};

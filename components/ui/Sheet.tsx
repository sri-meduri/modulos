import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { border, colors, radius, space, useSize } from '../../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Bottom sheet on phones, centered dialog on wide screens. */
export const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
    const { isWide, width } = useSize();
    const centered = isWide || width >= 720;
    return (
        <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable accessibilityLabel="Close dialog" onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: centered ? 'center' : 'flex-end', alignItems: 'center' }}>
                <Pressable accessibilityViewIsModal onPress={() => undefined}
                    style={{ width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: colors.card, borderWidth: border.hairline, borderColor: colors.border,
                        borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderBottomLeftRadius: centered ? radius.xl : 0, borderBottomRightRadius: centered ? radius.xl : 0 }}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xxl, gap: space.lg }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="h2" accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}><Icon name="close" color="textMuted" /></Pressable>
                        </View>
                        {children}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

import React, { useId, useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { border, colors, hit, radius, space, textStyle } from '../../theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Inline, Stack } from './Layout';
import { Chip } from './Button';

interface FieldProps {
    label: string;
    value: string | number;
    onChange: (text: string) => void;
    hint?: string;
    prefix?: string;
    suffix?: string;
    placeholder?: string;
    /** Decimal keypad and numeric semantics. */
    numeric?: boolean;
    secure?: boolean;
    keyboardType?: TextInputProps['keyboardType'];
    autoComplete?: TextInputProps['autoComplete'];
    maxLength?: number;
    /** Compact one-line input without a label above (for rows). */
    inline?: boolean;
    onSubmit?: () => void;
}

export const Field: React.FC<FieldProps> = ({ label, value, onChange, hint, prefix, suffix, placeholder, numeric, secure, keyboardType, autoComplete, maxLength, inline, onSubmit }) => {
    const id = useId();
    const [focused, setFocused] = useState(false);
    const input = (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: inline ? 40 : hit.control, backgroundColor: inline ? colors.bg : colors.card, borderWidth: border.hairline, borderRadius: inline ? radius.sm : radius.md, paddingHorizontal: inline ? 10 : 14, borderColor: focused ? colors.accent : colors.line }}>
            {prefix ? <Text color="textMuted" style={{ marginRight: 4 }}>{prefix}</Text> : null}
            <TextInput
                nativeID={id} accessibilityLabel={label} value={String(value)} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted}
                keyboardType={keyboardType ?? (numeric ? 'decimal-pad' : 'default')} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false}
                autoComplete={autoComplete} maxLength={maxLength} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSubmitEditing={onSubmit}
                selectTextOnFocus={numeric}
                style={[textStyle('body'), { flex: 1, minWidth: 0, color: colors.text, paddingVertical: 8, fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]} />
            {suffix ? <Text color="textMuted" style={{ marginLeft: 4 }}>{suffix}</Text> : null}
        </View>
    );
    if (inline) return input;
    return (
        <View style={{ gap: 6, minWidth: 0, flex: 1 }}>
            <Text variant="label" color="textMuted">{label}</Text>
            {input}
            {hint ? <Text variant="caption" color="textMuted">{hint}</Text> : null}
        </View>
    );
};

/** Dropdown replacement that behaves the same on web and native. */
export const Select = <T extends string>({ label, value, options, onChange, placeholder = 'Choose…', inline }: { label: string; value: T | ''; options: { value: T; label: string }[]; onChange: (v: T) => void; placeholder?: string; inline?: boolean }) => {
    const [open, setOpen] = useState(false);
    const current = options.find(o => o.value === value);
    const button = (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? placeholder}`} onPress={() => setOpen(true)}
            style={{ minHeight: inline ? 40 : hit.control, backgroundColor: inline ? colors.bg : colors.card, borderWidth: border.hairline, borderColor: colors.line, borderRadius: inline ? radius.sm : radius.md, paddingHorizontal: inline ? 10 : 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Text color={current ? 'text' : 'textMuted'} numberOfLines={1} style={{ flexShrink: 1 }}>{current?.label ?? placeholder}</Text>
            <Icon name="chevronDown" size={18} color="textMuted" />
        </Pressable>
    );
    return (
        <View style={{ gap: 6, minWidth: 0, flex: 1 }}>
            {inline ? null : <Text variant="label" color="textMuted">{label}</Text>}
            {button}
            <Sheet open={open} onClose={() => setOpen(false)} title={label}>
                <Stack gap="sm">
                    <Inline wrap gap="sm">
                        {options.map(o => <Chip key={o.value} active={o.value === value} onPress={() => { onChange(o.value); setOpen(false); }}>{o.label}</Chip>)}
                    </Inline>
                </Stack>
            </Sheet>
        </View>
    );
};

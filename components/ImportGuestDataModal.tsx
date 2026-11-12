import React from 'react';
import { View } from 'react-native';
import { Button, Inline, Sheet, Text } from './ui';

/** Asked once after sign-in when guest data exists on this device. */
const ImportGuestDataModal: React.FC<{ onImport: () => void; onDiscard: () => void }> = ({ onImport, onDiscard }) => (
    <Sheet open onClose={onDiscard} title="Import your guest data?">
        <Text color="textMuted">We found data saved from a previous guest session on this device. Import it into your account, or start fresh?</Text>
        <Inline gap="md">
            <View style={{ flex: 1 }}><Button variant="secondary" onPress={onDiscard}>Start fresh</Button></View>
            <View style={{ flex: 1 }}><Button onPress={onImport}>Import guest data</Button></View>
        </Inline>
    </Sheet>
);


export default ImportGuestDataModal;

import { Platform, Share } from 'react-native';

/**
 * Hands the user their payment plan. On the web it downloads an .ics calendar file
 * (monthly reminders); on a phone it opens the share sheet with a plain-text schedule.
 */
export const sharePlan = async (calendar: string, text: string): Promise<'downloaded' | 'shared' | 'failed'> => {
    try {
        if (Platform.OS === 'web') {
            const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'modulos-payment-plan.ics';
            link.click();
            URL.revokeObjectURL(url);
            return 'downloaded';
        }
        await Share.share({ message: text });
        return 'shared';
    } catch {
        return 'failed';
    }
};

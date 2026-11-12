import { Linking } from 'react-native';

/** Opens a web or mailto link in the system browser / mail app. */
export const openUrl = (url: string): void => { Linking.openURL(url).catch(() => undefined); };

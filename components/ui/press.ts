import { PressableStateCallbackType } from 'react-native';

/** Pressable state including web hover (react-native-web adds `hovered`). */
export type PressState = PressableStateCallbackType & { hovered?: boolean };

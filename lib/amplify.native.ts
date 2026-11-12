// Native entry: the crypto polyfill and Amplify's React Native bindings
// (AsyncStorage-backed auth, network status) must load before aws-amplify.
import 'react-native-get-random-values';
import '@aws-amplify/react-native';
export * from './amplifyClient';

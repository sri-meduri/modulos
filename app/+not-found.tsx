import { Redirect } from 'expo-router';

/** Old or unknown URLs (e.g. /loan-check, /settings) land on the Overview. */
export default function NotFound() {
    return <Redirect href="/overview" />;
}

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { colors } from '../theme/colors';

/** Web document shell: SEO + social preview tags, and a dark page background before JS loads. */
export default function Root({ children }: PropsWithChildren) {
    const title = 'Modulos – Your Personal Debt Management Companion';
    const description = 'Take control of your loans. Modulos helps you track balances and visualize payoff timelines to become debt-free faster.';
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
                <title>{title}</title>
                <meta name="description" content={description} />
                <meta name="theme-color" content={colors.bg} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description} />
                <meta property="og:image" content="https://modulos.app/og-image.png" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:image:alt" content="Modulos – Take Control of Your Loans." />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={description} />
                <meta name="twitter:image" content="https://modulos.app/og-image.png" />
                <link rel="icon" type="image/png" href="/favicon-v2.png" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{ __html: `html,body{background:${colors.bg}}` }} />
            </head>
            <body>{children}</body>
        </html>
    );
}

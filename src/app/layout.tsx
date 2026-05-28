import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'UV Alert',
    description: 'Notificaciones cuando el índice UV supera 3.',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'UV Alert',
    },
    icons: {
        icon: '/icons/icon-192.png',
        apple: '/icons/icon-192.png',
    },
};

export const viewport: Viewport = {
    themeColor: '#0b1220',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="es">
            <body className={inter.className}>
                {children}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                window.addEventListener('load', () => {
                                    navigator.serviceWorker.register('/sw.js', { scope: '/' })
                                        .catch((err) => console.error('SW register failed', err));
                                });
                            }
                        `,
                    }}
                />
            </body>
        </html>
    );
}

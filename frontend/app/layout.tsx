import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Afterframe — Your life, in films',
  description: 'Your movies. Your memories. Your evolving perspective.',
  manifest: './manifest.webmanifest',
  icons: { icon: './icon-192.png', apple: './icon-192.png' },
};
export const viewport: Viewport = {
  themeColor: '#101411',
  width: 'device-width',
  initialScale: 1,
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body>{children}</body>
    </html>
  );
}

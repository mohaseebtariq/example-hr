import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Libre_Baskerville } from 'next/font/google';
import { Providers } from '@/providers';
import './globals.css';

const uiFont = DM_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
});

const displayFont = Libre_Baskerville({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

const monoFont = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ExampleHR — Time Off',
  description: 'Time-off request management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${uiFont.variable} ${displayFont.variable} ${monoFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

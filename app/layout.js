import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script
          src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"
          type="module"
          strategy="lazyOnload"
        />
        <Script
          src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"
          noModule
          strategy="lazyOnload"
        />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import ThemeToggle from '../components/ThemeToggle';

export const metadata = {
  title: '字體大全 Font Collection',
  description: 'Your personal font collection and preview generator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {/* Liquid Glass Background Orbs */}
          <div className="bg-orbs">
            <div className="orb"></div>
            <div className="orb"></div>
            <div className="orb"></div>
          </div>
          
          <div className="container">
            <header className="header animate-in">
              <h1>字體大全 Font Collection</h1>
              <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <a href="/" className="btn btn-secondary">所有字體</a>
                <a href="/add" className="btn btn-primary">新增字體</a>
                <ThemeToggle />
              </nav>
            </header>
            <main className="animate-in" style={{ animationDelay: '0.1s' }}>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

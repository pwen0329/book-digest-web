"use client";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect, memo } from 'react';
import { useTranslations, useLocale } from 'next-intl';

// Use memo to optimize navigation link component
const NavLink = memo(function NavLink({ 
  href, 
  isActive, 
  children,
  prefetch = true,
  tracking = '',
}: { 
  href: string; 
  isActive: boolean; 
  children: React.ReactNode;
  prefetch?: boolean;
  tracking?: string;
}) {
  const linkClass = `flex items-center justify-center font-outfit transition-colors ${tracking} ${
    isActive 
      ? 'text-brand-pink font-bold' 
      : 'text-white/95 hover:text-brand-pink hover:font-bold'
  }`;
  
  return (
    <Link href={href} className={linkClass} prefetch={prefetch} aria-current={isActive ? 'page' : undefined}>
      {children}
    </Link>
  );
});

// Use memo to optimize mobile navigation link
const MobileNavLink = memo(function MobileNavLink({
  href,
  isActive,
  children,
  onClick,
  tracking = '',
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
  onClick: () => void;
  tracking?: string;
}) {
  const mobileLinkClass = `py-2 px-3 rounded-lg font-outfit transition-colors ${tracking} ${
    isActive
      ? 'text-brand-pink font-bold bg-white/5'
      : 'text-white hover:bg-white/10 hover:text-brand-pink hover:font-bold'
  }`;
  
  return (
    <Link 
      href={href} 
      className={mobileLinkClass}
      onClick={onClick}
      prefetch={false}
    >
      {children}
    </Link>
  );
});

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsReady(true);
  }, []);

  // Helper to check if link is active
  const isActive = useCallback((href: string) => {
    // Support both localized (/zh/books) and non-localized (/books) paths
    const localized = `/${locale}${href}`;

    if (href === '/') {
      return (
        pathname === `/${locale}` ||
        pathname === '/' ||
        pathname.startsWith(localized)
      );
    }

    return (
      pathname.startsWith(localized) ||
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }, [pathname, locale]);

  // Optimize close menu function with useCallback
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  return (
    <header data-ready={isReady ? 'true' : 'false'} className="bg-brand-navy/95 backdrop-blur supports-[backdrop-filter]:bg-brand-navy/80 sticky top-0 z-60 border-b border-white/10 py-3 md:py-4">
      <div className="mx-auto max-w-6xl px-6 h-[72px] md:h-[100px] relative">
        {/* Desktop/tablet: grid layout with equal width nav items */}
        <nav aria-label="Primary" className="hidden md:grid grid-cols-5 items-center h-full">
          <NavLink href={`/${locale}/books`} isActive={isActive('/books')} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>{t('books')}</NavLink>
          <NavLink href={`/${locale}/events`} isActive={isActive('/events')} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>{t('events')}</NavLink>
          <Link href={`/${locale}`} className="flex items-center justify-center" aria-label="Home" prefetch={true}>
            <Image src="/images/logo/logo-t.gif" alt="Book Digest logo" width={88} height={70} className="h-[70px] w-auto" unoptimized priority />
          </Link>
          <NavLink href={`/${locale}/about`} isActive={isActive('/about')} prefetch={false} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>{t('about')}</NavLink>
          <NavLink href={`/${locale}/joinus`} isActive={isActive('/joinus')} prefetch={false} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>{t('joinUs')}</NavLink>
        </nav>

        {/* Mobile: hamburger button on left, logo centered */}
        <div className="md:hidden h-full flex items-center">
          {/* Hamburger button */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            data-ready={isReady ? 'true' : 'false'}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          
          {/* Centered logo */}
          <div className="flex-1 flex justify-center">
            <Link href={`/${locale}`} className="inline-flex items-center" aria-label="Home">
              <Image src="/images/logo/logo-t.gif" alt="Book Digest logo" width={70} height={56} className="h-14 w-auto" unoptimized priority />
            </Link>
          </div>
          
          {/* Spacer to balance the hamburger button */}
          <div className="w-10" />
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-brand-navy/98 backdrop-blur">
          <nav aria-label="Primary mobile" className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3">
            <MobileNavLink href={`/${locale}/books`} isActive={isActive('/books')} onClick={closeMobileMenu} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>
              {t('books')}
            </MobileNavLink>
            <MobileNavLink href={`/${locale}/events`} isActive={isActive('/events')} onClick={closeMobileMenu} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>
              {t('events')}
            </MobileNavLink>
            <MobileNavLink href={`/${locale}/about`} isActive={isActive('/about')} onClick={closeMobileMenu} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>
              {t('about')}
            </MobileNavLink>
            <MobileNavLink href={`/${locale}/joinus`} isActive={isActive('/joinus')} onClick={closeMobileMenu} tracking={locale === 'zh' ? 'tracking-[0.15em]' : ''}>
              {t('joinUs')}
            </MobileNavLink>
          </nav>
        </div>
      )}
    </header>
  );
}

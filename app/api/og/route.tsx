import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { CLIENT_ENV } from '@/lib/env';

const siteUrl = CLIENT_ENV.SITE_URL;

function truncate(value: string | null, maxLength: number, fallback = '') {
  return (value || fallback).trim().slice(0, maxLength);
}

function normalizeCoverUrl(value: string | null) {
  const cover = (value || '').trim();
  if (!cover) return '';
  if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;
  if (cover.startsWith('/')) return `${siteUrl}${cover}`;
  return '';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = truncate(searchParams.get('title'), 120, 'Book Digest');
  const author = truncate(searchParams.get('author'), 80);
  const cover = normalizeCoverUrl(searchParams.get('cover'));
  const locale = searchParams.get('locale') === 'zh' ? 'zh' : 'en';

  const subtitle = locale === 'zh' ? '一頁一頁，重新連結' : 'A space to rest, read, and reconnect';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0F2E66 0%, #1a4080 50%, #0F2E66 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left: Book cover */}
        {cover ? (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              width: '280px',
              height: '420px',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
              marginRight: '50px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              width={280}
              height={420}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        ) : null}

        {/* Right: Text content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 20 ? '42px' : '52px',
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.2,
              marginBottom: '16px',
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {author ? (
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '40px',
              }}
            >
              {locale === 'zh' ? '作者：' : 'by '}{author}
            </div>
          ) : null}

          {/* Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '24px',
                fontWeight: 600,
                color: '#FFA6C3',
              }}
            >
              Book Digest
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '18px',
                color: 'rgba(255,255,255,0.5)',
                marginLeft: '12px',
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

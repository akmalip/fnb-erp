'use client'

import Link from 'next/link'

interface Block {
  id: string
  type: 'heading' | 'text' | 'image' | 'cta' | 'divider'
  content?: string
  image_url?: string
  image_caption?: string
  cta_label?: string
  cta_url?: string
  cta_style?: 'primary' | 'outline'
}

interface Banner {
  id: string
  title: string
  description?: string
  image_url?: string
  bg_color: string
  text_color: string
  image_position_x?: number
  image_position_y?: number
  image_zoom?: number
  detail_content?: Block[]
}

interface Outlet {
  id: string
  slug: string
  name: string
  description?: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  accent_color: string
  header_image_url?: string
  header_use_photo?: boolean
}

export default function PromoDetailPage({ outlet, banner }: { outlet: Outlet; banner: Banner }) {
  const blocks: Block[] = banner.detail_content ?? []
  const s = outlet.secondary_color
  const p = outlet.primary_color

  const bannerBgStyle = banner.image_url ? {
    backgroundImage: `url(${banner.image_url})`,
    backgroundSize: `${banner.image_zoom ?? 100}%`,
    backgroundPosition: `${banner.image_position_x ?? 50}% ${banner.image_position_y ?? 50}%`,
    backgroundRepeat: 'no-repeat' as const,
  } : { background: banner.bg_color }

  // Outlet header style — same as order page
  const headerBgStyle = outlet.header_use_photo && outlet.header_image_url
    ? {
        backgroundImage: `url(${outlet.header_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  const headerBgColor = (!outlet.header_use_photo || !outlet.header_image_url)
    ? `linear-gradient(160deg, ${outlet.secondary_color} 0%, ${outlet.secondary_color}CC 100%)`
    : undefined

  return (
    <div className="page">

      {/* ── Outlet branded header (matches order page) ── */}
      <div className="outlet-header" style={{
        ...headerBgStyle,
        background: headerBgColor,
      }}>
        {outlet.header_use_photo && outlet.header_image_url && (
          <div className="header-overlay" />
        )}
        <div className="header-inner">
          <Link href={`/${outlet.slug}`} className="back-btn">
            ← Back to Menu
          </Link>
          <div className="header-brand">
            {outlet.logo_url ? (
              <img src={outlet.logo_url} alt={outlet.name} className="brand-logo" />
            ) : (
              <div className="brand-initials" style={{ background: p }}>
                {outlet.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="brand-name">{outlet.name}</div>
              {outlet.description && <div className="brand-desc">{outlet.description}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner hero ── */}
      <div className="banner-hero" style={bannerBgStyle}>
        {banner.title && (
          <div className="banner-overlay">
            <h1 className="banner-title" style={{ color: banner.text_color }}>{banner.title}</h1>
            {banner.description && (
              <p className="banner-desc" style={{ color: banner.text_color }}>{banner.description}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Content blocks ── */}
      {blocks.length > 0 && (
        <div className="content">
          {blocks.map(block => {
            switch (block.type) {
              case 'heading':
                return <h2 key={block.id} className="block-heading">{block.content}</h2>

              case 'text':
                return <p key={block.id} className="block-text">{block.content}</p>

              case 'image':
                return (
                  <div key={block.id} className="block-image">
                    {block.image_url && <img src={block.image_url} alt={block.image_caption ?? ''} />}
                    {block.image_caption && <p className="img-caption">{block.image_caption}</p>}
                  </div>
                )

              case 'cta':
                return (
                  <div key={block.id} className="block-cta">
                    {block.cta_url ? (
                      <a href={block.cta_url} target="_blank" rel="noreferrer"
                        className={`cta-btn ${block.cta_style === 'outline' ? 'outline' : 'primary'}`}
                        style={block.cta_style !== 'outline'
                          ? { background: s, color: 'white', borderColor: 'transparent' }
                          : { background: 'transparent', borderColor: s, color: s }}>
                        {block.cta_label ?? 'Learn More'}
                      </a>
                    ) : (
                      <button className={`cta-btn ${block.cta_style === 'outline' ? 'outline' : 'primary'}`}
                        style={block.cta_style !== 'outline'
                          ? { background: s, color: 'white', borderColor: 'transparent' }
                          : { background: 'transparent', borderColor: s, color: s }}>
                        {block.cta_label ?? 'Learn More'}
                      </button>
                    )}
                  </div>
                )

              case 'divider':
                return <hr key={block.id} className="block-divider" />

              default:
                return null
            }
          })}
        </div>
      )}

      {blocks.length === 0 && (
        <div className="empty-content">More details coming soon.</div>
      )}

      {/* ── Footer CTA ── */}
      <div className="footer-cta">
        <Link href={`/${outlet.slug}`} className="cta-btn primary"
          style={{ background: s, color: 'white', borderColor: 'transparent' }}>
          Order Now →
        </Link>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page {
          max-width: 480px; margin: 0 auto; min-height: 100vh;
          background: #FAF7F4;
          font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
          color: #1A0F0A;
        }

        /* Outlet branded header */
        .outlet-header {
          position: relative;
          min-height: 140px;
          display: flex; flex-direction: column; justify-content: flex-end;
        }
        .header-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(160deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%);
          z-index: 0;
        }
        .header-inner {
          position: relative; z-index: 1;
          padding: 16px 20px 20px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.75); text-decoration: none;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px; padding: 6px 14px; width: fit-content;
        }
        .back-btn:hover { color: white; }
        .header-brand { display: flex; align-items: center; gap: 12px; }
        .brand-logo {
          width: 44px; height: 44px; border-radius: 10px;
          object-fit: cover; border: 2px solid rgba(255,255,255,0.3);
          flex-shrink: 0;
        }
        .brand-initials {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 800; color: white;
          border: 2px solid rgba(255,255,255,0.3); flex-shrink: 0;
        }
        .brand-name { font-size: 18px; font-weight: 800; color: white; }
        .brand-desc { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px; }

        /* Banner hero */
        .banner-hero {
          width: 100%; aspect-ratio: 2/1;
          position: relative; display: flex; align-items: flex-end;
        }
        .banner-overlay {
          width: 100%; padding: 20px;
          background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%);
        }
        .banner-title { font-size: 22px; font-weight: 800; margin: 0 0 6px; line-height: 1.2; }
        .banner-desc { font-size: 14px; margin: 0; opacity: 0.85; line-height: 1.5; }

        /* Content */
        .content { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }
        .block-heading { font-size: 20px; font-weight: 800; line-height: 1.3; }
        .block-text { font-size: 15px; line-height: 1.7; color: #3A2A20; white-space: pre-wrap; }
        .block-image { border-radius: 12px; overflow: hidden; }
        .block-image img { width: 100%; display: block; object-fit: cover; }
        .img-caption { font-size: 12px; color: #8B7355; text-align: center; margin: 8px 0 0; }
        .block-cta { display: flex; justify-content: center; }
        .block-divider { border: none; border-top: 1px solid rgba(0,0,0,0.1); }
        .cta-btn {
          display: inline-block; padding: 14px 28px; border-radius: 12px;
          font-size: 15px; font-weight: 700; text-decoration: none; text-align: center;
          border: 2px solid transparent; cursor: pointer; font-family: inherit;
        }
        .empty-content { padding: 40px 20px; text-align: center; color: #8B7355; font-size: 14px; }
        .footer-cta {
          padding: 20px; border-top: 1px solid rgba(0,0,0,0.08);
          display: flex; justify-content: center;
        }
        .footer-cta .cta-btn { width: 100%; max-width: 320px; }
      `}</style>
    </div>
  )
}

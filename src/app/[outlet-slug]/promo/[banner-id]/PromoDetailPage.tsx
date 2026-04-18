'use client'

import Link from 'next/link'

interface Block {
  id: string
  type: 'heading' | 'text' | 'image' | 'cta' | 'divider'
  content?: string
  url?: string
  cta_label?: string
  cta_url?: string
  cta_style?: 'primary' | 'outline'
  image_url?: string
  image_caption?: string
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
  primary_color: string
  secondary_color: string
  accent_color: string
}

export default function PromoDetailPage({ outlet, banner }: { outlet: Outlet; banner: Banner }) {
  const blocks: Block[] = banner.detail_content ?? []
  const p = outlet.primary_color
  const s = outlet.secondary_color

  const heroStyle = banner.image_url ? {
    backgroundImage: `url(${banner.image_url})`,
    backgroundSize: `${banner.image_zoom ?? 100}%`,
    backgroundPosition: `${banner.image_position_x ?? 50}% ${banner.image_position_y ?? 50}%`,
    backgroundRepeat: 'no-repeat' as const,
  } : { background: banner.bg_color }

  return (
    <div className="page">
      {/* Back button */}
      <Link href={`/${outlet.slug}`} className="back-btn">
        ← Back to Menu
      </Link>

      {/* Hero banner */}
      <div className="hero" style={heroStyle}>
        {banner.title && (
          <div className="hero-overlay">
            <h1 className="hero-title" style={{ color: banner.text_color }}>{banner.title}</h1>
            {banner.description && (
              <p className="hero-desc" style={{ color: banner.text_color }}>{banner.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Content blocks */}
      {blocks.length > 0 && (
        <div className="content">
          {blocks.map(block => {
            switch (block.type) {
              case 'heading':
                return <h2 key={block.id} className="block-heading">{block.content}</h2>

              case 'text':
                return (
                  <p key={block.id} className="block-text">
                    {block.content}
                  </p>
                )

              case 'image':
                return (
                  <div key={block.id} className="block-image">
                    {block.image_url && (
                      <img src={block.image_url} alt={block.image_caption ?? ''} />
                    )}
                    {block.image_caption && (
                      <p className="img-caption">{block.image_caption}</p>
                    )}
                  </div>
                )

              case 'cta':
                return (
                  <div key={block.id} className="block-cta">
                    {block.cta_url ? (
                      <a
                        href={block.cta_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`cta-btn ${block.cta_style === 'outline' ? 'outline' : 'primary'}`}
                        style={block.cta_style !== 'outline' ? { background: s, color: 'white' } : { borderColor: s, color: s }}
                      >
                        {block.cta_label ?? 'Learn More'}
                      </a>
                    ) : (
                      <button
                        className={`cta-btn ${block.cta_style === 'outline' ? 'outline' : 'primary'}`}
                        style={block.cta_style !== 'outline' ? { background: s, color: 'white' } : { borderColor: s, color: s }}
                      >
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

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="empty-content">
          <p>More details coming soon.</p>
        </div>
      )}

      {/* Back to menu CTA */}
      <div className="footer-cta">
        <Link
          href={`/${outlet.slug}`}
          className="cta-btn primary"
          style={{ background: s, color: 'white' }}
        >
          Order Now →
        </Link>
      </div>

      <style jsx>{`
        .page { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #FAF7F4; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1A0F0A; }

        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 12px 16px; font-size: 13px; font-weight: 600;
          color: #8B7355; text-decoration: none;
        }
        .back-btn:hover { color: #1A0F0A; }

        .hero {
          width: 100%; aspect-ratio: 2/1; position: relative;
          display: flex; align-items: flex-end;
        }
        .hero-overlay {
          width: 100%; padding: 20px;
          background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%);
        }
        .hero-title { font-size: 22px; font-weight: 800; margin: 0 0 6px; line-height: 1.2; }
        .hero-desc { font-size: 14px; margin: 0; opacity: 0.85; line-height: 1.5; }

        .content { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }

        .block-heading { font-size: 20px; font-weight: 800; margin: 0; line-height: 1.3; }
        .block-text { font-size: 15px; line-height: 1.7; margin: 0; color: #3A2A20; white-space: pre-wrap; }
        .block-image { border-radius: 12px; overflow: hidden; }
        .block-image img { width: 100%; display: block; object-fit: cover; }
        .img-caption { font-size: 12px; color: #8B7355; text-align: center; margin: 8px 0 0; }
        .block-cta { display: flex; justify-content: center; }
        .block-divider { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 4px 0; }

        .cta-btn {
          display: inline-block; padding: 14px 28px; border-radius: 12px;
          font-size: 15px; font-weight: 700; text-decoration: none; text-align: center;
          border: 2px solid transparent; cursor: pointer; font-family: inherit;
          transition: opacity 0.15s;
        }
        .cta-btn:active { opacity: 0.8; }
        .cta-btn.outline { background: transparent !important; border-width: 2px; border-style: solid; }
        .cta-btn.primary { border-color: transparent; }

        .empty-content { padding: 40px 20px; text-align: center; color: #8B7355; font-size: 14px; }

        .footer-cta { padding: 20px; border-top: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: center; }
        .footer-cta .cta-btn { width: 100%; max-width: 320px; }
      `}</style>
    </div>
  )
}

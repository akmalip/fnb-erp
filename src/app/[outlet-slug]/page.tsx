import { notFound } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { getMenuByOutlet, getBannersByOutlet } from '../../lib/supabase/queries'
import OrderPage from './OrderPage'
import type { Metadata } from 'next'

interface Props {
  params: { 'outlet-slug': string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: outlet } = await supabase
    .from('outlets').select('name, description').eq('slug', params['outlet-slug']).single()
  if (!outlet) return { title: 'Menu' }
  return {
    title: `Menu — ${outlet.name}`,
    description: outlet.description ?? `Pesan langsung dari meja kamu di ${outlet.name}`,
  }
}

export default async function OutletPage({ params }: Props) {
  const supabase = await createClient()

  const { data: outlet } = await supabase
    .from('outlets').select('*').eq('slug', params['outlet-slug']).single()

  if (!outlet) notFound()
  if (!outlet.is_open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😴</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{outlet.name} Sedang Tutup</h1>
        <p style={{ color: '#8B7355', fontSize: 14 }}>Buka lagi pukul {outlet.open_time} – {outlet.close_time}</p>
      </div>
    )
  }

  const [menu, banners] = await Promise.all([
    getMenuByOutlet(outlet.id),
    getBannersByOutlet(outlet.id)
  ])

  return <OrderPage outlet={outlet} initialMenu={menu} initialBanners={banners} />
}

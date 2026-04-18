import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PromoDetailPage from './PromoDetailPage'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ 'outlet-slug': string; 'banner-id': string }>
}

export default async function PromoPage({ params }: Props) {
  const { 'outlet-slug': slug, 'banner-id': bannerId } = await params
  const supabase = await createClient()

  const [outletRes, bannerRes] = await Promise.all([
    supabase.from('outlets').select('*').eq('slug', slug).single(),
    supabase.from('outlet_banners').select('*').eq('id', bannerId).eq('is_active', true).single()
  ])

  if (!outletRes.data || !bannerRes.data) notFound()

  return <PromoDetailPage outlet={outletRes.data} banner={bannerRes.data as any} />
}

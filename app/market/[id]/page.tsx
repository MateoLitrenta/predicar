import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from "@/lib/supabase/server";
import MarketDetailClient from "./MarketDetailClient";

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: market } = await supabase
    .from('markets')
    .select('title, description')
    .eq('id', id)
    .single();

  if (!market) {
    return {
      title: 'Mercado no encontrado | Zeilo',
    }
  }

  return {
    title: `${market.title} | Zeilo`,
    description: market.description || `Pronostica sobre: ${market.title}`,
    openGraph: {
      title: market.title,
      description: market.description || `Pronostica sobre: ${market.title}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: market.title,
      description: market.description || `Pronostica sobre: ${market.title}`,
    },
  }
}

export default async function MarketPage({ params }: Props) {
  const { id } = await params;
  
  return <MarketDetailClient marketId={id} />;
}

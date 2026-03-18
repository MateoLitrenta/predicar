"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketOption {
  id: string;
  option_name: string;
  color: string;
  total_votes: number;
}

interface MarketCardProps {
  id: string;
  question: string;
  category: string;
  totalVolume: string;
  endDate: string;
  imageUrl?: string | null;
  options: MarketOption[];
  userId: string | null;
  userPoints: number;
  onBetPlaced?: (newPoints: number) => void;
  onOpenAuthModal?: () => void;
}

export function MarketCard({
  id,
  question,
  category,
  totalVolume,
  endDate,
  imageUrl,
  options = [],
}: MarketCardProps) {
  const router = useRouter();

  const truncateTitle = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  };

  const handleNavigateToMarket = () => {
    router.push(`/market/${id}`);
  };

  const totalVolNum = Number(totalVolume.replace(/,/g, '') || 0);
  const totalOptsCount = options.length || 2;

  const getProbability = (votes: number) => {
    let ammPrice = (Number(votes) + 100.0) / (totalVolNum + (totalOptsCount * 100.0));
    ammPrice = Math.max(0.01, Math.min(0.99, ammPrice));
    return ammPrice * 100;
  };

  // LA SOLUCIÓN: Ordenamos las opciones de mayor a menor cantidad de votos (probabilidad)
  const sortedOptions = [...options].sort((a, b) => Number(b.total_votes) - Number(a.total_votes));

  return (
    <Card 
      onClick={handleNavigateToMarket}
      className="group bg-card hover:bg-muted/10 transition-all duration-300 border-border/50 hover:border-primary/50 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden flex flex-col h-full"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <CardContent className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex gap-3 sm:gap-4 mb-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt="Market" className="w-full h-full object-cover" />
            ) : (
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-primary opacity-50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-3">
              {truncateTitle(question, 80)}
            </h3>
          </div>
        </div>

        <div className="space-y-3 mb-4 flex-1">
          {sortedOptions.length > 0 ? (
            <>
              {/* Progreso Visual ordenado */}
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
                {sortedOptions.map((opt) => (
                  <div 
                    key={opt.id} 
                    className="h-full transition-all duration-500 ease-out" 
                    style={{ width: `${getProbability(opt.total_votes)}%`, backgroundColor: opt.color }} 
                  />
                ))}
              </div>
              
              {/* Opciones destacadas ordenadas (Muestra las 3 más altas) */}
              <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs">
                {sortedOptions.slice(0, 3).map((opt) => (
                  <div key={opt.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50 bg-background/50 text-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                    <span className="font-semibold truncate max-w-[80px] sm:max-w-[100px]">{opt.option_name}</span>
                    <span className="font-black opacity-80">{Math.round(getProbability(opt.total_votes))}%</span>
                  </div>
                ))}
                {sortedOptions.length > 3 && (
                  <div className="flex items-center px-2 py-1 rounded-md border border-border/50 bg-background/50 text-muted-foreground text-[10px] sm:text-xs font-medium">
                    +{sortedOptions.length - 3}
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="h-2 w-full rounded-full bg-muted" />
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-auto pt-4 border-t border-border/50 gap-3 sm:gap-0">
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
            <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs border-border/50 font-bold bg-muted/50 hover:bg-muted text-foreground px-2 py-0.5 uppercase tracking-wide capitalize">
              {category}
            </Badge>
            <div className="flex items-center gap-3 text-muted-foreground text-[10px] sm:text-xs font-medium min-w-0">
              <span className="flex items-center gap-1 shrink-0"><Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{totalVolume}</span>
              <span className="flex items-center gap-1 truncate"><Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />{endDate}</span>
            </div>
          </div>
          
          <Button 
            variant="default" 
            size="sm" 
            className="w-full sm:w-auto h-8 px-4 text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all group-hover:bg-primary/90"
            onClick={(e) => { e.stopPropagation(); handleNavigateToMarket(); }}
          >
            Predecir <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
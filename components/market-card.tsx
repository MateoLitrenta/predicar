"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// ACÁ ESTÁ LA CORRECCIÓN: Agregué TrendingUp a la lista de íconos
import { Coins, Clock, Activity, Check, Lock, Trophy, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  rawEndDate?: string; 
  imageUrl?: string | null;
  options: MarketOption[];
  userId: string | null;
  userPoints: number;
  status?: string; 
  winningOutcome?: string | null;
  onBetPlaced?: (newPoints: number) => void;
  onOpenAuthModal?: () => void;
  onCategoryClick?: (category: string) => void;
}

export function MarketCard({
  id,
  question,
  category,
  totalVolume,
  endDate,
  rawEndDate,
  imageUrl,
  options = [],
  status,
  winningOutcome,
  onCategoryClick,
}: MarketCardProps) {
  const router = useRouter();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{ optionId: string; type: 'yes' | 'no' } | null>(null);

  const isResolved = status === 'resolved';
  const isClosedByDate = rawEndDate ? new Date(rawEndDate) <= new Date() : false;
  const isClosed = isResolved || isClosedByDate;

  const handleNavigateToMarket = () => {
    if (isClosed) {
      router.push(`/market/${id}`);
    } else if (selectedAction) {
      router.push(`/market/${id}?preselect=${selectedAction.optionId}&type=${selectedAction.type}`);
    } else {
      router.push(`/market/${id}`);
    }
  };

  const realTotalVotes = options.reduce((acc, opt) => acc + Number(opt.total_votes || 0), 0);
  const totalOptsCount = options.length || 2;

  const getProbability = (votes: number) => {
    let ammPrice = (Number(votes) + 100.0) / (realTotalVotes + (totalOptsCount * 100.0));
    ammPrice = Math.max(0.01, Math.min(0.99, ammPrice));
    return ammPrice * 100;
  };

  const sortedOptions = [...options].sort((a, b) => Number(b.total_votes) - Number(a.total_votes));
  const isBinaryYesNo = options.length === 2 && 
    options.some(o => ['sí', 'si', 'yes'].includes(o.option_name.toLowerCase())) && 
    options.some(o => o.option_name.toLowerCase() === 'no');

  return (
    <>
      <Card 
        onClick={() => {
          if (isClosed) {
            handleNavigateToMarket(); 
          } else {
            setSelectedAction(null); 
            setIsPreviewOpen(true); 
          }
        }}
        className={cn("group bg-card transition-all duration-200 border border-border/40 shadow-sm relative overflow-hidden flex flex-col h-full cursor-pointer hover:border-primary/40 hover:shadow-md", 
          isClosed ? "opacity-75 bg-muted/10" : "")}
      >
        <CardContent className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
          
          {/* HEADER: Imagen, Título y Categoría */}
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/50 overflow-hidden relative">
              {imageUrl ? (
                <img src={imageUrl} alt="Market" className="w-full h-full object-cover" />
              ) : (
                <Coins className="w-5 h-5 text-muted-foreground opacity-50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <Badge 
                  variant="secondary" 
                  onClick={(e) => { e.stopPropagation(); if (onCategoryClick) onCategoryClick(category); }}
                  className="text-[9px] uppercase tracking-wider px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary cursor-pointer transition-colors"
                >
                  {category}
                </Badge>
                {isClosed && (
                  <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {isResolved ? "Resuelto" : "Cerrado"}
                  </span>
                )}
              </div>
              <h3 className={cn("font-semibold text-[15px] sm:text-base leading-snug transition-colors line-clamp-2", isClosed ? "text-muted-foreground" : "text-foreground group-hover:text-primary")}>
                {question}
              </h3>
            </div>
          </div>

          {/* OPCIONES CON BARRAS DE PROGRESO (Estilo Polymarket) */}
          <div className="space-y-1.5 flex-1 mt-1">
            {sortedOptions.slice(0, 3).map((opt) => {
              const pct = Math.round(getProbability(opt.total_votes));
              const isWinner = winningOutcome === opt.id;
              
              return (
                <div key={opt.id} className="relative h-8 flex items-center justify-between px-2 rounded bg-muted/20 overflow-hidden text-xs sm:text-sm border border-transparent hover:border-border/50 transition-colors">
                  {/* Barra de progreso de fondo */}
                  <div 
                    className="absolute left-0 top-0 h-full opacity-20 transition-all duration-500 ease-out" 
                    style={{ width: `${pct}%`, backgroundColor: opt.color }} 
                  />
                  
                  <div className="flex items-center gap-2 z-10 relative truncate pr-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                    <span className={cn("font-medium truncate", isWinner && "font-bold text-primary")}>
                      {opt.option_name}
                    </span>
                    {isResolved && isWinner && <Trophy className="w-3 h-3 text-primary ml-1 shrink-0" />}
                  </div>
                  
                  <span className="font-bold z-10 relative">{pct}%</span>
                </div>
              );
            })}
            
            {sortedOptions.length > 3 && (
              <div className="text-[10px] text-muted-foreground text-center pt-1 font-medium">
                + {sortedOptions.length - 3} opciones
              </div>
            )}
          </div>

          {/* FOOTER: Meta info */}
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/40 text-muted-foreground text-[11px] font-medium">
            <span className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> {totalVolume} Vol.</span>
            {!isClosed && (
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {endDate}</span>
            )}
          </div>

        </CardContent>
      </Card>

      {/* MODAL DE PREVIEW */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-border/50">
          <div className="p-6 pb-2">
            <DialogHeader>
              <div className="flex items-start gap-4 mb-2">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden shadow-sm">
                  {imageUrl ? <img src={imageUrl} alt="Market" className="w-full h-full object-cover" /> : <Coins className="w-6 h-6 text-primary opacity-50" />}
                </div>
                <div className="flex-1 text-left">
                  <Badge variant="outline" className="mb-2 uppercase text-[10px] font-bold tracking-wider">{category}</Badge>
                  <DialogTitle className="text-xl leading-tight font-bold text-foreground">{question}</DialogTitle>
                </div>
              </div>
              <DialogDescription className="flex items-center gap-4 text-xs font-medium mt-2">
                <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> Vol: {totalVolume} pts</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Cierra: {endDate}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-4 sm:px-6 py-4 bg-muted/10 border-y border-border/50 max-h-[400px] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Valor de las acciones</h4>
              {!isBinaryYesNo && <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider hidden sm:block">Operar</span>}
            </div>
            
            <div className="space-y-3">
              {sortedOptions.map((opt) => {
                const yesPrice = Math.round(getProbability(opt.total_votes));
                const noPrice = 100 - yesPrice;
                const isYesSelected = selectedAction?.optionId === opt.id && selectedAction?.type === 'yes';
                const isNoSelected = selectedAction?.optionId === opt.id && selectedAction?.type === 'no';

                if (isBinaryYesNo) {
                  return (
                    <div key={opt.id} onClick={() => setSelectedAction({ optionId: opt.id, type: 'yes' })} className={cn("flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm cursor-pointer transition-all", isYesSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/50 hover:border-primary/50")}>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full shadow-inner relative flex items-center justify-center" style={{ backgroundColor: opt.color }}>
                           {isYesSelected && <Check className="w-3 h-3 text-white absolute" />}
                        </div>
                        <span className={cn("font-bold text-lg", isYesSelected && "text-primary")}>{opt.option_name}</span>
                      </div>
                      <span className={cn("text-2xl font-black", isYesSelected ? "text-primary" : "text-foreground")}>{yesPrice}¢</span>
                    </div>
                  )
                }

                return (
                  <div key={opt.id} className={cn("flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-card border shadow-sm gap-3 transition-colors hover:bg-muted/30", (isYesSelected || isNoSelected) ? "border-border" : "border-border/50")}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-inner" style={{ backgroundColor: opt.color }} />
                      <span className="font-bold text-sm truncate">{opt.option_name}</span>
                      <span className="text-sm font-black ml-auto sm:ml-2 text-foreground/70">{yesPrice}%</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Button variant={isYesSelected ? "default" : "outline"} className={cn("flex-1 sm:w-20 h-9 font-bold text-sm border-border/50 transition-all", isYesSelected ? "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-md shadow-green-500/20" : "text-green-600 dark:text-green-500 hover:bg-green-500/10 hover:border-green-500/50")} onClick={(e) => { e.stopPropagation(); setSelectedAction({ optionId: opt.id, type: 'yes' }); }}>Sí {yesPrice}¢</Button>
                      <Button variant={isNoSelected ? "default" : "outline"} className={cn("flex-1 sm:w-20 h-9 font-bold text-sm border-border/50 transition-all", isNoSelected ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md shadow-red-500/20" : "text-red-600 dark:text-red-500 hover:bg-red-500/10 hover:border-red-500/50")} onClick={(e) => { e.stopPropagation(); setSelectedAction({ optionId: opt.id, type: 'no' }); }}>No {noPrice}¢</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 pt-4 bg-background">
            <Button size="lg" className="w-full font-bold text-base h-12 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground" onClick={() => { setIsPreviewOpen(false); handleNavigateToMarket(); }}>
              Ir a Operar <TrendingUp className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
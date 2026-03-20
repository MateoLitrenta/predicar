"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, User as UserIcon, Coins, History, CheckCircle2, Clock, XCircle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { sellBet } from "@/lib/actions";

interface ProfileClientProps {
  profileId: string;
}

export default function ProfileClient({ profileId }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [marketOptions, setMarketOptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sellingBetId, setSellingBetId] = useState<string | null>(null);
  
  // Estado para el filtro de tiempo
  const [timeframe, setTimeframe] = useState<'1D' | 'ALL'>('ALL');

  const fetchAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setMyProfile(data);
    }
  }, [supabase]);

  const fetchViewedProfileData = useCallback(async () => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, points, avatar_url") 
      .eq("id", profileId)
      .single();

    if (profileError) {
      toast({ title: "Error", description: "No se pudo cargar el perfil del usuario.", variant: "destructive" });
      router.push("/ranking");
      return;
    }
    setViewedProfile(profileData);

    const { data: betsData } = await supabase
      .from("bets")
      .select("*, markets(*)") 
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });

    const { data: optionsData } = await supabase.from("market_options").select("*");

    setUserBets(betsData || []);
    setMarketOptions(optionsData || []);
    setIsLoading(false);
  }, [profileId, router, supabase]);

  useEffect(() => {
    fetchAuth();
    fetchViewedProfileData();
  }, [fetchAuth, fetchViewedProfileData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const handleSell = async (betId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setSellingBetId(betId);
    const { ok, error, cashoutValue } = await sellBet(betId);
    
    if (!ok) {
      toast({ title: "Error al vender", description: error || "Hubo un problema", variant: "destructive" });
      setSellingBetId(null);
    } else {
      toast({ title: "¡Venta exitosa!", description: `Tus ganancias de ${cashoutValue?.toLocaleString()} pts ya están en tu cuenta.` });
      fetchAuth();
      fetchViewedProfileData();
      setSellingBetId(null);
    }
  };

  const calculateRealCashout = useCallback((bet: any, market: any, opt: any) => {
    const shares = Number(bet.shares || 0);
    if (shares <= 0) return Math.round(bet.amount * 0.95); 
    
    const direction = bet.direction || 'yes';
    const optionVotes = Number(opt.total_votes || 0);
    const totalVol = Number(market.total_volume || 0);
    const totalOptions = marketOptions.filter(o => o.market_id === market.id).length || 2;

    const startPriceYes = (optionVotes + 100.0) / (totalVol + (totalOptions * 100.0));
    const estPayout = shares * (direction === 'yes' ? startPriceYes : (1 - startPriceYes));

    let endPriceYes = 0;
    if (direction === 'yes') {
      endPriceYes = Math.max(0.01, (optionVotes - estPayout + 100.0) / (Math.max(1, totalVol - estPayout) + (totalOptions * 100.0)));
    } else {
      endPriceYes = Math.max(0.01, (optionVotes + 100.0) / (Math.max(1, totalVol - estPayout) + (totalOptions * 100.0)));
    }

    let avgPriceYes = (startPriceYes + endPriceYes) / 2.0;
    avgPriceYes = Math.max(0.01, Math.min(0.99, avgPriceYes));

    const currentPrice = direction === 'yes' ? avgPriceYes : (1 - avgPriceYes);
    return Math.round(shares * currentPrice);
  }, [marketOptions]);

  // MATEMÁTICA DEL PORTFOLIO PÚBLICO
  const portfolioStats = useMemo(() => {
    const availableCapital = viewedProfile?.points ?? 0;
    let totalInvestedActive = 0;
    let totalCurrentValueActive = 0;

    userBets
      .filter((b) => b.markets && ['active', 'pending'].includes(String(b.markets.status).toLowerCase()))
      .forEach((bet) => {
        // ACÁ ESTABA EL ERROR (antes decía b.markets)
        const market = bet.markets; 
        const opt = marketOptions.find(o => o.id === bet.outcome);
        if (market && opt) {
          totalInvestedActive += bet.amount;
          totalCurrentValueActive += calculateRealCashout(bet, market, opt);
        }
      });

    const totalPortfolioValue = availableCapital + totalCurrentValueActive;
    const totalPnl = totalCurrentValueActive - totalInvestedActive;
    const totalPnlPercentage = totalInvestedActive > 0 ? (totalPnl / totalInvestedActive) * 100 : 0;

    return {
      availableCapital,
      totalPortfolioValue,
      totalPnl,
      totalPnlPercentage,
    };
  }, [userBets, viewedProfile?.points, calculateRealCashout, marketOptions]);

  if (isLoading) return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!viewedProfile) return null;

  const isMe = currentUser?.id === profileId;
  const displayName = viewedProfile.username || "Usuario Anónimo";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavHeader points={myProfile?.points ?? 10000} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} onPointsUpdate={() => fetchAuth()} userId={currentUser?.id ?? null} userEmail={currentUser?.email ?? null} onOpenAuthModal={() => setIsAuthModalOpen(true)} onSignOut={async () => { await supabase.auth.signOut(); router.push("/"); }} isAdmin={myProfile?.role === "admin"} username={myProfile?.username} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/ranking"><ArrowLeft className="w-4 h-4 mr-2" /> Volver al Ranking</Link>
          </Button>
          
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-background shadow-sm overflow-hidden shrink-0">
                {viewedProfile.avatar_url ? <img src={viewedProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5" />}
             </div>
             <span className="font-bold text-foreground">{displayName}</span>
             {isMe && <Badge className="ml-2 bg-primary text-primary-foreground hidden sm:inline-flex">Tu Perfil</Badge>}
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          
          {/* LAS DOS CAJAS ESTILO POLYMARKET PARA EL PERFIL PÚBLICO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            
            {/* CAJA 1: Portfolio Value */}
            <Card className="bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <LineChart className="w-5 h-5" /> Portfolio
                  </div>
                </div>
                
                <div>
                  <p className="text-5xl font-black text-foreground mb-2 flex items-baseline gap-2 tracking-tight">
                    {portfolioStats.totalPortfolioValue.toLocaleString()} <span className="text-xl text-muted-foreground font-bold">pts</span>
                  </p>
                  
                  <p className={cn("text-sm font-bold flex items-center gap-1", portfolioStats.totalPnl >= 0 ? "text-[#00FF00]" : "text-[#FF0000]")}>
                    {portfolioStats.totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnl.toLocaleString()} pts ({portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnlPercentage.toFixed(2)}%)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CAJA 2: Profit/Loss */}
            <Card className="bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm rounded-2xl overflow-hidden relative">
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
              <svg className="absolute bottom-0 left-0 w-full h-24 text-primary/20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 100V80C10 80 20 90 30 70C40 50 50 60 60 40C70 20 80 30 90 10C95 0 100 20 100 20V100H0Z" fill="currentColor" />
                <path d="M0 80C10 80 20 90 30 70C40 50 50 60 60 40C70 20 80 30 90 10C95 0 100 20 100 20" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>

              <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className={cn("flex items-center gap-2 font-bold", portfolioStats.totalPnl >= 0 ? "text-[#00FF00]" : "text-[#FF0000]")}>
                    {portfolioStats.totalPnl >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />} Profit/Loss
                  </div>
                  
                  {/* Botones de Tiempo Interactivos */}
                  <div className="flex gap-1 bg-background/50 backdrop-blur-md rounded-lg p-1 border border-border/50">
                    <button 
                      onClick={() => setTimeframe('1D')}
                      className={cn("px-2 py-1 text-xs font-bold rounded-md transition-all", timeframe === '1D' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      1D
                    </button>
                    <button 
                      onClick={() => setTimeframe('ALL')}
                      className={cn("px-2 py-1 text-xs font-bold rounded-md transition-all", timeframe === 'ALL' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      ALL
                    </button>
                  </div>
                </div>
                
                <div>
                  <p className={cn("text-5xl font-black mb-2 flex items-baseline gap-2 tracking-tight", portfolioStats.totalPnl >= 0 ? "text-[#00FF00]" : "text-[#FF0000]")}>
                    {portfolioStats.totalPnl >= 0 ? '+' : ''}{portfolioStats.totalPnlPercentage.toFixed(2)}%
                  </p>
                  <p className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                    {timeframe === 'ALL' ? 'Rendimiento Histórico' : 'Rendimiento últimas 24hs'}
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* HISTORIAL DE APUESTAS (ESTILO BROKER) */}
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Historial de Predicciones
          </h2>
          
          <Card className="bg-card border-border/50 shadow-sm overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              {userBets.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">{isMe ? "Tu portfolio está vacío." : "Este usuario aún no ha operado."}</p>
                  {isMe && <Button size="lg" asChild className="mt-6 font-bold rounded-full"><Link href="/">Explorar Mercados</Link></Button>}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {userBets.map((bet) => {
                    const market = bet.markets;
                    if (!market) return null;

                    const isResolved = market.status === 'resolved';
                    const isOldBinary = bet.outcome === 'yes' || bet.outcome === 'no';
                    const opt = marketOptions.find(o => o.id === bet.outcome);
                    const displayOutcome = opt ? opt.option_name : (isOldBinary ? (bet.outcome === 'yes' ? "SÍ" : "NO") : "Opción");
                    const direction = bet.direction || 'yes';

                    const isOptBinary = ['sí', 'si', 'yes', 'no'].includes(displayOutcome.toLowerCase());
                    let predictionText = "";
                    if (isOptBinary) {
                      predictionText = direction === 'no' ? (displayOutcome.toLowerCase().includes('s') ? 'No' : 'Sí') : displayOutcome;
                    } else {
                      predictionText = `${direction === 'no' ? 'No' : 'Sí'} a ${displayOutcome}`;
                    }
                    const isEffectivelyNo = direction === 'no' || (isOptBinary && displayOutcome.toLowerCase() === 'no' && direction === 'yes');

                    let won = false;
                    if (isResolved) {
                      if (isOldBinary) {
                        won = market.winning_outcome === bet.outcome;
                      } else {
                        const wonYes = direction === 'yes' && market.winning_outcome === bet.outcome;
                        const wonNo = direction === 'no' && market.winning_outcome !== bet.outcome && market.winning_outcome !== null;
                        won = wonYes || wonNo;
                      }
                    }

                    let cashoutValue = 0;
                    let pnlPct = 0;
                    let isPositive = false;
                    let canSell = false;

                    if (!isResolved) {
                      canSell = isMe;
                      const shares = Number(bet.shares || 0);

                      if (shares > 0 && opt) {
                        cashoutValue = calculateRealCashout(bet, market, opt);
                      } else {
                        let currVal = bet.amount;
                        if (opt && bet.outcome.length > 10) {
                          const totalVotes = Number(opt.total_votes);
                          if (totalVotes > 0) currVal = (bet.amount / totalVotes) * Number(market.total_volume);
                        }
                        cashoutValue = Math.round(currVal * 0.95);
                      }

                      const pnl = cashoutValue - bet.amount;
                      pnlPct = (pnl / bet.amount) * 100;
                      isPositive = pnl >= 0;
                    }

                    return (
                      <Link href={`/market/${bet.market_id}`} key={bet.id} className="block p-5 sm:p-6 hover:bg-muted/30 transition-colors group">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-background">{market.category || "Mercado"}</Badge>
                              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(bet.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="font-bold text-lg sm:text-xl text-foreground group-hover:text-primary transition-colors line-clamp-2 pr-4 leading-tight">
                              {market.title || "Mercado no disponible"}
                            </h3>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 bg-muted/10 sm:bg-transparent p-4 sm:p-0 rounded-xl border sm:border-none border-border/50">
                            
                            <div className="flex flex-col min-w-[90px]">
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Inversión</p>
                              <p className="font-black text-foreground text-lg sm:text-xl flex items-center gap-1">
                                {bet.amount.toLocaleString()} <span className="text-xs font-bold text-muted-foreground mt-1">pts</span>
                              </p>
                            </div>

                            <div className="flex flex-col min-w-[120px]">
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Posición</p>
                              <Badge variant="outline" className={cn("text-xs sm:text-sm font-bold border h-7 sm:h-8 justify-center", isEffectivelyNo ? "bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/30" : "bg-[#00FF00]/10 text-[#00FF00] border-[#00FF00]/30")}>
                                {predictionText}
                              </Badge>
                            </div>

                            <div className="flex flex-col min-w-[90px] text-right sm:text-left">
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 hidden sm:block">Retorno</p>
                              {!isResolved ? (
                                  <span className={cn("font-black text-lg sm:text-xl", isPositive ? "text-[#00FF00]" : "text-[#FF0000]")}>
                                      {isPositive ? "+" : ""}{pnlPct.toFixed(1)}%
                                  </span>
                              ) : won ? (
                                  <span className="font-black text-lg sm:text-xl text-[#00FF00] flex items-center justify-end sm:justify-start gap-1"><CheckCircle2 className="w-5 h-5" /> Ganó</span>
                              ) : (
                                  <span className="font-black text-lg sm:text-xl text-[#FF0000] flex items-center justify-end sm:justify-start gap-1 opacity-90"><XCircle className="w-5 h-5" /> Perdió</span>
                              )}
                            </div>

                            {/* BOTÓN VENDER (Solo visible si es tuyo) */}
                            <div className="flex flex-col justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
                              {!isResolved && canSell && (
                                <Button
                                  onClick={(e) => handleSell(bet.id, e)}
                                  disabled={sellingBetId === bet.id}
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9 sm:h-10 px-4 w-full sm:w-auto shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all rounded-lg"
                                >
                                  {sellingBetId === bet.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                                  Vender por {cashoutValue.toLocaleString()} pts
                                </Button>
                              )}
                            </div>

                          </div>

                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={() => { setIsAuthModalOpen(false); fetchAuth(); }} isDarkMode={isDarkMode} />
    </div>
  );
}
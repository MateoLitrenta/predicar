"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { sellBet } from "@/lib/actions";
import { Loader2, ArrowLeft, Clock, Coins, X, User as UserIcon, MessageSquare, Reply, ChevronDown, ChevronUp, Trash2, ArrowDownRight, ArrowUpRight, TrendingUp, LineChart as LineChartIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MarketDetailClientProps {
  marketId: string;
}

export default function MarketDetailClient({ marketId }: MarketDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [market, setMarket] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]); 
  const [activityFeed, setActivityFeed] = useState<any[]>([]); 
  const [comments, setComments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Estados de Trading
  const [tradeTab, setTradeTab] = useState("buy");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'yes' | 'no'>('yes');
  const [betAmount, setBetAmount] = useState("");
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  
  const [userBets, setUserBets] = useState<any[]>([]);
  const [sellingBetId, setSellingBetId] = useState<string | null>(null);

  // Estados de Comentarios
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchUserAndProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      const { data: pData } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
      setProfile(pData);
    } else {
      setUser(null);
      setProfile(null);
    }
  }, [supabase]);

  const fetchUserBets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('bets').select('*').eq('market_id', marketId).eq('user_id', user.id);
    setUserBets(data || []);
  }, [user, marketId, supabase]);

  const fetchData = useCallback(async () => {
    const { data: mData, error: mError } = await supabase.from("markets").select("*").eq("id", marketId).single();
    if (mError) {
      toast({ title: "Error", description: "Mercado no encontrado", variant: "destructive" });
      router.push("/");
      return;
    }
    setMarket(mData);

    const { data: optionsData } = await supabase.from("market_options").select("*").eq("market_id", marketId).order("created_at", { ascending: true });
    setOptions(optionsData || []);

    const { data: newHistoryData } = await supabase.from("market_option_history").select("*").eq("market_id", marketId).order("created_at", { ascending: true });
    const { data: oldHistoryData } = await supabase.from("market_history").select("*").eq("market_id", marketId).order("created_at", { ascending: true });

    let formattedHistory: any[] = [];
    if (newHistoryData && newHistoryData.length > 0) {
      const historyMap = new Map();
      newHistoryData.forEach(h => {
        const time = new Date(h.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        if (!historyMap.has(time)) historyMap.set(time, { time });
        historyMap.get(time)[h.option_id] = Number(h.percentage);
      });
      formattedHistory = Array.from(historyMap.values());
    } else if (oldHistoryData && oldHistoryData.length > 0 && optionsData && optionsData.length === 2) {
      const yesOpt = optionsData.find(o => o.option_name.toLowerCase().includes('s'));
      const noOpt = optionsData.find(o => o.option_name.toLowerCase().includes('n'));
      formattedHistory = oldHistoryData.map(h => ({
        time: new Date(h.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        [yesOpt?.id || 'yes']: h.yes_percentage,
        [noOpt?.id || 'no']: 100 - h.yes_percentage,
      }));
    }

    if (formattedHistory.length === 1) formattedHistory.push({ ...formattedHistory[0], time: "Ahora" });
    setHistory(formattedHistory);

    const { data: betsData } = await supabase.from("bets").select("*").eq("market_id", marketId).order("created_at", { ascending: false });
    const { data: cashoutsData } = await supabase.from("transactions").select("*").eq("market_id", marketId).eq("type", "cashout").order("created_at", { ascending: false });

    const rawBets = betsData || [];
    const rawCashouts = cashoutsData || [];
    
    const userIds = [...new Set([...rawBets.map(b => b.user_id), ...rawCashouts.map(c => c.user_id)])];
    const profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, username").in("id", userIds);
      if (profilesData) profilesData.forEach(p => { profileMap[p.id] = p.username || "Usuario Anónimo"; });
    }

    const mappedBets = rawBets.map(bet => ({ ...bet, activityType: 'bet', profiles: { username: profileMap[bet.user_id] || "Usuario Anónimo" } }));
    const mappedCashouts = rawCashouts.map(c => ({ ...c, activityType: 'cashout', profiles: { username: profileMap[c.user_id] || "Usuario Anónimo" } }));

    const combinedFeed = [...mappedBets, ...mappedCashouts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivityFeed(combinedFeed);

    const { data: commentsData } = await supabase.from("comments").select("*, profiles(username, avatar_url)").eq("market_id", marketId).order("created_at", { ascending: true }); 
    setComments(commentsData || []);
    
    setIsLoading(false);
  }, [marketId, router, supabase]);

  useEffect(() => {
    fetchUserAndProfile();
    fetchData();
  }, [fetchUserAndProfile, fetchData]);

  useEffect(() => {
    if (user) fetchUserBets();
  }, [user, fetchData, fetchUserBets]);

  useEffect(() => {
    const channel = supabase.channel(`market-${marketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `market_id=eq.${marketId}` }, () => { fetchData(); fetchUserBets(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "market_options", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [marketId, supabase, fetchData, fetchUserBets]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  // CÁLCULO DE PRECIOS AMM
  const getOptionPrice = (optionVotes: number) => {
    const totalVol = Number(market?.total_volume || 0);
    const totalOpts = options.length || 2;
    let price = (Number(optionVotes) + 100.0) / (totalVol + (totalOpts * 100.0));
    return Math.max(0.01, Math.min(0.99, price));
  };

  const handlePlaceBet = async () => {
    if (!user) { setIsAuthModalOpen(true); return; }
    if (!selectedOptionId || !betAmount) return;

    const numericAmount = parseInt(betAmount, 10);
    const userPoints = profile?.points || 0;

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Monto inválido", description: "Ingresá una cantidad mayor a 0", variant: "destructive" });
      return;
    }
    if (numericAmount > userPoints) {
      toast({ title: "Saldo Insuficiente", description: `Solo tenés ${userPoints} pts disponibles.`, variant: "destructive" });
      return;
    }

    setIsPlacingBet(true);
    
    const { error } = await supabase.rpc("realizar_apuesta", { 
      p_amount: numericAmount, 
      p_market_id: marketId, 
      p_outcome: selectedOptionId,
      p_direction: selectedDirection
    });
    
    setIsPlacingBet(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const optionName = options.find(o => o.id === selectedOptionId)?.option_name || "la opción";
      const directionText = selectedDirection === 'yes' ? 'a favor de' : 'en contra de';
      toast({ title: "¡Orden ejecutada!", description: `Compraste acciones ${directionText} ${optionName}` });
      setBetAmount("");
      fetchUserAndProfile();
      fetchUserBets();
    }
  };

  const handleSellBet = async (betId: string) => {
    setSellingBetId(betId);
    const { ok, error, cashoutValue } = await sellBet(betId);
    
    if (!ok) {
      toast({ title: "Error al vender", description: error || "Hubo un problema", variant: "destructive" });
    } else {
      toast({ title: "¡Venta exitosa!", description: `Tus ganancias de ${cashoutValue?.toLocaleString()} pts ya están en tu cuenta.` });
      fetchUserAndProfile();
      fetchUserBets();
    }
    setSellingBetId(null);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setIsAuthModalOpen(true); return; }
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from("comments").insert({ market_id: marketId, user_id: user.id, content: newComment.trim(), parent_id: replyingTo ? replyingTo.id : null });
      if (error) throw error;
      setNewComment(""); setReplyingTo(null); fetchData();
    } catch (err: any) { toast({ title: "Error al comentar", description: err.message, variant: "destructive" }); } finally { setIsSubmittingComment(false); }
  };

  const executeDeleteComment = async () => {
    if (!commentToDelete) return;
    setIsDeletingComment(true);
    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentToDelete);
      if (error) throw error;
      setCommentToDelete(null); fetchData();
    } catch (err: any) { toast({ title: "Error al borrar", description: err.message, variant: "destructive" }); } finally { setIsDeletingComment(false); }
  };

  const openUserProfile = async (userId: string, username: string) => { setIsProfileModalOpen(true); };
  const toggleThread = (commentId: string) => { setExpandedThreads(prev => ({ ...prev, [commentId]: !prev[commentId] })); };

  if (isLoading) return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!market) return null;

  const totalVotesMulti = options.reduce((sum, opt) => sum + Number(opt.total_votes), 0);
  const topLevelComments = comments.filter(c => !c.parent_id).reverse();

  const renderComment = (comment: any, isReply = false) => {
    const replies = comments.filter(c => c.parent_id === comment.id);
    const isExpanded = !!expandedThreads[comment.id];
    const isMyComment = user?.id === comment.user_id;

    return (
      <div key={comment.id} className={cn("flex flex-col gap-3", isReply ? "mt-3" : "mt-4")}>
        <div className={cn("flex gap-3 sm:gap-4 p-4 rounded-xl transition-colors relative group", isReply ? "bg-muted/10 border border-border/30" : "bg-card border border-border/50")}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" onClick={() => openUserProfile(comment.user_id, comment.profiles?.username || "Usuario")}>
            {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-sm">{comment.profiles?.username || "Usuario Anónimo"}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(comment.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed break-words">{comment.content}</p>
            <div className="mt-2 flex items-center gap-4">
              <button onClick={() => { setReplyingTo(comment); document.getElementById("comment-input")?.focus(); }} className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><Reply className="w-3 h-3" /> Responder</button>
              {replies.length > 0 && (
                <button onClick={() => toggleThread(comment.id)} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  {isExpanded ? <><ChevronUp className="w-4 h-4" /> Ocultar respuestas</> : <><ChevronDown className="w-4 h-4" /> Ver {replies.length} respuestas</>}
                </button>
              )}
            </div>
          </div>
          {isMyComment && (
             <button onClick={() => { setCommentToDelete(comment.id); executeDeleteComment(); }} className="absolute top-4 right-4 text-muted-foreground opacity-50 hover:opacity-100 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
        {replies.length > 0 && isExpanded && <div className="ml-8 sm:ml-12 pl-4 border-l-2 border-border/50 flex flex-col gap-2">{replies.map(reply => renderComment(reply, true))}</div>}
      </div>
    );
  };

  const UltimasApuestasBlock = (
    <div className="pt-8 border-t border-border/50 lg:pt-0 lg:border-t-0">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ActivityIcon /> Actividad del Mercado</h3>
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {activityFeed.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Aún no hay actividad. ¡Sé el primero!</p>
        ) : (
          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {activityFeed.map((item) => {
              if (item.activityType === 'bet') {
                const opt = options.find(o => o.id === item.outcome);
                const isOldBinary = item.outcome === 'yes' || item.outcome === 'no';
                const displayOutcome = opt ? opt.option_name : (isOldBinary ? item.outcome : 'Opción');
                const optColor = opt ? opt.color : (item.outcome === 'yes' ? '#0ea5e9' : '#ef4444');

                return (
                  <div key={`bet-${item.id}`} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${optColor}30`, color: optColor }}>
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-medium text-sm">{item.profiles?.username || "Usuario"} invirtió</span>
                        <p className="text-xs text-muted-foreground block">{new Date(item.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{item.amount.toLocaleString()} pts</p>
                      <p className="text-xs font-medium uppercase truncate w-24" style={{ color: optColor }}>{displayOutcome}</p>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={`cashout-${item.id}`} className="flex items-center justify-between p-4 bg-muted/10 hover:bg-muted/30 transition-colors border-l-4 border-l-green-500">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-500/20 text-green-500">
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-medium text-sm">{item.profiles?.username || "Usuario"} retiró ganancias</span>
                        <p className="text-xs text-muted-foreground block">{new Date(item.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-500">+{item.amount.toLocaleString()} pts</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Cashout</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );

  const DebateBlock = (
    <div className="pt-8 border-t border-border/50">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><MessageSquare className="w-6 h-6 text-primary" /> Debate del Mercado</h3>
      <div className="mb-8 p-4 rounded-xl border border-border/50 bg-card shadow-sm sticky top-20 z-10">
        {replyingTo && (
          <div className="flex items-center justify-between bg-primary/10 text-primary px-3 py-2 rounded-lg mb-3 text-sm">
            <span className="flex items-center gap-2"><Reply className="w-4 h-4" /> Respondiendo a <b>{replyingTo.profiles?.username || 'Usuario'}</b></span>
            <button onClick={() => setReplyingTo(null)} className="hover:bg-primary/20 p-1 rounded-full"><X className="w-4 h-4" /></button>
          </div>
        )}
        <form onSubmit={handleAddComment} className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 hidden sm:flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 flex gap-2">
            <Input id="comment-input" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={user ? "Opiná sobre este mercado..." : "Iniciá sesión para comentar..."} disabled={isSubmittingComment || !user} className="bg-muted/20" />
            <Button type="submit" disabled={!newComment.trim() || isSubmittingComment || !user}>{isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}</Button>
          </div>
        </form>
      </div>
      <div className="space-y-2">
        {topLevelComments.length === 0 ? <p className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">Todavía no hay comentarios.</p> : topLevelComments.map(comment => renderComment(comment))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavHeader points={profile?.points ?? 10000} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} onPointsUpdate={() => fetchUserAndProfile()} userId={user?.id ?? null} userEmail={user?.email ?? null} onOpenAuthModal={() => setIsAuthModalOpen(true)} onSignOut={async () => { await supabase.auth.signOut(); fetchUserAndProfile(); }} isAdmin={profile?.role === "admin"} username={profile?.username} />

      <main className="container mx-auto px-4 py-8 flex-1 max-w-6xl">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Volver a Mercados</Link>
        </Button>

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA: INFO, GRÁFICO Y LISTA DE COTIZACIONES */}
          <div className="lg:col-span-2 space-y-6 w-full order-1">
            <div className="flex gap-4 sm:gap-6 items-start">
              {market.image_url && <img src={market.image_url} alt="Mercado" className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 shadow-md border border-border/50" />}
              <div>
                <Badge variant="secondary" className="mb-3 capitalize">{market.category}</Badge>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">{market.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                  <div className="flex items-center gap-1.5"><Coins className="w-4 h-4" />{totalVotesMulti.toLocaleString()} pts Vol.</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Cierra: {new Date(market.end_date).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {market.description && <div className="p-5 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground leading-relaxed">{market.description}</div>}

            <div className="p-6 rounded-xl border border-border/50 bg-card shadow-sm">
              <h3 className="font-semibold mb-2 flex justify-between items-center">
                <span className="flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-primary" /> Tendencia del Mercado</span>
              </h3>

              {history.length > 0 && (
                <div className="h-[250px] w-full mt-4 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <XAxis dataKey="time" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} width={40} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      {options.map((opt) => (
                        <Line key={opt.id} type="monotone" dataKey={opt.id} stroke={opt.color} strokeWidth={3} dot={false} name={opt.option_name} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* NUEVA LISTA DE COTIZACIONES (Estilo Kalshi Mejorado) */}
            <div className="space-y-3">
              <div className="flex justify-between px-2 text-xs font-bold text-muted-foreground uppercase mb-2">
                <span>Posibles Resultados</span>
                <div className="flex items-center gap-8 sm:gap-24 pr-2 sm:pr-8">
                  <span className="hidden sm:block">Chance</span>
                  <span>Operar</span>
                </div>
              </div>
              
              {options.map((opt) => {
                const yesPrice = getOptionPrice(opt.total_votes);
                const yesCents = Math.round(yesPrice * 100);
                const noCents = 100 - yesCents;
                
                const isSelectedYes = selectedOptionId === opt.id && selectedDirection === 'yes';
                const isSelectedNo = selectedOptionId === opt.id && selectedDirection === 'no';

                return (
                  <div key={opt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/20 transition-colors gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-4 h-4 rounded-full shadow-inner shrink-0" style={{ backgroundColor: opt.color }} />
                      <span className="font-bold text-base sm:text-lg text-foreground truncate">{opt.option_name}</span>
                    </div>
                    
                    {/* Probabilidad en el medio */}
                    <div className="flex justify-start sm:justify-center w-16 sm:w-20 shrink-0 pl-7 sm:pl-0">
                      <span className="font-black text-xl text-foreground">{yesCents}%</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => { setSelectedOptionId(opt.id); setSelectedDirection('yes'); setTradeTab("buy"); }}
                        className={cn("flex-1 sm:w-24 h-11 font-bold text-sm transition-all border-2", isSelectedYes ? "bg-green-500/20 text-green-600 dark:text-green-500 border-green-500 shadow-sm" : "bg-card text-green-600 dark:text-green-500 border-border hover:border-green-500/50 hover:bg-green-500/10")}
                      >
                        Sí {yesCents}¢
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setSelectedOptionId(opt.id); setSelectedDirection('no'); setTradeTab("buy"); }}
                        className={cn("flex-1 sm:w-24 h-11 font-bold text-sm transition-all border-2", isSelectedNo ? "bg-red-500/20 text-red-600 dark:text-red-500 border-red-500 shadow-sm" : "bg-card text-red-600 dark:text-red-500 border-border hover:border-red-500/50 hover:bg-red-500/10")}
                      >
                        No {noCents}¢
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="hidden lg:block mt-8 pt-8 border-t border-border/50">{DebateBlock}</div>
            <div className="hidden lg:block mt-8 pt-8 border-t border-border/50">{UltimasApuestasBlock}</div>
          </div>

          {/* COLUMNA DERECHA: PANEL DE TRADING PROFESIONAL */}
          <div className="lg:col-span-1 lg:sticky lg:top-24 w-full order-2">
            <div className="rounded-2xl border border-border/50 bg-card shadow-xl overflow-hidden p-2 sm:p-3">
              
              <Tabs value={tradeTab} onValueChange={setTradeTab} className="w-full">
                {/* TABS ESTILO PASTILLA (Modernas) */}
                <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl mb-4">
                  <TabsTrigger value="buy" className="rounded-lg text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground">
                    Comprar
                  </TabsTrigger>
                  <TabsTrigger value="sell" className="rounded-lg text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all text-muted-foreground">
                    Vender
                  </TabsTrigger>
                </TabsList>

                {/* PESTAÑA COMPRAR */}
                <TabsContent value="buy" className="p-2 sm:p-3 mt-0">
                  <div className="flex flex-col gap-4">
                    {!selectedOptionId ? (
                      <div className="p-6 text-center border-2 border-dashed border-border/50 rounded-xl bg-muted/10">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-sm font-medium text-muted-foreground">Seleccioná Sí o No en cualquier opción para operar.</p>
                      </div>
                    ) : (
                      <>
                        <div className={cn("p-4 rounded-xl border", selectedDirection === 'yes' ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10')}>
                          <p className={cn("text-xs font-bold uppercase mb-1 opacity-90", selectedDirection === 'yes' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>Estás comprando</p>
                          <div className="flex justify-between items-center">
                            <span className={cn("font-black text-lg sm:text-xl", selectedDirection === 'yes' ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500')}>
                              Comprar {selectedDirection === 'yes' ? 'Sí' : 'No'}
                            </span>
                            <span className={cn("font-bold text-xl", selectedDirection === 'yes' ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500')}>
                              {selectedDirection === 'yes' 
                                ? Math.round(getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes) * 100) 
                                : 100 - Math.round(getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes) * 100)}¢
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1 truncate text-foreground/80">{options.find(o => o.id === selectedOptionId)?.option_name}</p>
                        </div>

                        <div>
                          <Label className="text-muted-foreground mb-1.5 block">Monto a invertir</Label>
                          <div className="relative">
                            <Input type="number" placeholder="0" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="pl-4 h-14 text-xl font-bold bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">pts</span>
                          </div>
                        </div>

                        {betAmount && !isNaN(Number(betAmount)) && Number(betAmount) > 0 && (
                          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Precio por acción</span>
                              <span className="font-bold">
                                {selectedDirection === 'yes' 
                                  ? Math.round(getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes) * 100) 
                                  : 100 - Math.round(getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes) * 100)}¢
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Acciones estimadas</span>
                              <span className={cn("font-bold", selectedDirection === 'yes' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>
                                ~{Math.floor(Number(betAmount) / (selectedDirection === 'yes' ? getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes) : (1 - getOptionPrice(options.find(o => o.id === selectedOptionId)?.total_votes)))).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {user && (
                          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                            <span>Balance disponible:</span>
                            <span className="font-bold text-foreground">{(profile?.points || 0).toLocaleString()} pts</span>
                          </div>
                        )}
                        
                        <Button 
                          size="lg" 
                          className={cn("w-full h-14 text-lg font-bold text-white shadow-lg mt-2 transition-all hover:scale-[1.02] active:scale-[0.98]", selectedDirection === 'yes' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20')} 
                          disabled={!betAmount || isPlacingBet} 
                          onClick={handlePlaceBet}
                        >
                          {isPlacingBet ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</> : !user ? "Ingresar para Operar" : `Confirmar Orden`}
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>

                {/* PESTAÑA VENDER */}
                <TabsContent value="sell" className="p-2 sm:p-3 mt-0">
                  {!user ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm mb-4">Iniciá sesión para ver tu portfolio.</p>
                      <Button onClick={() => setIsAuthModalOpen(true)}>Ingresar</Button>
                    </div>
                  ) : userBets.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-border/50 rounded-xl bg-muted/10">
                      <Coins className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm font-medium text-muted-foreground">No tenés posiciones activas en este mercado.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                      {userBets.map(bet => {
                        const opt = options.find(o => o.id === bet.outcome);
                        const shares = Number(bet.shares || 0);
                        const currentYesPrice = getOptionPrice(opt?.total_votes || 0);
                        
                        const currentPrice = bet.direction === 'no' ? (1 - currentYesPrice) : currentYesPrice;
                        const cashoutVal = shares > 0 ? Math.round(shares * currentPrice) : Math.round(bet.amount * 0.95); 
                        const pnl = cashoutVal - bet.amount;
                        const pnlPct = (pnl / bet.amount) * 100;

                        return (
                          <div key={bet.id} className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Tu posición</p>
                                <p className="font-bold text-foreground">
                                  <span className={cn("mr-1", bet.direction === 'no' ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500")}>
                                    {bet.direction === 'no' ? 'No' : 'Sí'}
                                  </span> a {opt?.option_name || "Opción"}
                                </p>
                              </div>
                              <Badge variant="outline" className={cn("font-bold border", pnl >= 0 ? "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/30" : "bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/30")}>
                                {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm bg-background p-2 rounded-lg border border-border/50">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Inversión</p>
                                <p className="font-semibold">{bet.amount} pts</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground">Valor Actual</p>
                                <p className="font-bold text-primary">{cashoutVal} pts</p>
                              </div>
                            </div>

                            <Button 
                              size="sm" 
                              className="w-full h-10 font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground" 
                              onClick={() => handleSellBet(bet.id)} 
                              disabled={sellingBetId === bet.id}
                            >
                              {sellingBetId === bet.id ? <Loader2 className="w-4 h-4 animate-spin" /> : `Liquidar por ${cashoutVal} pts`}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="block lg:hidden w-full order-3 mt-2">{DebateBlock}</div>
          <div className="block lg:hidden w-full order-4 mt-2">{UltimasApuestasBlock}</div>
        </div>
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={() => { setIsAuthModalOpen(false); fetchUserAndProfile(); }} isDarkMode={isDarkMode} />
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}
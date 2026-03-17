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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, Clock, Coins, History, CheckCheck, X, User as UserIcon, MessageSquare, Reply, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// NUEVO IMPORT: Traemos la artillería pesada para los gráficos
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MarketDetailClientProps {
  marketId: string;
}

export default function MarketDetailClient({ marketId }: MarketDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [market, setMarket] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]); // NUEVO: Estado para el gráfico
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [selectedOption, setSelectedOption] = useState<"yes" | "no" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingProfileStats, setIsLoadingProfileStats] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);

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

  const fetchData = useCallback(async () => {
    const { data: mData, error: mError } = await supabase.from("markets").select("*").eq("id", marketId).single();
    if (mError) {
      toast({ title: "Error", description: "Mercado no encontrado", variant: "destructive" });
      router.push("/");
      return;
    }
    setMarket(mData);

    // NUEVO: Traemos las "fotos" del historial para el gráfico
    const { data: historyData } = await supabase
      .from("market_history")
      .select("*")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true });

    let formattedHistory = historyData?.map(h => ({
      time: new Date(h.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      yes: h.yes_percentage,
      no: 100 - h.yes_percentage,
    })) || [];

    // Truco: Si hay solo 1 foto (el mercado es muy nuevo), la duplicamos con "Ahora" para que se dibuje una línea recta
    if (formattedHistory.length === 1) {
      formattedHistory.push({ ...formattedHistory[0], time: "Ahora" });
    }
    setHistory(formattedHistory);

    const { data: betsData } = await supabase.from("bets").select("*").eq("market_id", marketId).order("created_at", { ascending: false });
    if (betsData && betsData.length > 0) {
      const userIds = [...new Set(betsData.map(b => b.user_id))];
      const { data: profilesData } = await supabase.from("profiles").select("id, username").in("id", userIds);
      const profileMap: Record<string, string> = {};
      if (profilesData) profilesData.forEach(p => { profileMap[p.id] = p.username || "Usuario Anónimo"; });
      setBets(betsData.map(bet => ({ ...bet, profiles: { username: profileMap[bet.user_id] || "Usuario Anónimo" } })));
    } else {
      setBets([]);
    }

    const { data: commentsData } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true }); 
    setComments(commentsData || []);
    
    setIsLoading(false);
  }, [marketId, router, supabase]);

  useEffect(() => {
    fetchUserAndProfile();
    fetchData();

    // Ahora también escuchamos si hay un cambio en el historial para actualizar el gráfico en vivo
    const channel = supabase.channel(`market-${marketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "market_history", filter: `market_id=eq.${marketId}` }, () => { fetchData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUserAndProfile, fetchData, marketId, supabase]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const handlePlaceBet = async () => {
    if (!user) { setIsAuthModalOpen(true); return; }
    if (!selectedOption || !betAmount) return;

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
    const { error } = await supabase.rpc("realizar_apuesta", { p_amount: numericAmount, p_market_id: marketId, p_outcome: selectedOption });
    setIsPlacingBet(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "¡Apuesta confirmada!", description: `Invertiste ${numericAmount} pts al ${selectedOption.toUpperCase()}` });
      setBetAmount("");
      fetchUserAndProfile();
      // ¡Acá no hace falta hacer fetchData() porque el Tiempo Real del historial lo va a actualizar solo!
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setIsAuthModalOpen(true); return; }
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from("comments").insert({
        market_id: marketId,
        user_id: user.id,
        content: newComment.trim(),
        parent_id: replyingTo ? replyingTo.id : null
      });

      if (error) throw error;

      if (replyingTo && replyingTo.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: replyingTo.user_id,
          sender_id: user.id,
          market_id: marketId,
          type: 'reply',
          message: 'Alguien respondió a tu comentario'
        });
        
        setExpandedThreads(prev => ({ ...prev, [replyingTo.id]: true }));
      }

      setNewComment("");
      setReplyingTo(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error al comentar", description: err.message || "Revisá la consola", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const executeDeleteComment = async () => {
    if (!commentToDelete) return;
    setIsDeletingComment(true);
    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentToDelete);
      if (error) throw error;
      toast({ title: "Comentario eliminado", description: "Tu mensaje fue borrado con éxito." });
      setCommentToDelete(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error al borrar", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletingComment(false);
    }
  };

  const openUserProfile = async (userId: string, username: string) => {
    setSelectedUserProfile({ id: userId, username, points: 0, rank: 0, winRate: 0, totalResolved: 0, avatar_url: null });
    setIsProfileModalOpen(true);
    setIsLoadingProfileStats(true);

    try {
      const { data: pData } = await supabase.from('profiles').select('points, avatar_url').eq('id', userId).single();
      const userPoints = pData?.points || 0;
      const userAvatarUrl = pData?.avatar_url || null;

      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('points', userPoints);
      const userRank = (count || 0) + 1;

      const { data: bData } = await supabase.from('bets').select('outcome, markets(status, winning_outcome)').eq('user_id', userId);
      let wins = 0; let resolvedCount = 0;
      if (bData) {
        bData.forEach((bet) => {
          const m = Array.isArray(bet.markets) ? bet.markets[0] : bet.markets;
          if (m && m.status === 'resolved') {
            resolvedCount++;
            if (m.winning_outcome === bet.outcome) wins++;
          }
        });
      }
      const winRate = resolvedCount > 0 ? Math.round((wins / resolvedCount) * 100) : 0;

      setSelectedUserProfile({ id: userId, username, points: userPoints, rank: userRank, winRate, totalResolved: resolvedCount, avatar_url: userAvatarUrl });
    } catch (err) {
      console.error("Error", err);
    } finally {
      setIsLoadingProfileStats(false);
    }
  };

  const toggleThread = (commentId: string) => {
    setExpandedThreads(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  if (isLoading) return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!market) return null;

  const totalVotes = Number(market.yes_votes) + Number(market.no_votes);
  const yesPercentage = totalVotes === 0 ? 50 : Math.round((Number(market.yes_votes) / totalVotes) * 100);
  const noPercentage = 100 - yesPercentage;

  const topLevelComments = comments.filter(c => !c.parent_id).reverse();

  const renderComment = (comment: any, isReply = false) => {
    const userBets = bets.filter(b => b.user_id === comment.user_id);
    const hasBet = userBets.length > 0;
    const totalBet = hasBet ? userBets.reduce((sum, b) => sum + Number(b.amount), 0) : 0;
    const mainOutcome = hasBet ? userBets[0].outcome : null;

    const replies = comments.filter(c => c.parent_id === comment.id);
    const isExpanded = !!expandedThreads[comment.id];
    const isMyComment = user?.id === comment.user_id;

    return (
      <div key={comment.id} className={cn("flex flex-col gap-3", isReply ? "mt-3" : "mt-4")}>
        <div className={cn("flex gap-3 sm:gap-4 p-4 rounded-xl transition-colors relative group", isReply ? "bg-muted/10 border border-border/30" : "bg-card border border-border/50 hover:border-primary/30")}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-primary/20 cursor-pointer" onClick={() => openUserProfile(comment.user_id, comment.profiles?.username || "Usuario")}>
            {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => openUserProfile(comment.user_id, comment.profiles?.username || "Usuario")}>{comment.profiles?.username || "Usuario Anónimo"}</span>
              {hasBet && (
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border", mainOutcome === 'yes' ? "bg-primary/10 text-primary border-primary/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                  {mainOutcome === 'yes' ? 'SÍ' : 'NO'} ({totalBet.toLocaleString()} pts)
                </span>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(comment.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed break-words">{comment.content}</p>
            <div className="mt-2 flex items-center gap-4">
              <button onClick={() => { setReplyingTo(comment); document.getElementById("comment-input")?.focus(); }} className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <Reply className="w-3 h-3" /> Responder
              </button>
              {replies.length > 0 && (
                <button onClick={() => toggleThread(comment.id)} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  {isExpanded ? <><ChevronUp className="w-4 h-4" /> Ocultar respuestas</> : <><ChevronDown className="w-4 h-4" /> Ver {replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}</>}
                </button>
              )}
            </div>
          </div>
          {isMyComment && (
            <button onClick={() => setCommentToDelete(comment.id)} className="absolute top-4 right-4 text-muted-foreground opacity-50 hover:opacity-100 hover:text-red-500 transition-all" title="Eliminar mi comentario">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {replies.length > 0 && isExpanded && (
          <div className="ml-8 sm:ml-12 pl-4 border-l-2 border-border/50 flex flex-col gap-2">
            {replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  const UltimasApuestasBlock = (
    <div className="pt-8 border-t border-border/50 lg:pt-0 lg:border-t-0">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Últimas Apuestas</h3>
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {bets.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Nadie ha apostado aún. ¡Sé el primero!</p>
        ) : (
          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {bets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", bet.outcome === 'yes' ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-500")}>
                    {bet.outcome === 'yes' ? <CheckCheck className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div>
                    <button onClick={() => openUserProfile(bet.user_id, bet.profiles?.username || "Usuario Anónimo")} className="font-medium text-sm hover:text-primary transition-colors hover:underline text-left">
                      {bet.profiles?.username || "Usuario Anónimo"}
                    </button>
                    <p className="text-xs text-muted-foreground block">{new Date(bet.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{bet.amount.toLocaleString()} pts</p>
                  <p className={cn("text-xs font-medium uppercase", bet.outcome === 'yes' ? "text-primary" : "text-red-500")}>{bet.outcome}</p>
                </div>
              </div>
            ))}
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
            <button onClick={() => setReplyingTo(null)} className="hover:bg-primary/20 p-1 rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}
        <form onSubmit={handleAddComment} className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 hidden sm:flex items-center justify-center shrink-0 overflow-hidden border border-primary/20">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Tu Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 flex gap-2">
            <Input id="comment-input" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={user ? (replyingTo ? "Escribí tu respuesta..." : "Opiná sobre este mercado...") : "Iniciá sesión para comentar..."} className="flex-1 bg-muted/20" disabled={isSubmittingComment || !user} />
            <Button type="submit" disabled={!newComment.trim() || isSubmittingComment || !user}>{isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}</Button>
          </div>
        </form>
      </div>
      <div className="space-y-2">
        {topLevelComments.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">Todavía no hay comentarios. ¡Rompé el hielo!</p>
        ) : (
          topLevelComments.map(comment => renderComment(comment))
        )}
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
          <div className="lg:col-span-2 space-y-8 w-full order-1">
            <div className="flex gap-4 sm:gap-6 items-start">
              {market.image_url && <img src={market.image_url} alt="Mercado" className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 shadow-md border border-border/50" />}
              <div>
                <Badge variant="secondary" className="mb-3 capitalize">{market.category}</Badge>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">{market.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                  <div className="flex items-center gap-1.5"><Coins className="w-4 h-4" />{market.total_volume.toLocaleString()} pts Vol.</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Cierra: {new Date(market.end_date).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {market.description && <div className="p-5 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground leading-relaxed">{market.description}</div>}

            <div className="p-6 rounded-xl border border-border/50 bg-card">
              <h3 className="font-semibold mb-2 flex justify-between">
                <span>Historial del Mercado</span>
                <span className="text-muted-foreground font-normal">{totalVotes.toLocaleString()} pts en juego</span>
              </h3>

              {/* NUEVO: GRÁFICO DE RECHARTS ACÁ ADENTRO */}
              <div className="h-[250px] w-full mt-4 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <XAxis dataKey="time" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} width={40} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ fontWeight: 'bold' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                    />
                    <Line type="linear" dataKey="yes" stroke="#0ea5e9" strokeWidth={3} dot={false} name="Sí" />
                    <Line type="linear" dataKey="no" stroke="#ef4444" strokeWidth={3} dot={false} name="No" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between font-bold text-lg mb-3">
                <span className="text-primary">Sí {yesPercentage}%</span>
                <span className="text-red-500">No {noPercentage}%</span>
              </div>
              <div className="h-4 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${yesPercentage}%` }} />
                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${noPercentage}%` }} />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-3 font-medium">
                <span>{market.yes_votes.toLocaleString()} pts</span>
                <span>{market.no_votes.toLocaleString()} pts</span>
              </div>
            </div>

            <div className="hidden lg:block mt-8">{DebateBlock}</div>
            <div className="hidden lg:block mt-8 pt-8 border-t border-border/50">{UltimasApuestasBlock}</div>
          </div>

          <div className="lg:col-span-1 lg:sticky lg:top-24 w-full order-2">
            <div className="rounded-2xl border border-border/50 bg-card shadow-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2"><Coins className="w-5 h-5 text-amber-500" /> Operar Mercado</h2>
              <div className="flex gap-2 mb-6">
                <button onClick={() => setSelectedOption("yes")} className={cn("flex-1 py-3 px-4 rounded-xl font-bold transition-all border-2", selectedOption === "yes" ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-transparent border-border hover:border-primary/50 text-foreground")}>Comprar Sí</button>
                <button onClick={() => setSelectedOption("no")} className={cn("flex-1 py-3 px-4 rounded-xl font-bold transition-all border-2", selectedOption === "no" ? "bg-red-500 border-red-500 text-white shadow-md" : "bg-transparent border-border hover:border-red-500/50 text-foreground")}>Comprar No</button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <Label className="text-muted-foreground mb-1.5 block">Monto a invertir</Label>
                  <div className="relative">
                    <Input type="number" placeholder="Ej: 1000" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="pl-4 h-12 text-lg font-medium" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">pts</span>
                  </div>
                </div>
                {user && (
                  <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/40 border border-border/50">
                    <span className="text-muted-foreground">Tu balance:</span>
                    <span className="font-bold text-foreground">{(profile?.points || 0).toLocaleString()} pts</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {[100, 500, 1000].map((amt) => (<Button key={amt} variant="outline" size="sm" className="flex-1 bg-background" onClick={() => setBetAmount(amt.toString())} disabled={!user || amt > (profile?.points || 0)}>+{amt}</Button>))}
                </div>
              </div>
              <Button size="lg" className={cn("w-full h-12 text-base font-bold", selectedOption === 'no' ? "bg-red-600 hover:bg-red-700 text-white" : "")} disabled={!selectedOption || !betAmount || isPlacingBet} onClick={handlePlaceBet}>
                {isPlacingBet ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</> : !user ? "Ingresar para Operar" : !selectedOption ? "Seleccioná Sí o No" : `Confirmar Inversión`}
              </Button>
            </div>
          </div>

          <div className="block lg:hidden w-full order-3 mt-2">{DebateBlock}</div>
          <div className="block lg:hidden w-full order-4 mt-2">{UltimasApuestasBlock}</div>
        </div>
      </main>

      <Dialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-center text-xl flex items-center justify-center gap-2 text-red-500"><Trash2 className="w-6 h-6" /> ¿Eliminar comentario?</DialogTitle></DialogHeader>
          <div className="text-center py-4 text-muted-foreground">¿Estás seguro de que querés borrar este mensaje? <br /><span className="text-xs mt-2 block opacity-80">(Si tiene respuestas, también se van a eliminar)</span></div>
          <div className="flex gap-3 justify-center mt-2">
            <Button variant="outline" onClick={() => setCommentToDelete(null)} disabled={isDeletingComment} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={executeDeleteComment} disabled={isDeletingComment} className="flex-1">{isDeletingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sí, eliminar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-center">Resumen del Jugador</DialogTitle></DialogHeader>
          {isLoadingProfileStats ? (
             <div className="py-12 flex flex-col items-center justify-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin text-primary mb-4" /><p className="text-sm">Analizando estadísticas...</p></div>
          ) : selectedUserProfile ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-sm overflow-hidden">
                {selectedUserProfile.avatar_url ? <img src={selectedUserProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-primary" />}
              </div>
              <h3 className="text-2xl font-bold text-foreground mt-1">{selectedUserProfile.username}</h3>
              <div className="grid grid-cols-2 gap-3 w-full text-center mt-2">
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 shadow-sm"><p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Puntos</p><p className="font-bold text-lg text-amber-500">{selectedUserProfile.points.toLocaleString()}</p></div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 shadow-sm"><p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Ranking</p><p className="font-bold text-lg text-foreground">#{selectedUserProfile.rank}</p></div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 col-span-2 shadow-sm"><p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Tasa de Acierto</p><p className="font-bold text-2xl text-green-500">{selectedUserProfile.totalResolved > 0 ? `${selectedUserProfile.winRate}%` : 'Sin datos'}</p><p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">De {selectedUserProfile.totalResolved} predicciones finalizadas</p></div>
              </div>
              <Button asChild className="w-full mt-4" size="lg"><Link href={`/profile/${selectedUserProfile.id}`}>Ver Perfil Completo</Link></Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={() => { setIsAuthModalOpen(false); fetchUserAndProfile(); }} isDarkMode={isDarkMode} />
    </div>
  );
}
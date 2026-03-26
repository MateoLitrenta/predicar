"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavHeader } from "@/components/nav-header";
import { AuthModal } from "@/components/auth-modal";
import { getProfile } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, User, Loader2, ArrowLeft, BarChart3, Target, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  portfolio_value: number;
  total_volume: number;
  total_predictions: number;
}

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const loadData = async () => {
    setIsLoading(true);
    const userProfile = await getProfile();
    setCurrentUser(userProfile);

    // Traemos el ranking con la función SQL
    const { data, error } = await supabase.rpc('get_leaderboard_stats');
    
    if (!error && data) {
      setUsers(data as LeaderboardUser[]);
    } else {
      // Ahora si hay error, nos va a decir exactamente qué pasó
      console.error("Error cargando ranking:", error?.message || error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-ordenamos las 3 listas usando el nuevo PORTFOLIO VALUE como principal
  const topPortfolio = useMemo(() => [...users].sort((a, b) => b.portfolio_value - a.portfolio_value).slice(0, 50), [users]);
  const topVolume = useMemo(() => [...users].sort((a, b) => b.total_volume - a.total_volume).slice(0, 50), [users]);
  const topPredictions = useMemo(() => [...users].sort((a, b) => b.total_predictions - a.total_predictions).slice(0, 50), [users]);

  // Función para renderizar medallas Top 3
  const renderRankBadge = (index: number) => {
    if (index === 0) return <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold text-xs shrink-0"><Medal className="w-3 h-3" /></div>;
    if (index === 1) return <div className="w-6 h-6 rounded-full bg-gray-400/20 text-gray-400 flex items-center justify-center font-bold text-xs shrink-0"><Medal className="w-3 h-3" /></div>;
    if (index === 2) return <div className="w-6 h-6 rounded-full bg-amber-600/20 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0"><Medal className="w-3 h-3" /></div>;
    return <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px] shrink-0">{index + 1}</div>;
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavHeader 
        points={currentUser?.points ?? 0} 
        isDarkMode={isDarkMode} 
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
        onPointsUpdate={() => loadData()} 
        userId={currentUser?.id ?? null} 
        userEmail={currentUser?.email ?? null} 
        onOpenAuthModal={() => setIsAuthModalOpen(true)} 
        onSignOut={async () => { await supabase.auth.signOut(); router.push("/"); }} 
        isAdmin={currentUser?.role === "admin"} 
        username={currentUser?.username} 
      />

      <main className="container mx-auto px-4 py-8 flex-1 max-w-7xl">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Volver a Mercados</Link>
        </Button>

        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-foreground flex items-center gap-3">
            <Trophy className="w-8 h-8 text-[#FFD700]" /> Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Descubrí quiénes son los mejores traders de PREDIX rankeados por su Poder de Fuego (Portfolio Total), volumen y actividad.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border/50">
            <BarChart3 className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Aún no hay traders para mostrar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            
            {/* COLUMNA 1: PORTFOLIO TOTAL (PODER DE FUEGO) */}
            <div className="bg-card/50 border border-border/50 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col h-[70vh] min-h-[500px]">
              <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4 sticky top-0 bg-card/90 backdrop-blur z-10">
                <div className="w-8 h-8 rounded-lg bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Portfolio Total</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {topPortfolio.map((user, i) => (
                  <Link href={`/profile/${user.user_id}`} key={`pts-${user.user_id}`}>
                    <div className={cn("flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer", currentUser?.id === user.user_id && "bg-[#FFD700]/10 border border-[#FFD700]/20 hover:bg-[#FFD700]/10")}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        {renderRankBadge(i)}
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                          {user.avatar_url ? <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-primary" />}
                        </div>
                        <span className={cn("font-medium text-sm truncate", currentUser?.id === user.user_id ? "text-[#FFD700] font-bold" : "text-foreground")}>
                          {user.username}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-foreground shrink-0 pl-2">
                        {user.portfolio_value.toLocaleString()} pts
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* COLUMNA 2: VOLUMEN */}
            <div className="bg-card/50 border border-border/50 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col h-[70vh] min-h-[500px]">
              <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4 sticky top-0 bg-card/90 backdrop-blur z-10">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Volumen Tradeado</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {topVolume.map((user, i) => (
                  <Link href={`/profile/${user.user_id}`} key={`vol-${user.user_id}`}>
                    <div className={cn("flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer", currentUser?.id === user.user_id && "bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/10")}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        {renderRankBadge(i)}
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                          {user.avatar_url ? <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-primary" />}
                        </div>
                        <span className={cn("font-medium text-sm truncate", currentUser?.id === user.user_id ? "text-blue-500 font-bold" : "text-foreground")}>
                          {user.username}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-blue-500 shrink-0 pl-2">
                        {user.total_volume.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* COLUMNA 3: PREDICCIONES */}
            <div className="bg-card/50 border border-border/50 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col h-[70vh] min-h-[500px]">
              <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4 sticky top-0 bg-card/90 backdrop-blur z-10">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Predicciones</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {topPredictions.map((user, i) => (
                  <Link href={`/profile/${user.user_id}`} key={`pred-${user.user_id}`}>
                    <div className={cn("flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer", currentUser?.id === user.user_id && "bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/10")}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        {renderRankBadge(i)}
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                          {user.avatar_url ? <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-primary" />}
                        </div>
                        <span className={cn("font-medium text-sm truncate", currentUser?.id === user.user_id ? "text-purple-500 font-bold" : "text-foreground")}>
                          {user.username}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-purple-500 shrink-0 pl-2">
                        {user.total_predictions.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={() => { setIsAuthModalOpen(false); loadData(); }} isDarkMode={isDarkMode} />
    </div>
  );
}
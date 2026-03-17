"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProfile, getMyBets, getMyTransactions, updateUserPassword, updateProfileSettings, sellBet, type BetWithMarket } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, User, ArrowLeft, Loader2, TrendingUp, TrendingDown, History, Pencil, Landmark, Lock, Camera, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = ["active", "pending"];
const FINISHED_STATUSES = ["resolved", "rejected"];

function getMarket(bet: BetWithMarket) {
  return bet.markets ?? bet.market ?? null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [bets, setBets] = useState<BetWithMarket[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingBets, setIsLoadingBets] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [sellingBetId, setSellingBetId] = useState<string | null>(null);
  
  // NUEVO ESTADO: Para el modal de vender
  const [betToSell, setBetToSell] = useState<{ id: string, title: string, outcomeName: string, cashoutValue: number } | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchUserData = useCallback(async () => {
    setIsLoadingBets(true);
    setIsLoadingTransactions(true);
    
    const [betsRes, txRes] = await Promise.all([
      getMyBets(),
      getMyTransactions()
    ]);
    
    if (!betsRes.error && betsRes.data) setBets(betsRes.data);
    if (!txRes.error && txRes.data) setTransactions(txRes.data);
    
    setIsLoadingBets(false);
    setIsLoadingTransactions(false);
  }, []);

  const fetchAuth = useCallback(async () => {
    const p = await getProfile();
    if (p) setProfile(p);
  }, []);

  useEffect(() => {
    const load = async () => {
      const p = await getProfile();
      if (!p) {
        router.replace("/");
        return;
      }
      setProfile(p);
      setNewUsername(p.username || "");
      setPreviewUrl((p as any).avatar_url || null);
      setIsChecking(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (profile?.id) fetchUserData();
  }, [profile?.id, fetchUserData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  // NUEVA FUNCIÓN: Ahora llama al modal en vez de vender directo
  const confirmSell = async () => {
    if (!betToSell) return;

    setSellingBetId(betToSell.id);
    const { ok, error, cashoutValue } = await sellBet(betToSell.id);
    
    if (!ok) {
      toast({ title: "Error al vender", description: error || "Hubo un problema", variant: "destructive" });
    } else {
      toast({ title: "¡Venta exitosa!", description: `Tus ganancias de ${cashoutValue?.toLocaleString()} pts ya están en tu cuenta.` });
      await fetchAuth();
      await fetchUserData();
    }
    setSellingBetId(null);
    setBetToSell(null); // Cierra el modal
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    
    setIsSaving(true);
    const supabase = createClient();
    let finalAvatarUrl = profile.avatar_url;

    if (selectedImage) {
      const fileExt = selectedImage.name.split('.').pop();
      const filePath = `${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, selectedImage, { upsert: true });

      if (uploadError) {
        toast({ title: "Error", description: "No se pudo subir la imagen. Intenta con una más liviana.", variant: "destructive" });
        setIsSaving(false);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      finalAvatarUrl = data.publicUrl;
    }

    const { ok, error } = await updateProfileSettings(newUsername.trim(), finalAvatarUrl);
    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron con éxito." });
      setProfile({ ...profile, username: newUsername.trim(), avatar_url: finalAvatarUrl });
      setIsEditModalOpen(false);
      setSelectedImage(null);
      router.refresh(); 
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" }); return; }

    setIsChangingPassword(true);
    const { ok, error } = await updateUserPassword(newPassword);
    setIsChangingPassword(false);

    if (error) { toast({ title: "Error al cambiar contraseña", description: error, variant: "destructive" }); } 
    else {
      toast({ title: "¡Contraseña actualizada!", description: "Tu contraseña se cambió correctamente." });
      setIsPasswordModalOpen(false); setNewPassword(""); setConfirmPassword("");
    }
  };

  if (isChecking) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return null;

  const displayName = profile.username || profile.email?.split("@")[0] || "Usuario";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavHeader points={profile.points ?? 10000} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} onPointsUpdate={() => {}} userId={profile.id} userEmail={profile.email ?? null} onOpenAuthModal={() => router.push("/")} onSignOut={async () => { await createClient().auth.signOut(); router.replace("/"); }} isAdmin={profile.role === "admin"} username={profile.username ?? null} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link href="/" className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Volver</Link>
        </Button>

        <div className="max-w-2xl mx-auto">
          <Card className="bg-card border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Mi Perfil</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsPasswordModalOpen(true)} title="Cambiar Contraseña"><Lock className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => { setNewUsername(profile.username || ""); setPreviewUrl(profile.avatar_url || null); setSelectedImage(null); setIsEditModalOpen(true); }}><Pencil className="w-4 h-4 mr-2" /> Editar</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 overflow-hidden shrink-0">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-10 h-10" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Usuario</p>
                  <p className="text-2xl font-bold text-foreground truncate">{displayName}</p>
                  {profile.email && <p className="text-sm text-muted-foreground mt-0.5 truncate">{profile.email}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/20 border border-secondary/30">
                <Coins className="w-10 h-10 text-amber-500 drop-shadow-md" />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                  <p className="text-3xl font-bold text-foreground">
                    {(profile.points ?? 0).toLocaleString()} <span className="text-lg text-muted-foreground font-medium">pts</span>
                  </p>
                </div>
              </div>

              {profile.role === "admin" && (
                <Button asChild className="w-full bg-slate-800 text-white hover:bg-slate-700">
                  <Link href="/admin" className="flex items-center justify-center gap-2">Panel de Administración</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 mt-6 shadow-md">
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 mb-6">
                  <TabsTrigger value="active" className="flex items-center gap-1.5 text-xs sm:text-sm"><TrendingUp className="w-4 h-4" /><span className="hidden sm:inline">Activas</span></TabsTrigger>
                  <TabsTrigger value="finished" className="flex items-center gap-1.5 text-xs sm:text-sm"><History className="w-4 h-4" /><span className="hidden sm:inline">Finalizadas</span></TabsTrigger>
                  <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs sm:text-sm"><Landmark className="w-4 h-4" /><span className="hidden sm:inline">Movimientos</span></TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-4">
                  {isLoadingBets ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : bets.filter((b) => getMarket(b) && ACTIVE_STATUSES.includes(String(getMarket(b)!.status).toLowerCase())).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No tenés apuestas activas en este momento.</p>
                  ) : (
                    bets
                      .filter((b) => getMarket(b) && ACTIVE_STATUSES.includes(String(getMarket(b)!.status).toLowerCase()))
                      .map((bet) => {
                        const market = getMarket(bet);
                        const opt = bet.option_details;
                        const isOldBinary = bet.outcome === "yes" || bet.outcome === "no";
                        const displayOutcome = opt ? opt.option_name : (isOldBinary ? (bet.outcome === "yes" ? "SÍ" : "NO") : "Opción");
                        const optColor = opt ? opt.color : (bet.outcome === "yes" ? "#0ea5e9" : "#ef4444");

                        let cashoutValue = 0;
                        let canSell = false;
                        
                        if (market) {
                          canSell = true;
                          const totalVol = Number(market.total_volume || 0);
                          let currVal = bet.amount;

                          if (opt && bet.outcome.length > 10) {
                            const totalVotes = Number(opt.total_votes);
                            if (totalVotes > 0) currVal = (bet.amount / totalVotes) * totalVol;
                          } else if (isOldBinary) {
                            const totalVotes = bet.outcome === "yes" ? Number(market.yes_votes || 0) : Number(market.no_votes || 0);
                            if (totalVotes > 0) currVal = (bet.amount / totalVotes) * totalVol;
                          }

                          cashoutValue = Math.round(currVal * 0.95);
                        }

                        return (
                          <div key={bet.id} className="rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-muted/30 shadow-sm relative overflow-hidden group">
                            <Link href={`/market/${bet.market_id}`} className="block">
                              <p className="font-semibold text-foreground line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                                {market?.title ?? "Mercado"}
                              </p>
                            </Link>

                            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                               <div className="flex gap-4 sm:gap-8">
                                  <div className="flex flex-col">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Inversión</p>
                                    <p className="font-bold text-foreground flex items-center gap-1 text-sm">
                                      <Coins className="w-3.5 h-3.5 text-amber-500" /> {bet.amount.toLocaleString()} pts
                                    </p>
                                  </div>
                                  <div className="flex flex-col">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Predicción</p>
                                    <Badge variant="outline" className="font-bold border bg-opacity-10" style={{ backgroundColor: `${optColor}15`, color: optColor, borderColor: `${optColor}30` }}>
                                      {displayOutcome}
                                    </Badge>
                                  </div>
                               </div>

                               <div className="flex items-center gap-2">
                                 {canSell && (
                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Abrimos el modal con la info de la apuesta
                                        setBetToSell({
                                          id: bet.id,
                                          title: market?.title ?? "Mercado",
                                          outcomeName: displayOutcome,
                                          cashoutValue: cashoutValue
                                        });
                                      }}
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20 shrink-0 transition-transform hover:scale-105 active:scale-95"
                                    >
                                      <Coins className="w-4 h-4 mr-1.5" />
                                      Vender ({cashoutValue.toLocaleString()})
                                    </Button>
                                 )}
                                 <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 justify-center text-xs py-1">En Juego</Badge>
                               </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </TabsContent>

                <TabsContent value="finished" className="space-y-4">
                  {isLoadingBets ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : bets.filter((b) => getMarket(b) && FINISHED_STATUSES.includes(String(getMarket(b)!.status).toLowerCase())).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay resultados de tus apuestas.</p>
                  ) : (
                    bets
                      .filter((b) => getMarket(b) && FINISHED_STATUSES.includes(String(getMarket(b)!.status).toLowerCase()))
                      .map((bet) => {
                        const market = getMarket(bet);
                        const won = market?.winning_outcome === bet.outcome;
                        const opt = bet.option_details;
                        const displayOutcome = opt ? opt.option_name : (bet.outcome === "yes" ? "SÍ" : "NO");
                        const optColor = opt ? opt.color : (bet.outcome === "yes" ? "#0ea5e9" : "#ef4444");

                        return (
                          <div key={bet.id} className="rounded-xl border border-border/50 bg-muted/10 p-4 opacity-90">
                            <Link href={`/market/${bet.market_id}`} className="block">
                              <p className="font-medium text-foreground line-clamp-2 mb-3">{market?.title ?? "Mercado"}</p>
                            </Link>
                            <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border/50">
                               <div className="flex items-center gap-4">
                                  <div className="flex flex-col">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Inversión</p>
                                    <p className="font-bold text-foreground text-sm">{bet.amount.toLocaleString()} pts</p>
                                  </div>
                                  <div className="flex flex-col">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Predicción</p>
                                    <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${optColor}10`, color: optColor, borderColor: `${optColor}30` }}>{displayOutcome}</Badge>
                                  </div>
                               </div>
                               <span className={`px-3 py-1 rounded-md text-xs font-bold tracking-wide border ${won ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500"}`}>
                                 {won ? "GANASTE" : "PERDISTE"}
                               </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </TabsContent>

                <TabsContent value="bank" className="space-y-3">
                  {isLoadingTransactions ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-xl bg-muted/10">
                      <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <h3 className="font-semibold text-foreground mb-1">No hay movimientos</h3>
                      <p className="text-sm text-muted-foreground">Todavía no tenés transacciones registradas.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{tx.description}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                  {new Date(tx.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className={`font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                              {isPositive ? '+' : ''}{tx.amount.toLocaleString()} pts
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* MODAL DE CONFIRMACIÓN DE VENTA */}
      <Dialog open={!!betToSell} onOpenChange={(open) => !open && setBetToSell(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-green-500">
              <Coins className="w-5 h-5" /> Vender Predicción
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés realizar un Cashout anticipado?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-sm">
              <p className="text-muted-foreground mb-1">Mercado:</p>
              <p className="font-semibold text-foreground line-clamp-2">{betToSell?.title}</p>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border/50">
              <span className="text-sm text-muted-foreground">Tu predicción:</span>
              <Badge variant="outline" className="font-bold">{betToSell?.outcomeName}</Badge>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="font-medium text-green-600 dark:text-green-400">Recibís ahora:</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {betToSell?.cashoutValue.toLocaleString()} pts
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Incluye el 5% de comisión de la plataforma por retiro anticipado.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBetToSell(null)}>Cancelar</Button>
            <Button onClick={confirmSell} disabled={sellingBetId === betToSell?.id} className="bg-green-500 hover:bg-green-600 text-white">
              {sellingBetId === betToSell?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
              Confirmar Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        {/* ... Modal Edición ... */}
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle><DialogDescription>Personalizá tu avatar y nombre.</DialogDescription></DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-6 pt-4">
            <div className="flex flex-col items-center justify-center gap-3">
              <div onClick={() => fileInputRef.current?.click()} className="relative w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden group hover:border-primary transition-colors">
                {previewUrl ? ( <><img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-6 h-6 text-white" /></div></> ) : ( <div className="flex flex-col items-center text-muted-foreground group-hover:text-primary transition-colors"><Camera className="w-8 h-8 mb-1" /><span className="text-[10px] uppercase font-bold">Subir</span></div> )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/png, image/jpeg, image/webp" className="hidden" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario</Label>
              <Input id="username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} maxLength={20} required />
            </div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={isSaving || !newUsername.trim()}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Guardar Cambios"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        {/* ... Modal Contraseña ... */}
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar Contraseña</DialogTitle></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Nueva Contraseña</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required /></div>
            <div className="space-y-2"><Label>Repetir Contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required /></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={isChangingPassword || !newPassword || !confirmPassword}>{isChangingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Actualizar Contraseña"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
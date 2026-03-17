"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProfile, approveMarket, rejectMarket, resolveMarket, updateMarket, deleteMarket, createAdminMarket } from "@/lib/actions";
import type { ProfileResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Pencil, Trash2, Plus, X, Image as ImageIcon, Trophy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; // <-- IMPORTANTE: Agregado para las clases dinámicas

interface MarketOption {
  id: string;
  option_name: string;
}

interface Market {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  end_date: string;
  created_at: string;
  created_by: string;
  total_volume: number;
  image_url?: string | null;
  winning_outcome?: string | null;
  market_options?: MarketOption[]; 
  [key: string]: unknown;
}

export default function AdminDashboardClient() {
  const router = useRouter();
  const supabase = createClient();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfileResult>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<{ title: string; description: string; category: string; end_date: string; image_url: string; options: MarketOption[] }>({ title: "", description: "", category: "", end_date: "", image_url: "", options: [] });
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [createForm, setCreateForm] = useState<{
    title: string; description: string; category: string; end_date: string; image_url: string; marketType: "binary" | "multiple"; options: string[];
  }>({ 
    title: "", description: "", category: "politica", end_date: "", image_url: "", marketType: "binary", options: ["", ""]
  });

  const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null);
  const [selectedWinningOption, setSelectedWinningOption] = useState<string>("");
  
  const [deletingMarket, setDeletingMarket] = useState<{ id: string, title: string } | null>(null);

  useEffect(() => {
    const check = async () => {
      const p = await getProfile();
      if (!p || p.role !== "admin") {
        router.replace("/");
        return;
      }
      setProfile(p);
      setIsCheckingAuth(false);
    };
    check();
  }, [router]);

  const fetchMarkets = async () => {
    const { data, error } = await supabase
      .from("markets")
      .select('*, market_options(id, option_name)')
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("[Admin] Error:", error);
      setMarkets([]);
    } else {
      setMarkets((data || []) as Market[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isCheckingAuth) {
      fetchMarkets();
      const channel = supabase
        .channel("admin-markets")
        .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, () => { fetchMarkets(); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isCheckingAuth, supabase]);

  useEffect(() => {
    if (editingMarket) {
      const endDate = editingMarket.end_date ? new Date(editingMarket.end_date).toISOString().split("T")[0] : "";
      const rawCategory = String(editingMarket.category ?? "");
      const categoryNormalized = rawCategory.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      setEditForm({
        title: String(editingMarket.title ?? ""),
        description: String(editingMarket.description ?? ""),
        category: categoryNormalized || "politica",
        end_date: endDate,
        image_url: String(editingMarket.image_url ?? ""),
        options: editingMarket.market_options ? [...editingMarket.market_options] : []
      });
    }
  }, [editingMarket]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMarket) return;
    setIsSaving(true);
    
    const { error } = await updateMarket(editingMarket.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      category: editForm.category,
      end_date: editForm.end_date,
      image_url: editForm.image_url.trim() || null,
    });

    if (!error && editForm.options.length > 0) {
      for (const opt of editForm.options) {
        await supabase.from("market_options").update({ option_name: opt.option_name }).eq("id", opt.id);
      }
    }

    setIsSaving(false);
    
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Mercado actualizado", description: "Los cambios se guardaron." });
      setEditingMarket(null);
      await fetchMarkets();
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...createForm.options];
    newOptions[index] = value;
    setCreateForm(f => ({ ...f, options: newOptions }));
  };

  const addOption = () => {
    if (createForm.options.length < 10) setCreateForm(f => ({ ...f, options: [...f.options, ""] }));
  };

  const removeOption = (indexToRemove: number) => {
    if (createForm.options.length > 2) setCreateForm(f => ({ ...f, options: f.options.filter((_, i) => i !== indexToRemove) }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalOptions = ['Sí', 'No'];
    if (createForm.marketType === "multiple") {
      finalOptions = createForm.options.map(o => o.trim()).filter(o => o !== "");
      if (finalOptions.length < 2) {
        toast({ title: "Error", description: "Mínimo 2 opciones para mercados múltiples", variant: "destructive" });
        return;
      }
    }

    setIsCreating(true);
    const { error } = await createAdminMarket({
      title: createForm.title.trim(), description: createForm.description.trim() || null, category: createForm.category, end_date: createForm.end_date, image_url: createForm.image_url.trim() || null, options: finalOptions
    });
    setIsCreating(false);

    if (error) {
      toast({ title: "Error al crear", description: error, variant: "destructive" });
    } else {
      toast({ title: "Mercado Activo", description: "El mercado se creó y ya está público." });
      setIsCreateModalOpen(false);
      setCreateForm({ title: "", description: "", category: "politica", end_date: "", image_url: "", marketType: "binary", options: ["", ""] });
      await fetchMarkets();
    }
  };

  const handleApprove = async (marketId: string) => {
    setProcessingIds((p) => new Set(p).add(marketId));
    const { error } = await approveMarket(marketId);
    if (error) toast({ title: "Error", description: error, variant: "destructive" });
    else { toast({ title: "Aprobado", description: "El mercado ya está público." }); await fetchMarkets(); }
    setProcessingIds((p) => { const n = new Set(p); n.delete(marketId); return n; });
  };

  const handleReject = async (marketId: string) => {
    setProcessingIds((p) => new Set(p).add(marketId));
    const { error } = await rejectMarket(marketId);
    if (error) toast({ title: "Error", description: error, variant: "destructive" });
    else await fetchMarkets();
    setProcessingIds((p) => { const n = new Set(p); n.delete(marketId); return n; });
  };

  const confirmResolve = async () => {
    if (!resolvingMarket || !selectedWinningOption) return;
    const { id } = resolvingMarket;
    setProcessingIds((p) => new Set(p).add(id));
    
    const { error } = await resolveMarket(id, selectedWinningOption);
    
    setResolvingMarket(null);
    setSelectedWinningOption("");
    
    if (error) toast({ title: "Error al resolver", description: error, variant: "destructive" });
    else { toast({ title: "Mercado Finalizado", description: `Se repartieron los puntos.` }); await fetchMarkets(); }
    setProcessingIds((p) => { const n = new Set(p); n.delete(id); return n; });
  };

  const confirmDelete = async () => {
    if (!deletingMarket) return;
    const { id } = deletingMarket;
    setProcessingIds((p) => new Set(p).add(id));
    setDeletingMarket(null);
    const { error } = await deleteMarket(id);
    if (error) toast({ title: "Error al eliminar", description: error, variant: "destructive" });
    else { toast({ title: "Mercado Eliminado", description: "Se reembolsaron los puntos." }); await fetchMarkets(); }
    setProcessingIds((p) => { const n = new Set(p); n.delete(id); return n; });
  };

  const formatDate = (value: string | Date | null | undefined): string => {
    if (value == null) return "—";
    const d = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const safeString = (v: unknown): string => v == null ? "" : typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  const safeNumber = (v: unknown): number => typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0;

  const getStatusBadge = (status: unknown) => {
    const s = safeString(status);
    switch (s) {
      case "pending": return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pendiente</Badge>;
      case "active": return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Activo</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rechazado</Badge>;
      case "resolved": return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">Finalizado</Badge>;
      default: return <Badge variant="outline">{s || "—"}</Badge>;
    }
  };

  const sortedMarkets = useMemo(() => {
    const statusOrder: Record<string, number> = { pending: 1, active: 2, resolved: 3, rejected: 4 };
    return [...markets].sort((a, b) => {
       const orderA = statusOrder[String(a.status)] || 99;
       const orderB = statusOrder[String(b.status)] || 99;
       if (orderA !== orderB) return orderA - orderB;
       return new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime();
    });
  }, [markets]);

  if (isCheckingAuth) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <NavHeader points={safeNumber(profile?.points ?? 10000)} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} onPointsUpdate={() => {}} userId={profile?.id ? String(profile.id) : null} userEmail={profile?.email != null ? String(profile.email) : null} onOpenAuthModal={() => {}} onSignOut={async () => { await createClient().auth.signOut(); router.replace("/"); }} isAdmin={true} username={profile?.username != null ? String(profile.username) : null} />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Link></Button></div>
        
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Panel de <span className="text-primary">Administración</span></h1>
            <p className="text-muted-foreground text-base md:text-lg">Aprobá propuestas, editá fotos y resolvé mercados en vivo.</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="shrink-0 bg-primary hover:bg-primary/90 h-12 w-full sm:w-auto font-bold text-base"><Plus className="w-5 h-5 mr-2" /> Crear Mercado Rápido</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* VISTA DESKTOP: TABLA (Oculta en móviles) */}
            <div className="hidden md:block rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Pregunta</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead>Volumen</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMarkets.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No hay mercados</TableCell></TableRow>
                  ) : (
                    sortedMarkets.map((market) => (
                      <TableRow key={String(market.id)} className={market.status === 'resolved' ? 'opacity-70 bg-muted/10' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {market.image_url ? <img src={String(market.image_url)} alt="Miniatura" className="w-10 h-10 rounded-md object-cover border border-border/50 shrink-0" /> : <div className="w-10 h-10 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground/50" /></div>}
                            <p className="font-medium text-foreground line-clamp-2 max-w-[300px]">{safeString(market.title)}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="font-normal capitalize">{safeString(market.category)}</Badge></TableCell>
                        <TableCell>{getStatusBadge(market.status)}</TableCell>
                        <TableCell className="text-muted-foreground font-medium">{formatDate(market.end_date)}</TableCell>
                        <TableCell className="text-muted-foreground font-medium">{safeNumber(market.total_volume).toLocaleString()} pts</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="icon" variant="outline" className="h-8 w-8 hover:text-primary hover:border-primary/50 transition-colors" onClick={() => setEditingMarket(market)}><Pencil className="w-4 h-4" /></Button>

                            {market.status === "pending" && (
                              <>
                                <Button size="sm" onClick={() => handleApprove(market.id)} disabled={processingIds.has(market.id)}>{processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(market.id)} disabled={processingIds.has(market.id)}>{processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}</Button>
                              </>
                            )}
                            
                            {market.status === "active" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold transition-all" 
                                onClick={() => { setResolvingMarket(market); setSelectedWinningOption(""); }} 
                                disabled={processingIds.has(market.id)}
                              >
                                <Trophy className="w-4 h-4 mr-1.5" /> Resolver
                              </Button>
                            )}

                            {market.status !== "pending" && (
                              <Button size="icon" variant="destructive" className="h-8 w-8 hover:bg-red-600 transition-colors" onClick={() => setDeletingMarket({ id: market.id, title: String(market.title) })} disabled={processingIds.has(market.id)}>
                                {processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* VISTA MOBILE: TARJETAS (Visible solo en celulares) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {sortedMarkets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border/50">No hay mercados</div>
              ) : (
                sortedMarkets.map((market) => (
                  <div key={String(market.id)} className={cn("p-4 rounded-xl border border-border/50 bg-card flex flex-col gap-4 shadow-sm", market.status === 'resolved' ? 'opacity-70 bg-muted/20' : '')}>
                    
                    {/* Tarjeta - Cabecera */}
                    <div className="flex items-start gap-3">
                      {market.image_url ? (
                        <img src={String(market.image_url)} alt="Miniatura" className="w-14 h-14 rounded-lg object-cover border border-border/50 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted border border-border/50 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-3">{safeString(market.title)}</h3>
                    </div>

                    {/* Tarjeta - Información en Grilla */}
                    <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Categoría</span>
                        <Badge variant="secondary" className="w-fit font-medium capitalize text-xs">{safeString(market.category)}</Badge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Estado</span>
                        <div>{getStatusBadge(market.status)}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Cierre</span>
                        <span className="font-semibold text-foreground">{formatDate(market.end_date)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Volumen</span>
                        <span className="font-bold text-amber-500">{safeNumber(market.total_volume).toLocaleString()} pts</span>
                      </div>
                    </div>

                    {/* Tarjeta - Botones de Acción Accesibles */}
                    <div className="pt-2 flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 hover:text-primary" onClick={() => setEditingMarket(market)}>
                        <Pencil className="w-4 h-4" />
                      </Button>

                      {market.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(market.id)} disabled={processingIds.has(market.id)} className="flex-1 h-10 font-bold">
                            {processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprobar</>}
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => handleReject(market.id)} disabled={processingIds.has(market.id)} className="h-10 w-10 shrink-0">
                            {processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </Button>
                        </>
                      )}

                      {market.status === "active" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold flex-1 h-10" 
                          onClick={() => { setResolvingMarket(market); setSelectedWinningOption(""); }} 
                          disabled={processingIds.has(market.id)}
                        >
                          <Trophy className="w-4 h-4 mr-1.5" /> Resolver Mercado
                        </Button>
                      )}

                      {market.status !== "pending" && (
                        <Button size="icon" variant="destructive" className="h-10 w-10 shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20" onClick={() => setDeletingMarket({ id: market.id, title: String(market.title) })} disabled={processingIds.has(market.id)}>
                          {processingIds.has(market.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Modal Borrar */}
        <Dialog open={!!deletingMarket} onOpenChange={(open) => !open && setDeletingMarket(null)}>
          <DialogContent className="w-[90vw] max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-red-500 text-xl">¿Eliminar y Reembolsar?</DialogTitle>
              <DialogDescription className="text-base pt-2">Se borrará de forma permanente <strong>"{deletingMarket?.title}"</strong> y se devolverá la plata a los usuarios. Esta acción no se puede deshacer.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setDeletingMarket(null)} className="h-12 w-full sm:w-auto">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} className="h-12 w-full sm:w-auto font-bold">Sí, Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Resolver Mercado con Selector */}
        <Dialog open={!!resolvingMarket} onOpenChange={(open) => !open && setResolvingMarket(null)}>
          <DialogContent className="w-[90vw] max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl"><Trophy className="w-5 h-5 text-primary" /> Declarar Ganador</DialogTitle>
              <DialogDescription className="pt-2 text-base">
                Elegí la opción ganadora para <strong>"{resolvingMarket?.title}"</strong>. Se repartirán los <strong className="text-amber-500">{(resolvingMarket?.total_volume || 0).toLocaleString()} pts</strong> apostados.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block font-semibold text-muted-foreground">Opción Ganadora</Label>
              <Select value={selectedWinningOption} onValueChange={setSelectedWinningOption}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Seleccioná al ganador..." />
                </SelectTrigger>
                <SelectContent>
                  {resolvingMarket?.market_options?.map(opt => (
                    <SelectItem key={opt.id} value={opt.id} className="h-12 text-base cursor-pointer">{opt.option_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button variant="outline" onClick={() => setResolvingMarket(null)} className="h-12 w-full sm:w-auto">Cancelar</Button>
              <Button 
                onClick={confirmResolve} 
                disabled={!selectedWinningOption} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 w-full sm:w-auto text-base"
              >
                Confirmar Resolución
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Creación Rápida */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
           <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Crear Mercado Inmediato</DialogTitle>
              <DialogDescription>
                Los mercados creados por el Administrador pasan directamente a estado Activo para apostar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="font-semibold">Pregunta</Label>
                <Input placeholder="Ej: ¿Boca ganará la Libertadores?" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} required className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Descripción (Opcional)</Label>
                <Textarea placeholder="Contexto de la apuesta..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} className="resize-none h-24 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Link de la Imagen (Opcional)</Label>
                <Input placeholder="https://ejemplo.com/foto.jpg" value={createForm.image_url} onChange={(e) => setCreateForm((f) => ({ ...f, image_url: e.target.value }))} className="h-12 text-base" />
              </div>
              
              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                <Label className="font-semibold text-base">Tipo de Mercado</Label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Button type="button" className="h-12 font-bold" variant={createForm.marketType === "binary" ? "default" : "outline"} onClick={() => setCreateForm(f => ({ ...f, marketType: "binary" }))}>Sí / No</Button>
                  <Button type="button" className="h-12 font-bold" variant={createForm.marketType === "multiple" ? "default" : "outline"} onClick={() => setCreateForm(f => ({ ...f, marketType: "multiple" }))}>Múltiples</Button>
                </div>

                {createForm.marketType === "multiple" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 bg-background p-4 rounded-xl border border-border/50">
                    <Label className="text-sm font-semibold text-muted-foreground block mb-2">Opciones posibles (mínimo 2):</Label>
                    {createForm.options.map((option, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="w-6 text-center text-sm font-bold text-muted-foreground">{index + 1}.</div>
                        <Input placeholder={index === 0 ? "Ej: Real Madrid" : index === 1 ? "Ej: Manchester City" : "Otra opción..."} value={option} onChange={(e) => handleOptionChange(index, e.target.value)} className="flex-1 h-12 text-base" />
                        {createForm.options.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)} className="h-12 w-12 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 shrink-0"><X className="w-5 h-5" /></Button>
                        )}
                      </div>
                    ))}
                    {createForm.options.length < 10 && (
                      <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-full mt-2 h-12 border-dashed font-semibold text-primary"><Plus className="w-5 h-5 mr-2" /> Agregar opción</Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Categoría</Label>
                  <Select value={createForm.category} onValueChange={(v) => setCreateForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="política" className="h-12">Política</SelectItem>
                      <SelectItem value="deportes" className="h-12">Deportes</SelectItem>
                      <SelectItem value="finanzas" className="h-12">Finanzas</SelectItem>
                      <SelectItem value="cripto" className="h-12">Cripto</SelectItem>
                      <SelectItem value="tecnología" className="h-12">Tecnología</SelectItem>
                      <SelectItem value="ciencia" className="h-12">Ciencia</SelectItem>
                      <SelectItem value="clima" className="h-12">Clima</SelectItem>
                      <SelectItem value="entretenimiento" className="h-12">Entretenimiento</SelectItem>
                      <SelectItem value="música" className="h-12">Música</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">Fecha de Cierre</Label>
                  <Input type="date" value={createForm.end_date} onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))} required className="h-12 text-base" />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-6 pt-4 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="h-12 w-full sm:w-auto font-bold text-base">Cancelar</Button>
                <Button type="submit" disabled={isCreating} className="h-12 w-full sm:w-auto font-bold text-base">{isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publicar Activo"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Edición */}
        <Dialog open={!!editingMarket} onOpenChange={(open) => !open && setEditingMarket(null)}>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Editar mercado</DialogTitle>
              <DialogDescription>Corregí errores de tipeo en las preguntas o en las opciones.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="font-semibold">Pregunta</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required className="h-12 text-base" />
              </div>
              
              <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border/50">
                <Label className="font-semibold text-base">Editar opciones</Label>
                {editForm.options.map((opt, index) => (
                  <div key={opt.id} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-muted-foreground">{index + 1}.</span>
                    <Input 
                      value={opt.option_name} 
                      className="h-12 text-base flex-1"
                      onChange={(e) => {
                        const newOpts = [...editForm.options];
                        newOpts[index].option_name = e.target.value;
                        setEditForm(f => ({ ...f, options: newOpts }));
                      }} 
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Link de la Imagen (Opcional)</Label>
                <Input placeholder="https://ejemplo.com/foto.jpg" value={editForm.image_url} onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))} className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Categoría</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="política" className="h-12">Política</SelectItem>
                    <SelectItem value="deportes" className="h-12">Deportes</SelectItem>
                    <SelectItem value="finanzas" className="h-12">Finanzas</SelectItem>
                    <SelectItem value="cripto" className="h-12">Cripto</SelectItem>
                    <SelectItem value="tecnología" className="h-12">Tecnología</SelectItem>
                    <SelectItem value="ciencia" className="h-12">Ciencia</SelectItem>
                    <SelectItem value="clima" className="h-12">Clima</SelectItem>
                    <SelectItem value="entretenimiento" className="h-12">Entretenimiento</SelectItem>
                    <SelectItem value="música" className="h-12">Música</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-6 pt-4 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setEditingMarket(null)} className="h-12 w-full sm:w-auto font-bold text-base">Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="h-12 w-full sm:w-auto font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground">{isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Cambios"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
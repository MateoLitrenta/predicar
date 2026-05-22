"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Mail, Lock, User, Calendar, AtSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  isDarkMode: boolean; 
}

export function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
}: AuthModalProps) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ESTADO: Guarda el código de referido si vino por link
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Estados del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        setReferralCode(ref);
        setActiveTab("register");
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPassword("");
      setConfirmPassword("");
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      setIsLoading(false);
      return;
    }

    onAuthSuccess();
    onClose();
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
    if (cleanUsername.length < 3) {
      setErrorMsg("El nombre de usuario debe tener al menos 3 caracteres.");
      setIsLoading(false);
      return;
    }

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .single();

    if (existingUser) {
      setErrorMsg("Ese nombre de usuario ya está en uso. Por favor elegí otro.");
      setIsLoading(false);
      return;
    }

    // Registrar al usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
          full_name: fullName.trim(),
          date_of_birth: dob,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message === "User already registered" ? "Ya existe una cuenta con este correo." : error.message);
      setIsLoading(false);
      return;
    }

    if (data?.user) {
      // BUCLE DE VIGILANCIA: Esperamos que el perfil exista en la Base de Datos antes de hacer algo
      let profileExists = false;
      for (let i = 0; i < 15; i++) { // Intentamos por hasta 7.5 segundos
         const { data: p } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
         if (p) {
             profileExists = true;
             break;
         }
         await new Promise(resolve => setTimeout(resolve, 500)); // Esperamos medio segundo
      }

      // Si el perfil ya existe de forma segura, disparamos las actualizaciones
      if (profileExists) {
          // 1. Actualizamos nombre y usuario
          await supabase.from("profiles").update({
            username: cleanUsername,
            full_name: fullName.trim(),
            date_of_birth: dob,
          }).eq("id", data.user.id);

          // 2. DISPARAMOS REFERIDOS
          if (referralCode) {
            try {
              const { error: rpcError, data: rpcData } = await supabase.rpc('process_referral', {
                referrer_username: referralCode,
                p_new_user_id: data.user.id
              });
              
              if (!rpcError && rpcData === true) {
                 toast({ title: "¡Bono de Invitación!", description: `Recibiste 1000 pts extra gracias a ${referralCode}.` });
              } else {
                 console.error("No se pudo procesar el referido:", rpcError || "Función devolvió FALSE");
              }
            } catch (err) {
              console.error("Error catcheado al procesar referido:", err);
            }
          }
      } else {
          console.error("El perfil fantasma: La cuenta se creó en Auth pero no apareció en la tabla Profiles a tiempo.");
      }
    }

    toast({ title: "¡Cuenta creada!", description: "Bienvenido a ZÉILO." });
    onAuthSuccess();
    onClose();
    setIsLoading(false);
  };

  if (!mounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl shadow-2xl sm:rounded-2xl">
        <div className="px-6 pt-8 pb-6">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center justify-center gap-3 text-2xl font-bold mb-2">
              <span className="text-[oklch(0.12_0.01_240)] dark:text-foreground">
                Bienvenido a <span className="text-primary font-medium tracking-tight">Zéilo</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {activeTab === "login" ? "Iniciá sesión para seguir jugando." : "Creá tu cuenta y empezá a predecir."}
            </DialogDescription>
          </DialogHeader>

          {referralCode && activeTab === "register" && (
             <div className="bg-primary/10 border border-primary/30 text-primary p-3 rounded-xl flex items-center justify-center text-sm font-medium mt-4 shadow-sm">
                ✨ ¡Fuiste invitado por {referralCode}! Registrate ahora y ganá 1000 pts extra.
             </div>
          )}

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm mt-4 shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{errorMsg}</p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 rounded-xl h-12">
              <TabsTrigger value="login" className="rounded-lg h-full data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-bold transition-all text-sm">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg h-full data-[state=active]:bg-background dark:data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-bold transition-all text-sm">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-12 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 h-12 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 mt-6 rounded-xl text-base font-bold shadow-md hover:scale-[1.02] transition-transform" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                  {isLoading ? "Ingresando..." : "Iniciar Sesión"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-fullname" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Nombre completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="reg-fullname" placeholder="Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-dob" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Nacimiento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input id="reg-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().split("T")[0]} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors flex flex-row items-center [&::-webkit-calendar-picker-indicator]:bg-transparent [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Nombre de usuario (único)</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="reg-username" placeholder="lobodeWallStreet99" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="reg-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Repetir</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="reg-confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:bg-transparent transition-colors" />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 mt-6 rounded-xl text-base font-bold shadow-md hover:scale-[1.02] transition-transform" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
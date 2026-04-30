import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, User, Eye, EyeOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type LoginMethod = "email" | "phone";

// Normalize Egyptian phone numbers to E.164 (+20...)
const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("20")) return `+${digits}`;
  if (digits.startsWith("0")) return `+20${digits.slice(1)}`;
  if (digits.startsWith("1") && digits.length === 10) return `+20${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
};

// Convert normalized phone to a synthetic email for Supabase auth
const phoneToEmail = (phoneE164: string) => `${phoneE164.replace(/\D/g, "")}@phone.medicare.local`;
// Deterministic password derived from phone (so user only needs OTP)
const phoneToPassword = (phoneE164: string) => `Ph-${phoneE164.replace(/\D/g, "")}-MC2026`;

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [method, setMethod] = useState<LoginMethod>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("أدخل رقم هاتف صحيح");
      return;
    }
    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      const { data, error } = await supabase.rpc("request_phone_otp", { _phone: normalizedPhone });
      if (error) throw error;
      setOtpSent(true);
      // Dev mode: show code in toast and console
      toast.success(`كود التحقق: ${data} (وضع تجريبي)`, { duration: 10000 });
      console.log(`[OTP DEV] Phone ${normalizedPhone} → Code: ${data}`);
    } catch (err: any) {
      toast.error(err.message || "فشل إرسال الكود");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (method === "email") {
        if (isLogin) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName, phone: phone ? normalizePhone(phone) : null },
              emailRedirectTo: window.location.origin,
            },
          });
          if (error) throw error;
        }
        toast.success(isLogin ? "تم تسجيل الدخول بنجاح! 🎉" : "تم إنشاء الحساب بنجاح! 🎉");
        navigate("/dashboard");
      } else {
        // Phone flow with OTP
        if (!otpSent) {
          await sendOtp();
          return;
        }
        if (!otp || otp.length !== 6) {
          toast.error("أدخل كود التحقق المكون من 6 أرقام");
          return;
        }
        const normalizedPhone = normalizePhone(phone);
        const { data: verified, error: verifyError } = await supabase.rpc("verify_phone_otp", {
          _phone: normalizedPhone,
          _code: otp,
        });
        if (verifyError) throw verifyError;
        if (!verified) {
          toast.error("الكود غير صحيح أو منتهي الصلاحية");
          return;
        }

        const syntheticEmail = phoneToEmail(normalizedPhone);
        const syntheticPassword = phoneToPassword(normalizedPhone);

        // Try sign in first; if fails, sign up
        let { error: signInErr } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: syntheticPassword,
        });

        if (signInErr) {
          if (isLogin) {
            // No account exists — create it on the fly
            const { error: signUpErr } = await supabase.auth.signUp({
              email: syntheticEmail,
              password: syntheticPassword,
              options: {
                data: { full_name: fullName || `مستخدم ${normalizedPhone.slice(-4)}`, phone: normalizedPhone },
                emailRedirectTo: window.location.origin,
              },
            });
            if (signUpErr) throw signUpErr;
          } else {
            const { error: signUpErr } = await supabase.auth.signUp({
              email: syntheticEmail,
              password: syntheticPassword,
              options: {
                data: { full_name: fullName, phone: normalizedPhone },
                emailRedirectTo: window.location.origin,
              },
            });
            if (signUpErr) throw signUpErr;
          }
        }

        toast.success("تم التحقق وتسجيل الدخول بنجاح! 🎉");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ. حاول مرة تانية.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-hero-bg flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              ميدي<span className="text-primary">كير</span>
            </span>
          </Link>

          <motion.div
            key={isLogin ? "login" : "register"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              {isLogin ? "مرحباً بعودتك! 👋" : "إنشاء حساب جديد ✨"}
            </h1>
            <p className="text-muted-foreground mb-8">
              {isLogin
                ? "سجل دخولك لمتابعة مواعيدك وإدارة صحتك"
                : "اشترك الآن واحجز أول موعد مع أفضل الأطباء في مصر"}
            </p>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Method tabs */}
              <Tabs value={method} onValueChange={(v) => setMethod(v as LoginMethod)}>
                <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl">
                  <TabsTrigger value="email" className="gap-1.5 rounded-lg">
                    <Mail className="w-4 h-4" /> إيميل
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="gap-1.5 rounded-lg">
                    <Phone className="w-4 h-4" /> هاتف
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {!isLogin && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">الاسم الكامل</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="محمد أحمد" className="pr-10 h-12 rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                </motion.div>
              )}

              {method === "email" ? (
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="example@email.com" className="pr-10 h-12 rounded-xl" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">رقم الموبايل</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="tel" placeholder="01012345678" className="pr-10 h-12 rounded-xl" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium text-foreground">كلمة المرور</Label>
                   {isLogin && method === "email" && (
                     <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                       نسيت كلمة المرور؟
                     </Link>
                   )}
                </div>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10 pl-10 h-12 rounded-xl"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && method === "email" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">رقم الموبايل (اختياري)</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="tel" placeholder="01012345678" className="pr-10 h-12 rounded-xl" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </motion.div>
              )}

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button type="submit" disabled={loading} className="w-full h-12 gradient-hero-bg text-primary-foreground border-0 text-base font-semibold shadow-lg shadow-primary/25">
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                  ) : (
                    isLogin ? "تسجيل الدخول" : "إنشاء الحساب"
                  )}
                </Button>
              </motion.div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-sm text-muted-foreground">أو</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl gap-2"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result?.error) {
                    toast.error("فشل تسجيل الدخول بجوجل");
                    setLoading(false);
                  }
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                الدخول بحساب جوجل
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-8">
              {isLogin ? "مالكش حساب؟" : "عندك حساب بالفعل؟"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "سجل الآن" : "سجل دخولك"}
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Left Side - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-hero-bg relative overflow-hidden items-center justify-center p-12">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], rotate: [0, -90, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-primary-foreground/5 blur-2xl"
        />
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[15%] left-[20%] text-5xl opacity-30">🩺</motion.div>
        <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 5, repeat: Infinity, delay: 1 }} className="absolute bottom-[25%] right-[15%] text-4xl opacity-20">💊</motion.div>
        <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 6, repeat: Infinity, delay: 2 }} className="absolute top-[60%] left-[60%] text-3xl opacity-25">🏥</motion.div>

        <div className="relative z-10 text-center text-primary-foreground max-w-md">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-4">صحتك أمانة عندنا</h2>
            <p className="text-primary-foreground/80 leading-relaxed">
              أكثر من ٥٠,٠٠٠ مريض وثقوا فينا. انضم لعائلة ميديكير واستمتع برعاية صحية متميزة في مصر.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

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
          toast.success("تم تسجيل الدخول بنجاح! 🎉");
          navigate("/dashboard");
        } else {
          const normalizedPhoneVal = phone ? normalizePhone(phone) : null;

          // Check phone uniqueness before signup
          if (normalizedPhoneVal) {
            const { data: phoneExists } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("phone", normalizedPhoneVal)
              .maybeSingle();
            if (phoneExists) {
              toast.error("رقم الهاتف مسجل بالفعل في حساب آخر");
              setLoading(false);
              return;
            }
          }

          const { error, data } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName, phone: normalizedPhoneVal },
              emailRedirectTo: window.location.origin,
            },
          });
          if (error) throw error;

          // If phone provided during email registration, link it
          if (normalizedPhoneVal) {
            supabase.functions.invoke("phone-auth", {
              body: { action: "link_phone", email, phone: normalizedPhoneVal },
            }).catch(() => {});
          }

          // Check if email confirmation is needed
          if (data.user && !data.session) {
            toast.success("تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد الحساب 📧");
          } else {
            toast.success("تم إنشاء الحساب بنجاح! 🎉");
            navigate("/dashboard");
          }
        }
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

        const actionName = isLogin ? "login_with_phone" : "register_with_phone";
        const bodyPayload: any = { action: actionName, phone: normalizedPhone, code: otp };
        if (!isLogin) bodyPayload.full_name = fullName || `مستخدم ${normalizedPhone.slice(-4)}`;

        const { data: result, error: fnErr } = await supabase.functions.invoke("phone-auth", {
          body: bodyPayload,
        });

        if (fnErr) throw fnErr;
        if (result?.error === "no_account_for_phone") {
          toast.error("لا يوجد حساب مرتبط بهذا الرقم. سجل حساب جديد أولاً أو أضف رقمك في ملفك الشخصي.");
          return;
        }
        if (result?.error === "phone_already_registered") {
          toast.error("هذا الرقم مسجل بالفعل. جرب تسجيل الدخول.");
          return;
        }
        if (result?.error === "invalid_otp") {
          toast.error("الكود غير صحيح أو منتهي الصلاحية");
          return;
        }
        if (result?.error === "user_banned") {
          const banDate = new Date(result.banned_until).toLocaleDateString("ar-EG");
          toast.error(`حسابك محظور حتى ${banDate}`);
          return;
        }
        if (result?.error === "user_not_found") {
          toast.error("لم يتم العثور على حساب بهذا الرقم. تأكد من الرقم أو سجل حساب جديد.");
          return;
        }
        if (result?.error === "failed_to_generate_session") {
          toast.error("حدث خطأ في إنشاء الجلسة. حاول مرة أخرى.");
          return;
        }
        if (result?.error) {
          const errorMap: Record<string, string> = {
            "Email and phone required": "البريد الإلكتروني ورقم الهاتف مطلوبان",
            "Phone and OTP code required": "رقم الهاتف وكود التحقق مطلوبان",
            "Phone, code, and name required": "رقم الهاتف والكود والاسم مطلوبان",
            "Invalid action": "إجراء غير صالح",
          };
          toast.error(errorMap[result.error] || "حدث خطأ غير متوقع. حاول مرة أخرى.");
          return;
        }

        // Sign in with temporary password
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.temp_password,
        });
        if (signInErr) throw signInErr;

        toast.success("تم التحقق وتسجيل الدخول بنجاح! 🎉");
        navigate("/dashboard");
      }
    } catch (error: any) {
      const msg = error.message || "";
      const friendlyErrors: Record<string, string> = {
        "Invalid login credentials": "بيانات تسجيل الدخول غير صحيحة. تأكد من البريد وكلمة المرور.",
        "Email not confirmed": "البريد الإلكتروني غير مؤكد. تحقق من بريدك الوارد.",
        "User already registered": "هذا البريد مسجل بالفعل. جرب تسجيل الدخول.",
        "Signup requires a valid password": "كلمة المرور غير صالحة. استخدم كلمة مرور أقوى.",
        "Password should be at least 6 characters": "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
      };
      const friendly = Object.entries(friendlyErrors).find(([key]) => msg.includes(key));
      toast.error(friendly ? friendly[1] : (msg || "حدث خطأ. حاول مرة تانية."));
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
              <Tabs value={method} onValueChange={(v) => { setMethod(v as LoginMethod); setOtpSent(false); setOtp(""); }}>
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
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-sm font-medium text-foreground">رقم الموبايل</Label>
                      {otpSent && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => { setOtpSent(false); setOtp(""); }}
                        >
                          تغيير الرقم
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="01012345678"
                        className="pr-10 h-12 rounded-xl"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={otpSent}
                        required
                      />
                    </div>
                  </div>

                  {otpSent && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-sm font-medium text-foreground">كود التحقق (6 أرقام)</Label>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={sendOtp}
                          disabled={loading}
                        >
                          إعادة الإرسال
                        </button>
                      </div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="h-12 rounded-xl text-center text-lg tracking-[0.5em]"
                        dir="ltr"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        required
                      />
                    </motion.div>
                  )}
                </div>
              )}

              {method === "email" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm font-medium text-foreground">كلمة المرور</Label>
                    {isLogin && (
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
              )}

              {!isLogin && method === "email" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">رقم الموبايل (اختياري — للدخول بالهاتف لاحقاً)</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="tel" placeholder="01012345678" className="pr-10 h-12 rounded-xl" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">أضف رقمك لتتمكن من الدخول بالإيميل أو الهاتف</p>
                </motion.div>
              )}

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button type="submit" disabled={loading} className="w-full h-12 gradient-hero-bg text-primary-foreground border-0 text-base font-semibold shadow-lg shadow-primary/25">
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                  ) : (
                    method === "phone" && !otpSent
                      ? "إرسال كود التحقق"
                      : method === "phone" && otpSent
                        ? "تأكيد الكود والدخول"
                        : isLogin ? "تسجيل الدخول" : "إنشاء الحساب"
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
                onClick={() => { setIsLogin(!isLogin); setOtpSent(false); setOtp(""); }}
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
        <div className="relative z-10 text-center text-primary-foreground">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Heart className="w-16 h-16 mx-auto mb-6 opacity-80" />
            <h2 className="font-display text-3xl font-bold mb-4">صحتك أولويتنا</h2>
            <p className="text-lg opacity-80 max-w-sm mx-auto">
              احجز مع أفضل الأطباء في مصر بسهولة وأمان
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

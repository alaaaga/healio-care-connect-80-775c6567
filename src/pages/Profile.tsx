import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, Camera, Save, Lock, Phone, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    // Load full profile including avatar
    supabase.from("profiles").select("full_name, phone, avatar_url").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
      }
    });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة لازم يكون أقل من 2MB");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
    if (error) {
      toast.error("فشل رفع الصورة");
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    const url = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    setUploadingAvatar(false);
    toast.success("تم تحديث الصورة");
  };

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("20")) return `+${digits}`;
    if (digits.startsWith("0")) return `+20${digits.slice(1)}`;
    if (digits.startsWith("1") && digits.length === 10) return `+20${digits}`;
    return raw.startsWith("+") ? raw : `+${digits}`;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : "";
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: normalizedPhone,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("حدث خطأ في الحفظ");
    } else {
      setPhone(normalizedPhone);
      toast.success("تم حفظ البيانات بنجاح — يمكنك الآن الدخول بالإيميل أو الهاتف");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور غير متطابقة");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error("فشل تغيير كلمة المرور");
    } else {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-12 px-4 md:px-8 container-narrow max-w-2xl">
          <Skeleton className="h-10 w-48 mb-8" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-8">
        <div className="container-narrow max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" className="gap-2 text-muted-foreground mb-4" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="w-4 h-4" />
              رجوع للوحة التحكم
            </Button>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-8">الملف الشخصي</h1>
          </motion.div>

          {/* Avatar Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-primary" />
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-2xl bg-foreground/0 group-hover:bg-foreground/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <Camera className="w-6 h-6 text-background" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{fullName || "مستخدم"}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {uploadingAvatar && <p className="text-xs text-primary mt-1">جاري رفع الصورة...</p>}
              </div>
            </div>
          </motion.div>

          {/* Profile Info */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-6 mb-6">
            <h3 className="font-display font-semibold text-foreground mb-4">البيانات الشخصية</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />الاسم الكامل
                </Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أدخل اسمك الكامل" className="bg-muted/50" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />رقم الموبايل
                </Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" className="bg-muted/50 text-left" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />البريد الإلكتروني
                </Label>
                <Input value={user.email || ""} disabled className="bg-muted/30 text-left opacity-60" dir="ltr" />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="gradient-hero-bg text-primary-foreground border-0 gap-2 w-full sm:w-auto">
                <Save className="w-4 h-4" />
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </motion.div>

          {/* Change Password */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4" />تغيير كلمة المرور
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-1.5">كلمة المرور الجديدة</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-muted/50" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-1.5">تأكيد كلمة المرور</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-muted/50" />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline" className="gap-2">
                <Lock className="w-4 h-4" />
                {changingPassword ? "جاري التغيير..." : "تغيير كلمة المرور"}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

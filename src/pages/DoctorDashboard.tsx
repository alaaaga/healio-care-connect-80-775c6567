import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, User, LogOut, CheckCircle2, XCircle, AlertCircle, Stethoscope, Users, Pill, Download, Plus, Trash2, FileText, Save, Edit, ArrowUp, ArrowDown, PlayCircle, SkipForward
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: AlertCircle },
  confirmed: { label: "مؤكد", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle2 },
  completed: { label: "مكتمل", color: "bg-medical-green/10 text-medical-green border-medical-green/20", icon: CheckCircle2 },
  cancelled: { label: "ملغي", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

const AVG_WAIT_MINUTES = 15;

function DoctorProfileEdit({ doctorProfile, userEmail, userPhone }: { doctorProfile: any; userEmail: string; userPhone: string }) {
  const [location, setLocation] = useState(doctorProfile.location || "");
  const [bio, setBio] = useState(doctorProfile.bio || "");
  const [price, setPrice] = useState(String(doctorProfile.price || 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("doctors").update({
      location, bio, price: parseInt(price) || 0,
    }).eq("id", doctorProfile.id);
    setSaving(false);
    if (error) toast.error("فشل حفظ البيانات");
    else toast.success("تم تحديث بيانات الطبيب ✅");
  };

  return (
    <div className="glass-card rounded-2xl p-6 max-w-lg space-y-5">
      <div className="flex items-center gap-4 mb-2">
        {doctorProfile.image_url ? (
          <img src={doctorProfile.image_url} alt={doctorProfile.name} className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-2xl gradient-hero-bg flex items-center justify-center">
            <Stethoscope className="w-8 h-8 text-primary-foreground" />
          </div>
        )}
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">د. {doctorProfile.name}</h3>
          <p className="text-sm text-primary">{doctorProfile.specialty}</p>
        </div>
      </div>
      <div>
        <Label className="text-sm text-muted-foreground mb-1.5 block">الموقع / العنوان</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} className="bg-muted/50" />
      </div>
      <div>
        <Label className="text-sm text-muted-foreground mb-1.5 block">النبذة التعريفية</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="bg-muted/50" />
      </div>
      <div>
        <Label className="text-sm text-muted-foreground mb-1.5 block">سعر الكشف (جنيه)</Label>
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-muted/50 w-32" />
      </div>
      <div className="space-y-2 pt-2 border-t border-border/50">
        {[
          { label: "التقييم", value: `${doctorProfile.rating} ⭐` },
          { label: "البريد الإلكتروني", value: userEmail },
          { label: "الموبايل", value: userPhone || "غير محدد" },
        ].map((f) => (
          <div key={f.label} className="flex justify-between items-center py-2">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="text-sm font-medium text-foreground">{f.value}</span>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} className="gradient-hero-bg text-primary-foreground border-0 gap-2">
        <Save className="w-4 h-4" />
        {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
      </Button>
    </div>
  );
}

export default function DoctorDashboardPage() {
  const navigate = useNavigate();
  const { user, isDoctor, doctorProfile, profile, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Prescription dialog state
  const [rxOpen, setRxOpen] = useState(false);
  const [rxBooking, setRxBooking] = useState<any>(null);
  const [rxEditId, setRxEditId] = useState<string | null>(null);
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxNotes, setRxNotes] = useState("");
  const [rxMeds, setRxMeds] = useState<{ name: string; dosage: string; instructions: string }[]>([
    { name: "", dosage: "", instructions: "" },
  ]);
  const [rxSaving, setRxSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isDoctor || !doctorProfile)) {
      navigate("/dashboard");
      toast.error("هذه الصفحة مخصصة للأطباء فقط");
    }
  }, [authLoading, user, isDoctor, doctorProfile, navigate]);

  useEffect(() => {
    if (!user || !doctorProfile) return;

    const fetchData = async () => {
      const [{ data: bookingsData }, { data: prescData }] = await Promise.all([
        supabase.from("bookings").select("*, doctors(name, specialty)").eq("doctor_id", doctorProfile.id).order("created_at", { ascending: false }),
        supabase.from("prescriptions").select("*, bookings(booking_date)").eq("doctor_id", doctorProfile.id).order("created_at", { ascending: false }),
      ]);

      const patientIds = [...new Set([
        ...(bookingsData || []).map((b: any) => b.user_id),
        ...(prescData || []).map((p: any) => p.patient_id),
      ])];

      let profileMap = new Map<string, string>();
      if (patientIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", patientIds);
        profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
      }

      setBookings((bookingsData || []).map((b: any) => ({ ...b, patient_name: profileMap.get(b.user_id) || "مريض" })));
      setPrescriptions((prescData || []).map((p: any) => ({ ...p, patient_name: profileMap.get(p.patient_id) || "مريض" })));
      setLoadingData(false);
    };

    fetchData();

    const channel = supabase
      .channel('doctor-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `doctor_id=eq.${doctorProfile.id}` }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", updated.user_id).single();
          const withName = { ...updated, patient_name: prof?.full_name || "مريض", doctors: doctorProfile };
          setBookings((prev) => {
            const exists = prev.find((b) => b.id === updated.id);
            if (exists) return prev.map((b) => b.id === updated.id ? withName : b);
            return [withName, ...prev];
          });
          if (payload.eventType === 'INSERT') toast.info("حجز جديد من " + (prof?.full_name || "مريض"));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, doctorProfile]);

  // ── Queue helpers ──
  const getQueueBookings = useCallback((date?: string, time?: string) => {
    return bookings
      .filter((b) => 
        (b.status === "pending" || b.status === "confirmed") &&
        (!date || b.booking_date === date) &&
        (!time || b.booking_time === time)
      )
      .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));
  }, [bookings]);

  const recalcQueueLocally = useCallback(async (date: string, time: string, excludeId?: string) => {
    const queueItems = bookings
      .filter((b) =>
        b.booking_date === date &&
        b.booking_time === time &&
        b.status !== "cancelled" && b.status !== "completed" &&
        b.id !== excludeId
      )
      .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));

    const updates: Promise<any>[] = [];
    const newBookings = [...bookings];

    queueItems.forEach((item, idx) => {
      const newPos = idx + 1;
      const newWait = newPos > 1 ? `${(newPos - 1) * AVG_WAIT_MINUTES} دقيقة` : null;
      
      if (item.queue_position !== newPos || item.estimated_wait !== newWait) {
        updates.push(
          supabase.from("bookings").update({ 
            queue_position: newPos, 
            estimated_wait: newWait 
          }).eq("id", item.id).then()
        );
        const bIdx = newBookings.findIndex((b) => b.id === item.id);
        if (bIdx >= 0) {
          newBookings[bIdx] = { ...newBookings[bIdx], queue_position: newPos, estimated_wait: newWait };
        }
      }
    });

    if (updates.length > 0) {
      setBookings(newBookings);
      await Promise.all(updates);
    }
  }, [bookings]);

  const completeAndAdvance = async (booking: any) => {
    const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id);
    if (error) {
      toast.error("فشل تحديث الحالة");
      return;
    }
    setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "completed" } : b));
    toast.success("تم إكمال الحجز — الطابور يتحدث تلقائياً ✅");
    // Recalc queue after state update
    setTimeout(() => {
      recalcQueueLocally(booking.booking_date, booking.booking_time, booking.id);
    }, 300);
  };

  const updateStatus = async (id: string, status: string) => {
    const booking = bookings.find((b) => b.id === id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (!error) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      toast.success("تم تحديث حالة الحجز");
      if ((status === "cancelled" || status === "completed") && booking) {
        setTimeout(() => {
          recalcQueueLocally(booking.booking_date, booking.booking_time, id);
        }, 300);
      }
    } else {
      toast.error("فشل تحديث الحالة");
    }
  };

  // ── Prescription helpers ──
  const openRxDialog = (booking: any) => {
    setRxBooking(booking);
    setRxEditId(null);
    setRxDiagnosis("");
    setRxNotes("");
    setRxMeds([{ name: "", dosage: "", instructions: "" }]);
    setRxOpen(true);
  };

  const openEditRx = (rx: any) => {
    setRxBooking({ id: rx.booking_id, user_id: rx.patient_id, patient_name: rx.patient_name });
    setRxEditId(rx.id);
    setRxDiagnosis(rx.diagnosis || "");
    setRxNotes(rx.notes || "");
    const meds = Array.isArray(rx.medications) && rx.medications.length > 0
      ? rx.medications.map((m: any) => ({ name: m.name || "", dosage: m.dosage || "", instructions: m.instructions || "" }))
      : [{ name: "", dosage: "", instructions: "" }];
    setRxMeds(meds);
    setRxOpen(true);
  };

  const addMed = () => setRxMeds((prev) => [...prev, { name: "", dosage: "", instructions: "" }]);
  const removeMed = (idx: number) => setRxMeds((prev) => prev.filter((_, i) => i !== idx));
  const updateMed = (idx: number, field: string, value: string) =>
    setRxMeds((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const saveRx = async () => {
    if (!rxBooking || !doctorProfile) return;
    const validMeds = rxMeds.filter((m) => m.name.trim());
    if (validMeds.length === 0) {
      toast.error("أضف دواء واحد على الأقل");
      return;
    }
    setRxSaving(true);

    if (rxEditId) {
      // Update existing prescription
      const { data, error } = await supabase.from("prescriptions").update({
        diagnosis: rxDiagnosis,
        notes: rxNotes,
        medications: validMeds,
      }).eq("id", rxEditId).select().single();
      setRxSaving(false);
      if (error) {
        toast.error("فشل تعديل الروشتة: " + error.message);
        return;
      }
      setPrescriptions((prev) => prev.map((p) => p.id === rxEditId ? { ...p, ...data } : p));
      toast.success("تم تعديل الروشتة ✅");
    } else {
      // Create new prescription
      const { data, error } = await supabase.from("prescriptions").insert({
        booking_id: rxBooking.id,
        doctor_id: doctorProfile.id,
        patient_id: rxBooking.user_id,
        diagnosis: rxDiagnosis,
        notes: rxNotes,
        medications: validMeds,
      }).select().single();
      setRxSaving(false);
      if (error) {
        toast.error("فشل حفظ الروشتة: " + error.message);
        return;
      }
      setPrescriptions((prev) => [{ ...data, patient_name: rxBooking.patient_name }, ...prev]);
      toast.success("تم حفظ الروشتة ✅");
    }
    setRxOpen(false);
  };

  const deleteRx = async (id: string) => {
    const { error } = await supabase.from("prescriptions").delete().eq("id", id);
    if (error) {
      toast.error("فشل حذف الروشتة");
      return;
    }
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    toast.success("تم حذف الروشتة");
  };

  if (authLoading || loadingData || !doctorProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-12 px-4 md:px-8 container-narrow">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "pending");
  const completedBookings = bookings.filter((b) => b.status === "completed");

  // Group bookings by date+time for queue view
  const todayStr = new Date().toISOString().split("T")[0];
  const todayQueue = bookings
    .filter((b) => b.booking_date === todayStr && b.status !== "cancelled" && b.status !== "completed")
    .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));

  const currentPatient = todayQueue.length > 0 ? todayQueue[0] : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-8">
        <div className="container-narrow">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Stethoscope className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                    د. {doctorProfile.name} 👋
                  </h1>
                  <p className="text-muted-foreground mt-1">{doctorProfile.specialty} — لوحة تحكم الطبيب</p>
                </div>
              </div>
              <Button variant="outline" onClick={signOut} className="gap-2 text-muted-foreground">
                <LogOut className="w-4 h-4" />خروج
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "حجوزات قادمة", value: activeBookings.length, icon: Calendar, color: "text-primary" },
              { label: "زيارات مكتملة", value: completedBookings.length, icon: CheckCircle2, color: "text-medical-green" },
              { label: "إجمالي المرضى", value: new Set(bookings.map((b) => b.user_id)).size, icon: Users, color: "text-medical-purple" },
              { label: "الروشتات", value: prescriptions.length, icon: Pill, color: "text-medical-coral" },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-2xl p-4 text-center">
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Today's Queue Summary */}
          {todayQueue.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-primary" />
                    طابور اليوم — {todayQueue.length} مريض
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {todayQueue.map((b, idx) => (
                      <div
                        key={b.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                          idx === 0
                            ? "bg-primary text-primary-foreground font-bold shadow-md"
                            : "bg-muted/60 text-foreground"
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs font-bold">
                          {b.queue_position || idx + 1}
                        </span>
                        <span>{b.patient_name}</span>
                        <span className="text-xs opacity-70">{b.booking_time}</span>
                      </div>
                    ))}
                  </div>
                  {currentPatient && (
                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        size="sm"
                        className="gradient-hero-bg text-primary-foreground gap-1.5"
                        onClick={() => completeAndAdvance(currentPatient)}
                      >
                        <SkipForward className="w-4 h-4" />
                        إكمال المريض الحالي والتالي
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        المريض الحالي: <strong>{currentPatient.patient_name}</strong>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl mb-6 overflow-x-auto">
              <TabsTrigger value="bookings" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Calendar className="w-4 h-4" />الحجوزات
              </TabsTrigger>
              <TabsTrigger value="queue" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Users className="w-4 h-4" />الطابور
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Pill className="w-4 h-4" />الروشتات
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <User className="w-4 h-4" />بياناتي
              </TabsTrigger>
            </TabsList>

            {/* ── Bookings Tab ── */}
            <TabsContent value="bookings">
              <div className="glass-card rounded-2xl overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المريض</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوقت</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => {
                      const config = statusConfig[b.status];
                      const StatusIcon = config?.icon || AlertCircle;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.patient_name}</TableCell>
                          <TableCell>{b.booking_date}</TableCell>
                          <TableCell>{b.booking_time}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{b.type === "online" ? "أونلاين" : "عيادة"}</Badge>
                          </TableCell>
                          <TableCell>
                            {b.status !== "cancelled" && b.status !== "completed" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                  {b.queue_position || "—"}
                                </span>
                                {b.estimated_wait && (
                                  <span className="text-xs text-muted-foreground">{b.estimated_wait}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${config?.color || ""} border gap-1`}>
                              <StatusIcon className="w-3 h-3" />{config?.label || b.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {b.status === "pending" && (
                                <Button variant="outline" size="sm" className="text-xs text-primary" onClick={() => updateStatus(b.id, "confirmed")}>تأكيد</Button>
                              )}
                              {(b.status === "pending" || b.status === "confirmed") && (
                                <>
                                  <Button variant="outline" size="sm" className="text-xs text-medical-green" onClick={() => completeAndAdvance(b)}>
                                    <CheckCircle2 className="w-3 h-3 ml-1" />إكمال
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => updateStatus(b.id, "cancelled")}>إلغاء</Button>
                                </>
                              )}
                              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openRxDialog(b)}>
                                <FileText className="w-3 h-3" />روشتة
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">مافيش حجوزات لسه</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Queue Tab ── */}
            <TabsContent value="queue">
              <div className="space-y-4">
                {(() => {
                  // Group active bookings by date+time
                  const activeQ = bookings.filter((b) => b.status !== "cancelled" && b.status !== "completed");
                  const groups = new Map<string, any[]>();
                  activeQ.forEach((b) => {
                    const key = `${b.booking_date}|${b.booking_time}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(b);
                  });

                  if (groups.size === 0) {
                    return (
                      <div className="text-center py-16">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-display font-bold text-foreground mb-2">مافيش طابور حالياً</h3>
                        <p className="text-muted-foreground text-sm">بمجرد إضافة حجوزات، هيظهر الطابور هنا تلقائياً</p>
                      </div>
                    );
                  }

                  return Array.from(groups.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, items]) => {
                      const [date, time] = key.split("|");
                      const sorted = items.sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));
                      return (
                        <Card key={key} className="overflow-hidden">
                          <CardHeader className="pb-2 bg-muted/30">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              {date} — {time}
                              <Badge variant="outline" className="mr-auto">{sorted.length} مريض</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                              {sorted.map((b, idx) => {
                                const config = statusConfig[b.status];
                                return (
                                  <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? "bg-primary/5" : ""}`}>
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                      idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}>
                                      {b.queue_position || idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm text-foreground truncate">{b.patient_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {b.estimated_wait ? `⏳ ${b.estimated_wait}` : idx === 0 ? "🟢 دوره الآن" : ""}
                                      </p>
                                    </div>
                                    <Badge className={`${config?.color || ""} border text-xs shrink-0`}>
                                      {config?.label}
                                    </Badge>
                                    {idx === 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs text-medical-green gap-1 shrink-0"
                                        onClick={() => completeAndAdvance(b)}
                                      >
                                        <SkipForward className="w-3 h-3" />التالي
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                })()}
              </div>
            </TabsContent>

            {/* ── Prescriptions Tab ── */}
            <TabsContent value="prescriptions">
              {prescriptions.length === 0 ? (
                <div className="text-center py-16">
                  <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display font-bold text-foreground mb-2">مافيش روشتات</h3>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((pr, i) => (
                    <motion.div key={pr.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-medical-green/10 flex items-center justify-center">
                          <Pill className="w-5 h-5 text-medical-green" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">المريض: {pr.patient_name}</h4>
                          <p className="text-xs text-muted-foreground">{new Date(pr.created_at).toLocaleDateString("ar-EG")}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openEditRx(pr)}>
                            <Edit className="w-3 h-3" />تعديل
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1" onClick={() => deleteRx(pr.id)}>
                            <Trash2 className="w-3 h-3" />حذف
                          </Button>
                        </div>
                      </div>
                      {pr.diagnosis && (
                        <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">التشخيص</p>
                          <p className="text-sm font-medium text-foreground">{pr.diagnosis}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">الأدوية</p>
                        {(Array.isArray(pr.medications) ? pr.medications : []).map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                            <Badge variant="outline" className="text-xs shrink-0">{m.name}</Badge>
                            {m.dosage && <span className="text-xs text-muted-foreground">{m.dosage}</span>}
                            {m.instructions && <span className="text-xs text-foreground">• {m.instructions}</span>}
                          </div>
                        ))}
                      </div>
                      {pr.notes && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                          <p className="text-sm text-foreground">{pr.notes}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="profile">
              <DoctorProfileEdit doctorProfile={doctorProfile} userEmail={user?.email || ""} userPhone={profile?.phone || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Prescription dialog (create + edit) */}
      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-medical-green" />
              {rxEditId ? "تعديل الروشتة" : "روشتة جديدة"} {rxBooking?.patient_name ? `— ${rxBooking.patient_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">التشخيص</Label>
              <Input value={rxDiagnosis} onChange={(e) => setRxDiagnosis(e.target.value)} placeholder="مثلاً: التهاب حلق حاد" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>الأدوية</Label>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addMed}>
                  <Plus className="w-3 h-3" />إضافة دواء
                </Button>
              </div>
              <div className="space-y-2">
                {rxMeds.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg bg-muted/30">
                    <Input className="col-span-4" placeholder="اسم الدواء" value={m.name} onChange={(e) => updateMed(idx, 'name', e.target.value)} />
                    <Input className="col-span-3" placeholder="الجرعة" value={m.dosage} onChange={(e) => updateMed(idx, 'dosage', e.target.value)} />
                    <Input className="col-span-4" placeholder="التعليمات" value={m.instructions} onChange={(e) => updateMed(idx, 'instructions', e.target.value)} />
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive h-9 w-9" onClick={() => removeMed(idx)} disabled={rxMeds.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">ملاحظات</Label>
              <Textarea value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} placeholder="ملاحظات إضافية للمريض" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRxOpen(false)}>إلغاء</Button>
            <Button onClick={saveRx} disabled={rxSaving} className="gradient-hero-bg text-primary-foreground">
              {rxSaving ? "جاري الحفظ..." : rxEditId ? "حفظ التعديلات" : "حفظ الروشتة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

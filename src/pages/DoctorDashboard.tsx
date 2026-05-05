import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, User, LogOut, CheckCircle2, XCircle, AlertCircle, Stethoscope, Users, Pill, Download, Plus, Trash2, FileText
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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

export default function DoctorDashboardPage() {
  const navigate = useNavigate();
  const { user, isDoctor, doctorProfile, profile, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

      // Fetch patient names
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

    // Realtime for new bookings
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

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (!error) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      toast.success("تم تحديث حالة الحجز");
    } else {
      toast.error("فشل تحديث الحالة");
    }
  };

  const updateQueue = async (id: string, queue_position: number, estimated_wait: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ queue_position, estimated_wait })
      .eq("id", id);
    if (!error) {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, queue_position, estimated_wait } : b));
      toast.success("تم تحديث الطابور");
    } else {
      toast.error("فشل تحديث الطابور");
    }
  };

  // Prescription dialog state
  const [rxOpen, setRxOpen] = useState(false);
  const [rxBooking, setRxBooking] = useState<any>(null);
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxNotes, setRxNotes] = useState("");
  const [rxMeds, setRxMeds] = useState<{ name: string; dosage: string; instructions: string }[]>([
    { name: "", dosage: "", instructions: "" },
  ]);
  const [rxSaving, setRxSaving] = useState(false);

  const openRxDialog = (booking: any) => {
    setRxBooking(booking);
    setRxDiagnosis("");
    setRxNotes("");
    setRxMeds([{ name: "", dosage: "", instructions: "" }]);
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
    setRxOpen(false);
  };

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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl mb-6">
              <TabsTrigger value="bookings" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Calendar className="w-4 h-4" />حجوزات المرضى
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Pill className="w-4 h-4" />الروشتات
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <User className="w-4 h-4" />بياناتي
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bookings">
              <div className="glass-card rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المريض</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوقت</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الطابور</TableHead>
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
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                defaultValue={b.queue_position || ''}
                                className="h-8 w-14 text-xs"
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val && val !== b.queue_position) {
                                    updateQueue(b.id, val, b.estimated_wait || `${val * 15} د`);
                                  }
                                }}
                              />
                              <Input
                                type="text"
                                defaultValue={b.estimated_wait || ''}
                                placeholder="انتظار"
                                className="h-8 w-16 text-xs"
                                onBlur={(e) => {
                                  if (e.target.value !== b.estimated_wait) {
                                    updateQueue(b.id, b.queue_position || 1, e.target.value);
                                  }
                                }}
                              />
                            </div>
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
                                  <Button variant="outline" size="sm" className="text-xs text-medical-green" onClick={() => updateStatus(b.id, "completed")}>إكمال</Button>
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

      {/* Prescription dialog */}
      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-medical-green" />
              روشتة جديدة {rxBooking?.patient_name ? `— ${rxBooking.patient_name}` : ""}
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
              {rxSaving ? "جاري الحفظ..." : "حفظ الروشتة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, User, LogOut, Bell, CheckCircle2, XCircle, AlertCircle, Timer, Users, Pill, Download, Navigation, Star, Settings, Stethoscope
} from "lucide-react";
import ReviewDialog from "@/components/ReviewDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BookingTracker from "@/components/BookingTracker";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: AlertCircle },
  confirmed: { label: "مؤكد", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle2 },
  completed: { label: "مكتمل", color: "bg-medical-green/10 text-medical-green border-medical-green/20", icon: CheckCircle2 },
  cancelled: { label: "ملغي", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

function generatePrescriptionPDF(pr: any, userName: string) {
  const meds = Array.isArray(pr.medications) ? pr.medications : [];
  const medsRows = meds.map((m: any) =>
    `<tr><td style="padding:8px;border:1px solid #ddd">${m.name || ''}</td><td style="padding:8px;border:1px solid #ddd">${m.dosage || ''}</td><td style="padding:8px;border:1px solid #ddd">${m.instructions || ''}</td></tr>`
  ).join('');

  const html = `
    <html dir="rtl"><head><meta charset="utf-8"><title>روشتة طبية</title>
    <style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:40px;color:#333}
    h1{color:#16a34a;border-bottom:3px solid #16a34a;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#f0fdf4;padding:10px;border:1px solid #ddd;text-align:right}
    .info{display:flex;gap:40px;margin:20px 0;flex-wrap:wrap}
    .info-item{margin-bottom:10px}
    .label{color:#666;font-size:14px}.value{font-weight:bold;font-size:16px}
    .notes{background:#f9fafb;padding:15px;border-radius:8px;margin-top:20px}
    .footer{margin-top:40px;text-align:center;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:15px}
    </style></head><body>
    <h1>🏥 روشتة طبية — ميديكير</h1>
    <div class="info">
      <div class="info-item"><span class="label">المريض: </span><span class="value">${userName}</span></div>
      <div class="info-item"><span class="label">الطبيب: </span><span class="value">${pr.doctors?.name || ''}</span></div>
      <div class="info-item"><span class="label">التاريخ: </span><span class="value">${new Date(pr.created_at).toLocaleDateString("ar-EG")}</span></div>
    </div>
    ${pr.diagnosis ? `<div style="margin:15px 0"><strong>التشخيص:</strong> ${pr.diagnosis}</div>` : ''}
    <table><thead><tr><th>الدواء</th><th>الجرعة</th><th>التعليمات</th></tr></thead><tbody>${medsRows || '<tr><td colspan="3" style="padding:8px;text-align:center">لا توجد أدوية</td></tr>'}</tbody></table>
    ${pr.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${pr.notes}</div>` : ''}
    <div class="footer">هذه الروشتة صادرة من نظام ميديكير الإلكتروني</div>
    </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut, isDoctor } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [reviews, setReviews] = useState<Record<string, { id: string; rating: number; comment: string }>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [{ data: bookingsData }, { data: notifsData }, { data: prescData }] = await Promise.all([
        supabase.from("bookings").select("*, doctors(name, specialty)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("prescriptions").select("*, doctors(name, specialty)").eq("patient_id", user.id).order("created_at", { ascending: false }),
      ]);
      setBookings(bookingsData || []);
      setNotifications(notifsData || []);
      setPrescriptions(prescData || []);

      // Load reviews
      const { data: reviewsData } = await supabase.from("reviews").select("id, rating, comment, booking_id").eq("user_id", user.id);
      if (reviewsData) {
        const map: Record<string, { id: string; rating: number; comment: string }> = {};
        reviewsData.forEach((r: any) => { map[r.booking_id] = { id: r.id, rating: r.rating, comment: r.comment }; });
        setReviews(map);
      }
      setLoadingData(false);
    };
    fetchData();

    const notifChannel = supabase
      .channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new as any, ...prev]);
        toast.info((payload.new as any).message);
      })
      .subscribe();

    const bookingChannel = supabase
      .channel('user-bookings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `user_id=eq.${user.id}` }, async (payload) => {
        const updated = payload.new as any;
        const { data: docData } = await supabase.from("doctors").select("name, specialty").eq("id", updated.doctor_id).single();
        setBookings((prev) => prev.map((b) => b.id === updated.id ? { ...updated, doctors: docData } : b));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(bookingChannel);
    };
  }, [user]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
      toast.success("تم إلغاء الحجز");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-12 px-4 md:px-8 container-narrow">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "pending");
  const pastBookings = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-8">
        <div className="container-narrow">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  أهلاً {profile?.full_name || user.email}! 👋
                </h1>
                <p className="text-muted-foreground mt-1">تابع مواعيدك وتفاصيل حجوزاتك من هنا</p>
              </div>
              <div className="flex gap-2">
                <Link to="/booking">
                  <Button className="gradient-hero-bg text-primary-foreground border-0 shadow-lg shadow-primary/25 gap-2">
                    <Calendar className="w-4 h-4" />حجز موعد جديد
                  </Button>
                </Link>
                <Link to="/profile">
                  <Button variant="outline" className="gap-2 text-muted-foreground">
                    <Settings className="w-4 h-4" />ملفي الشخصي
                  </Button>
                </Link>
                <Button variant="outline" onClick={signOut} className="gap-2 text-muted-foreground">
                  <LogOut className="w-4 h-4" />خروج
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "حجوزات قادمة", value: activeBookings.length.toString(), icon: Calendar, color: "text-primary" },
              { label: "إجمالي الزيارات", value: bookings.filter((b) => b.status === "completed").length.toString(), icon: CheckCircle2, color: "text-medical-green" },
              { label: "إشعارات جديدة", value: notifications.filter((n) => !n.is_read).length.toString(), icon: Bell, color: "text-medical-coral" },
              { label: "إجمالي الحجوزات", value: bookings.length.toString(), icon: User, color: "text-medical-purple" },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }} className="glass-card rounded-2xl p-4 text-center">
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Booking Tracker */}
          {activeBookings.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-display font-bold text-foreground">تتبع حجوزاتك</h3>
              </div>
              <div className="space-y-3">
                {activeBookings.map((booking) => (
                  <BookingTracker key={booking.id} booking={booking} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl mb-6">
                <TabsTrigger value="bookings" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Calendar className="w-4 h-4" />حجوزاتي
                </TabsTrigger>
                <TabsTrigger value="tracker" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Navigation className="w-4 h-4" />تتبع الحجز
                </TabsTrigger>
                <TabsTrigger value="notifications" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Bell className="w-4 h-4" />الإشعارات
                  {notifications.filter((n) => !n.is_read).length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                      {notifications.filter((n) => !n.is_read).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Pill className="w-4 h-4" />روشتاتي
                </TabsTrigger>
                <TabsTrigger value="profile" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <User className="w-4 h-4" />بياناتي
                </TabsTrigger>
              </TabsList>

              {/* Tracker Tab */}
              <TabsContent value="tracker">
                {loadingData ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-16">
                    <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-display font-bold text-foreground mb-2">مافيش حجوزات للتتبع</h3>
                    <p className="text-muted-foreground mb-4">احجز موعد وتابع حالته من هنا</p>
                    <Link to="/booking"><Button className="gradient-hero-bg text-primary-foreground border-0">احجز الآن</Button></Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-display font-semibold text-foreground">جميع حجوزاتك</h3>
                    {bookings.map((booking) => (
                      <BookingTracker key={booking.id} booking={booking} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bookings">
                {loadingData ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-16">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-display font-bold text-foreground mb-2">مافيش حجوزات لسه</h3>
                    <p className="text-muted-foreground mb-4">احجز أول موعد مع أفضل الأطباء</p>
                    <Link to="/booking"><Button className="gradient-hero-bg text-primary-foreground border-0">احجز الآن</Button></Link>
                  </div>
                ) : (
                  <>
                    {activeBookings.length > 0 && (
                      <div className="mb-8">
                        <h3 className="font-display font-semibold text-foreground mb-4">الحجوزات القادمة</h3>
                        <div className="space-y-3">
                          <AnimatePresence>
                            {activeBookings.map((booking, i) => {
                              const config = statusConfig[booking.status];
                              const StatusIcon = config.icon;
                              return (
                                <motion.div key={booking.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">👨‍⚕️</div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-foreground">{booking.doctors?.name}</h4>
                                    <p className="text-sm text-primary">{booking.doctors?.specialty}</p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.booking_date}</span>
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{booking.booking_time}</span>
                                      <Badge variant="outline" className="text-xs">{booking.type === "online" ? "أونلاين" : "عيادة"}</Badge>
                                      {booking.queue_position && booking.queue_position > 1 && (
                                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 border text-xs gap-1">
                                          <Users className="w-3 h-3" />قدامك: {booking.queue_position - 1}
                                        </Badge>
                                      )}
                                      {booking.estimated_wait && (
                                        <Badge className="bg-primary/10 text-primary border-primary/20 border text-xs gap-1">
                                          <Timer className="w-3 h-3" />{booking.estimated_wait}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${config.color} border gap-1`}><StatusIcon className="w-3 h-3" />{config.label}</Badge>
                                    <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => cancelBooking(booking.id)}>إلغاء</Button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                    {pastBookings.length > 0 && (
                      <div>
                        <h3 className="font-display font-semibold text-foreground mb-4">السجل السابق</h3>
                        <div className="space-y-3">
                          {pastBookings.map((booking, i) => {
                            const config = statusConfig[booking.status];
                            const StatusIcon = config.icon;
                            return (
                              <motion.div key={booking.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 opacity-70">
                                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">👨‍⚕️</div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground">{booking.doctors?.name}</h4>
                                  <p className="text-sm text-muted-foreground">{booking.doctors?.specialty}</p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span>{booking.booking_date}</span><span>{booking.booking_time}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${config.color} border gap-1`}><StatusIcon className="w-3 h-3" />{config.label}</Badge>
                                  {booking.status === "completed" && (
                                    <ReviewDialog
                                      bookingId={booking.id}
                                      doctorId={booking.doctor_id}
                                      doctorName={booking.doctors?.name || ""}
                                      userId={user!.id}
                                      existingReview={reviews[booking.id] || null}
                                      onReviewSubmitted={() => {
                                        supabase.from("reviews").select("id, rating, comment, booking_id").eq("user_id", user!.id).then(({ data }) => {
                                          if (data) {
                                            const map: Record<string, { id: string; rating: number; comment: string }> = {};
                                            data.forEach((r: any) => { map[r.booking_id] = { id: r.id, rating: r.rating, comment: r.comment }; });
                                            setReviews(map);
                                          }
                                        });
                                      }}
                                    />
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="notifications">
                {notifications.length === 0 ? (
                  <div className="text-center py-16">
                    <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-display font-bold text-foreground mb-2">مافيش إشعارات</h3>
                  </div>
                ) : (
                  <div className="space-y-1 mb-4">
                    {notifications.filter((n) => !n.is_read).length > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={async () => {
                        await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
                        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                      }}>تعليم الكل كمقروء</Button>
                    )}
                  </div>
                )}
                {notifications.length > 0 && (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {notifications.map((notif, i) => {
                        const typeIcon = notif.type === 'success' ? CheckCircle2 : notif.type === 'error' ? XCircle : Bell;
                        const TypeIcon = typeIcon;
                        const typeColor = notif.type === 'success' ? 'text-medical-green' : notif.type === 'error' ? 'text-destructive' : 'text-primary';
                        return (
                          <motion.div key={notif.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                            className={`glass-card rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all ${!notif.is_read ? "border-r-4 border-r-primary" : "opacity-60"}`}
                            onClick={async () => {
                              if (!notif.is_read) {
                                await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
                                setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
                              }
                            }}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-muted"}`}>
                              <TypeIcon className={`w-4 h-4 ${!notif.is_read ? typeColor : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-foreground">{notif.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">{new Date(notif.created_at).toLocaleDateString("ar-EG", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prescriptions">
                {prescriptions.length === 0 ? (
                  <div className="text-center py-16">
                    <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-display font-bold text-foreground mb-2">مافيش روشتات</h3>
                    <p className="text-muted-foreground">الروشتات هتظهر هنا بعد زيارة الطبيب</p>
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
                            <h4 className="font-semibold text-foreground">{pr.doctors?.name}</h4>
                            <p className="text-xs text-muted-foreground">{new Date(pr.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5 text-medical-green" onClick={() => generatePrescriptionPDF(pr, profile?.full_name || user.email || '')}>
                            <Download className="w-4 h-4" />تحميل PDF
                          </Button>
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
                <div className="glass-card rounded-2xl p-6 max-w-lg">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl gradient-hero-bg flex items-center justify-center">
                      <User className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-foreground">{profile?.full_name || "مستخدم"}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "البريد الإلكتروني", value: user.email || "" },
                      { label: "رقم الموبايل", value: profile?.phone || "غير محدد" },
                      { label: "تاريخ الاشتراك", value: new Date(user.created_at).toLocaleDateString("ar-EG") },
                    ].map((field) => (
                      <div key={field.label} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                        <span className="text-sm text-muted-foreground">{field.label}</span>
                        <span className="text-sm font-medium text-foreground" dir="ltr">{field.value}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/profile" className="block mt-6">
                    <Button className="gradient-hero-bg text-primary-foreground border-0 gap-2 w-full">
                      <Settings className="w-4 h-4" />تعديل البيانات وكلمة المرور
                    </Button>
                  </Link>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

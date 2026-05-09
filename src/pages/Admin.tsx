import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, FileText, Stethoscope, TrendingUp, CheckCircle2, Clock, XCircle,
  Plus, Trash2, Edit, Shield, Pill, Search, Upload, Image, Tag, Download, BarChart3,
  CreditCard, Banknote, Ticket, Percent, Ban, UserX, MessageCircleQuestion, Send, EyeOff, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AnalyticsTab from "@/components/admin/AnalyticsTab";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getPublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/uploads/${path}`;
}

function generatePrescriptionPDF(pr: any) {
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
      <div class="info-item"><span class="label">المريض: </span><span class="value">${pr.patient_name || ''}</span></div>
      <div class="info-item"><span class="label">الطبيب: </span><span class="value">${pr.doctors?.name || ''}</span></div>
      <div class="info-item"><span class="label">التاريخ: </span><span class="value">${new Date(pr.created_at).toLocaleDateString("ar-EG")}</span></div>
    </div>
    ${pr.diagnosis ? `<div style="margin:15px 0"><strong>التشخيص:</strong> ${pr.diagnosis}</div>` : ''}
    <table><thead><tr><th>الدواء</th><th>الجرعة</th><th>التعليمات</th></tr></thead><tbody>${medsRows || '<tr><td colspan="3" style="padding:8px;text-align:center">لا توجد أدوية</td></tr>'}</tbody></table>
    ${pr.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${pr.notes}</div>` : ''}
    <div class="footer">هذه الروشتة صادرة من نظام ميديكير الإلكتروني</div>
    </body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [bookingFilter, setBookingFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [linkDoctorDialogOpen, setLinkDoctorDialogOpen] = useState(false);
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null);
  const [selectedDoctorToLink, setSelectedDoctorToLink] = useState("");
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banUserId, setBanUserId] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState("7"); // days

  // Doctor form
  const [docForm, setDocForm] = useState({ name: "", specialty: "", location: "", price: 0, bio: "" });
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [docImageFile, setDocImageFile] = useState<File | null>(null);
  const docImageRef = useRef<HTMLInputElement>(null);

  // Article form
  const [artForm, setArtForm] = useState({ title: "", content: "", excerpt: "", category: "عام", author: "فريق ميديكير" });
  const [artDialogOpen, setArtDialogOpen] = useState(false);
  const [editingArt, setEditingArt] = useState<any>(null);
  const [artImageFile, setArtImageFile] = useState<File | null>(null);
  const artImageRef = useRef<HTMLInputElement>(null);

  // Prescription form
  const [prescForm, setPrescForm] = useState({ booking_id: "", doctor_id: "", patient_id: "", diagnosis: "", medications: "", notes: "" });
  const [prescDialogOpen, setPrescDialogOpen] = useState(false);
  const [editingPresc, setEditingPresc] = useState<any>(null);

  // Offer form
  const [offerForm, setOfferForm] = useState({ title: "", description: "", discount: "", discount_percentage: 0, badge: "عرض", ends_at: "" });
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);

  // Coupons state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponForm, setCouponForm] = useState({
    code: "", description: "", discount_type: "percentage", discount_value: 0,
    min_amount: 0, max_uses: null as number | null, expires_at: ""
  });
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  // User questions
  const [questions, setQuestions] = useState<any[]>([]);
  const [qAnswerMap, setQAnswerMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
      toast.error("مش مسموحلك تدخل هنا");
    }
  }, [authLoading, user, isAdmin, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchAll = async () => {
      const [{ data: d }, { data: b }, { data: a }, { data: p }, { data: pr }, { data: o }, { data: ur }, { data: pay }, { data: coup }, { data: qs }] = await Promise.all([
        supabase.from("doctors").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("*, doctors(name, specialty)").order("created_at", { ascending: false }),
        supabase.from("articles").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("prescriptions").select("*, doctors(name), bookings(booking_date)").order("created_at", { ascending: false }),
        supabase.from("offers").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*").order("user_id"),
        supabase.from("payments").select("*, bookings(booking_date, doctors(name))").order("created_at", { ascending: false }),
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
        supabase.from("user_questions").select("*").order("created_at", { ascending: false }),
      ]);
      const profileMap = new Map((p || []).map((prof: any) => [prof.user_id, prof.full_name]));
      const bookingsWithNames = (b || []).map((booking: any) => ({
        ...booking,
        patient_name: profileMap.get(booking.user_id) || "مستخدم",
      }));
      const prescsWithNames = (pr || []).map((presc: any) => ({
        ...presc,
        patient_name: profileMap.get(presc.patient_id) || "مستخدم",
      }));
      setDoctors(d || []);
      setBookings(bookingsWithNames);
      setArticles(a || []);
      setProfiles(p || []);
      setPrescriptions(prescsWithNames);
      setOffers(o || []);
      setUserRoles(ur || []);
      setCoupons(coup || []);
      setQuestions(qs || []);
      const payWithNames = (pay || []).map((pm: any) => ({
        ...pm,
        patient_name: profileMap.get(pm.user_id) || "مستخدم",
      }));
      setPayments(payWithNames);
      setLoadingData(false);
    };
    fetchAll();
  }, [user, isAdmin]);

  // Upload image helper
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("خطأ في رفع الصورة"); return null; }
    return getPublicUrl(path);
  };

  // Doctor CRUD
  const openEditDoctor = (doc: any) => {
    setEditingDoc(doc);
    setDocForm({ name: doc.name, specialty: doc.specialty, location: doc.location, price: doc.price, bio: doc.bio || "" });
    setDocImageFile(null);
    setDocDialogOpen(true);
  };

  const openAddDoctor = () => {
    setEditingDoc(null);
    setDocForm({ name: "", specialty: "", location: "", price: 0, bio: "" });
    setDocImageFile(null);
    setDocDialogOpen(true);
  };

  const saveDoctor = async () => {
    let image_url = editingDoc?.image_url || "";
    if (docImageFile) {
      const url = await uploadImage(docImageFile, "doctors");
      if (url) image_url = url;
    }
    if (editingDoc) {
      const { error } = await supabase.from("doctors").update({ ...docForm, image_url }).eq("id", editingDoc.id);
      if (!error) {
        toast.success("تم تعديل بيانات الطبيب");
        setDoctors((prev) => prev.map((d) => d.id === editingDoc.id ? { ...d, ...docForm, image_url } : d));
      } else toast.error("حدث خطأ");
    } else {
      const { error } = await supabase.from("doctors").insert({ ...docForm, image_url, is_active: true, consultation_types: ["clinic", "online"] });
      if (!error) {
        toast.success("تم إضافة الطبيب");
        const { data } = await supabase.from("doctors").select("*").order("created_at", { ascending: false });
        setDoctors(data || []);
      } else toast.error("حدث خطأ");
    }
    setDocDialogOpen(false);
    setEditingDoc(null);
    setDocImageFile(null);
  };

  const deleteDoctor = async (id: string) => {
    await supabase.from("doctors").delete().eq("id", id);
    setDoctors((prev) => prev.filter((d) => d.id !== id));
    toast.success("تم حذف الطبيب");
  };

  // Article CRUD
  const openEditArticle = (art: any) => {
    setEditingArt(art);
    setArtForm({ title: art.title, content: art.content, excerpt: art.excerpt || "", category: art.category, author: art.author });
    setArtImageFile(null);
    setArtDialogOpen(true);
  };

  const openAddArticle = () => {
    setEditingArt(null);
    setArtForm({ title: "", content: "", excerpt: "", category: "عام", author: "فريق ميديكير" });
    setArtImageFile(null);
    setArtDialogOpen(true);
  };

  const saveArticle = async () => {
    let image_url = editingArt?.image_url || "";
    if (artImageFile) {
      const url = await uploadImage(artImageFile, "articles");
      if (url) image_url = url;
    }
    if (editingArt) {
      const { error } = await supabase.from("articles").update({ ...artForm, image_url }).eq("id", editingArt.id);
      if (!error) {
        toast.success("تم تعديل المقال");
        setArticles((prev) => prev.map((a) => a.id === editingArt.id ? { ...a, ...artForm, image_url } : a));
      } else toast.error("حدث خطأ");
    } else {
      const { error } = await supabase.from("articles").insert({ ...artForm, image_url, is_published: true });
      if (!error) {
        toast.success("تم إضافة المقال");
        const { data } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
        setArticles(data || []);
      } else toast.error("حدث خطأ");
    }
    setArtDialogOpen(false);
    setEditingArt(null);
    setArtImageFile(null);
  };

  const deleteArticle = async (id: string) => {
    await supabase.from("articles").delete().eq("id", id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
    toast.success("تم حذف المقال");
  };

  // Bookings
  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    // Send SMS notification on status change
    supabase.functions.invoke("send-booking-sms", {
      body: { booking_id: id, status },
    }).then(({ error }) => {
      if (error) console.error("SMS error:", error);
    });
    toast.success("تم تحديث حالة الحجز وإرسال إشعار");
  };

  const updateBookingQueue = async (id: string, queue_position: number | null, estimated_wait: string | null) => {
    await supabase.from("bookings").update({ queue_position, estimated_wait }).eq("id", id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, queue_position, estimated_wait } : b)));
    toast.success("تم تحديث بيانات الطابور");
  };

  const deleteCancelledBookings = async () => {
    const cancelledIds = bookings.filter((b) => b.status === "cancelled").map((b) => b.id);
    if (cancelledIds.length === 0) return toast.info("مافيش حجوزات ملغية");
    for (const id of cancelledIds) {
      await supabase.from("bookings").delete().eq("id", id);
    }
    setBookings((prev) => prev.filter((b) => b.status !== "cancelled"));
    toast.success(`تم حذف ${cancelledIds.length} حجز ملغي`);
  };

  const deleteBooking = async (id: string) => {
    await supabase.from("bookings").delete().eq("id", id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
    toast.success("تم حذف الحجز");
  };

  // Prescriptions
  const openEditPrescription = (pr: any) => {
    setEditingPresc(pr);
    const medsText = (Array.isArray(pr.medications) ? pr.medications : [])
      .map((m: any) => `${m.name}${m.dosage ? ' - ' + m.dosage : ''}${m.instructions ? ' - ' + m.instructions : ''}`)
      .join('\n');
    setPrescForm({
      booking_id: pr.booking_id,
      doctor_id: pr.doctor_id,
      patient_id: pr.patient_id,
      diagnosis: pr.diagnosis || "",
      medications: medsText,
      notes: pr.notes || "",
    });
    setPrescDialogOpen(true);
  };

  const openAddPrescription = () => {
    setEditingPresc(null);
    setPrescForm({ booking_id: "", doctor_id: "", patient_id: "", diagnosis: "", medications: "", notes: "" });
    setPrescDialogOpen(true);
  };

  const savePrescription = async () => {
    const medsArray = prescForm.medications.split("\n").filter(Boolean).map((m) => {
      const parts = m.split("-").map((s) => s.trim());
      return { name: parts[0] || m, dosage: parts[1] || "", instructions: parts[2] || "" };
    });
    const payload = {
      booking_id: prescForm.booking_id,
      doctor_id: prescForm.doctor_id,
      patient_id: prescForm.patient_id,
      diagnosis: prescForm.diagnosis,
      medications: medsArray,
      notes: prescForm.notes,
    };
    if (editingPresc) {
      const { error } = await supabase.from("prescriptions").update(payload).eq("id", editingPresc.id);
      if (!error) {
        toast.success("تم تعديل الروشتة");
        const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
        setPrescriptions((prev) => prev.map((p) => p.id === editingPresc.id ? { ...p, ...payload, patient_name: profileMap.get(payload.patient_id) || "مستخدم" } : p));
      } else toast.error("حدث خطأ: " + error.message);
    } else {
      const { error } = await supabase.from("prescriptions").insert(payload);
      if (!error) {
        toast.success("تم إضافة الروشتة");
        const { data } = await supabase.from("prescriptions").select("*, doctors(name), bookings(booking_date)").order("created_at", { ascending: false });
        const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
        setPrescriptions((data || []).map((pr: any) => ({ ...pr, patient_name: profileMap.get(pr.patient_id) || "مستخدم" })));
      } else toast.error("حدث خطأ: " + error.message);
    }
    setPrescDialogOpen(false);
    setEditingPresc(null);
  };

  const deletePrescription = async (id: string) => {
    await supabase.from("prescriptions").delete().eq("id", id);
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    toast.success("تم حذف الروشتة");
  };

  // Offers CRUD
  const openEditOffer = (o: any) => {
    setEditingOffer(o);
    setOfferForm({ title: o.title, description: o.description, discount: o.discount, discount_percentage: o.discount_percentage || 0, badge: o.badge, ends_at: o.ends_at ? new Date(o.ends_at).toISOString().slice(0, 16) : "" });
    setOfferDialogOpen(true);
  };

  const openAddOffer = () => {
    setEditingOffer(null);
    setOfferForm({ title: "", description: "", discount: "", discount_percentage: 0, badge: "عرض", ends_at: "" });
    setOfferDialogOpen(true);
  };

  const saveOffer = async () => {
    const payload = {
      title: offerForm.title,
      description: offerForm.description,
      discount: offerForm.discount,
      discount_percentage: offerForm.discount_percentage,
      badge: offerForm.badge,
      ends_at: offerForm.ends_at ? new Date(offerForm.ends_at).toISOString() : null,
      is_active: true,
    };
    if (editingOffer) {
      const { error } = await supabase.from("offers").update(payload).eq("id", editingOffer.id);
      if (!error) {
        toast.success("تم تعديل العرض");
        setOffers((prev) => prev.map((o) => o.id === editingOffer.id ? { ...o, ...payload } : o));
      } else toast.error("حدث خطأ");
    } else {
      const { error } = await supabase.from("offers").insert(payload);
      if (!error) {
        toast.success("تم إضافة العرض");
        const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: false });
        setOffers(data || []);
      } else toast.error("حدث خطأ");
    }
    setOfferDialogOpen(false);
    setEditingOffer(null);
  };

  const deleteOffer = async (id: string) => {
    await supabase.from("offers").delete().eq("id", id);
    setOffers((prev) => prev.filter((o) => o.id !== id));
    toast.success("تم حذف العرض");
  };

  // Coupons CRUD
  const openEditCoupon = (c: any) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_amount: c.min_amount || 0,
      max_uses: c.max_uses,
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : "",
    });
    setCouponDialogOpen(true);
  };

  const openAddCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({ code: "", description: "", discount_type: "percentage", discount_value: 0, min_amount: 0, max_uses: null, expires_at: "" });
    setCouponDialogOpen(true);
  };

  const saveCoupon = async () => {
    const payload = {
      code: couponForm.code.toUpperCase().trim(),
      description: couponForm.description,
      discount_type: couponForm.discount_type,
      discount_value: couponForm.discount_value,
      min_amount: couponForm.min_amount || null,
      max_uses: couponForm.max_uses || null,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
      is_active: true,
    };
    if (editingCoupon) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCoupon.id);
      if (!error) {
        toast.success("تم تعديل الكوبون");
        setCoupons((prev) => prev.map((c) => c.id === editingCoupon.id ? { ...c, ...payload } : c));
      } else toast.error("حدث خطأ: " + error.message);
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (!error) {
        toast.success("تم إضافة الكوبون");
        const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
        setCoupons(data || []);
      } else toast.error("حدث خطأ: " + error.message);
    }
    setCouponDialogOpen(false);
    setEditingCoupon(null);
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    toast.success("تم حذف الكوبون");
  };

  const toggleCouponActive = async (id: string, isActive: boolean) => {
    await supabase.from("coupons").update({ is_active: isActive }).eq("id", id);
    setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, is_active: isActive } : c));
    toast.success(isActive ? "تم تفعيل الكوبون" : "تم إيقاف الكوبون");
  };

  const banUser = async (userId: string, days: number) => {
    const bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "ban_user", user_id: userId, banned_until: bannedUntil },
    });
    if (error || data?.error) { toast.error("حدث خطأ في حظر المستخدم"); return; }
    setProfiles((prev) => prev.map((p) => p.user_id === userId ? { ...p, banned_until: bannedUntil } : p));
    toast.success(`تم حظر المستخدم لمدة ${days} يوم`);
    setBanDialogOpen(false);
  };

  const unbanUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "ban_user", user_id: userId, banned_until: null },
    });
    if (error || data?.error) { toast.error("حدث خطأ"); return; }
    setProfiles((prev) => prev.map((p) => p.user_id === userId ? { ...p, banned_until: null } : p));
    toast.success("تم رفع الحظر عن المستخدم");
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟")) return;
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "delete_user", user_id: userId },
    });
    if (error || data?.error) { toast.error("حدث خطأ في حذف المستخدم"); return; }
    setProfiles((prev) => prev.filter((p) => p.user_id !== userId));
    setUserRoles((prev) => prev.filter((r) => r.user_id !== userId));
    toast.success("تم حذف المستخدم نهائياً");
  };

  const filteredBookings = bookingFilter === "all" ? bookings : bookings.filter((b) => b.status === bookingFilter);

  if (authLoading || loadingData) {
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

  const stats = [
    { label: "إجمالي الأطباء", value: doctors.length, icon: Stethoscope, color: "text-primary" },
    { label: "إجمالي الحجوزات", value: bookings.length, icon: Calendar, color: "text-medical-blue" },
    { label: "المقالات", value: articles.length, icon: FileText, color: "text-medical-purple" },
    { label: "الروشتات", value: prescriptions.length, icon: Pill, color: "text-medical-green" },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-600",
      confirmed: "bg-primary/10 text-primary",
      completed: "bg-medical-green/10 text-medical-green",
      cancelled: "bg-destructive/10 text-destructive",
    };
    const labels: Record<string, string> = { pending: "انتظار", confirmed: "مؤكد", completed: "مكتمل", cancelled: "ملغي" };
    return <Badge className={`${map[status] || ""} border-0`}>{labels[status] || status}</Badge>;
  };

  // Image upload input component
  const ImageUploadField = ({ fileRef, file, setFile, currentUrl, label }: any) => (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3 mt-1">
        {(currentUrl || file) && (
          <img src={file ? URL.createObjectURL(file) : currentUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
        )}
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" />{file ? "تغيير" : "رفع صورة"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-8">
        <div className="container-narrow">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medical-coral/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-medical-coral" />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">لوحة تحكم الأدمن</h1>
                <p className="text-muted-foreground text-sm">إدارة شاملة للنظام</p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-2xl p-4 text-center">
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollArea className="w-full whitespace-nowrap mb-6">
              <TabsList className="inline-flex w-max bg-muted/50 p-1 rounded-xl gap-1">
                <TabsTrigger value="overview" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><TrendingUp className="w-4 h-4" /><span className="hidden sm:inline">نظرة عامة</span><span className="sm:hidden">عام</span></TabsTrigger>
                <TabsTrigger value="doctors" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Stethoscope className="w-4 h-4" /><span className="hidden sm:inline">الأطباء</span><span className="sm:hidden">أطباء</span></TabsTrigger>
                <TabsTrigger value="bookings" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Calendar className="w-4 h-4" /><span className="hidden sm:inline">الحجوزات</span><span className="sm:hidden">حجز</span></TabsTrigger>
                <TabsTrigger value="prescriptions" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Pill className="w-4 h-4" /><span className="hidden sm:inline">الروشتات</span><span className="sm:hidden">روشتة</span></TabsTrigger>
                <TabsTrigger value="articles" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><FileText className="w-4 h-4" /><span className="hidden sm:inline">المقالات</span><span className="sm:hidden">مقالات</span></TabsTrigger>
                <TabsTrigger value="offers" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Tag className="w-4 h-4" /><span className="hidden sm:inline">العروض</span><span className="sm:hidden">عروض</span></TabsTrigger>
                <TabsTrigger value="coupons" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Ticket className="w-4 h-4" /><span className="hidden sm:inline">الكوبونات</span><span className="sm:hidden">كوبون</span></TabsTrigger>
                <TabsTrigger value="users" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Users className="w-4 h-4" /><span className="hidden sm:inline">المستخدمين</span><span className="sm:hidden">مستخدم</span></TabsTrigger>
                <TabsTrigger value="payments" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><CreditCard className="w-4 h-4" /><span className="hidden sm:inline">المدفوعات</span><span className="sm:hidden">دفع</span></TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">التحليلات</span><span className="sm:hidden">تحليل</span></TabsTrigger>
                <TabsTrigger value="questions" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><MessageCircleQuestion className="w-4 h-4" /><span className="hidden sm:inline">الأسئلة</span><span className="sm:hidden">سؤال</span></TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">آخر الحجوزات</h3>
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{b.patient_name}</p>
                          <p className="text-xs text-muted-foreground">{b.doctors?.name} • {b.booking_date}</p>
                        </div>
                        {statusBadge(b.status)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">إحصائيات الحجوزات</h3>
                  <div className="space-y-4">
                    {[
                      { label: "في الانتظار", count: bookings.filter((b) => b.status === "pending").length, icon: Clock, color: "text-yellow-600" },
                      { label: "مؤكدة", count: bookings.filter((b) => b.status === "confirmed").length, icon: CheckCircle2, color: "text-primary" },
                      { label: "مكتملة", count: bookings.filter((b) => b.status === "completed").length, icon: CheckCircle2, color: "text-medical-green" },
                      { label: "ملغية", count: bookings.filter((b) => b.status === "cancelled").length, icon: XCircle, color: "text-destructive" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <s.icon className={`w-4 h-4 ${s.color}`} />
                          <span className="text-sm text-foreground">{s.label}</span>
                        </div>
                        <span className="font-display font-bold text-foreground">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Doctors */}
            <TabsContent value="doctors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة الأطباء</h3>
                <Dialog open={docDialogOpen} onOpenChange={(open) => { setDocDialogOpen(open); if (!open) { setEditingDoc(null); setDocImageFile(null); } }}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddDoctor} className="gradient-hero-bg text-primary-foreground border-0 gap-2"><Plus className="w-4 h-4" />إضافة طبيب</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="font-display">{editingDoc ? "تعديل بيانات الطبيب" : "إضافة طبيب جديد"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <ImageUploadField fileRef={docImageRef} file={docImageFile} setFile={setDocImageFile} currentUrl={editingDoc?.image_url} label="صورة الطبيب" />
                      <div><Label>الاسم</Label><Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} /></div>
                      <div><Label>التخصص</Label><Input value={docForm.specialty} onChange={(e) => setDocForm({ ...docForm, specialty: e.target.value })} /></div>
                      <div><Label>الموقع</Label><Input value={docForm.location} onChange={(e) => setDocForm({ ...docForm, location: e.target.value })} /></div>
                      <div><Label>السعر (جنيه)</Label><Input type="number" value={docForm.price} onChange={(e) => setDocForm({ ...docForm, price: Number(e.target.value) })} /></div>
                      <div><Label>نبذة</Label><Textarea value={docForm.bio} onChange={(e) => setDocForm({ ...docForm, bio: e.target.value })} /></div>
                      <Button onClick={saveDoctor} className="w-full gradient-hero-bg text-primary-foreground border-0">{editingDoc ? "حفظ التعديلات" : "إضافة"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow><TableHead className="text-right">الصورة</TableHead><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">التخصص</TableHead><TableHead className="text-right">الموقع</TableHead><TableHead className="text-right">السعر</TableHead><TableHead className="text-right">إجراءات</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          {doc.image_url ? <img src={doc.image_url} alt={doc.name} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Image className="w-4 h-4 text-muted-foreground" /></div>}
                        </TableCell>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>{doc.specialty}</TableCell>
                        <TableCell>{doc.location}</TableCell>
                        <TableCell>{doc.price} جنيه</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-primary" onClick={() => openEditDoctor(doc)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDoctor(doc.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Bookings */}
            <TabsContent value="bookings">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة الحجوزات</h3>
                <div className="flex gap-2 flex-wrap">
                  <Select value={bookingFilter} onValueChange={setBookingFilter}>
                    <SelectTrigger className="w-32 h-9"><SelectValue placeholder="فلتر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="pending">انتظار</SelectItem>
                      <SelectItem value="confirmed">مؤكد</SelectItem>
                      <SelectItem value="completed">مكتمل</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={deleteCancelledBookings}>
                    <Trash2 className="w-4 h-4" />حذف الملغية
                  </Button>
                </div>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow><TableHead className="text-right">المريض</TableHead><TableHead className="text-right">الطبيب</TableHead><TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">النوع</TableHead><TableHead className="text-right">الحالة</TableHead><TableHead className="text-right">الطابور</TableHead><TableHead className="text-right">إجراءات</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.patient_name}</TableCell>
                        <TableCell>{b.doctors?.name}</TableCell>
                        <TableCell>{b.booking_date} {b.booking_time}</TableCell>
                        <TableCell>{b.type === "online" ? "أونلاين" : "عيادة"}</TableCell>
                        <TableCell>{statusBadge(b.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              placeholder="ترتيب"
                              className="w-16 h-8 text-xs"
                              defaultValue={b.queue_position || ""}
                              onBlur={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                if (val !== b.queue_position) updateBookingQueue(b.id, val, b.estimated_wait);
                              }}
                            />
                            <Input
                              placeholder="وقت"
                              className="w-20 h-8 text-xs"
                              defaultValue={b.estimated_wait || ""}
                              onBlur={(e) => {
                                const val = e.target.value || null;
                                if (val !== b.estimated_wait) updateBookingQueue(b.id, b.queue_position, val);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            <Select value={b.status} onValueChange={(val) => updateBookingStatus(b.id, val)}>
                              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">انتظار</SelectItem>
                                <SelectItem value="confirmed">تأكيد</SelectItem>
                                <SelectItem value="completed">مكتمل</SelectItem>
                                <SelectItem value="cancelled">إلغاء</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteBooking(b.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBookings.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">مافيش حجوزات</TableCell></TableRow>
                    )}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Prescriptions */}
            <TabsContent value="prescriptions">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة الروشتات</h3>
                <Dialog open={prescDialogOpen} onOpenChange={(open) => { setPrescDialogOpen(open); if (!open) setEditingPresc(null); }}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddPrescription} className="gradient-hero-bg text-primary-foreground border-0 gap-2"><Plus className="w-4 h-4" />إضافة روشتة</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle className="font-display">{editingPresc ? "تعديل الروشتة" : "إضافة روشتة جديدة"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {!editingPresc && (
                        <div>
                          <Label>الحجز</Label>
                          <Select value={prescForm.booking_id} onValueChange={(val) => {
                            const booking = bookings.find((b) => b.id === val);
                            setPrescForm({
                              ...prescForm,
                              booking_id: val,
                              doctor_id: booking?.doctor_id || "",
                              patient_id: booking?.user_id || "",
                            });
                          }}>
                            <SelectTrigger><SelectValue placeholder="اختر حجز" /></SelectTrigger>
                            <SelectContent>
                              {bookings.filter((b) => b.status === "confirmed" || b.status === "completed").map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.patient_name} - {b.doctors?.name} ({b.booking_date})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div><Label>التشخيص</Label><Input value={prescForm.diagnosis} onChange={(e) => setPrescForm({ ...prescForm, diagnosis: e.target.value })} /></div>
                      <div>
                        <Label>الأدوية (دواء - جرعة - تعليمات) سطر لكل دواء</Label>
                        <Textarea rows={4} placeholder="باراسيتامول - 500مجم - كل 8 ساعات&#10;أموكسيسيلين - 1جم - كل 12 ساعة" value={prescForm.medications} onChange={(e) => setPrescForm({ ...prescForm, medications: e.target.value })} />
                      </div>
                      <div><Label>ملاحظات</Label><Textarea value={prescForm.notes} onChange={(e) => setPrescForm({ ...prescForm, notes: e.target.value })} /></div>
                      <Button onClick={savePrescription} className="w-full gradient-hero-bg text-primary-foreground border-0">{editingPresc ? "حفظ التعديلات" : "إضافة الروشتة"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المريض</TableHead>
                      <TableHead className="text-right">الطبيب</TableHead>
                      <TableHead className="text-right">التشخيص</TableHead>
                      <TableHead className="text-right">الأدوية</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prescriptions.map((pr) => (
                      <TableRow key={pr.id}>
                        <TableCell className="font-medium">{pr.patient_name}</TableCell>
                        <TableCell>{pr.doctors?.name}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{pr.diagnosis}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(Array.isArray(pr.medications) ? pr.medications : []).map((m: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs mr-1">{m.name} {m.dosage && `- ${m.dosage}`}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(pr.created_at).toLocaleDateString("ar-EG")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-primary" onClick={() => openEditPrescription(pr)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-medical-green" onClick={() => generatePrescriptionPDF(pr)}><Download className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePrescription(pr.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {prescriptions.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">مافيش روشتات</TableCell></TableRow>
                    )}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Articles */}
            <TabsContent value="articles">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة المقالات</h3>
                <Dialog open={artDialogOpen} onOpenChange={(open) => { setArtDialogOpen(open); if (!open) { setEditingArt(null); setArtImageFile(null); } }}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddArticle} className="gradient-hero-bg text-primary-foreground border-0 gap-2"><Plus className="w-4 h-4" />إضافة مقال</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="font-display">{editingArt ? "تعديل المقال" : "إضافة مقال جديد"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <ImageUploadField fileRef={artImageRef} file={artImageFile} setFile={setArtImageFile} currentUrl={editingArt?.image_url} label="صورة المقال" />
                      <div><Label>العنوان</Label><Input value={artForm.title} onChange={(e) => setArtForm({ ...artForm, title: e.target.value })} /></div>
                      <div><Label>الملخص</Label><Input value={artForm.excerpt} onChange={(e) => setArtForm({ ...artForm, excerpt: e.target.value })} /></div>
                      <div><Label>التصنيف</Label><Input value={artForm.category} onChange={(e) => setArtForm({ ...artForm, category: e.target.value })} /></div>
                      <div><Label>الكاتب</Label><Input value={artForm.author} onChange={(e) => setArtForm({ ...artForm, author: e.target.value })} /></div>
                      <div><Label>المحتوى</Label><Textarea rows={5} value={artForm.content} onChange={(e) => setArtForm({ ...artForm, content: e.target.value })} /></div>
                      <Button onClick={saveArticle} className="w-full gradient-hero-bg text-primary-foreground border-0">{editingArt ? "حفظ التعديلات" : "إضافة"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow><TableHead className="text-right">الصورة</TableHead><TableHead className="text-right">العنوان</TableHead><TableHead className="text-right">التصنيف</TableHead><TableHead className="text-right">الكاتب</TableHead><TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">إجراءات</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.image_url ? <img src={a.image_url} alt={a.title} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Image className="w-4 h-4 text-muted-foreground" /></div>}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{a.title}</TableCell>
                        <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                        <TableCell>{a.author}</TableCell>
                        <TableCell>{new Date(a.created_at).toLocaleDateString("ar-EG")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-primary" onClick={() => openEditArticle(a)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteArticle(a.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Offers */}
            <TabsContent value="offers">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة العروض والخصومات</h3>
                <Dialog open={offerDialogOpen} onOpenChange={(open) => { setOfferDialogOpen(open); if (!open) setEditingOffer(null); }}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddOffer} className="gradient-hero-bg text-primary-foreground border-0 gap-2"><Plus className="w-4 h-4" />إضافة عرض</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="font-display">{editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>عنوان العرض</Label><Input value={offerForm.title} onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })} /></div>
                      <div><Label>الوصف</Label><Textarea value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} /></div>
                      <div><Label>الخصم (نص عرض مثل: ٥٠٪ أو مجاناً)</Label><Input value={offerForm.discount} onChange={(e) => setOfferForm({ ...offerForm, discount: e.target.value })} /></div>
                      <div><Label>نسبة الخصم الفعلية (%)</Label><Input type="number" min={0} max={100} value={offerForm.discount_percentage} onChange={(e) => setOfferForm({ ...offerForm, discount_percentage: Number(e.target.value) })} placeholder="مثال: 20" /></div>
                      <div><Label>الشارة</Label>
                        <Select value={offerForm.badge} onValueChange={(val) => setOfferForm({ ...offerForm, badge: val })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="مميز">مميز</SelectItem>
                            <SelectItem value="جديد">جديد</SelectItem>
                            <SelectItem value="خصم">خصم</SelectItem>
                            <SelectItem value="عرض">عرض</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>ينتهي في</Label><Input type="datetime-local" value={offerForm.ends_at} onChange={(e) => setOfferForm({ ...offerForm, ends_at: e.target.value })} /></div>
                      <Button onClick={saveOffer} className="w-full gradient-hero-bg text-primary-foreground border-0">{editingOffer ? "حفظ التعديلات" : "إضافة العرض"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow><TableHead className="text-right">العنوان</TableHead><TableHead className="text-right">الخصم</TableHead><TableHead className="text-right">الشارة</TableHead><TableHead className="text-right">ينتهي في</TableHead><TableHead className="text-right">إجراءات</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.title}</TableCell>
                        <TableCell><Badge className="bg-primary/10 text-primary border-0">{o.discount}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{o.badge}</Badge></TableCell>
                        <TableCell>{o.ends_at ? new Date(o.ends_at).toLocaleDateString("ar-EG") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-primary" onClick={() => openEditOffer(o)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteOffer(o.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {offers.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">مافيش عروض</TableCell></TableRow>
                    )}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Coupons */}
            <TabsContent value="coupons">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة الكوبونات</h3>
                <Dialog open={couponDialogOpen} onOpenChange={(open) => { setCouponDialogOpen(open); if (!open) setEditingCoupon(null); }}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddCoupon} className="gradient-hero-bg text-primary-foreground border-0 gap-2"><Plus className="w-4 h-4" />إضافة كوبون</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="font-display">{editingCoupon ? "تعديل الكوبون" : "إضافة كوبون جديد"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>كود الكوبون</Label><Input placeholder="مثال: SAVE20" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} /></div>
                      <div><Label>الوصف (اختياري)</Label><Textarea value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>نوع الخصم</Label>
                          <Select value={couponForm.discount_type} onValueChange={(val) => setCouponForm({ ...couponForm, discount_type: val })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                              <SelectItem value="fixed">مبلغ ثابت (جنيه)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>قيمة الخصم</Label>
                          <Input type="number" min={0} value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>الحد الأدنى للطلب (جنيه)</Label>
                          <Input type="number" min={0} value={couponForm.min_amount} onChange={(e) => setCouponForm({ ...couponForm, min_amount: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>الحد الأقصى للاستخدام</Label>
                          <Input type="number" min={0} placeholder="غير محدود" value={couponForm.max_uses || ""} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value ? Number(e.target.value) : null })} />
                        </div>
                      </div>
                      <div><Label>تاريخ الانتهاء</Label><Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} /></div>
                      <Button onClick={saveCoupon} className="w-full gradient-hero-bg text-primary-foreground border-0">{editingCoupon ? "حفظ التعديلات" : "إضافة الكوبون"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Coupon Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "إجمالي الكوبونات", value: coupons.length, icon: Ticket, color: "text-primary" },
                  { label: "نشطة", value: coupons.filter(c => c.is_active).length, icon: CheckCircle2, color: "text-medical-green" },
                  { label: "مستخدمة", value: coupons.reduce((s, c) => s + c.used_count, 0), icon: Tag, color: "text-medical-blue" },
                  { label: "منتهية", value: coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length, icon: XCircle, color: "text-destructive" },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card rounded-2xl p-4 text-center">
                    <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                    <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">الخصم</TableHead>
                        <TableHead className="text-right">الحد الأدنى</TableHead>
                        <TableHead className="text-right">الاستخدام</TableHead>
                        <TableHead className="text-right">انتهاء الصلاحية</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((c) => {
                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                        return (
                          <TableRow key={c.id} className={isExpired ? "opacity-60" : ""}>
                            <TableCell className="font-mono font-bold text-primary">{c.code}</TableCell>
                            <TableCell>
                              <Badge className="bg-primary/10 text-primary border-0 gap-1">
                                {c.discount_type === "percentage" ? <Percent className="w-3 h-3" /> : null}
                                {c.discount_value}{c.discount_type === "percentage" ? "%" : " جنيه"}
                              </Badge>
                            </TableCell>
                            <TableCell>{c.min_amount ? `${c.min_amount} جنيه` : "—"}</TableCell>
                            <TableCell>
                              <span className="text-sm">{c.used_count}</span>
                              {c.max_uses && <span className="text-muted-foreground">/{c.max_uses}</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.expires_at ? (
                                <span className={isExpired ? "text-destructive" : ""}>
                                  {new Date(c.expires_at).toLocaleDateString("ar-EG")}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch checked={c.is_active} onCheckedChange={(checked) => toggleCouponActive(c.id, checked)} />
                                <span className="text-xs">{c.is_active ? "نشط" : "متوقف"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="text-primary" onClick={() => openEditCoupon(c)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCoupon(c.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {coupons.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">مافيش كوبونات</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics">
              <AnalyticsTab bookings={bookings} doctors={doctors} profiles={profiles} prescriptions={prescriptions} articles={articles} offers={offers} />
            </TabsContent>

            {/* Payments */}
            <TabsContent value="payments">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة المدفوعات</h3>
                <div className="flex gap-2 flex-wrap">
                  {["all", "pending", "completed", "refunded"].map((f) => (
                    <Button key={f} size="sm" variant={paymentFilter === f ? "default" : "outline"}
                      onClick={() => setPaymentFilter(f)}
                      className={paymentFilter === f ? "gradient-hero-bg text-primary-foreground border-0" : ""}>
                      {f === "all" ? "الكل" : f === "pending" ? "في الانتظار" : f === "completed" ? "مكتمل" : "مسترد"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Payment Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "إجمالي المدفوعات", value: payments.length, icon: CreditCard, color: "text-primary" },
                  { label: "مكتملة", value: payments.filter(p => p.status === "completed").length, icon: CheckCircle2, color: "text-medical-green" },
                  { label: "في الانتظار", value: payments.filter(p => p.status === "pending").length, icon: Clock, color: "text-yellow-600" },
                  { label: "إجمالي الإيرادات", value: `${payments.filter(p => p.status === "completed").reduce((s: number, p: any) => s + p.amount, 0)} ج`, icon: Banknote, color: "text-medical-gold" },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card rounded-2xl p-4 text-center">
                    <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                    <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المريض</TableHead>
                      <TableHead>الطبيب</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الطريقة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>المرجع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments
                      .filter((p) => paymentFilter === "all" || p.status === paymentFilter)
                      .map((payment) => {
                        const methodLabel = payment.payment_method === "cash" ? "كاش" : payment.payment_method === "card" ? "بطاقة" : "محفظة";
                        const statusMap: Record<string, { label: string; cls: string }> = {
                          pending: { label: "انتظار", cls: "bg-yellow-500/10 text-yellow-600" },
                          completed: { label: "مكتمل", cls: "bg-medical-green/10 text-medical-green" },
                          refunded: { label: "مسترد", cls: "bg-destructive/10 text-destructive" },
                        };
                        const st = statusMap[payment.status] || statusMap.pending;
                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.patient_name}</TableCell>
                            <TableCell>{payment.bookings?.doctors?.name || "—"}</TableCell>
                            <TableCell className="font-bold">{payment.amount} جنيه</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{methodLabel}{payment.card_last4 ? ` ****${payment.card_last4}` : ""}</Badge>
                            </TableCell>
                            <TableCell><Badge className={`${st.cls} border-0`}>{st.label}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground" dir="ltr">{payment.transaction_ref || "—"}</TableCell>
                            <TableCell className="text-xs">{new Date(payment.created_at).toLocaleDateString("ar-EG")}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {payment.status === "pending" && (
                                  <Button size="sm" variant="outline" className="text-xs text-medical-green border-medical-green/30"
                                    onClick={async () => {
                                      await supabase.from("payments").update({ status: "completed", transaction_ref: `TXN-${Date.now().toString(36).toUpperCase()}` }).eq("id", payment.id);
                                      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: "completed", transaction_ref: `TXN-${Date.now().toString(36).toUpperCase()}` } : p));
                                      toast.success("تم تأكيد الدفع");
                                    }}>
                                    <CheckCircle2 className="w-3 h-3 ml-1" />تأكيد
                                  </Button>
                                )}
                                {payment.status === "completed" && (
                                  <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/30"
                                    onClick={async () => {
                                      await supabase.from("payments").update({ status: "refunded" }).eq("id", payment.id);
                                      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: "refunded" } : p));
                                      toast.success("تم الاسترداد");
                                    }}>
                                    استرداد
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                {payments.filter((p) => paymentFilter === "all" || p.status === paymentFilter).length === 0 && (
                  <div className="text-center py-12">
                    <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">لا توجد مدفوعات</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Users */}
            <TabsContent value="users">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="font-display font-bold text-foreground">إدارة المستخدمين والصلاحيات</h3>
                <Input placeholder="بحث بالاسم..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full sm:w-64" />
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الموبايل</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الصلاحية</TableHead>
                      <TableHead className="text-right">طبيب مرتبط</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles
                      .filter((p) => !userSearch || (p.full_name || "").includes(userSearch))
                      .map((p) => {
                        const roles = userRoles.filter((r) => r.user_id === p.user_id);
                        const currentRole = roles.find((r) => r.role === 'admin')?.role || roles.find((r) => r.role === 'doctor')?.role || 'user';
                        const linkedDoctor = doctors.find((d) => d.user_id === p.user_id);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.full_name || "غير محدد"}</TableCell>
                            <TableCell dir="ltr">{p.phone || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={currentRole}
                                onValueChange={async (newRole) => {
                                  // Remove old roles
                                  await supabase.from("user_roles").delete().eq("user_id", p.user_id);
                                  // Insert new role
                                  const { error } = await supabase.from("user_roles").insert({ user_id: p.user_id, role: newRole as any });
                                  if (!error) {
                                    toast.success("تم تغيير الصلاحية");
                                    setUserRoles((prev) => [
                                      ...prev.filter((r) => r.user_id !== p.user_id),
                                      { user_id: p.user_id, role: newRole },
                                    ]);
                                  } else toast.error("حدث خطأ: " + error.message);
                                }}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">مستخدم</SelectItem>
                                  <SelectItem value="doctor">طبيب</SelectItem>
                                  <SelectItem value="admin">أدمن</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {currentRole === 'doctor' ? (
                                linkedDoctor ? (
                                  <Badge className="bg-medical-green/10 text-medical-green border-0">{linkedDoctor.name}</Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1"
                                    onClick={() => {
                                      setLinkingUserId(p.user_id);
                                      setSelectedDoctorToLink("");
                                      setLinkDoctorDialogOpen(true);
                                    }}
                                  >
                                    <Stethoscope className="w-3 h-3" />ربط بطبيب
                                  </Button>
                                )
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {p.banned_until && new Date(p.banned_until) > new Date() ? (
                                <Badge className="bg-destructive/10 text-destructive border-0">
                                  محظور حتى {new Date(p.banned_until).toLocaleDateString("ar-EG")}
                                </Badge>
                              ) : (
                                <Badge className="bg-medical-green/10 text-medical-green border-0">نشط</Badge>
                              )}
                            </TableCell>
                            {/* ... existing role & doctor cells ... */}
                            <TableCell>{new Date(p.created_at).toLocaleDateString("ar-EG")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                {linkedDoctor && (
                                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={async () => {
                                    await supabase.from("doctors").update({ user_id: null }).eq("id", linkedDoctor.id);
                                    setDoctors((prev) => prev.map((d) => d.id === linkedDoctor.id ? { ...d, user_id: null } : d));
                                    toast.success("تم فك ربط الطبيب");
                                  }}>فك الربط</Button>
                                )}
                                {p.banned_until && new Date(p.banned_until) > new Date() ? (
                                  <Button variant="ghost" size="sm" className="text-medical-green text-xs gap-1" onClick={() => unbanUser(p.user_id)}>
                                    <CheckCircle2 className="w-3 h-3" />رفع الحظر
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" className="text-yellow-600 text-xs gap-1" onClick={() => {
                                    setBanUserId(p.user_id);
                                    setBanDuration("7");
                                    setBanDialogOpen(true);
                                  }}>
                                    <Ban className="w-3 h-3" />حظر
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-destructive text-xs gap-1" onClick={() => deleteUser(p.user_id)}>
                                  <UserX className="w-3 h-3" />حذف
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                  </Table>
                </div>
              </div>

              {/* Link Doctor Dialog */}
              <Dialog open={linkDoctorDialogOpen} onOpenChange={setLinkDoctorDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle className="font-display">ربط حساب بطبيب</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>اختر الطبيب</Label>
                      <Select value={selectedDoctorToLink} onValueChange={setSelectedDoctorToLink}>
                        <SelectTrigger><SelectValue placeholder="اختر طبيب" /></SelectTrigger>
                        <SelectContent>
                          {doctors.filter((d) => !d.user_id).map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name} — {d.specialty}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full gradient-hero-bg text-primary-foreground border-0"
                      disabled={!selectedDoctorToLink}
                      onClick={async () => {
                        const { error } = await supabase.from("doctors").update({ user_id: linkingUserId }).eq("id", selectedDoctorToLink);
                        if (!error) {
                          toast.success("تم ربط الحساب بالطبيب");
                          setDoctors((prev) => prev.map((d) => d.id === selectedDoctorToLink ? { ...d, user_id: linkingUserId } : d));
                          setLinkDoctorDialogOpen(false);
                        } else toast.error("حدث خطأ");
                      }}
                    >
                      ربط
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Ban User Dialog */}
              <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle className="font-display">حظر مستخدم</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>مدة الحظر (بالأيام)</Label>
                      <Select value={banDuration} onValueChange={setBanDuration}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">يوم واحد</SelectItem>
                          <SelectItem value="3">3 أيام</SelectItem>
                          <SelectItem value="7">أسبوع</SelectItem>
                          <SelectItem value="30">شهر</SelectItem>
                          <SelectItem value="365">سنة</SelectItem>
                          <SelectItem value="36500">دائم</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full bg-destructive text-destructive-foreground"
                      onClick={() => banUserId && banUser(banUserId, parseInt(banDuration))}
                    >
                      <Ban className="w-4 h-4 ml-2" />تأكيد الحظر
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
}

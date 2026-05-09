import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Send, MessageCircleQuestion, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const staticFaqs = [
  {
    q: "إزاي أحجز موعد مع طبيب؟",
    a: "ادخل على صفحة 'حجز موعد'، اختار التخصص أو الطبيب، حدد اليوم والميعاد المناسب، وأكد الحجز. هتوصلك رسالة تأكيد فورًا.",
  },
  {
    q: "هل أقدر أعمل استشارة أونلاين؟",
    a: "أيوة، عندنا خدمة استشارة فيديو ومحادثة مع أطباء متخصصين، تقدر تختار النوع وقت الحجز.",
  },
  {
    q: "إيه طرق الدفع المتاحة؟",
    a: "بنقبل الدفع بالكارت (فيزا/ماستر كارد) والمحافظ الإلكترونية. الحجوزات الأونلاين بتتطلب دفع مسبق.",
  },
  {
    q: "أقدر ألغي أو أأجل الحجز؟",
    a: "أيوة، من لوحة التحكم بتاعتك تقدر تلغي أو تعدل الميعاد قبل الموعد بـ٢٤ ساعة على الأقل.",
  },
  {
    q: "هل بياناتي الطبية محمية؟",
    a: "كل بياناتك مشفرة ومحفوظة بأعلى معايير الأمان، ومتاحة ليك ولطبيبك المعالج فقط.",
  },
  {
    q: "إزاي أوصل للروشتات بتاعتي؟",
    a: "كل روشتات أطبائك بتتحفظ في لوحة التحكم تحت قسم 'الروشتات' وتقدر تحملها PDF في أي وقت.",
  },
  {
    q: "هل في خدمة طوارئ؟",
    a: "أيوة، خدمة الطوارئ متاحة ٢٤/٧، تقدر تتواصل من صفحة 'تواصل معنا' أو الرقم 123 للإسعاف.",
  },
];

interface PublicQuestion {
  id: string;
  question: string;
  answer: string | null;
  name: string;
}

export default function FAQ() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState<PublicQuestion[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_questions")
        .select("id, question, answer, name")
        .eq("is_published", true)
        .order("answered_at", { ascending: false })
        .limit(20);
      setPublished((data as PublicQuestion[]) || []);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !question.trim()) {
      toast.error("اكتب اسمك وسؤالك من فضلك");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("user_questions").insert({
      name: name.trim(),
      email: email.trim() || null,
      question: question.trim(),
      user_id: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("حصل خطأ، حاول تاني");
      return;
    }
    toast.success("تم استلام سؤالك، هنرد عليك قريب");
    setName("");
    setEmail("");
    setQuestion("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-0 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="container-narrow px-4 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            <HelpCircle className="w-4 h-4" /> مركز المساعدة
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl md:text-5xl font-bold mb-4"
          >
            الأسئلة <span className="gradient-text">الشائعة</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            كل اللي محتاج تعرفه عن خدماتنا في مكان واحد. ولو معندكش إجابة لسؤالك، اسألنا في الأسفل.
          </motion.p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-12">
        <div className="container-narrow px-4 md:px-8 max-w-3xl">
          <Card className="p-4 md:p-8">
            <Accordion type="single" collapsible className="w-full">
              {staticFaqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-right font-display font-semibold text-base hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          {/* Published user questions */}
          {published.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="font-display text-xl font-bold">أسئلة من زوارنا</h2>
              </div>
              <Card className="p-4 md:p-8">
                <Accordion type="single" collapsible className="w-full">
                  {published.map((q) => (
                    <AccordionItem key={q.id} value={q.id}>
                      <AccordionTrigger className="text-right font-display font-semibold text-base hover:no-underline">
                        {q.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {q.answer}
                        <div className="text-xs text-muted-foreground/70 mt-2">— {q.name}</div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Ask form */}
      <section className="py-12">
        <div className="container-narrow px-4 md:px-8 max-w-3xl">
          <Card className="p-6 md:p-10 glass-card">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-hero-bg flex items-center justify-center shrink-0">
                <MessageCircleQuestion className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">سيب سؤالك</h2>
                <p className="text-sm text-muted-foreground">
                  مش لاقي إجابة؟ ابعتلنا سؤالك وفريقنا الطبي هيرد عليك في أقرب وقت.
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">الاسم</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك الكامل"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="question">سؤالك</Label>
                <Textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="اكتب سؤالك بالتفصيل..."
                  rows={5}
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                className="gradient-hero-bg text-primary-foreground border-0 gap-2 w-full sm:w-auto"
              >
                <Send className="w-4 h-4" />
                {submitting ? "جاري الإرسال..." : "إرسال السؤال"}
              </Button>
            </form>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}

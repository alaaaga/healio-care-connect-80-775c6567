import { motion } from "framer-motion";
import { Heart, Shield, Users, Award, Stethoscope, Sparkles, Target, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const values = [
  { icon: Heart, title: "رعاية إنسانية", desc: "نتعامل مع كل مريض كأنه من عائلتنا، باهتمام وتعاطف حقيقي." },
  { icon: Shield, title: "أمان وثقة", desc: "أطباء معتمدون وبيانات محمية بأعلى معايير الأمان." },
  { icon: Award, title: "جودة عالية", desc: "خدمات طبية بمعايير عالمية وأحدث التقنيات المتاحة." },
  { icon: Sparkles, title: "ابتكار مستمر", desc: "نطور خدماتنا باستمرار لنوفر تجربة طبية أفضل." },
];

const stats = [
  { value: "+٥٠,٠٠٠", label: "مريض سعيد" },
  { value: "+٢٠٠", label: "طبيب متخصص" },
  { value: "+١٥", label: "سنة خبرة" },
  { value: "٢٤/٧", label: "دعم متواصل" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container-narrow px-4 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            <Stethoscope className="w-4 h-4" /> من نحن
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl md:text-6xl font-bold mb-6"
          >
            رحلتنا في صناعة <span className="gradient-text">رعاية صحية أفضل</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            ميديكير منصة طبية مصرية متكاملة، نجمع بين خبرة نخبة من الأطباء وسهولة التكنولوجيا الحديثة لنوصلك أفضل رعاية ممكنة في أي وقت ومن أي مكان.
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12">
        <div className="container-narrow px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 text-center glass-card">
                  <div className="text-3xl md:text-4xl font-display font-bold gradient-text mb-2">{s.value}</div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16">
        <div className="container-narrow px-4 md:px-8 grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Card className="p-8 h-full">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">رسالتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                توفير رعاية صحية متميزة وسهلة الوصول لكل مصري، عن طريق دمج التكنولوجيا مع الخبرة الطبية لخلق تجربة علاج بسيطة وآمنة وفعّالة.
              </p>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Card className="p-8 h-full">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">رؤيتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                أن نكون المنصة الطبية الأولى في الشرق الأوسط، ومرجع موثوق لكل من يبحث عن رعاية صحية ذكية تواكب العصر.
              </p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-muted/30">
        <div className="container-narrow px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">قيمنا</h2>
            <p className="text-muted-foreground">المبادئ اللي بنشتغل بيها كل يوم</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl gradient-hero-bg flex items-center justify-center mb-4">
                    <v.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="font-display font-semibold text-lg mb-2">{v.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container-narrow px-4 md:px-8">
          <Card className="p-10 text-center glass-card">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">انضم لعائلة ميديكير</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              ابدأ رحلتك الصحية معانا واحجز أول موعد مع نخبة من أفضل الأطباء.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/booking"><Button size="lg" className="gradient-hero-bg text-primary-foreground border-0">احجز موعد</Button></Link>
              <Link to="/faq"><Button size="lg" variant="outline">عندك سؤال؟</Button></Link>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}

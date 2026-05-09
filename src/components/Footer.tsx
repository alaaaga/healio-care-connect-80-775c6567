import { Heart, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container-narrow section-padding pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-hero-bg flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">
                ميدي<span className="text-primary">كير</span>
              </span>
            </Link>
            <p className="text-background/60 text-sm leading-relaxed">
              شريكك الموثوق في الرعاية الصحية. نقدم خدمات طبية حديثة بأعلى مستوى من الاحترافية والتكنولوجيا المتقدمة في مصر.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-background/60">
              {[
                { label: "الرئيسية", path: "/" },
                { label: "الأطباء", path: "/doctors" },
                { label: "حجز موعد", path: "/booking" },
                { label: "المقالات", path: "/articles" },
                { label: "من نحن", path: "/about" },
                { label: "الأسئلة الشائعة", path: "/faq" },
                { label: "تواصل معنا", path: "/contact" },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="hover:text-primary transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">تواصل معنا</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> 01012345678</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> info@medicare-eg.com</li>
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-primary mt-0.5" /> ١٢٣ شارع التحرير، الدقي، الجيزة، مصر</li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-display font-semibold mb-4">النشرة البريدية</h4>
            <p className="text-sm text-background/60 mb-4">اشترك في نشرتنا البريدية لتصلك آخر النصائح الطبية والعروض.</p>
            <div className="flex gap-2">
              <Input placeholder="البريد الإلكتروني" className="bg-background/10 border-background/20 text-background placeholder:text-background/40" />
              <Button size="sm" className="gradient-hero-bg text-primary-foreground border-0 shrink-0">
                اشترك
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 pt-8 text-center text-sm text-background/40">
          © ٢٠٢٦ ميديكير. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}

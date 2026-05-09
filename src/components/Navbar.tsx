import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Heart, Phone, LayoutDashboard, Moon, Sun, Shield, Stethoscope, User, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { name: "الرئيسية", path: "/" },
  { name: "الأطباء", path: "/doctors" },
  { name: "حجز موعد", path: "/booking" },
  { name: "المقالات", path: "/articles" },
  { name: "من نحن", path: "/about" },
  { name: "الأسئلة الشائعة", path: "/faq" },
  { name: "تواصل معنا", path: "/contact" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, isDoctor, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-50">
      <div className="container-narrow flex items-center justify-between h-16 md:h-20 px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-hero-bg flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl text-foreground">
            ميدي<span className="text-primary">كير</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === link.path
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          <Link to="/contact" className="hidden lg:block">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              الطوارئ
            </Button>
          </Link>

          {user ? (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  حسابي
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>مرحباً بك</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="w-full cursor-pointer flex items-center gap-2 text-medical-coral">
                      <Shield className="w-4 h-4" />
                      لوحة الأدمن
                    </Link>
                  </DropdownMenuItem>
                )}
                {isDoctor && (
                  <DropdownMenuItem asChild>
                    <Link to="/doctor-dashboard" className="w-full cursor-pointer flex items-center gap-2 text-primary">
                      <Stethoscope className="w-4 h-4" />
                      لوحة الطبيب
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="w-full cursor-pointer flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    لوحة التحكم
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  تسجيل خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="outline">تسجيل الدخول</Button>
            </Link>
          )}

          <Link to="/booking">
            <Button size="sm" className="gradient-hero-bg text-primary-foreground border-0 shadow-lg shadow-primary/25">احجز الآن</Button>
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <div className="p-4 space-y-2">
              {navLinks.map((link, i) => (
                <motion.div key={link.path} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === link.path
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}

              <div className="pt-4 mt-2 border-t border-border/50 flex flex-col gap-2">
                {user ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setMobileOpen(false)}>
                          <Button variant="outline" className="w-full gap-2 border-medical-coral text-medical-coral bg-medical-coral/5">
                            <Shield className="w-4 h-4" />
                            الأدمن
                          </Button>
                        </Link>
                      )}
                      {isDoctor && (
                        <Link to="/doctor-dashboard" onClick={() => setMobileOpen(false)}>
                          <Button variant="outline" className="w-full gap-2 border-primary text-primary bg-primary/5">
                            <Stethoscope className="w-4 h-4" />
                            لوحة الطبيب
                          </Button>
                        </Link>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Link to="/dashboard" className="flex-1" onClick={() => setMobileOpen(false)}>
                        <Button variant="outline" className="w-full gap-2">
                          <LayoutDashboard className="w-4 h-4" />
                          التحكم
                        </Button>
                      </Link>
                      <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => { signOut(); setMobileOpen(false); }}>
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <Link to="/booking" className="w-full mt-2" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full gradient-hero-bg text-primary-foreground border-0 shadow-lg shadow-primary/25">احجز الآن</Button>
                    </Link>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Link to="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full">دخول</Button>
                    </Link>
                    <Link to="/booking" className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full gradient-hero-bg text-primary-foreground border-0 shadow-lg shadow-primary/25">احجز الآن</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

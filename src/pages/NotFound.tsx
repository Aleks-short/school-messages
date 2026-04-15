import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "motion/react";
import { Home, Search, BookOpen, GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden p-6">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[15%] text-primary/10"
        >
          <BookOpen size={120} />
        </motion.div>
        <motion.div
          animate={{
            y: [0, 25, 0],
            rotate: [0, -8, 0],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[15%] right-[10%] text-primary/10"
        >
          <GraduationCap size={160} />
        </motion.div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative inline-block mb-8">
            <motion.h1 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20 
              }}
              className="text-[12rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-primary to-primary/40 select-none"
            >
              404
            </motion.h1>
            <motion.div 
              animate={{ 
                rotate: [0, 10, -10, 0],
                x: [0, 5, -5, 0]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-4 -right-4 bg-primary text-primary-foreground p-3 rounded-2xl shadow-xl rotate-12"
            >
              <Search size={32} />
            </motion.div>
          </div>

          <h2 className="text-4xl font-bold tracking-tight mb-4 text-foreground">
            Упс! Страницата е изчезнала...
          </h2>
          
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
            Изглежда, че този учебен час е приключил или страницата, която търсите, 
            е влязла в "голямо междучасие". Не се притеснявайте, ще ви помогнем 
            да се върнете в правилната класна стая.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full group">
              <Link to="/">
                <Home className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-1" />
                Начална страница
              </Link>
            </Button>
            
            <Button variant="outline" size="lg" onClick={() => window.history.back()} className="h-14 px-8 text-lg rounded-full group">
              <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
              Назад
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-16 text-muted-foreground/60 text-sm font-medium uppercase tracking-widest"
        >
          School Connect Hub &bull; 2026
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;


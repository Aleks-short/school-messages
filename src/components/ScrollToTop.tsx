import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Show button when page is scrolled down
  const toggleVisibility = () => {
    if (window.pageYOffset > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  // Set the scroll back to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-[100] transition-all duration-500 transform",
      isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-10 opacity-0 scale-50 pointer-events-none"
    )}>
      <Button
        onClick={scrollToTop}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-110 active:scale-95 transition-all duration-300"
        title="Връщане най-отгоре"
      >
        <ArrowUp className="h-6 w-6 stroke-[3]" />
      </Button>
    </div>
  );
};

export default ScrollToTop;

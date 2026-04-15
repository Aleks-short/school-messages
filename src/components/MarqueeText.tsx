import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const PIXELS_PER_SECOND = 25;

interface MarqueeTextProps {
  text: React.ReactNode;
  className?: string;
  speed?: number;
  delay?: string;
}

const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className,
  speed = PIXELS_PER_SECOND,
  delay = '1s'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTooLong, setIsTooLong] = useState(false);
  const [offset, setOffset] = useState('0px');
  const [duration, setDuration] = useState('0s');

  useEffect(() => {
    const checkSize = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (container && textEl) {
        const tooLong = textEl.scrollWidth > container.clientWidth;
        setIsTooLong(tooLong);
        if (tooLong) {
          const off = textEl.scrollWidth - container.clientWidth;
          setOffset(`-${off}px`);
          // Adjust duration relative to the length of overflow
          const slideDuration = off / speed;
          setDuration(`${slideDuration / 0.6}s`);
        }
      }
    };

    checkSize();
    // Use a small timeout to ensure layout has settled
    const timeoutId = setTimeout(checkSize, 100);

    window.addEventListener('resize', checkSize);
    return () => {
      window.removeEventListener('resize', checkSize);
      clearTimeout(timeoutId);
    };
  }, [text, speed]);

  return (
    <div className="overflow-hidden w-full pointer-events-none" ref={containerRef}>
      <p
        ref={textRef}
        className={cn("whitespace-nowrap w-fit", isTooLong ? "animate-marquee" : "truncate", className)}
        style={isTooLong ? {
          animationDuration: duration,
          animationDelay: delay,
          '--marquee-offset': offset
        } as React.CSSProperties : {}}
      >
        {text}
      </p>
    </div>
  );
};

export default MarqueeText;

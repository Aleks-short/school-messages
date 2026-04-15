import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, autoResize, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const adjustHeight = React.useCallback(() => {
      const textarea = innerRef.current;
      if (textarea && autoResize) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [autoResize]);

    React.useEffect(() => {
      if (autoResize) {
        adjustHeight();
      }
    }, [props.value, autoResize, adjustHeight]);

    // Handle window resize to adjust textarea height
    React.useEffect(() => {
      if (autoResize) {
        window.addEventListener("resize", adjustHeight);
        return () => window.removeEventListener("resize", adjustHeight);
      }
    }, [autoResize, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        adjustHeight();
      }
      onChange?.(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={innerRef}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

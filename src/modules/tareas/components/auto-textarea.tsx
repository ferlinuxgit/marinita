"use client";

import { useLayoutEffect, useRef } from "react";

type AutoTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  value: string;
  singleLine?: boolean;
};

/** Textarea that grows with its content so long names and notes are always readable in full. */
export function AutoTextarea({ value, singleLine, onKeyDown, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;

    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      {...props}
      onKeyDown={(event) => {
        if (singleLine && event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
      ref={ref}
      rows={1}
      value={value}
    />
  );
}

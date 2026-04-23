"use client";

import React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  variant: {
    default: "bg-black text-white hover:bg-gray-800",
    secondary:
      "bg-white text-black border border-gray-300 hover:bg-gray-50",
    destructive:
      "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent text-black hover:bg-gray-100",
    link: "bg-transparent text-black underline-offset-4 hover:underline p-0 h-auto",
  },
  size: {
    sm: "h-9 px-3 text-sm rounded-md",
    default: "h-11 px-4 text-sm rounded-lg",
    lg: "h-12 px-6 text-base rounded-lg",
  },
} as const;

type ButtonVariant = keyof typeof buttonVariants.variant;
type ButtonSize = keyof typeof buttonVariants.size;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  as?: React.ElementType;
}

const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-2 h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      disabled,
      children,
      as: Component = "button",
      ...props
    },
    ref
  ) => {
    return (
      <Component
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </Component>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

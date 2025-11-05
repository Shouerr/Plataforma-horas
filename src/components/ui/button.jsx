import React from "react";
import clsx from "clsx";

export function Button({ asChild=false, variant="default", size="default", className, ...props }) {
  const classes = clsx(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
    {
      default: "bg-blue-600 text-white hover:bg-blue-600/90",
      destructive: "bg-red-600 text-white hover:bg-red-600/90",
      outline: "border border-gray-300 bg-transparent hover:bg-gray-100",
      secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
      ghost: "bg-transparent hover:bg-gray-100",
      link: "text-blue-600 underline-offset-4 hover:underline",
    }[variant],
    { default:"h-10 px-4", sm:"h-9 px-3", lg:"h-11 px-8", icon:"h-10 w-10 p-0" }[size],
    className
  );
  const Comp = asChild ? "span" : "button";
  return <Comp className={classes} {...props} />;
}
export default Button;
export const buttonVariants = () => null; // compat

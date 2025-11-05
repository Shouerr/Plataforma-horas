import React from "react";

export function Avatar({ className="", children }) {
  return <div className={"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200 "+className}>{children}</div>;
}
export function AvatarImage({ src, alt="", className="" }) {
  return src ? <img src={src} alt={alt} className={"h-full w-full object-cover "+className} /> : null;
}
export function AvatarFallback({ className="", children }) {
  return <div className={"flex h-full w-full items-center justify-center "+className}>{children}</div>;
}
export default Avatar;

import React, { useContext, useEffect, useRef, useState } from "react";
const Ctx = React.createContext(null);

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <Ctx.Provider value={{ open, setOpen }}><div ref={ref} className="relative inline-block">{children}</div></Ctx.Provider>;
}
export function DropdownMenuTrigger({ asChild, children, ...props }) {
  const { open, setOpen } = useContext(Ctx);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ...props, onClick:(e)=>{children.props.onClick?.(e); setOpen(!open);} });
  }
  return <button {...props} onClick={()=>setOpen(!open)}>{children}</button>;
}
export function DropdownMenuContent({ className="", align="end", children }) {
  const { open } = useContext(Ctx);
  if (!open) return null;
  return <div className={"absolute z-50 mt-2 min-w-[8rem] rounded-md border bg-white text-gray-900 shadow-md "+className} style={{ right: align==="end" ? 0 : "auto" }}>{children}</div>;
}
export const DropdownMenuItem = ({ className="", children, ...props }) =>
  <button className={"block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 "+className} {...props}>{children}</button>;
export const DropdownMenuSeparator = () => <div className="my-1 h-px bg-gray-200" />;

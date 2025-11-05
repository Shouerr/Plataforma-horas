import React from "react";

/** Stub Calendar con <input type="date"> (compatible React 19) */
export default function Calendar({ selected, onSelect, className }) {
  const [value, setValue] = React.useState(selected ? toInputDate(selected) : "");
  function toInputDate(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0,10);
  }
  return (
    <input
      type="date"
      className={className}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        onSelect?.(v ? new Date(v + "T00:00:00") : undefined);
      }}
    />
  );
}

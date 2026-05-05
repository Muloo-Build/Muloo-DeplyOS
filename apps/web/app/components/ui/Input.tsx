import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

const baseField =
  "w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4";

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export function Input({ className = "", ...rest }: InputProps) {
  return <input {...rest} className={`${baseField} ${className}`} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };
export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select {...rest} className={`${baseField} ${className}`}>
      {children}
    </select>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className = "", ...rest }: TextareaProps) {
  return <textarea {...rest} className={`${baseField} ${className}`} />;
}

interface LabelProps {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FieldLabel({ children, htmlFor, className = "" }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-[11px] tracking-[0.08em] uppercase text-text-3 font-semibold mb-1.5 block ${className}`}
    >
      {children}
    </label>
  );
}

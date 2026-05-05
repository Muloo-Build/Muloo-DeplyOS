import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TblProps {
  children: ReactNode;
  className?: string;
}

export function Tbl({ children, className = "" }: TblProps) {
  return (
    <div className={`bg-ink-1 border border-ink-4 rounded-[14px] overflow-hidden ${className}`}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

interface TrProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Tr({ children, onClick, className = "" }: TrProps) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-ink-4 last:border-b-0 transition-colors ${
        onClick ? "cursor-pointer hover:bg-ink-2" : ""
      } ${className}`}
    >
      {children}
    </tr>
  );
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement>;

export function Th({ className = "", children, ...rest }: ThProps) {
  return (
    <th
      {...rest}
      className={`text-left text-[10.5px] tracking-[0.12em] uppercase text-text-3 font-semibold px-[18px] py-2.5 border-b border-ink-4 bg-ink-1 sticky top-0 ${className}`}
    >
      {children}
    </th>
  );
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> & { muted?: boolean };

export function Td({ className = "", muted = false, children, ...rest }: TdProps) {
  return (
    <td
      {...rest}
      className={`px-[18px] py-3.5 text-[13px] align-middle ${
        muted ? "text-text-3" : "text-text-1"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function CellPrimary({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="font-medium">{children}</div>
      {sub && <div className="text-[11.5px] text-text-3 mt-0.5">{sub}</div>}
    </div>
  );
}

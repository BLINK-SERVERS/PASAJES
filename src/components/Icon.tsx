import type { SVGProps } from "react";

export type IconName =
  | "tarjeta"
  | "check"
  | "alerta"
  | "actualizar"
  | "conectar"
  | "onda";

const trazos: Record<IconName, React.ReactNode> = {
  tarjeta: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </>
  ),
  check: <path d="M20 6.5 9.5 17 4 11.5" />,
  alerta: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2v.1" />
    </>
  ),
  actualizar: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4v5h-5" />
    </>
  ),
  conectar: (
    <>
      <path d="M9 2.5v5" />
      <path d="M15 2.5v5" />
      <path d="M6 7.5h12v4a6 6 0 0 1-12 0v-4Z" />
      <path d="M12 17.5v4" />
    </>
  ),
  onda: (
    <>
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0" />
      <path d="M7 12a5 5 0 0 1 10 0" />
      <path d="M10.5 12a1.5 1.5 0 0 1 3 0" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
  ...rest
}: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      aria-hidden="true"
      {...rest}
    >
      {trazos[name]}
    </svg>
  );
}

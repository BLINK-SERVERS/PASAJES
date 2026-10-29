import { useState } from "react";
import { Admin } from "./pages/Admin";
import { Fiscal } from "./pages/Fiscal";
import { Lector } from "./pages/Lector";
import { Pasajero } from "./pages/Pasajero";

type Modulo = "pasajero" | "lector" | "fiscal" | "admin";

const MODULOS: { id: Modulo; etiqueta: string }[] = [
  { id: "pasajero", etiqueta: "Pasajero" },
  { id: "lector", etiqueta: "Lector" },
  { id: "fiscal", etiqueta: "Fiscal" },
  { id: "admin", etiqueta: "Admin" },
];

export function App() {
  const [modulo, setModulo] = useState<Modulo>("lector");

  return (
    <div className="app">
      <header className="topbar">
        <div className="marca">
          <span className="marca__blink">BLINK</span>
          <span className="marca__producto">PASAJES</span>
        </div>

        <nav className="tabs" role="tablist" aria-label="Módulos">
          {MODULOS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={modulo === item.id}
              onClick={() => setModulo(item.id)}
            >
              {item.etiqueta}
            </button>
          ))}
        </nav>

        <span className="topbar__version mono dim">v{__APP_VERSION__}</span>
      </header>

      <main className="page" role="tabpanel">
        {modulo === "pasajero" && <Pasajero />}
        {modulo === "lector" && <Lector />}
        {modulo === "fiscal" && <Fiscal />}
        {modulo === "admin" && <Admin />}
      </main>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import React from "react";

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function Header({ isDarkMode, toggleTheme }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border px-8 py-4">
      <div className="flex max-w-7xl mx-auto items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">HawkEye</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
        >
          {isDarkMode ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
        </Button>
      </div>
    </header>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Landmark,
  Trophy,
  TrendingUp,
  Bitcoin,
  Cpu,
  Atom,
  CloudSun,
  Clapperboard,
  Music
} from "lucide-react";

const categories = [
  { id: "all", label: "Todos", icon: LayoutGrid },
  { id: "politica", label: "Política", icon: Landmark },
  { id: "deportes", label: "Deportes", icon: Trophy },
  { id: "finanzas", label: "Finanzas", icon: TrendingUp },
  { id: "cripto", label: "Cripto", icon: Bitcoin },
  { id: "tecnologia", label: "Tecnología", icon: Cpu },
  { id: "ciencia", label: "Ciencia", icon: Atom },
  { id: "clima", label: "Clima", icon: CloudSun },
  { id: "entretenimiento", label: "Entretenimiento", icon: Clapperboard },
  { id: "musica", label: "Música", icon: Music },
];

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    // LA MAGIA ESTÁ ACÁ: flex-nowrap en móviles para que no se apilen, y flex-wrap en PC
    <div className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selectedCategory === cat.id;
        return (
          <Button
            key={cat.id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              "whitespace-nowrap shrink-0 h-9 transition-all", // shrink-0 evita que los botones se aplasten
              !isSelected && "border-border/50 hover:bg-muted/50"
            )}
          >
            <Icon className="w-4 h-4 mr-2" />
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
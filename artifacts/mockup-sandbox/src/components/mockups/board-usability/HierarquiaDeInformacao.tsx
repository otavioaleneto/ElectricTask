import "./_group.css";
import React from "react";
import { 
  COLUMNS, 
  PROJECT, 
  PRIORITY_LABEL, 
  MEMBERS, 
  initials, 
  formatDueShort, 
  isOverdue, 
  TODAY 
} from "./_data";
import {
  LayoutDashboard,
  Network,
  StickyNote,
  Share2,
  Settings,
  ChevronLeft,
  Plus,
  MoreHorizontal,
  Clock,
  CheckSquare,
  AlignLeft,
  SlidersHorizontal,
  Search
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function HierarquiaDeInformacao() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar shrink-0 flex-col h-screen">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-primary mb-8">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
              F
            </div>
            FlowDeck
          </div>

          <nav className="flex flex-col gap-1">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <LayoutDashboard size={18} />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Network size={18} />
              Mapas Mentais
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <StickyNote size={18} />
              Notas
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Share2 size={18} />
              Grafo
            </Button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary">ML</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-sm font-medium truncate w-full text-left">Marina Lopes</span>
              <span className="text-xs text-muted-foreground truncate w-full text-left">marina@exemplo.com</span>
            </div>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex flex-col border-b border-border bg-background pt-6 px-8 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="shrink-0 -ml-2 text-muted-foreground">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
                style={{ backgroundColor: PROJECT.accentColor }}
              >
                C
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{PROJECT.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {PROJECT.platform} · {PROJECT.completedCount}/{PROJECT.taskCount} concluídas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Settings className="h-5 w-5" />
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Nova Coluna
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-auto">
            <Tabs defaultValue="kanban" className="w-auto">
              <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto space-x-6">
                <TabsTrigger 
                  value="kanban" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 pt-0 font-medium"
                >
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="roadmap" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-muted-foreground hover:text-foreground data-[state=active]:shadow-none">Roadmap</TabsTrigger>
                <TabsTrigger value="tabela" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-muted-foreground hover:text-foreground data-[state=active]:shadow-none">Tabela</TabsTrigger>
                <TabsTrigger value="calendario" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-muted-foreground hover:text-foreground data-[state=active]:shadow-none">Calendário</TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 text-muted-foreground hover:text-foreground data-[state=active]:shadow-none">Linha do tempo</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="h-8 w-48 pl-8 text-sm bg-background border-border shadow-sm" />
            </div>
            <Select>
              <SelectTrigger className="h-8 w-[140px] text-sm bg-background border-border shadow-sm">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
            </Select>
            <Select>
              <SelectTrigger className="h-8 w-[120px] text-sm bg-background border-border shadow-sm">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
            </Select>
            <Select>
              <SelectTrigger className="h-8 w-[120px] text-sm bg-background border-border shadow-sm">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
            </Select>
            <Select>
              <SelectTrigger className="h-8 w-[120px] text-sm bg-background border-border shadow-sm">
                <SelectValue placeholder="Prazo" />
              </SelectTrigger>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-sm shadow-sm bg-background">
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
            Ordenar
          </Button>
        </div>

        <div className="px-8 py-2 bg-muted/10 text-xs text-muted-foreground shrink-0 border-b border-border text-center">
          Otimizado para: Hierarquia de Informação. Compromisso: Ligeira redução na densidade de informação e controles ocultos (aparecem ao passar o mouse) para focar na legibilidade.
        </div>

        {/* Board */}
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-8 bg-muted/10">
          <div className="flex gap-6 h-full items-start" style={{ minWidth: "max-content" }}>
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col w-[340px] max-h-full shrink-0">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 px-1 group">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: col.color }}
                    />
                    <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">{col.name}</h2>
                    <span className="text-xs text-muted-foreground ml-1 font-medium">{col.tasks.length}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {/* Tasks List */}
                <div className="flex flex-col gap-3 overflow-y-auto pb-2 pr-1 custom-scrollbar">
                  {col.tasks.map((task) => {
                    const overdue = isOverdue(task.dueDate);
                    const dueFormatted = formatDueShort(task.dueDate);
                    
                    return (
                      <div 
                        key={task.id} 
                        className="group bg-card rounded-lg border border-border shadow-sm p-4 transition-all hover:shadow-md hover:border-muted-foreground/30 flex flex-col gap-3 relative cursor-pointer"
                      >
                        {/* Hover Action */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6 bg-card/80 backdrop-blur-sm hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>

                        {/* Top Meta (Urgency) */}
                        <div className="flex items-center justify-between">
                          {task.priority === 'high' ? (
                            <div className="text-[10px] font-bold text-destructive flex items-center gap-1 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                              Urgente
                            </div>
                          ) : task.priority === 'medium' ? (
                            <div className="text-[10px] font-medium text-amber-600 flex items-center gap-1 uppercase tracking-wider">
                              Média
                            </div>
                          ) : (
                            <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                              Baixa
                            </div>
                          )}

                          {dueFormatted && (
                            <div className={`text-xs font-medium flex items-center gap-1.5 ${overdue && !task.completed ? 'text-destructive' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              {dueFormatted}
                            </div>
                          )}
                        </div>

                        {/* Title - The clear focal point */}
                        <h3 className={`text-base font-semibold leading-snug ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {task.title}
                        </h3>

                        {/* Labels - Subordinated */}
                        {task.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {task.labels.map(l => (
                              <Badge 
                                key={l.id} 
                                variant="outline" 
                                className="text-[10px] font-medium px-1.5 py-0 rounded-sm border-transparent bg-muted text-muted-foreground"
                              >
                                {l.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Bottom Meta - Quiet tertiary row */}
                        <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            {(task.checklistTotal > 0) && (
                              <div className="flex items-center gap-1 text-[11px] font-medium" title="Checklist">
                                <CheckSquare className="h-3.5 w-3.5" />
                                {task.checklistDone}/{task.checklistTotal}
                              </div>
                            )}
                            {task.hasDescription && (
                              <div title="Descrição">
                                <AlignLeft className="h-3.5 w-3.5" />
                              </div>
                            )}
                            {task.hasMindmap && (
                              <div title="Mapa Mental">
                                <Network className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                          
                          {task.assignee && (
                            <Avatar className="h-6 w-6 border border-background ring-1 ring-border/50">
                              <AvatarImage src={task.assignee.avatarUrl || undefined} />
                              <AvatarFallback className="bg-muted text-[10px] text-muted-foreground font-medium">
                                {initials(task.assignee.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Add Task Button */}
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground mt-2 border border-dashed border-transparent hover:border-border hover:bg-card">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar tarefa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      
      {/* Global CSS injected for custom scrollbar to keep it clean */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
        }
      `}</style>
    </div>
  );
}

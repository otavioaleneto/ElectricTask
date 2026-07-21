import "./_group.css";
import { 
  COLUMNS, 
  PROJECT, 
  PRIORITY_LABEL, 
  MEMBERS, 
  formatDueShort, 
  isOverdue, 
} from "./_data";
import { 
  LayoutDashboard, 
  Network, 
  StickyNote, 
  Share2, 
  ChevronLeft, 
  Settings, 
  Plus, 
  MoreHorizontal, 
  SlidersHorizontal,
  Clock,
  CheckSquare,
  AlignLeft,
  GripVertical,
  Check,
  ArrowRight,
  Eye,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function InteracaoEAffordances() {
  // Helper to safely format initials
  const getInitials = (name: string) => {
    return name.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar shrink-0 flex-col h-full z-10 shadow-sm relative">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-primary mb-8 cursor-pointer hover:opacity-80 transition-opacity p-2 -ml-2 rounded-md hover:bg-primary/5">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              F
            </div>
            <span>FlowDeck</span>
          </div>

          <nav className="flex flex-col gap-2">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-sm transition-all border border-transparent hover:border-border">
              <LayoutDashboard size={18} />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-sm transition-all border border-transparent hover:border-border">
              <Network size={18} />
              Mapas Mentais
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-sm transition-all border border-transparent hover:border-border">
              <StickyNote size={18} />
              Notas
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-sm transition-all border border-transparent hover:border-border">
              <Share2 size={18} />
              Grafo
            </Button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-border bg-sidebar/50">
          <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-2 hover:bg-accent hover:shadow-sm transition-all border border-transparent hover:border-border group">
            <Avatar className="h-9 w-9 border-2 border-background shadow-sm group-hover:border-primary/20 transition-colors">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">JD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-sm font-medium truncate w-full text-left">João Desenvolvedor</span>
              <span className="text-xs text-muted-foreground truncate w-full text-left">joao@flowdeck.com</span>
            </div>
            <MoreHorizontal size={16} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#f9fafb]">
        {/* Header */}
        <header className="flex flex-col border-b border-border bg-background shrink-0 z-10 shadow-sm relative">
          <div className="flex items-center justify-between gap-4 p-4 md:px-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="shrink-0 shadow-sm hover:bg-accent hover:text-accent-foreground border-border" aria-label="Voltar">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md border border-black/10 cursor-pointer hover:brightness-110 transition-all"
                style={{ backgroundColor: PROJECT.accentColor }}
                title="Editar ícone do projeto"
              >
                C
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight cursor-pointer hover:underline underline-offset-4 decoration-muted-foreground decoration-dashed transition-all">{PROJECT.name}</h1>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                  <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border/50 cursor-pointer hover:bg-accent">{PROJECT.platform}</span>
                  <span>·</span>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold cursor-pointer hover:bg-primary/20">{PROJECT.completedCount}/{PROJECT.taskCount} concluídas</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="shadow-sm gap-2 border-border font-medium hover:bg-accent transition-colors hidden sm:flex">
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
              <Button variant="default" className="shadow-md gap-2 font-medium bg-primary hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> 
                Nova Coluna
              </Button>
            </div>
          </div>

          {/* Tradeoff Caption */}
          <div className="bg-blue-50 border-y border-blue-100 px-6 py-2 flex items-center justify-center">
            <p className="text-xs text-blue-800 font-medium text-center">
              Otimizado para: Interação e Affordances. Compromisso: Alta densidade visual, com mais ruído e botões visíveis, sacrificando o minimalismo.
            </p>
          </div>

          <div className="px-4 md:px-6 py-2 bg-background flex flex-col gap-3">
            <Tabs defaultValue="kanban" className="w-full">
              <TabsList className="bg-muted/50 border border-border p-1 h-auto shadow-sm">
                <TabsTrigger value="kanban" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 py-1.5 px-4 cursor-pointer">Kanban</TabsTrigger>
                <TabsTrigger value="roadmap" className="cursor-pointer py-1.5 px-4 hover:bg-accent/50">Roadmap</TabsTrigger>
                <TabsTrigger value="tabela" className="cursor-pointer py-1.5 px-4 hover:bg-accent/50">Tabela</TabsTrigger>
                <TabsTrigger value="calendario" className="cursor-pointer py-1.5 px-4 hover:bg-accent/50">Calendário</TabsTrigger>
                <TabsTrigger value="timeline" className="cursor-pointer py-1.5 px-4 hover:bg-accent/50">Linha do tempo</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filter / Sort Bar with very explicit affordances */}
            <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-md border border-border shadow-sm">
              <div className="text-xs font-semibold text-muted-foreground mr-2 flex items-center gap-1 uppercase tracking-wider">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros:
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 w-[180px] bg-muted/30 border-border shadow-sm hover:bg-accent transition-colors font-medium">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Responsável</SelectItem>
                  {MEMBERS.map((m, i) => (
                    <SelectItem key={i} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select defaultValue="all">
                <SelectTrigger className="h-9 w-[150px] bg-muted/30 border-border shadow-sm hover:bg-accent transition-colors font-medium">
                  <SelectValue placeholder="Etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Etiquetas</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all">
                <SelectTrigger className="h-9 w-[150px] bg-muted/30 border-border shadow-sm hover:bg-accent transition-colors font-medium">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Prioridade</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all">
                <SelectTrigger className="h-9 w-[140px] bg-muted/30 border-border shadow-sm hover:bg-accent transition-colors font-medium">
                  <SelectValue placeholder="Prazo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Prazo</SelectItem>
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />
              
              <Select defaultValue="manual">
                <SelectTrigger className="h-9 w-[160px] bg-muted/30 border-border shadow-sm hover:bg-accent transition-colors font-medium">
                  <div className="flex items-center gap-2">
                    <AlignLeft className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Ordenar por" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Ordem Manual</SelectItem>
                  <SelectItem value="prazo">Por Prazo</SelectItem>
                  <SelectItem value="prioridade">Por Prioridade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Board Area */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-[#f9fafb]">
          <div className="flex gap-6 h-full items-start" style={{ minWidth: "max-content" }}>
            {COLUMNS.map((col) => (
              <div 
                key={col.id} 
                className="w-80 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200 shadow-sm max-h-full"
              >
                {/* Column Header with drag handle */}
                <div className="p-3 border-b border-slate-200 bg-slate-100 rounded-t-xl group cursor-pointer hover:bg-slate-200/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="cursor-grab hover:bg-slate-300 p-1 rounded transition-colors text-slate-400" title="Arrastar coluna">
                      <GripVertical size={16} />
                    </div>
                    <div 
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/10" 
                      style={{ backgroundColor: col.color }}
                    />
                    <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide truncate">{col.name}</h2>
                    <Badge variant="secondary" className="bg-white border-slate-200 text-slate-600 font-semibold px-1.5 shadow-sm">
                      {col.tasks.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-300 hover:text-slate-800" title="Opções da coluna">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {/* Column Tasks */}
                <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3 min-h-[150px]">
                  {col.tasks.map((task) => {
                    const isOverdueTask = isOverdue(task.dueDate);
                    const isCompleted = task.completed;
                    
                    return (
                      <div 
                        key={task.id}
                        className={`group relative bg-white border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col cursor-grab active:cursor-grabbing hover:border-primary/40 ${isCompleted ? 'opacity-70 bg-slate-50' : 'border-slate-200'}`}
                      >
                        {/* Drag Handle Area (Left edge) - always visible so the affordance is unmistakable */}
                        <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center transition-colors bg-slate-100 group-hover:bg-primary/10 border-r border-slate-200 rounded-l-lg" title="Arrastar tarefa">
                          <GripVertical size={14} className="text-slate-500 group-hover:text-primary" />
                        </div>

                        <div className="p-3 pl-7">
                          {/* Top Row: Priority & Menu */}
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] font-bold px-1.5 py-0 uppercase border shadow-sm ${
                                  task.priority === 'high' ? 'text-red-600 border-red-200 bg-red-50' :
                                  task.priority === 'medium' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                                  'text-slate-500 border-slate-200 bg-slate-50'
                                }`}
                                title={`Prioridade: ${PRIORITY_LABEL[task.priority]}`}
                              >
                                {PRIORITY_LABEL[task.priority]}
                              </Badge>
                              
                              {task.labels.map(l => (
                                <Badge 
                                  key={l.id} 
                                  variant="outline" 
                                  className="text-[10px] font-medium px-1.5 py-0 border-transparent shadow-sm"
                                  style={{ backgroundColor: `${l.color}15`, color: l.color, borderColor: `${l.color}30` }}
                                >
                                  {l.name}
                                </Badge>
                              ))}
                            </div>
                            
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 -mt-1 -mr-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-sm transition-all" title="Ações da tarefa">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Title */}
                          <h3 className={`font-semibold text-sm leading-snug mb-3 group-hover:text-primary transition-colors ${isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                            {task.title}
                          </h3>

                          {/* Indicators Row */}
                          <div className="flex flex-wrap items-center gap-3 text-xs font-medium mb-3">
                            {task.dueDate && (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border shadow-sm ${
                                isCompleted ? 'text-slate-500 bg-slate-50 border-slate-200' :
                                isOverdueTask ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-600 bg-slate-50 border-slate-200'
                              }`} title={isOverdueTask ? "Atrasado" : "Prazo"}>
                                <Clock size={12} />
                                <span>{formatDueShort(task.dueDate)}</span>
                              </div>
                            )}

                            {task.checklistTotal > 0 && (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border shadow-sm ${task.checklistDone === task.checklistTotal ? 'text-green-600 bg-green-50 border-green-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`} title="Checklist">
                                <CheckSquare size={12} />
                                <span>{task.checklistDone}/{task.checklistTotal}</span>
                              </div>
                            )}

                            {(task.hasDescription || task.hasMindmap) && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                {task.hasDescription && <span title="Possui descrição" className="inline-flex hover:text-slate-700 transition-colors"><AlignLeft size={14} /></span>}
                                {task.hasMindmap && <span title="Possui mapa mental" className="inline-flex hover:text-slate-700 transition-colors"><Network size={14} /></span>}
                              </div>
                            )}
                          </div>

                          {/* Bottom Row: Assignee and Quick Actions */}
                          <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                            {task.assignee ? (
                              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 -ml-1 rounded border border-transparent hover:border-slate-200 transition-all shadow-sm" title={`Responsável: ${task.assignee.name}`}>
                                <Avatar className="h-6 w-6 border border-slate-200 shadow-sm">
                                  {task.assignee.avatarUrl ? (
                                    <AvatarImage src={task.assignee.avatarUrl} />
                                  ) : (
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                      {getInitials(task.assignee.name)}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <span className="text-[11px] font-medium text-slate-600 hidden sm:inline-block max-w-[80px] truncate">{task.assignee.name}</span>
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm" title="Atribuir">
                                <Plus size={12} />
                              </div>
                            )}

                            {/* Explicit Quick Actions - always visible so every action is discoverable */}
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 py-0 border-slate-200 shadow-sm hover:border-primary hover:text-primary font-medium gap-1 bg-white">
                                <Eye size={12} /> Abrir
                              </Button>
                              <Button variant="outline" size="icon" className="h-6 w-6 p-0 border-slate-200 shadow-sm hover:border-green-500 hover:text-green-600 hover:bg-green-50 bg-white" title="Concluir">
                                <Check size={12} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Column Footer: Explicit Add Button */}
                <div className="p-2 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                  <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all font-medium gap-2">
                    <Plus size={16} />
                    Adicionar tarefa
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Add Column Explicit Affordance */}
            <div className="w-80 flex-shrink-0">
              <Button variant="outline" className="w-full h-12 border-dashed border-2 border-slate-300 bg-transparent text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-semibold gap-2 shadow-sm">
                <Plus size={18} />
                Nova Coluna
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

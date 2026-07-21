import "./_group.css";
import React from "react";
import {
  COLUMNS,
  PROJECT,
  PRIORITY_LABEL,
  MEMBERS,
  LABELS,
  initials,
  formatDueShort,
  isOverdue,
} from "./_data";
import {
  ChevronLeft,
  Settings,
  Plus,
  LayoutDashboard,
  Network,
  StickyNote,
  Share2,
  Clock,
  CheckSquare,
  AlignLeft,
  MoreHorizontal,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AcessibilidadeELeitura() {
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="w-5 h-5 text-red-700" aria-hidden="true" />;
      case "medium":
        return <ArrowUpCircle className="w-5 h-5 text-amber-700" aria-hidden="true" />;
      case "low":
        return <ArrowDownCircle className="w-5 h-5 text-emerald-700" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-900 border-red-200";
      case "medium":
        return "bg-amber-50 text-amber-900 border-amber-200";
      case "low":
        return "bg-emerald-50 text-emerald-900 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-900 border-slate-200";
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-slate-900 font-sans text-base">
      {/* Sidebar */}
      <aside className="w-72 border-r-2 border-slate-300 bg-slate-50 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 font-bold text-2xl text-red-600 mb-8 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 rounded-md" tabIndex={0} role="button">
            <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-sm">
              F
            </div>
            FlowDeck
          </div>

          <nav className="flex flex-col gap-3" aria-label="Navegação principal">
            <Button variant="secondary" className="w-full justify-start gap-4 min-h-[48px] text-lg bg-red-100 text-red-900 hover:bg-red-200 border border-red-200 focus-visible:ring-2 focus-visible:ring-red-600">
              <LayoutDashboard className="w-6 h-6" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-4 min-h-[48px] text-lg text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-red-600">
              <Network className="w-6 h-6" />
              Mapas Mentais
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-4 min-h-[48px] text-lg text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-red-600">
              <StickyNote className="w-6 h-6" />
              Notas
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-4 min-h-[48px] text-lg text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-red-600">
              <Share2 className="w-6 h-6" />
              Grafo
            </Button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t-2 border-slate-300 bg-white">
          <button className="flex w-full items-center gap-4 p-3 rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-red-600 outline-none border border-transparent hover:border-slate-300">
            <Avatar className="h-12 w-12 border-2 border-slate-200">
              <AvatarImage src="" />
              <AvatarFallback className="bg-red-100 text-red-700 text-lg font-bold">
                {initials("Maria Silva")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-base font-bold text-slate-900">Maria Silva</span>
              <span className="text-sm font-medium text-slate-600">maria@exemplo.com</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {/* Caption */}
        <div className="bg-slate-100 border-b-2 border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 flex justify-center">
          Otimizado para: Acessibilidade e Leitura. Compromisso: Menor densidade de informação (elementos maiores, mais rolagem, visual mais robusto).
        </div>

        <header className="px-8 pt-8 pb-6 border-b-2 border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-5">
              <Button variant="outline" className="min-h-[48px] min-w-[48px] p-0 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-red-600" aria-label="Voltar">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-sm border-2 border-red-700"
                style={{ backgroundColor: PROJECT.accentColor }}
                aria-hidden="true"
              >
                {PROJECT.name.charAt(0)}
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{PROJECT.name}</h1>
                <p className="text-base font-semibold text-slate-600">
                  {PROJECT.platform} · <span className="text-slate-900">{PROJECT.completedCount} de {PROJECT.taskCount} concluídas</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" className="min-h-[48px] px-4 border-2 border-slate-300 text-slate-800 hover:bg-slate-100 text-base font-bold focus-visible:ring-2 focus-visible:ring-red-600">
                <Settings className="w-5 h-5 mr-3" aria-hidden="true" />
                Configurações
              </Button>
              <Button className="min-h-[48px] px-6 bg-red-600 hover:bg-red-700 text-white text-base font-bold border-2 border-red-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600">
                <Plus className="w-6 h-6 mr-2" aria-hidden="true" />
                Nova Coluna
              </Button>
            </div>
          </div>
        </header>

        <div className="px-8 py-5 border-b-2 border-slate-200 shrink-0 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
          <Tabs defaultValue="kanban" className="w-auto">
            <TabsList className="h-14 bg-slate-200 p-1 rounded-lg border border-slate-300">
              <TabsTrigger value="kanban" className="min-h-[44px] px-6 text-base font-bold data-[state=active]:bg-white data-[state=active]:text-red-700 data-[state=active]:shadow-sm rounded-md focus-visible:ring-2 focus-visible:ring-red-600">Kanban</TabsTrigger>
              <TabsTrigger value="roadmap" className="min-h-[44px] px-6 text-base font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-red-600 rounded-md">Roadmap</TabsTrigger>
              <TabsTrigger value="tabela" className="min-h-[44px] px-6 text-base font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-red-600 rounded-md">Tabela</TabsTrigger>
              <TabsTrigger value="calendario" className="min-h-[44px] px-6 text-base font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-red-600 rounded-md">Calendário</TabsTrigger>
              <TabsTrigger value="timeline" className="min-h-[44px] px-6 text-base font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-red-600 rounded-md">Linha do tempo</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center flex-wrap gap-3">
            <div className="text-base font-bold text-slate-700 mr-2" aria-hidden="true">Filtros:</div>
            
            <Select defaultValue="all">
              <SelectTrigger className="min-h-[48px] w-[180px] border-2 border-slate-300 bg-white text-base font-medium focus:ring-2 focus:ring-red-600 rounded-lg">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-base min-h-[44px]">Qualquer responsável</SelectItem>
                {MEMBERS.map((m, i) => (
                  <SelectItem key={i} value={m.name} className="text-base min-h-[44px]">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="min-h-[48px] w-[170px] border-2 border-slate-300 bg-white text-base font-medium focus:ring-2 focus:ring-red-600 rounded-lg">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-base min-h-[44px]">Qualquer etiqueta</SelectItem>
                {Object.values(LABELS).map((l) => (
                  <SelectItem key={l.id} value={l.name} className="text-base min-h-[44px]">{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="min-h-[48px] w-[170px] border-2 border-slate-300 bg-white text-base font-medium focus:ring-2 focus:ring-red-600 rounded-lg">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-base min-h-[44px]">Qualquer prioridade</SelectItem>
                <SelectItem value="high" className="text-base min-h-[44px]">Alta</SelectItem>
                <SelectItem value="medium" className="text-base min-h-[44px]">Média</SelectItem>
                <SelectItem value="low" className="text-base min-h-[44px]">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="min-h-[48px] w-[170px] border-2 border-slate-300 bg-white text-base font-medium focus:ring-2 focus:ring-red-600 rounded-lg">
                <SelectValue placeholder="Prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-base min-h-[44px]">Qualquer prazo</SelectItem>
                <SelectItem value="overdue" className="text-base min-h-[44px]">Atrasadas</SelectItem>
                <SelectItem value="week" className="text-base min-h-[44px]">Esta semana</SelectItem>
                <SelectItem value="none" className="text-base min-h-[44px]">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
            
            <Select defaultValue="manual">
              <SelectTrigger className="min-h-[48px] w-[170px] border-2 border-slate-300 bg-white text-base font-medium focus:ring-2 focus:ring-red-600 rounded-lg">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual" className="text-base min-h-[44px]">Ordem Manual</SelectItem>
                <SelectItem value="dueDate" className="text-base min-h-[44px]">Por Prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-8 bg-slate-100">
          <div className="flex gap-8 h-full items-start" style={{ minWidth: "max-content" }}>
            {COLUMNS.map((col) => (
              <div
                key={col.id}
                className="w-[420px] bg-white rounded-xl border-2 border-slate-300 shadow-sm flex flex-col max-h-full"
              >
                <div className="p-5 border-b-2 border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
                  <div className="flex items-center gap-4">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-slate-900/10 shadow-inner"
                      style={{ backgroundColor: col.color }}
                      aria-hidden="true"
                    />
                    <h2 className="font-black text-xl text-slate-900">{col.name}</h2>
                    <Badge variant="secondary" className="px-3 py-1 text-base font-bold bg-slate-200 text-slate-800 rounded-full border border-slate-300">
                      {col.tasks.length} {col.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </Badge>
                  </div>
                  <Button variant="ghost" className="min-h-[44px] min-w-[44px] p-0 text-slate-700 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-red-600 rounded-lg" aria-label={`Opções da coluna ${col.name}`}>
                    <MoreHorizontal className="w-6 h-6" />
                  </Button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                  {col.tasks.map((task) => {
                    const overdue = isOverdue(task.dueDate) && !task.completed;
                    const prioClasses = getPriorityClasses(task.priority);

                    return (
                      <Card
                        key={task.id}
                        className="bg-white border-2 border-slate-300 shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer focus-within:ring-2 focus-within:ring-red-600 focus-within:ring-offset-2 overflow-hidden rounded-xl group"
                        tabIndex={0}
                        role="button"
                        aria-label={`Tarefa: ${task.title}. ${task.completed ? 'Concluída. ' : ''}Prioridade ${PRIORITY_LABEL[task.priority]}. ${task.dueDate ? `${overdue ? 'Atrasada' : 'Prazo'}: ${formatDueShort(task.dueDate)}` : 'Sem prazo'}.`}
                      >
                        <CardContent className="p-5 flex flex-col gap-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center flex-wrap gap-2">
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border-2 font-bold text-sm uppercase tracking-wide ${prioClasses}`}>
                                {getPriorityIcon(task.priority)}
                                Prioridade {PRIORITY_LABEL[task.priority]}
                              </div>
                              {task.completed && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border-2 font-bold text-sm uppercase tracking-wide bg-green-50 text-green-800 border-green-300">
                                  <CheckSquare className="w-5 h-5 text-green-700" aria-hidden="true" />
                                  Concluída
                                </div>
                              )}
                            </div>
                            
                            {task.dueDate && (
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border-2 font-bold text-sm ${overdue ? "bg-red-50 text-red-800 border-red-300" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                                {overdue ? <AlertCircle className="w-5 h-5 text-red-700" /> : <Calendar className="w-5 h-5 text-slate-600" />}
                                {overdue ? (
                                  <span>Atrasada: <span className="underline decoration-red-300 decoration-2">{formatDueShort(task.dueDate)}</span></span>
                                ) : (
                                  <span>Prazo: {formatDueShort(task.dueDate)}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <h3 className={`font-bold text-xl leading-snug transition-colors ${task.completed ? "line-through text-slate-500" : "text-slate-900 group-hover:text-red-700"}`}>
                            {task.title}
                          </h3>

                          {task.labels.length > 0 && (
                            <div className="flex flex-wrap gap-2" aria-label="Etiquetas">
                              {task.labels.map((label) => (
                                <Badge
                                  key={label.id}
                                  variant="outline"
                                  className="px-3 py-1.5 text-sm font-bold border-2"
                                  style={{
                                    backgroundColor: `${label.color}15`,
                                    color: label.color,
                                    borderColor: `${label.color}40`,
                                  }}
                                >
                                  {label.name}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="pt-2 mt-2 border-t-2 border-slate-100 flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-5 text-slate-600 font-medium text-base">
                              {task.checklistTotal > 0 && (
                                <div className="flex items-center gap-2" aria-label={`Checklist: ${task.checklistDone} de ${task.checklistTotal} itens concluídos`}>
                                  <CheckSquare className="w-5 h-5 text-slate-500" />
                                  <span>{task.checklistDone} / {task.checklistTotal} concluídos</span>
                                </div>
                              )}
                              {task.hasDescription && (
                                <div className="flex items-center gap-2" aria-label="Possui descrição">
                                  <AlignLeft className="w-5 h-5 text-slate-500" />
                                  <span>Descrição</span>
                                </div>
                              )}
                              {task.hasMindmap && (
                                <div className="flex items-center gap-2" aria-label="Possui mapa mental">
                                  <Network className="w-5 h-5 text-slate-500" />
                                  <span>Mapa Mental</span>
                                </div>
                              )}
                            </div>

                            {task.assignee && (
                              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                <Avatar className="h-9 w-9 border-2 border-slate-300">
                                  <AvatarImage src={task.assignee.avatarUrl || undefined} />
                                  <AvatarFallback className="bg-slate-200 text-slate-700 font-bold text-sm">
                                    {initials(task.assignee.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-sm text-slate-800">{task.assignee.name}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="p-4 border-t-2 border-slate-200 bg-slate-50 rounded-b-xl shrink-0">
                  <Button variant="ghost" className="w-full min-h-[56px] text-lg font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 border-2 border-transparent hover:border-slate-300 border-dashed focus-visible:ring-2 focus-visible:ring-red-600 rounded-lg">
                    <Plus className="w-6 h-6 mr-3" aria-hidden="true" />
                    Adicionar Nova Tarefa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

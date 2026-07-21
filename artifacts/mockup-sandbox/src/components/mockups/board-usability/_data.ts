// Shared mock data for the FlowDeck Kanban "usability" board variations.
// All three variants import this so they show identical content and the only
// difference the user perceives is the usability treatment, not the data.
//
// Mirrors the real shapes used in artifacts/flowdeck/src/pages/project.tsx.

export type Priority = "high" | "medium" | "low";

export interface BoardAssignee {
  name: string;
  avatarUrl?: string | null;
}

export interface BoardLabel {
  id: number;
  name: string;
  color: string;
}

export interface BoardTask {
  id: number;
  title: string;
  priority: Priority;
  completed: boolean;
  dueDate: string | null; // ISO date string
  labels: BoardLabel[];
  checklistDone: number;
  checklistTotal: number;
  hasDescription: boolean;
  hasMindmap: boolean;
  assignee: BoardAssignee | null;
}

export interface BoardColumn {
  id: number;
  name: string;
  color: string;
  tasks: BoardTask[];
}

export interface BoardProject {
  name: string;
  platform: string;
  accentColor: string;
  taskCount: number;
  completedCount: number;
}

// "Today" for this mockup is 2026-06-29 (matches the project clock).
export const TODAY = "2026-06-29";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "ALTA",
  medium: "MEDIA",
  low: "BAIXA",
};

export const LABELS: Record<string, BoardLabel> = {
  roteiro: { id: 1, name: "Roteiro", color: "#8b5cf6" },
  edicao: { id: 2, name: "Edicao", color: "#06b6d4" },
  seo: { id: 3, name: "SEO", color: "#f59e0b" },
  parceria: { id: 4, name: "Parceria", color: "#ec4899" },
  thumbnail: { id: 5, name: "Thumbnail", color: "#22c55e" },
};

export const MEMBERS: BoardAssignee[] = [
  { name: "Marina Lopes", avatarUrl: null },
  { name: "Bruno Alves", avatarUrl: null },
  { name: "Carla Dias", avatarUrl: null },
  { name: "Diego Souza", avatarUrl: null },
];

const [marina, bruno, carla, diego] = MEMBERS;

export const PROJECT: BoardProject = {
  name: "Canal no YouTube",
  platform: "YouTube",
  accentColor: "#ef4444",
  taskCount: 10,
  completedCount: 2,
};

export const COLUMNS: BoardColumn[] = [
  {
    id: 1,
    name: "Ideias",
    color: "#ef4444",
    tasks: [
      {
        id: 101,
        title: "Roteiro: 10 erros comuns em React",
        priority: "high",
        completed: false,
        dueDate: "2026-07-02",
        labels: [LABELS.roteiro],
        checklistDone: 0,
        checklistTotal: 4,
        hasDescription: true,
        hasMindmap: false,
        assignee: marina,
      },
      {
        id: 102,
        title: "Ideia de short: atalhos do VS Code",
        priority: "low",
        completed: false,
        dueDate: null,
        labels: [],
        checklistDone: 0,
        checklistTotal: 0,
        hasDescription: false,
        hasMindmap: false,
        assignee: bruno,
      },
      {
        id: 103,
        title: "Serie sobre TypeScript avancado",
        priority: "medium",
        completed: false,
        dueDate: "2026-07-12",
        labels: [LABELS.roteiro, LABELS.seo],
        checklistDone: 0,
        checklistTotal: 0,
        hasDescription: false,
        hasMindmap: true,
        assignee: carla,
      },
    ],
  },
  {
    id: 2,
    name: "Em Producao",
    color: "#f59e0b",
    tasks: [
      {
        id: 201,
        title: "Gravar tutorial de Tailwind CSS",
        priority: "high",
        completed: false,
        dueDate: "2026-06-27", // overdue
        labels: [LABELS.edicao],
        checklistDone: 2,
        checklistTotal: 5,
        hasDescription: true,
        hasMindmap: false,
        assignee: marina,
      },
      {
        id: 202,
        title: "Editar vlog: bastidores do setup",
        priority: "medium",
        completed: false,
        dueDate: "2026-07-01",
        labels: [LABELS.edicao],
        checklistDone: 1,
        checklistTotal: 3,
        hasDescription: false,
        hasMindmap: false,
        assignee: diego,
      },
      {
        id: 203,
        title: "Gravar entrevista com convidado",
        priority: "medium",
        completed: false,
        dueDate: "2026-07-05",
        labels: [LABELS.parceria],
        checklistDone: 0,
        checklistTotal: 0,
        hasDescription: true,
        hasMindmap: false,
        assignee: bruno,
      },
    ],
  },
  {
    id: 3,
    name: "Revisao",
    color: "#3b82f6",
    tasks: [
      {
        id: 301,
        title: "Revisar thumbnail do video de Next.js",
        priority: "medium",
        completed: false,
        dueDate: "2026-06-30",
        labels: [LABELS.thumbnail],
        checklistDone: 3,
        checklistTotal: 3,
        hasDescription: true,
        hasMindmap: false,
        assignee: carla,
      },
      {
        id: 302,
        title: "Conferir legendas em PT-BR",
        priority: "low",
        completed: false,
        dueDate: "2026-07-03",
        labels: [LABELS.edicao],
        checklistDone: 4,
        checklistTotal: 6,
        hasDescription: false,
        hasMindmap: false,
        assignee: diego,
      },
    ],
  },
  {
    id: 4,
    name: "Publicado",
    color: "#22c55e",
    tasks: [
      {
        id: 401,
        title: "Live: perguntas e respostas",
        priority: "low",
        completed: true,
        dueDate: null,
        labels: [],
        checklistDone: 0,
        checklistTotal: 0,
        hasDescription: false,
        hasMindmap: false,
        assignee: marina,
      },
      {
        id: 402,
        title: "Anuncio do curso de React",
        priority: "medium",
        completed: true,
        dueDate: "2026-06-20",
        labels: [LABELS.seo],
        checklistDone: 0,
        checklistTotal: 0,
        hasDescription: false,
        hasMindmap: false,
        assignee: carla,
      },
    ],
  },
];

// Convenience helpers (variants may use or ignore these).
export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDueShort(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + "T00:00:00") < new Date(TODAY + "T00:00:00");
}

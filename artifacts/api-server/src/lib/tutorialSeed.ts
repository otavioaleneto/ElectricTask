import {
  db as globalDb,
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  columnsTable,
  tasksTable,
  checklistsTable,
  checklistItemsTable,
  notesTable,
  mindmapsTable,
  insertReturning,
  insertIgnore,
  type MindmapDataShape,
} from "@workspace/db";
import { logger } from "./logger";

type DbLike = typeof globalDb;

const TUTORIAL_COLUMNS = [
  { name: "A fazer", color: "#94a3b8" },
  { name: "Fazendo", color: "#f59e0b" },
  { name: "Feito", color: "#22c55e" },
];

interface TaskSpec {
  title: string;
  description?: string;
  columnIndex: number;
  priority: "low" | "medium" | "high";
  completed?: boolean;
  dueDate?: string;
  checklists?: { title: string; items: { content: string; done: boolean }[] }[];
}

async function seedKanban(db: DbLike, projectId: number, tasks: TaskSpec[]) {
  const cols = await insertReturning(
    db,
    columnsTable,
    TUTORIAL_COLUMNS.map((c, i) => ({
      projectId,
      name: c.name,
      color: c.color,
      position: i,
    })),
  );

  const positionByCol: Record<number, number> = {};

  for (const t of tasks) {
    const col = cols[t.columnIndex];
    const position = positionByCol[col.id] ?? 0;
    positionByCol[col.id] = position + 1;

    const [task] = await insertReturning(db, tasksTable, {
      projectId,
      columnId: col.id,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority,
      completed: t.completed ?? false,
      dueDate: t.dueDate ?? null,
      position,
    });

    for (let ci = 0; ci < (t.checklists ?? []).length; ci++) {
      const group = t.checklists![ci];
      const [checklist] = await insertReturning(db, checklistsTable, {
        taskId: task.id,
        title: group.title,
        position: ci,
      });
      if (group.items.length > 0) {
        await db.insert(checklistItemsTable).values(
          group.items.map((item, idx) => ({
            checklistId: checklist.id,
            content: item.content,
            done: item.done,
            position: idx,
          })),
        );
      }
    }
  }
}

export async function seedTutorialWorkspace(userId: number): Promise<void> {
  const [ws] = await insertReturning(globalDb, workspacesTable, {
    ownerId: userId,
    name: "Tutorial",
    description: "Explore os recursos do ElectricTask com exemplos prontos",
    color: "#3b82f6",
  });

  await insertIgnore(globalDb, workspaceMembersTable, {
    workspaceId: ws.id,
    userId,
    role: "owner",
  });

  // --- Projeto Kanban de boas-vindas ---
  const [project] = await insertReturning(globalDb, projectsTable, {
    workspaceId: ws.id,
    name: "Bem-vindo ao ElectricTask",
    description:
      "Um projeto de exemplo com tarefas nas três fases do fluxo: A fazer, Fazendo e Feito.",
    platform: "generic",
    accentColor: "#3b82f6",
    position: 0,
  });

  await seedKanban(globalDb, project.id, [
    // A fazer (index 0)
    {
      title: "Criar seu primeiro projeto",
      description:
        "Clique em + Novo Projeto no topo da tela. Escolha um nome, plataforma e cor de destaque para personalizar.",
      columnIndex: 0,
      priority: "high",
      checklists: [
        {
          title: "Passos iniciais",
          items: [
            { content: "Abrir o Dashboard", done: false },
            { content: "Clicar em + Novo Projeto", done: false },
            { content: "Escolher nome e plataforma", done: false },
          ],
        },
      ],
    },
    {
      title: "Convidar um colega de equipe",
      description:
        "Acesse as configurações do workspace para adicionar membros. Você pode definir papéis: proprietário, admin ou membro.",
      columnIndex: 0,
      priority: "medium",
    },
    {
      title: "Experimentar o mapa mental",
      description:
        "Vá até Mapas Mentais neste workspace e abra o mapa de exemplo. Arraste os nós, clique duas vezes para editar o texto.",
      columnIndex: 0,
      priority: "low",
    },
    // Fazendo (index 1)
    {
      title: "Explorar o quadro Kanban",
      description:
        "Este é o quadro Kanban! Arraste esta tarefa para a coluna Feito quando terminar de explorar. Você pode criar colunas personalizadas no ícone de engrenagem.",
      columnIndex: 1,
      priority: "high",
      checklists: [
        {
          title: "O que testar",
          items: [
            { content: "Mover uma tarefa entre colunas", done: true },
            { content: "Abrir uma tarefa e ler a descrição", done: true },
            { content: "Marcar um item do checklist", done: false },
            { content: "Mudar a prioridade da tarefa", done: false },
          ],
        },
      ],
    },
    {
      title: "Ler a nota de boas-vindas",
      description:
        "Acesse Notas neste workspace. Lá você encontrará uma nota explicando como criar e organizar suas anotações.",
      columnIndex: 1,
      priority: "medium",
    },
    // Feito (index 2) — concluídas para mostrar o recurso
    {
      title: "Criar conta no ElectricTask",
      description: "Você já fez isso — bem-vindo(a)!",
      columnIndex: 2,
      priority: "high",
      completed: true,
    },
    {
      title: "Conhecer o workspace Tutorial",
      description:
        "Você está aqui! O workspace Tutorial é um espaço de exemplo editável. Sinta-se livre para apagar, editar ou reorganizar tudo.",
      columnIndex: 2,
      priority: "medium",
      completed: true,
    },
  ]);

  // --- Nota de boas-vindas ---
  await insertReturning(globalDb, notesTable, {
    workspaceId: ws.id,
    title: "Bem-vindo(a) ao ElectricTask!",
    content: `Aqui você pode criar notas de texto para guardar ideias, resumos, documentação e muito mais.

Como usar as notas:
- Clique no título para editar
- Use o corpo para escrever em texto livre
- Crie quantas notas quiser dentro de cada workspace
- As notas aparecem em ordem de atualização mais recente

Dicas rápidas:
- Cada workspace tem suas próprias notas
- Você pode usar notas para documentar o progresso dos seus projetos
- Notas podem ser protegidas com senha (ícone de cadeado)

Este workspace Tutorial tem exemplos prontos para você explorar: um projeto Kanban com tarefas e checklists, e um mapa mental. Explore à vontade — tudo pode ser editado ou apagado.`,
    isLocked: false,
  });

  // --- Mapa mental ---
  const mindmapData: MindmapDataShape = {
    nodes: [
      {
        id: "n1",
        label: "ElectricTask",
        x: 400,
        y: 80,
        color: "#3b82f6",
        details:
          "O ElectricTask centraliza projetos, tarefas, notas e mapas mentais em um só lugar.",
      },
      {
        id: "n2",
        label: "Projetos",
        x: 160,
        y: 240,
        color: "#3b82f6",
        details:
          "Organize seu trabalho em projetos. Cada projeto tem um quadro Kanban com colunas personalizáveis.",
      },
      {
        id: "n3",
        label: "Notas",
        x: 400,
        y: 260,
        color: "#f59e0b",
        details:
          "Guarde ideias, documentação e resumos em notas de texto dentro de cada workspace.",
      },
      {
        id: "n4",
        label: "Mapas Mentais",
        x: 640,
        y: 240,
        color: "#22c55e",
        details:
          "Visualize conexões entre ideias com mapas mentais. Arraste os nós e crie hierarquias.",
      },
      {
        id: "n5",
        label: "Tarefas & Checklists",
        x: 100,
        y: 400,
        color: null,
        details:
          "Cada cartão do Kanban é uma tarefa. Adicione descrição, prioridade, data e checklists.",
      },
      {
        id: "n6",
        label: "Colunas personalizáveis",
        x: 260,
        y: 400,
        color: null,
      },
      {
        id: "n7",
        label: "Workspaces",
        x: 400,
        y: 420,
        color: null,
        details:
          "Agrupe projetos em workspaces. Útil para separar clientes, times ou áreas da vida.",
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n1", target: "n3" },
      { id: "e3", source: "n1", target: "n4" },
      { id: "e4", source: "n2", target: "n5" },
      { id: "e5", source: "n2", target: "n6" },
      { id: "e6", source: "n3", target: "n7" },
    ],
  };

  await insertReturning(globalDb, mindmapsTable, {
    workspaceId: ws.id,
    name: "O que é o ElectricTask?",
    data: mindmapData,
    taskId: null,
    parentId: null,
  });

  logger.info({ userId, workspaceId: ws.id }, "Workspace Tutorial criado");
}

import {
  db,
  pool,
  usersTable,
  workspacesTable,
  projectsTable,
  columnsTable,
  tasksTable,
  checklistsTable,
  checklistItemsTable,
  mindmapsTable,
  insertReturning,
  type MindmapDataShape,
} from "@workspace/db";
import { hashPassword } from "./lib/auth";

function cover(seed: string): string {
  return `https://picsum.photos/seed/${seed}/960/540`;
}

const DEFAULT_COLUMNS = [
  { name: "Ideias", color: "#3b82f6" },
  { name: "Em Produção", color: "#f59e0b" },
  { name: "Revisão", color: "#3b82f6" },
  { name: "Publicado", color: "#22c55e" },
];

async function createBoard(
  projectId: number,
  tasks: {
    title: string;
    description?: string;
    columnIndex: number;
    priority: "low" | "medium" | "high";
    completed?: boolean;
    dueDate?: string;
    checklists?: {
      title: string;
      items: { content: string; done: boolean }[];
    }[];
  }[],
) {
  const cols = await insertReturning(
    db,
    columnsTable,
    DEFAULT_COLUMNS.map((c, i) => ({
      projectId,
      name: c.name,
      color: c.color,
      position: i,
    })),
  );

  const positions: Record<number, number> = {};
  for (const t of tasks) {
    const columnId = cols[t.columnIndex].id;
    const position = positions[columnId] ?? 0;
    positions[columnId] = position + 1;
    const [task] = await insertReturning(db, tasksTable, {
      projectId,
      columnId,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority,
      completed: t.completed ?? false,
      dueDate: t.dueDate ?? null,
      position,
    });
    if (t.checklists && t.checklists.length > 0) {
      for (let ci = 0; ci < t.checklists.length; ci++) {
        const group = t.checklists[ci];
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
  return cols;
}

async function main() {
  console.log("Limpando dados existentes...");
  await db.delete(checklistItemsTable);
  await db.delete(checklistsTable);
  await db.delete(tasksTable);
  await db.delete(columnsTable);
  await db.delete(mindmapsTable);
  await db.delete(projectsTable);
  await db.delete(workspacesTable);
  await db.delete(usersTable);

  console.log("Criando usuários...");
  const [demoUser] = await insertReturning(db, usersTable, {
    email: "teste@user.com",
    name: "Ana Criadora",
    passwordHash: hashPassword("123as123"),
    role: "user",
    theme: "dark",
  });

  await db.insert(usersTable).values({
    email: "admin@user.com",
    name: "Bruno Admin",
    passwordHash: hashPassword("123as123"),
    role: "admin",
    theme: "dark",
  });

  await db.insert(usersTable).values([
    {
      email: "carla@user.com",
      name: "Carla Mendes",
      passwordHash: hashPassword("123as123"),
      role: "user",
      theme: "light",
    },
    {
      email: "diego@user.com",
      name: "Diego Santos",
      passwordHash: hashPassword("123as123"),
      role: "user",
      theme: "dark",
    },
  ]);

  console.log("Criando workspaces...");
  const [mainWs] = await insertReturning(db, workspacesTable, {
    ownerId: demoUser.id,
    name: "Estúdio de Conteúdo",
    description: "Planejamento de todos os canais e redes",
    color: "#3b82f6",
  });

  const [clientWs] = await insertReturning(db, workspacesTable, {
    ownerId: demoUser.id,
    name: "Clientes & Agência",
    description: "Projetos de clientes e parcerias",
    color: "#8b5cf6",
  });

  console.log("Criando projetos...");
  const [ytProject] = await insertReturning(db, projectsTable, {
    workspaceId: mainWs.id,
    name: "Canal no YouTube",
    description: "Vídeos longos e cortes semanais",
    coverImageUrl: cover("youtube-studio"),
    platform: "youtube",
    accentColor: "#3b82f6",
    position: 0,
  });

  const [igProject] = await insertReturning(db, projectsTable, {
    workspaceId: mainWs.id,
    name: "Instagram",
    description: "Reels, carrosséis e stories",
    coverImageUrl: cover("instagram-feed"),
    platform: "instagram",
    accentColor: "#ec4899",
    position: 1,
  });

  const [ttProject] = await insertReturning(db, projectsTable, {
    workspaceId: mainWs.id,
    name: "TikTok",
    description: "Tendências e vídeos curtos",
    coverImageUrl: cover("tiktok-trends"),
    platform: "tiktok",
    accentColor: "#06b6d4",
    position: 2,
  });

  await db.insert(projectsTable).values({
    workspaceId: clientWs.id,
    name: "Marca XYZ - LinkedIn",
    description: "Gestão de presença corporativa",
    coverImageUrl: cover("linkedin-brand"),
    platform: "linkedin",
    accentColor: "#0a66c2",
    position: 0,
  });

  console.log("Montando quadros...");
  await createBoard(ytProject.id, [
    {
      title: "Roteiro: 10 erros de iniciantes",
      description: "Vídeo educativo de 12 minutos",
      columnIndex: 0,
      priority: "high",
      checklists: [
        {
          title: "Criar Vídeo",
          items: [
            { content: "Fazer roteiro", done: true },
            { content: "Gravar vídeo", done: false },
            { content: "Editar vídeo", done: false },
          ],
        },
        {
          title: "Divulgação",
          items: [
            { content: "Definir thumbnail", done: false },
            { content: "Escrever descrição", done: false },
          ],
        },
      ],
    },
    {
      title: "Gravar review do produto",
      columnIndex: 1,
      priority: "medium",
      dueDate: "2026-07-05",
      checklists: [
        {
          title: "Produção",
          items: [
            { content: "Preparar set", done: true },
            { content: "Gravar tomadas", done: true },
            { content: "Áudio extra", done: false },
          ],
        },
      ],
    },
    {
      title: "Editar vlog da viagem",
      columnIndex: 2,
      priority: "medium",
    },
    {
      title: "Publicar: tour pelo setup",
      columnIndex: 3,
      priority: "low",
      completed: true,
    },
    {
      title: "Publicar: Q&A com inscritos",
      columnIndex: 3,
      priority: "low",
      completed: true,
    },
  ]);

  await createBoard(igProject.id, [
    {
      title: "Carrossel: dicas de produtividade",
      columnIndex: 0,
      priority: "medium",
    },
    {
      title: "Reel: bastidores da semana",
      columnIndex: 1,
      priority: "high",
      dueDate: "2026-07-02",
      checklists: [
        {
          title: "Edição",
          items: [
            { content: "Capturar clipes", done: true },
            { content: "Escolher trilha", done: false },
          ],
        },
      ],
    },
    {
      title: "Stories: enquete com seguidores",
      columnIndex: 3,
      priority: "low",
      completed: true,
    },
  ]);

  await createBoard(ttProject.id, [
    {
      title: "Trend do momento - adaptar",
      columnIndex: 0,
      priority: "high",
    },
    {
      title: "Série: 3 partes sobre edição",
      columnIndex: 1,
      priority: "medium",
    },
    {
      title: "Publicar: receita rápida",
      columnIndex: 3,
      priority: "low",
      completed: true,
    },
  ]);

  console.log("Criando mapa mental...");
  const mindmapData: MindmapDataShape = {
    nodes: [
      {
        id: "n1",
        label: "Estratégia 2026",
        x: 420,
        y: 60,
        color: "#3b82f6",
        details:
          "Foco em crescimento orgânico multiplataforma. Meta: dobrar a base de inscritos e aumentar o engajamento em 30% até o final do ano.",
      },
      {
        id: "n2",
        label: "YouTube",
        x: 160,
        y: 220,
        color: "#3b82f6",
        details:
          "Canal principal. Publicar 1 vídeo longo por semana e priorizar tutoriais aprofundados sobre os temas mais buscados.",
      },
      { id: "n3", label: "Instagram", x: 420, y: 240, color: "#ec4899" },
      { id: "n4", label: "TikTok", x: 680, y: 220, color: "#06b6d4" },
      { id: "n5", label: "Vídeos longos", x: 120, y: 360, color: null },
      { id: "n6", label: "Reels diários", x: 420, y: 380, color: null },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n1", target: "n3" },
      { id: "e3", source: "n1", target: "n4" },
      { id: "e4", source: "n2", target: "n5" },
      { id: "e5", source: "n3", target: "n6" },
    ],
  };

  await db.insert(mindmapsTable).values({
    workspaceId: mainWs.id,
    name: "Estratégia de Conteúdo",
    data: mindmapData,
    taskId: null,
  });

  console.log("Seed concluído com sucesso.");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Erro no seed:", err);
    await pool.end();
    process.exit(1);
  });

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { TaskAttachments } from "./task-attachments";
import { TaskAttachmentsGallery } from "./task-attachments-gallery";

const TASK_ID = 1;

interface StoredAttachment {
  id: number;
  taskId: number;
  name: string;
  contentType: string;
  size: number;
  uploaderName: string | null;
  createdAt: string;
}

let store: StoredAttachment[] = [];
let nextId = 1;
let requestUrlCalls = 0;
let putCalls = 0;
let registerCalls = 0;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL) && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  store = [];
  nextId = 1;
  requestUrlCalls = 0;
  putCalls = 0;
  registerCalls = 0;

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      const method = methodOf(input, init);

      if (url.endsWith("/api/storage/uploads/request-url") && method === "POST") {
        requestUrlCalls += 1;
        return jsonResponse({
          uploadURL: "https://signed.example/upload/object-123",
          objectPath: "/objects/uploads/object-123",
          metadata: { name: "x", size: 1, contentType: "image/png" },
        });
      }

      if (url.startsWith("https://signed.example/upload/") && method === "PUT") {
        putCalls += 1;
        return new Response(null, { status: 200 });
      }

      if (url.endsWith(`/api/tasks/${TASK_ID}/attachments`) && method === "POST") {
        registerCalls += 1;
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          name: string;
          contentType: string;
          size: number;
        };
        const created: StoredAttachment = {
          id: nextId++,
          taskId: TASK_ID,
          name: payload.name,
          contentType: payload.contentType,
          size: payload.size,
          uploaderName: "Test User",
          createdAt: new Date().toISOString(),
        };
        store.push(created);
        return jsonResponse(created, 201);
      }

      if (url.endsWith(`/api/tasks/${TASK_ID}/attachments`) && method === "GET") {
        return jsonResponse(store);
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({ onSave }: { onSave: (html: string) => void }) {
  return (
    <>
      <RichTextEditor taskId={TASK_ID} initialContent="" onSave={onSave} />
      <TaskAttachments taskId={TASK_ID} />
      <TaskAttachmentsGallery taskId={TASK_ID} />
    </>
  );
}

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function makeImageFile(name = "diagram.png"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/png" });
}

describe("RichTextEditor inline image upload", () => {
  it("inserts the image inline, creates exactly one attachment, and shows it in both lists", async () => {
    const user = userEvent.setup();
    const saved: string[] = [];
    renderWithClient(<Harness onSave={(html) => saved.push(html)} />);

    // Both attachment lists start empty.
    await waitFor(() => {
      expect(screen.getAllByText("Nenhum anexo ainda.").length).toBe(2);
    });

    // The toolbar "Inserir imagem" button proxies to a hidden file input.
    const fileInput = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await user.upload(fileInput, makeImageFile());

    // Exactly one attachment is registered (no duplicate).
    await waitFor(() => {
      expect(registerCalls).toBe(1);
    });
    expect(requestUrlCalls).toBe(1);
    expect(putCalls).toBe(1);
    expect(store.length).toBe(1);

    // The image is rendered inline in the editor as a single <img>.
    await waitFor(() => {
      const imgs = document.querySelectorAll(".rte-content img");
      expect(imgs.length).toBe(1);
      expect(imgs[0].getAttribute("src")).toBe(
        `/api/attachments/${store[0].id}/file`,
      );
    });

    // The description is saved with the inline image included.
    await waitFor(() => {
      const last = saved[saved.length - 1] ?? "";
      expect((last.match(/<img/g) ?? []).length).toBe(1);
    });

    // It appears in both the inline Anexos list and the gallery tab.
    await waitFor(() => {
      const filenames = screen.getAllByText("diagram.png");
      expect(filenames.length).toBe(2);
    });

    // And the gallery shows uploader + a single image element per entry.
    const galleryEntry = screen.getByText("por Test User");
    expect(galleryEntry).toBeInTheDocument();
  });

  it("inserts exactly one image (no duplicate) when dropped onto the editor", async () => {
    const saved: string[] = [];
    renderWithClient(<Harness onSave={(html) => saved.push(html)} />);

    await waitFor(() => {
      expect(screen.getAllByText("Nenhum anexo ainda.").length).toBe(2);
    });

    const editorEl = document.querySelector(".rte-content") as HTMLElement;
    expect(editorEl).toBeTruthy();

    const file = makeImageFile("dropped.png");
    const dataTransfer = {
      files: [file],
      items: [],
      types: ["Files"],
      getData: () => "",
      setData: () => {},
    } as unknown as DataTransfer;

    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer });
    act(() => {
      editorEl.dispatchEvent(dropEvent);
    });

    await waitFor(() => {
      expect(registerCalls).toBe(1);
    });
    expect(store.length).toBe(1);

    await waitFor(() => {
      const imgs = document.querySelectorAll(".rte-content img");
      expect(imgs.length).toBe(1);
    });
  });
});

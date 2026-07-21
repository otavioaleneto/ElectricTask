import { useState } from "react";
import {
  useListWorkspaceMembers,
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
  useGetCurrentUser,
  getListWorkspaceMembersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Trash2, Loader2 } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  editor: "Editor",
  viewer: "Visualizador",
};

type Role = "owner" | "editor" | "viewer";

function errMsg(err: unknown): string {
  const data = (err as { data?: { error?: string } } | null)?.data;
  return data?.error ?? "Ocorreu um erro. Tente novamente.";
}

export function WorkspaceMembersDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const { data: members = [], isLoading } = useListWorkspaceMembers(
    workspaceId,
    {
      query: {
        enabled: open,
        queryKey: getListWorkspaceMembersQueryKey(workspaceId),
      },
    },
  );

  const addMember = useAddWorkspaceMember();
  const updateRole = useUpdateWorkspaceMemberRole();
  const removeMember = useRemoveWorkspaceMember();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getListWorkspaceMembersQueryKey(workspaceId),
    });

  const primaryOwnerId = members
    .filter((m) => m.role === "owner")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0]?.userId;

  const handleAdd = () => {
    const value = email.trim();
    if (!value) return;
    addMember.mutate(
      { workspaceId, data: { email: value, role } },
      {
        onSuccess: () => {
          setEmail("");
          setRole("editor");
          refresh();
          toast({ title: "Membro adicionado" });
        },
        onError: (err) =>
          toast({
            title: "Não foi possível adicionar",
            description: errMsg(err),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRoleChange = (userId: number, newRole: Role) => {
    updateRole.mutate(
      { workspaceId, userId, data: { role: newRole } },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Papel atualizado" });
        },
        onError: (err) =>
          toast({
            title: "Não foi possível atualizar",
            description: errMsg(err),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRemove = (userId: number) => {
    removeMember.mutate(
      { workspaceId, userId },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Membro removido" });
        },
        onError: (err) =>
          toast({
            title: "Não foi possível remover",
            description: errMsg(err),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros do Workspace</DialogTitle>
          <DialogDescription>
            Gerencie quem tem acesso e o nível de permissão de cada pessoa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Convidar por e-mail</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="email@exemplo.com"
              />
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-[150px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="owner">Dono</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={addMember.isPending || !email.trim()}
                className="shrink-0"
                aria-label="Adicionar membro"
              >
                {addMember.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "membro" : "membros"}
            </Label>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {members.map((m) => {
                  const isPrimaryOwner = m.userId === primaryOwnerId;
                  return (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={m.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">
                          {m.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {m.name}
                          {currentUser?.id === m.userId && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              (você)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.email}
                        </p>
                      </div>
                      {isPrimaryOwner ? (
                        <span className="px-2 text-xs font-medium text-muted-foreground">
                          {ROLE_LABEL[m.role]}
                        </span>
                      ) : (
                        <>
                          <Select
                            value={m.role}
                            onValueChange={(v) =>
                              handleRoleChange(m.userId, v as Role)
                            }
                          >
                            <SelectTrigger className="w-[140px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Dono</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">
                                Visualizador
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(m.userId)}
                            aria-label="Remover membro"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

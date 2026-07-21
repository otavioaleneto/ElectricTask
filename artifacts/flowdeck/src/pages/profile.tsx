import { useEffect, useRef, useState } from "react";
import {
  useGetCurrentUser,
  useUpdateProfile,
  useChangePassword,
  useUpdateSecurityQuestions,
  useSetAvatar,
  useRequestUploadUrl,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Upload, Moon, Sun, Check } from "lucide-react";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

export default function Profile() {
  const { data: user } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const updateSecurityQuestions = useUpdateSecurityQuestions();
  const setAvatar = useSetAvatar();
  const requestUploadUrl = useRequestUploadUrl();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [sqPassword, setSqPassword] = useState("");
  const [sq, setSq] = useState({
    q1: "",
    a1: "",
    q2: "",
    a2: "",
    q3: "",
    a3: "",
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const invalidateUser = () => {
    queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return;
    }
    updateProfile.mutate(
      { data: { name, email } },
      {
        onSuccess: () => {
          invalidateUser();
          toast({ title: "Perfil atualizado" });
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao atualizar",
            description: error?.message || "Verifique os dados e tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem", variant: "destructive" });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast({
        title: "Imagem muito grande",
        description: "O tamanho máximo é 5 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploadingAvatar(true);
    try {
      const contentType = file.type || "application/octet-stream";
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType },
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar a imagem");
      await setAvatar.mutateAsync({ data: { objectPath } });
      invalidateUser();
      toast({ title: "Foto atualizada" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar foto",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha deve ter pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast({ title: "Senha alterada" });
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao alterar senha",
            description: error?.message || "Verifique a senha atual.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSaveSecurityQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    updateSecurityQuestions.mutate(
      {
        data: {
          currentPassword: sqPassword,
          question1: sq.q1,
          answer1: sq.a1,
          question2: sq.q2,
          answer2: sq.a2,
          question3: sq.q3,
          answer3: sq.a3,
        },
      },
      {
        onSuccess: () => {
          invalidateUser();
          setSqPassword("");
          setSq({ q1: "", a1: "", q2: "", a2: "", q3: "", a3: "" });
          toast({ title: "Perguntas de segurança atualizadas" });
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao salvar",
            description: error?.message || "Verifique a senha atual e tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
        <p className="text-muted-foreground">
          Gerencie seus dados pessoais, senha e preferências.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="senha">Senha</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Dados pessoais</CardTitle>
              <CardDescription>Atualize seu nome, e-mail e foto de perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAvatarPick}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Trocar foto
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou GIF. Máximo 5 MB.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar alterações
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="senha">
          <Card>
            <CardHeader>
              <CardTitle>Alterar senha</CardTitle>
              <CardDescription>Confirme a senha atual para definir uma nova.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Senha atual</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar nova senha</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Alterar senha
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas de segurança</CardTitle>
              <CardDescription>
                {user.hasSecurityQuestions
                  ? "Você já configurou suas perguntas. Defina novas quando quiser."
                  : "Configure suas perguntas para poder recuperar o acesso."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSecurityQuestions} className="space-y-5">
                {([1, 2, 3] as const).map((n) => (
                  <div key={n} className="space-y-3 rounded-lg border border-border/50 p-4">
                    <div className="space-y-2">
                      <Label>Pergunta {n}</Label>
                      <Input
                        value={sq[`q${n}` as "q1" | "q2" | "q3"]}
                        onChange={(e) => setSq({ ...sq, [`q${n}`]: e.target.value })}
                        placeholder="Ex.: Qual o nome do seu primeiro animal de estimação?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Resposta {n}</Label>
                      <Input
                        value={sq[`a${n}` as "a1" | "a2" | "a3"]}
                        onChange={(e) => setSq({ ...sq, [`a${n}`]: e.target.value })}
                        placeholder="Sua resposta"
                      />
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Senha atual (para confirmar)</Label>
                  <Input
                    type="password"
                    value={sqPassword}
                    onChange={(e) => setSqPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={updateSecurityQuestions.isPending}>
                  {updateSecurityQuestions.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Salvar perguntas
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>Escolha o tema da interface.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Sun className="h-6 w-6" />
                  <span className="text-sm font-medium">Claro</span>
                  {theme === "light" && <Check className="h-4 w-4 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <Moon className="h-6 w-6" />
                  <span className="text-sm font-medium">Escuro</span>
                  {theme === "dark" && <Check className="h-4 w-4 text-primary" />}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

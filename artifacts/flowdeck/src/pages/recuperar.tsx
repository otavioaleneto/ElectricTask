import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetRecoveryQuestions,
  useResetPasswordWithQuestions,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

type Questions = { question1: string; question2: string; question3: string };

export default function Recuperar() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const getQuestions = useGetRecoveryQuestions();
  const resetPassword = useResetPasswordWithQuestions();

  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [answers, setAnswers] = useState({ a1: "", a2: "", a3: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleFetchQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    getQuestions.mutate(
      { data: { email } },
      {
        onSuccess: (data) => setQuestions(data),
        onError: (error: any) => {
          toast({
            title: "Não foi possível continuar",
            description:
              error?.message ||
              "Verifique o e-mail informado ou contate um administrador.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleReset = (e: React.FormEvent) => {
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
      toast({
        title: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }
    resetPassword.mutate(
      {
        data: {
          email,
          answer1: answers.a1,
          answer2: answers.a2,
          answer3: answers.a3,
          newPassword,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Senha redefinida",
            description: "Você já pode entrar com a nova senha.",
          });
          setLocation("/login");
        },
        onError: (error: any) => {
          toast({
            title: "Não foi possível redefinir",
            description: error?.message || "Verifique suas respostas e tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-2xl backdrop-blur-sm bg-card/95">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-2xl mb-2">
            F
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Recuperar senha</CardTitle>
          <CardDescription className="text-base">
            {questions
              ? "Responda às suas perguntas de segurança para definir uma nova senha."
              : "Informe seu e-mail para localizar suas perguntas de segurança."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!questions ? (
            <form onSubmit={handleFetchQuestions} className="space-y-6">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 h-12"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={getQuestions.isPending}>
                {getQuestions.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Continuar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label>{questions.question1}</Label>
                <Input
                  value={answers.a1}
                  onChange={(e) => setAnswers({ ...answers, a1: e.target.value })}
                  className="bg-background/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>{questions.question2}</Label>
                <Input
                  value={answers.a2}
                  onChange={(e) => setAnswers({ ...answers, a2: e.target.value })}
                  className="bg-background/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>{questions.question3}</Label>
                <Input
                  value={answers.a3}
                  onChange={(e) => setAnswers({ ...answers, a3: e.target.value })}
                  className="bg-background/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background/50 h-11 pr-11"
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
                <Label>Confirmar nova senha</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Redefinir senha
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

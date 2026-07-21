import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Informe seu nome" }),
    email: z.string().email({ message: "E-mail inválido" }),
    password: z.string().min(8, { message: "A senha deve ter pelo menos 8 caracteres" }),
    confirmPassword: z.string(),
    question1: z.string().min(3, { message: "Escreva uma pergunta" }),
    answer1: z.string().min(1, { message: "Informe a resposta" }),
    question2: z.string().min(3, { message: "Escreva uma pergunta" }),
    answer2: z.string().min(1, { message: "Informe a resposta" }),
    question3: z.string().min(3, { message: "Escreva uma pergunta" }),
    answer3: z.string().min(1, { message: "Informe a resposta" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      question1: "",
      answer1: "",
      question2: "",
      answer2: "",
      question3: "",
      answer3: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(
      {
        data: {
          name: data.name,
          email: data.email,
          password: data.password,
          question1: data.question1,
          answer1: data.answer1,
          question2: data.question2,
          answer2: data.answer2,
          question3: data.question3,
          answer3: data.answer3,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          toast({ title: "Conta criada com sucesso", description: "Bem-vindo ao ElectricTask!" });
          setLocation("/");
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao criar conta",
            description: error?.message || "Verifique os dados e tente novamente.",
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

      <Card className="w-full max-w-lg relative z-10 border-border/50 shadow-2xl backdrop-blur-sm bg-card/95 my-8">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-2xl mb-2">
            E
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Criar conta</CardTitle>
          <CardDescription className="text-base">
            Configure suas perguntas de segurança para recuperar o acesso depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} className="bg-background/50 h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} className="bg-background/50 h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar senha</FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="bg-background/50 h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 rounded-lg border border-border/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Perguntas de segurança
                </p>
                {([1, 2, 3] as const).map((n) => (
                  <div key={n} className="space-y-3">
                    <FormField
                      control={form.control}
                      name={`question${n}` as "question1" | "question2" | "question3"}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pergunta {n}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex.: Qual o nome do seu primeiro animal de estimação?"
                              {...field}
                              className="bg-background/50 h-11"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`answer${n}` as "answer1" | "answer2" | "answer3"}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Resposta {n}</FormLabel>
                          <FormControl>
                            <Input placeholder="Sua resposta" {...field} className="bg-background/50 h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Criar conta
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

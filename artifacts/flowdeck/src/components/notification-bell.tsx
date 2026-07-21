import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetUnreadNotificationCount,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useMarkSubscriptionPaid,
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  UserPlus,
  AtSign,
  Clock,
  CheckCheck,
  CreditCard,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubscriptionLogo } from "@/components/subscription-logo";
import { brandDisplay } from "@/lib/subscription-brands";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function subName(n: Notification): string {
  return n.subscription ? brandDisplay(n.subscription).name : "Assinatura";
}

function messageFor(n: Notification): string {
  const actor = n.actor?.name ?? "Alguém";
  switch (n.type) {
    case "assigned":
      return `${actor} atribuiu uma tarefa a você`;
    case "mentioned":
      return `${actor} mencionou você em um comentário`;
    case "due_soon":
      return "Uma tarefa está próxima do prazo";
    case "subscription_due":
      return `${subName(n)} vence em breve`;
    case "subscription_overdue":
      return `${subName(n)} está vencida`;
    default:
      return "Nova notificação";
  }
}

function subtitleFor(n: Notification): string {
  if (n.task) return n.task.title;
  if (n.subscription) return subName(n);
  return "";
}

function NotificationIcon({ type }: { type: Notification["type"] }) {
  if (type === "assigned")
    return <UserPlus className="h-3.5 w-3.5 text-primary" />;
  if (type === "mentioned")
    return <AtSign className="h-3.5 w-3.5 text-primary" />;
  if (type === "subscription_overdue")
    return <CreditCard className="h-3.5 w-3.5 text-destructive" />;
  if (type === "subscription_due")
    return <CreditCard className="h-3.5 w-3.5 text-amber-500" />;
  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: unread } = useGetUnreadNotificationCount({
    query: {
      queryKey: getGetUnreadNotificationCountQueryKey(),
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    },
  });
  const { data: notifications = [], isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled: open },
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const markPaid = useMarkSubscriptionPaid();
  const { toast } = useToast();

  const count = unread?.count ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetUnreadNotificationCountQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListNotificationsQueryKey(),
    });
  };

  const handleClick = (n: Notification) => {
    setOpen(false);
    const go = () => {
      if (n.task) {
        setLocation(`/projects/${n.task.projectId}?task=${n.task.id}`);
      } else {
        setLocation("/subscriptions");
      }
    };
    if (n.read) {
      go();
      return;
    }
    markRead.mutate(
      { notificationId: n.id },
      {
        onSuccess: () => {
          refresh();
          go();
        },
        onError: go,
      },
    );
  };

  const handleMarkAll = () => {
    if (count === 0) return;
    markAllRead.mutate(undefined, { onSuccess: refresh });
  };

  const canMarkPaid = (n: Notification): boolean =>
    !!n.subscription &&
    n.subscription.paymentType === "manual" &&
    (n.type === "subscription_due" || n.type === "subscription_overdue");

  const handleMarkPaid = (n: Notification) => {
    const sub = n.subscription;
    if (!sub) return;
    markPaid.mutate(
      { subscriptionId: sub.id },
      {
        onSuccess: () => {
          toast({ title: `${subName(n)} marcada como paga` });
          refresh();
          queryClient.invalidateQueries({
            predicate: (q) =>
              q.queryKey.some(
                (k) => typeof k === "string" && k.includes("subscription"),
              ),
          });
        },
        onError: () =>
          toast({
            title: "Não foi possível marcar como paga",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleMarkAll}
            disabled={count === 0 || markAllRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div key={n.id} className={n.read ? "" : "bg-primary/5"}>
                  <button
                    onClick={() => handleClick(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="relative shrink-0">
                      {n.subscription ? (
                        <SubscriptionLogo sub={n.subscription} size={32} />
                      ) : (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={n.actor?.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {n.actor ? (
                              n.actor.name.charAt(0).toUpperCase()
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                        <NotificationIcon type={n.type} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{messageFor(n)}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {subtitleFor(n)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                  {canMarkPaid(n) && (
                    <div className="pb-3 pl-[3.75rem] pr-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleMarkPaid(n)}
                        disabled={markPaid.isPending}
                      >
                        <Check className="h-3.5 w-3.5" /> Marcar como paga
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetNoteQueryKey,
  getGetTaskQueryKey,
  getListColumnsQueryKey,
  getListMentionablesQueryKey,
  getListNotesQueryKey,
  useDeleteNote,
  useGetNote,
  useGetTask,
  useListColumns,
  useListMentionables,
  useListWorkspaces,
  useUpdateNote,
  type Column,
  type ItemRef,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import {
  Button,
  ErrorView,
  Header,
  IconButton,
  LoadingView,
  useBottomInset,
} from "@/components/ui";
import { SheetModal } from "@/components/forms";
import { TaskEditorSheet } from "@/components/TaskEditorSheet";
import { decryptNoteContent, encryptNoteContent } from "@/lib/note-lock";

const LOCK_ACCENT = "#f59e0b";

/** Detects an open `[[` mention immediately before the caret (mirrors web). */
function getActiveMention(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const upto = value.slice(0, caret);
  const open = upto.lastIndexOf("[[");
  if (open === -1) return null;
  const between = upto.slice(open + 2);
  if (
    between.includes("]]") ||
    between.includes("\n") ||
    between.includes("[[")
  )
    return null;
  return { query: between, start: open + 2 };
}

function typeIconName(type: ItemRef["type"]): keyof typeof Ionicons.glyphMap {
  if (type === "note") return "document-text-outline";
  if (type === "mindmap") return "git-network-outline";
  return "checkbox-outline";
}

function typeIconColor(type: ItemRef["type"]): string {
  if (type === "note") return "#3b82f6";
  if (type === "mindmap") return "#8b5cf6";
  return "#10b981";
}

function typeLabel(type: ItemRef["type"]): string {
  return type === "note" ? "Nota" : type === "mindmap" ? "Mapa Mental" : "Tarefa";
}

export default function NoteDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Number(id);

  if (!Number.isFinite(noteId) || noteId <= 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          title="Nota"
          left={<IconButton name="chevron-back" onPress={() => router.back()} />}
        />
        <ErrorView message="Nota inválida." />
      </View>
    );
  }

  // Remount whenever the note changes so no per-note state (decrypted content,
  // password, open dialogs) can leak across notes.
  return <NoteEditorInner key={noteId} id={noteId} />;
}

function NoteEditorInner({ id }: { id: number }) {
  const colors = useColors();
  const router = useRouter();
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();

  const noteQuery = useGetNote(id, {
    query: { enabled: !!id, queryKey: getGetNoteQueryKey(id) },
  });
  const detail = noteQuery.data ?? null;
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const workspaceId = detail?.note.workspaceId ?? 0;
  const workspacesQuery = useListWorkspaces();
  const role = useMemo(
    () =>
      (workspacesQuery.data ?? []).find((w) => w.id === workspaceId)
        ?.currentUserRole,
    [workspacesQuery.data, workspaceId],
  );
  const canEdit = role ? role !== "viewer" : false;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mention, setMention] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  // Lock state
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockPending, setUnlockPending] = useState(false);

  // Lock dialog
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockPending, setLockPending] = useState(false);

  // Task link viewer
  const [openTask, setOpenTask] = useState<{
    taskId: number;
    projectId: number;
  } | null>(null);

  const contentRef = useRef("");
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const loadedIdRef = useRef<number | null>(null);
  // Bumped on every edit; a save captures the generation at start and only
  // clears `dirty` if no edit landed while the save/encrypt was in flight, so a
  // concurrent edit is never marked clean nor clobbered by the post-save
  // refetch (the same-note sync branch skips re-seeding while dirty).
  const editGenRef = useRef(0);

  const markDirty = () => {
    editGenRef.current += 1;
    setDirty(true);
  };

  useLayoutEffect(() => {
    if (!detail) return;
    const isNewNote = loadedIdRef.current !== detail.note.id;
    if (isNewNote) {
      loadedIdRef.current = detail.note.id;
      setTitle(detail.note.title);
      setLocked(detail.note.isLocked);
      setDirty(false);
      setPassword("");
      setUnlockInput("");
      setUnlockError("");
      setUnlockPending(false);
      setLockDialogOpen(false);
      setPw1("");
      setPw2("");
      setLockError("");
      setLockPending(false);
      setMention(null);
      if (detail.note.isLocked) {
        setContent("");
        contentRef.current = "";
        setUnlocked(false);
      } else {
        setContent(detail.note.content);
        contentRef.current = detail.note.content;
        setUnlocked(true);
      }
      return;
    }
    // Same note refetched: sync only when there are no pending edits, and never
    // re-lock a note the user already unlocked.
    if (!dirtyRef.current) {
      setTitle(detail.note.title);
      setLocked(detail.note.isLocked);
      if (!detail.note.isLocked) {
        setContent(detail.note.content);
        contentRef.current = detail.note.content;
        setUnlocked(true);
      }
    }
  }, [detail]);

  const { data: mentionables = [] } = useListMentionables(
    workspaceId,
    { q: mention?.query ?? "" },
    {
      query: {
        enabled: !!mention && !!workspaceId,
        queryKey: getListMentionablesQueryKey(workspaceId, {
          q: mention?.query ?? "",
        }),
      },
    },
  );
  const suggestions = mentionables.slice(0, 8);

  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(id) });
    if (workspaceId)
      queryClient.invalidateQueries({
        queryKey: getListNotesQueryKey(workspaceId),
      });
  }, [id, workspaceId, queryClient]);

  const onChangeContent = (text: string) => {
    contentRef.current = text;
    setContent(text);
    markDirty();
  };

  const onSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    const start = e.nativeEvent.selection.start;
    setMention(getActiveMention(contentRef.current, start));
    if (selection) setSelection(undefined);
  };

  const applyMention = (selectedTitle: string) => {
    if (!mention) return;
    const value = contentRef.current;
    let end = mention.start;
    while (
      end < value.length &&
      value[end] !== "]" &&
      value[end] !== "\n" &&
      value[end] !== "["
    )
      end++;
    const before = value.slice(0, mention.start);
    let after = value.slice(end);
    if (after.startsWith("]]")) after = after.slice(2);
    const insert = `${selectedTitle}]]`;
    const newValue = before + insert + after;
    contentRef.current = newValue;
    setContent(newValue);
    markDirty();
    setMention(null);
    const newCaret = before.length + insert.length;
    setSelection({ start: newCaret, end: newCaret });
  };

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    const targetId = id;
    const gen = editGenRef.current;
    let payloadContent = content;
    if (locked) {
      if (!password) return;
      payloadContent = await encryptNoteContent(content, password);
    }
    if (loadedIdRef.current !== targetId) return;
    updateNote.mutate(
      {
        noteId: targetId,
        data: { title: title.trim(), content: payloadContent, isLocked: locked },
      },
      {
        onSuccess: () => {
          if (loadedIdRef.current !== targetId) return;
          if (editGenRef.current === gen) setDirty(false);
          invalidateLists();
        },
        onError: () => Alert.alert("Erro", "Não foi possível salvar a nota."),
      },
    );
  }, [id, title, content, locked, password, updateNote, invalidateLists]);

  const handleUnlock = async () => {
    if (!detail || !unlockInput) return;
    const targetId = detail.note.id;
    setUnlockPending(true);
    try {
      const plain = await decryptNoteContent(detail.note.content, unlockInput);
      if (loadedIdRef.current !== targetId) return;
      setContent(plain);
      contentRef.current = plain;
      setPassword(unlockInput);
      setUnlocked(true);
      setUnlockError("");
      setUnlockInput("");
    } catch {
      if (loadedIdRef.current === targetId) setUnlockError("Senha incorreta.");
    } finally {
      if (loadedIdRef.current === targetId) setUnlockPending(false);
    }
  };

  const handleConfirmLock = async () => {
    if (!title.trim()) {
      setLockError("Dê um título à nota antes de protegê-la.");
      return;
    }
    if (!pw1) {
      setLockError("Digite uma senha.");
      return;
    }
    if (pw1 !== pw2) {
      setLockError("As senhas não coincidem.");
      return;
    }
    const targetId = id;
    const gen = editGenRef.current;
    setLockPending(true);
    try {
      const cipher = await encryptNoteContent(content, pw1);
      if (loadedIdRef.current !== targetId) {
        setLockPending(false);
        return;
      }
      updateNote.mutate(
        {
          noteId: targetId,
          data: { title: title.trim(), content: cipher, isLocked: true },
        },
        {
          onSuccess: () => {
            if (loadedIdRef.current !== targetId) return;
            setLocked(true);
            setUnlocked(true);
            setPassword(pw1);
            if (editGenRef.current === gen) setDirty(false);
            setLockDialogOpen(false);
            setPw1("");
            setPw2("");
            setLockError("");
            invalidateLists();
          },
          onSettled: () => setLockPending(false),
          onError: () =>
            Alert.alert("Erro", "Não foi possível proteger a nota."),
        },
      );
    } catch {
      if (loadedIdRef.current === targetId) {
        setLockError("Não foi possível proteger a nota.");
        setLockPending(false);
      }
    }
  };

  const handleRemoveLock = () => {
    if (!title.trim()) return;
    const targetId = id;
    const gen = editGenRef.current;
    updateNote.mutate(
      {
        noteId: targetId,
        data: { title: title.trim(), content, isLocked: false },
      },
      {
        onSuccess: () => {
          if (loadedIdRef.current !== targetId) return;
          setLocked(false);
          setPassword("");
          if (editGenRef.current === gen) setDirty(false);
          invalidateLists();
        },
        onError: () =>
          Alert.alert("Erro", "Não foi possível remover a proteção."),
      },
    );
  };

  const navTo = (ref: ItemRef) => {
    if (ref.type === "note") router.push(`/note/${ref.id}`);
    else if (ref.type === "mindmap") router.push(`/mindmap/${ref.id}`);
    else if (ref.type === "task" && ref.projectId != null)
      setOpenTask({ taskId: ref.id, projectId: ref.projectId });
  };

  // Task link viewer data
  const taskQuery = useGetTask(openTask?.taskId ?? 0, {
    query: {
      enabled: !!openTask,
      queryKey: getGetTaskQueryKey(openTask?.taskId ?? 0),
    },
  });
  const taskColumnsQuery = useListColumns(openTask?.projectId ?? 0, {
    query: {
      enabled: !!openTask,
      queryKey: getListColumnsQueryKey(openTask?.projectId ?? 0),
    },
  });
  const taskColumns = useMemo<Column[]>(
    () =>
      [...(taskColumnsQuery.data ?? [])].sort((a, b) => a.position - b.position),
    [taskColumnsQuery.data],
  );

  const openLockDialog = () => {
    setPw1("");
    setPw2("");
    setLockError("");
    setLockDialogOpen(true);
  };

  const confirmDelete = () => {
    Alert.alert("Excluir nota", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () =>
          deleteNote.mutate(
            { noteId: id },
            {
              onSuccess: () => {
                if (workspaceId)
                  queryClient.invalidateQueries({
                    queryKey: getListNotesQueryKey(workspaceId),
                  });
                if (router.canGoBack()) router.back();
                else router.replace("/notes");
              },
              onError: () =>
                Alert.alert("Erro", "Não foi possível excluir a nota."),
            },
          ),
      },
    ]);
  };

  const confirmRemoveLock = () => {
    Alert.alert(
      "Remover proteção",
      "O conteúdo desta nota deixará de exigir senha e ficará visível para todos os membros do workspace.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: handleRemoveLock },
      ],
    );
  };

  const openActions = () => {
    const buttons: {
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }[] = [];
    if (!locked) {
      buttons.push({ text: "Proteger com senha", onPress: openLockDialog });
    }
    if (locked && unlocked) {
      buttons.push({ text: "Remover proteção", onPress: confirmRemoveLock });
    }
    buttons.push({
      text: "Excluir nota",
      style: "destructive",
      onPress: confirmDelete,
    });
    buttons.push({ text: "Cancelar", style: "cancel" });
    Alert.alert("Nota", undefined, buttons);
  };

  const showGate = locked && !unlocked;

  const headerRight = canEdit ? (
    <View style={styles.headerActions}>
      <IconButton name="ellipsis-horizontal" onPress={openActions} />
      {!showGate ? (
        <IconButton
          name="save-outline"
          onPress={() => void handleSave()}
          disabled={!dirty || updateNote.isPending || !title.trim()}
          color={dirty ? colors.primary : colors.mutedForeground}
        />
      ) : null}
    </View>
  ) : undefined;

  const subtitle = showGate
    ? "Protegida"
    : locked
      ? "Protegida — [[ ]] indisponível"
      : "Use [[ para vincular notas, mapas e tarefas";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Editar nota"
        subtitle={subtitle}
        left={<IconButton name="chevron-back" onPress={() => router.back()} />}
        right={headerRight}
      />

      {noteQuery.isLoading ? (
        <LoadingView label="Carregando nota..." />
      ) : noteQuery.isError || !detail ? (
        <ErrorView
          message="Não foi possível carregar a nota."
          onRetry={() => noteQuery.refetch()}
        />
      ) : showGate ? (
        <View style={styles.gateWrap}>
          <View
            style={[
              styles.gateCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.gateIcon}>
              <Ionicons name="lock-closed" size={26} color={LOCK_ACCENT} />
            </View>
            <Text style={[styles.gateTitle, { color: colors.foreground }]}>
              {detail.note.title}
            </Text>
            <Text style={[styles.gateHint, { color: colors.mutedForeground }]}>
              Esta nota está protegida. Digite a senha para abrir.
            </Text>
            <PasswordInput
              value={unlockInput}
              onChangeText={(t) => {
                setUnlockInput(t);
                setUnlockError("");
              }}
              placeholder="Senha da nota"
              autoFocus
              onSubmitEditing={handleUnlock}
            />
            {unlockError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {unlockError}
              </Text>
            ) : null}
            <View style={styles.gateButton}>
              <Button
                label="Abrir"
                icon="lock-open-outline"
                onPress={handleUnlock}
                loading={unlockPending}
                disabled={!unlockInput}
              />
            </View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: bottomInset },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                markDirty();
              }}
              editable={canEdit}
              placeholder="Título da nota"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.titleInput,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                  opacity: canEdit ? 1 : 0.7,
                },
              ]}
            />

            <View style={styles.editorWrap}>
              <TextInput
                value={content}
                onChangeText={onChangeContent}
                onSelectionChange={onSelectionChange}
                selection={selection}
                editable={canEdit}
                multiline
                textAlignVertical="top"
                placeholder="Comece a escrever... use [[ para criar links."
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.contentInput,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    color: colors.foreground,
                    opacity: canEdit ? 1 : 0.7,
                  },
                ]}
              />

              {mention && suggestions.length > 0 ? (
                <View
                  style={[
                    styles.dropdown,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  {suggestions.map((s) => (
                    <Pressable
                      key={`${s.type}-${s.id}`}
                      onPress={() => applyMention(s.title)}
                      style={({ pressed }) => [
                        styles.dropdownRow,
                        {
                          backgroundColor: pressed
                            ? colors.secondary
                            : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        name={typeIconName(s.type)}
                        size={16}
                        color={typeIconColor(s.type)}
                      />
                      <Text
                        style={[styles.dropdownTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {s.title}
                      </Text>
                      <Text
                        style={[
                          styles.dropdownType,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {typeLabel(s.type)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {mention && suggestions.length === 0 ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Nenhum item encontrado. Ao salvar, "[[{mention.query}]]" criará
                uma nova nota vazia.
              </Text>
            ) : null}

            {locked ? (
              <View style={styles.lockedHint}>
                <Ionicons name="lock-closed" size={12} color={LOCK_ACCENT} />
                <Text
                  style={[styles.hint, { color: colors.mutedForeground, flex: 1 }]}
                >
                  Nota protegida. O conteúdo é criptografado com sua senha ao
                  salvar. Links [[ ]] ficam indisponíveis enquanto protegida.
                </Text>
              </View>
            ) : null}

            <LinkPanel
              icon="arrow-up-outline"
              label={`Links (${detail.outgoingLinks.length})`}
              emptyText="Nenhum link nesta nota."
              refs={detail.outgoingLinks}
              onNavigate={navTo}
              keyPrefix="out"
            />
            <LinkPanel
              icon="arrow-down-outline"
              label={`Backlinks (${detail.backlinks.length})`}
              emptyText="Nenhuma nota aponta para esta."
              refs={detail.backlinks}
              onNavigate={navTo}
              keyPrefix="back"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <SheetModal
        visible={lockDialogOpen}
        onClose={() => setLockDialogOpen(false)}
        title="Proteger nota com senha"
        footer={
          <Button
            label="Proteger"
            icon="lock-closed-outline"
            onPress={handleConfirmLock}
            loading={lockPending}
          />
        }
      >
        <Text style={[styles.dialogDesc, { color: colors.mutedForeground }]}>
          Digite a mesma senha duas vezes. O conteúdo será criptografado e só
          poderá ser aberto com esta senha.
        </Text>
        <FieldRow label="Senha">
          <PasswordInput
            value={pw1}
            onChangeText={(t) => {
              setPw1(t);
              setLockError("");
            }}
            placeholder="Digite a senha"
            autoFocus
          />
        </FieldRow>
        <FieldRow label="Confirmar senha">
          <PasswordInput
            value={pw2}
            onChangeText={(t) => {
              setPw2(t);
              setLockError("");
            }}
            placeholder="Digite a senha novamente"
            onSubmitEditing={handleConfirmLock}
          />
        </FieldRow>
        {lockError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {lockError}
          </Text>
        ) : null}
        <View style={styles.warnBox}>
          <Text style={[styles.warnText, { color: LOCK_ACCENT }]}>
            Atenção: se você esquecer esta senha, não será possível recuperar o
            conteúdo desta nota.
          </Text>
        </View>
      </SheetModal>

      {openTask ? (
        <TaskEditorSheet
          visible={!!taskQuery.data}
          mode="edit"
          projectId={openTask.projectId}
          workspaceId={workspaceId}
          columns={taskColumns}
          task={taskQuery.data ?? null}
          canEdit={canEdit}
          onClose={() => setOpenTask(null)}
        />
      ) : null}
    </View>
  );
}

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      secureTextEntry
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect={false}
      onSubmitEditing={onSubmitEditing}
      style={[
        styles.pwInput,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          borderRadius: colors.radius,
          color: colors.foreground,
        },
      ]}
    />
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function LinkPanel({
  icon,
  label,
  emptyText,
  refs,
  onNavigate,
  keyPrefix,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  emptyText: string;
  refs: ItemRef[];
  onNavigate: (ref: ItemRef) => void;
  keyPrefix: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Ionicons name={icon} size={16} color={colors.mutedForeground} />
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>
          {label}
        </Text>
      </View>
      {refs.length === 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {emptyText}
        </Text>
      ) : (
        <View style={styles.panelList}>
          {refs.map((ref) => (
            <Pressable
              key={`${keyPrefix}-${ref.type}-${ref.id}`}
              onPress={() => onNavigate(ref)}
              style={({ pressed }) => [
                styles.linkRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={typeIconName(ref.type)}
                size={16}
                color={typeIconColor(ref.type)}
              />
              <Text
                style={[styles.linkTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {ref.title}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  titleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 52,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  editorWrap: {
    position: "relative",
  },
  contentInput: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    minHeight: 320,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  dropdown: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    zIndex: 30,
    ...(Platform.OS === "web"
      ? {}
      : {
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }),
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownTitle: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  dropdownType: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  lockedHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  panel: {
    gap: 10,
    marginTop: 6,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  panelTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  panelList: {
    gap: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkTitle: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  gateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  gateCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
  },
  gateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
    marginBottom: 14,
  },
  gateTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  gateHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  gateButton: {
    width: "100%",
    marginTop: 12,
  },
  pwInput: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 48,
    width: "100%",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  dialogDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  warnBox: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
});

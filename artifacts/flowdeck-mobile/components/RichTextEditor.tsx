import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { FieldLabel } from "@/components/forms";
import { RichText } from "@/components/RichText";
import {
  RICH_TEXT_COLORS,
  editorModelToHtml,
  htmlToEditorModel,
  type CharAttr,
} from "@/lib/rich-text";

type Mark = "bold" | "italic" | "underline" | "strike";

const MARK_ICONS: Record<Mark, React.ComponentProps<typeof Ionicons>["name"]> = {
  bold: "text",
  italic: "text-outline",
  underline: "remove-outline",
  strike: "remove",
};

const MARK_LABELS: Record<Mark, string> = {
  bold: "Negrito",
  italic: "Itálico",
  underline: "Sublinhado",
  strike: "Tachado",
};

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  const colors = useColors();

  const [model, setModel] = useState(() => htmlToEditorModel(value));
  const text = model.text;
  const attrs = model.attrs;

  const lastEmitted = useRef(value);
  const selRef = useRef({ start: 0, end: 0 });
  const [, forceTick] = useState(0);
  const pendingRef = useRef<CharAttr | null>(null);
  const expectCaretRef = useRef<number | null>(null);
  const [colorOpen, setColorOpen] = useState(false);

  // Re-hydrate when the parent supplies a different description (e.g. opening
  // another task), but never clobber the user's in-progress edits.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setModel(htmlToEditorModel(value));
      lastEmitted.current = value;
      pendingRef.current = null;
    }
  }, [value]);

  const commit = (next: typeof model) => {
    setModel(next);
    const html = editorModelToHtml(next);
    if (html !== lastEmitted.current) {
      lastEmitted.current = html;
      onChange(html);
    }
  };

  const handleChangeText = (next: string) => {
    const prev = text;
    let p = 0;
    const minLen = Math.min(prev.length, next.length);
    while (p < minLen && prev[p] === next[p]) p++;
    let sfx = 0;
    while (
      sfx < minLen - p &&
      prev[prev.length - 1 - sfx] === next[next.length - 1 - sfx]
    ) {
      sfx++;
    }
    const inserted = next.length - p - sfx;
    const carry: CharAttr = pendingRef.current
      ? { ...pendingRef.current }
      : { ...(attrs[p - 1] ?? attrs[p] ?? {}) };
    const insertAttrs = Array.from({ length: inserted }, () => ({ ...carry }));
    const newAttrs = [
      ...attrs.slice(0, p),
      ...insertAttrs,
      ...attrs.slice(prev.length - sfx),
    ];
    expectCaretRef.current = p + inserted;
    commit({ ...model, text: next, attrs: newAttrs });
  };

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    const { start, end } = e.nativeEvent.selection;
    selRef.current = { start, end };
    // Clear pending marks once the caret moves away from the typing position.
    if (start !== end || start !== expectCaretRef.current) {
      if (pendingRef.current) {
        pendingRef.current = null;
      }
    }
    expectCaretRef.current = null;
    forceTick((t) => t + 1);
  };

  const markActive = (mark: Mark): boolean => {
    const { start, end } = selRef.current;
    if (end > start) {
      return attrs.slice(start, end).every((a) => a[mark]);
    }
    if (pendingRef.current) return !!pendingRef.current[mark];
    return !!attrs[start - 1]?.[mark];
  };

  const toggleMark = (mark: Mark) => {
    const { start, end } = selRef.current;
    if (end > start) {
      const allOn = attrs.slice(start, end).every((a) => a[mark]);
      const newAttrs = attrs.map((a, idx) =>
        idx >= start && idx < end ? { ...a, [mark]: allOn ? undefined : true } : a,
      );
      commit({ ...model, attrs: newAttrs });
    } else {
      const cur = pendingRef.current ?? { ...(attrs[start - 1] ?? {}) };
      pendingRef.current = { ...cur, [mark]: cur[mark] ? undefined : true };
      forceTick((t) => t + 1);
    }
  };

  const applyColor = (color: string | null) => {
    const { start, end } = selRef.current;
    if (end > start) {
      const newAttrs = attrs.map((a, idx) =>
        idx >= start && idx < end ? { ...a, color: color ?? undefined } : a,
      );
      commit({ ...model, attrs: newAttrs });
    } else {
      const cur = pendingRef.current ?? { ...(attrs[start - 1] ?? {}) };
      pendingRef.current = { ...cur, color: color ?? undefined };
      forceTick((t) => t + 1);
    }
    setColorOpen(false);
  };

  const html = editorModelToHtml(model);

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>

      {editable ? (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {(Object.keys(MARK_ICONS) as Mark[]).map((mark) => {
            const active = markActive(mark);
            return (
              <Pressable
                key={mark}
                accessibilityLabel={MARK_LABELS[mark]}
                onPress={() => toggleMark(mark)}
                style={[
                  styles.toolBtn,
                  active ? { backgroundColor: colors.card } : null,
                ]}
              >
                <Text
                  style={[
                    styles.toolBtnLabel,
                    {
                      color: active ? colors.foreground : colors.mutedForeground,
                      fontFamily:
                        mark === "bold" ? "Inter_700Bold" : "Inter_500Medium",
                      fontStyle: mark === "italic" ? "italic" : "normal",
                      textDecorationLine:
                        mark === "underline"
                          ? "underline"
                          : mark === "strike"
                            ? "line-through"
                            : "none",
                    },
                  ]}
                >
                  {mark === "bold"
                    ? "B"
                    : mark === "italic"
                      ? "I"
                      : mark === "underline"
                        ? "U"
                        : "S"}
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable
            accessibilityLabel="Cor do texto"
            onPress={() => setColorOpen((v) => !v)}
            style={styles.toolBtn}
          >
            <Ionicons
              name="color-palette-outline"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      ) : null}

      {editable && colorOpen ? (
        <View
          style={[
            styles.colorPickerWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {RICH_TEXT_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`Cor ${c}`}
              onPress={() => applyColor(c)}
              style={[styles.swatch, { backgroundColor: c, borderColor: colors.border }]}
            />
          ))}
          <Pressable
            accessibilityLabel="Cor padrão"
            onPress={() => applyColor(null)}
            style={[
              styles.swatch,
              styles.swatchDefault,
              { borderColor: colors.border },
            ]}
          >
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      {editable ? (
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          multiline
          editable={editable}
          style={[
            styles.input,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderRadius: colors.radius,
              color: colors.foreground,
            },
          ]}
        />
      ) : null}

      {html ? (
        <View style={styles.preview}>
          {editable ? (
            <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
              Pré-visualização
            </Text>
          ) : null}
          <View
            style={[
              styles.previewBox,
              editable
                ? {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  }
                : null,
            ]}
          >
            <RichText html={html} />
          </View>
        </View>
      ) : !editable ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Sem descrição.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  toolBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  toolBtnLabel: {
    fontSize: 16,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: 4,
  },
  colorPickerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchDefault: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: "top",
  },
  preview: {
    marginTop: 4,
  },
  previewLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginBottom: 6,
  },
  previewBox: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  empty: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontStyle: "italic",
  },
});

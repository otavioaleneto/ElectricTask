import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/ui";

const MONTHS_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD — never parse a date-only string through `new Date()`. */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function partsOf(ymd: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function formatDateLabel(ymd: string | null | undefined): string | null {
  if (!ymd) return null;
  const p = partsOf(ymd);
  if (!p) return null;
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
      {children}
    </Text>
  );
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoFocus,
  editable = true,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        editable={editable}
        autoFocus={autoFocus}
        multiline={multiline}
        style={[
          styles.input,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            borderRadius: colors.radius,
            color: colors.foreground,
            minHeight: multiline ? 88 : 48,
            textAlignVertical: multiline ? "top" : "center",
            opacity: editable ? 1 : 0.6,
          },
        ]}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View
        style={[
          styles.segmentRow,
          { backgroundColor: colors.secondary, borderRadius: colors.radius },
        ]}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? colors.card : "transparent",
                  borderRadius: Math.max(0, colors.radius - 2),
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: active ? colors.foreground : colors.mutedForeground,
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
  avatarName?: string;
  avatarUri?: string | null;
};

export function SelectField({
  label,
  options,
  value,
  onSelect,
  placeholder = "Selecionar",
  disabled,
  testID,
}: {
  label: string;
  options: SelectOption[];
  value: string | null;
  onSelect: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.select,
          {
            backgroundColor: colors.secondary,
            borderColor: open ? colors.primary : colors.border,
            borderRadius: colors.radius,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.selectValue}>
          {selected?.avatarName !== undefined ? (
            <Avatar
              name={selected.avatarName}
              uri={selected.avatarUri}
              size={22}
            />
          ) : selected?.color ? (
            <View style={[styles.dot, { backgroundColor: selected.color }]} />
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              color: selected ? colors.foreground : colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 15,
              flexShrink: 1,
            }}
          >
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open && !disabled ? (
        <View
          style={[
            styles.optionList,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
            },
          ]}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                style={[styles.option, { borderBottomColor: colors.border }]}
              >
                {opt.avatarName !== undefined ? (
                  <Avatar name={opt.avatarName} uri={opt.avatarUri} size={24} />
                ) : opt.color ? (
                  <View style={[styles.dot, { backgroundColor: opt.color }]} />
                ) : null}
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 15,
                    flex: 1,
                  }}
                >
                  {opt.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const display = formatDateLabel(value);
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.select,
          {
            backgroundColor: colors.secondary,
            borderColor: open ? colors.primary : colors.border,
            borderRadius: colors.radius,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <View style={styles.selectValue}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.mutedForeground}
          />
          <Text
            style={{
              color: display ? colors.foreground : colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 15,
            }}
          >
            {display ?? "Sem data"}
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open && !disabled ? (
        <Calendar
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function Calendar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const colors = useColors();
  const today = new Date();
  const initial = (value && partsOf(value)) || {
    y: today.getFullYear(),
    m: today.getMonth() + 1,
    d: today.getDate(),
  };
  const [view, setView] = useState({ y: initial.y, m: initial.m });

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selected = value ? partsOf(value) : null;
  const todayYMD = toYMD(today);

  const shiftMonth = (delta: number) => {
    let m = view.m + delta;
    let y = view.y;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setView({ y, m });
  };

  return (
    <View
      style={[
        styles.calendar,
        {
          borderColor: colors.border,
          borderRadius: colors.radius,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={styles.calHeader}>
        <Pressable hitSlop={10} onPress={() => shiftMonth(-1)}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 15,
          }}
        >
          {MONTHS_FULL[view.m - 1]} {view.y}
        </Text>
        <Pressable hitSlop={10} onPress={() => shiftMonth(1)}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.calWeekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={i}
            style={[styles.calWeekday, { color: colors.mutedForeground }]}
          >
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={styles.calCell} />;
          const ymd = `${view.y}-${pad(view.m)}-${pad(d)}`;
          const isSelected =
            !!selected &&
            selected.y === view.y &&
            selected.m === view.m &&
            selected.d === d;
          const isToday = ymd === todayYMD;
          return (
            <Pressable
              key={i}
              style={styles.calCell}
              onPress={() => onChange(ymd)}
            >
              <View
                style={[
                  styles.calDay,
                  {
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    borderColor:
                      isToday && !isSelected ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected
                      ? colors.primaryForeground
                      : colors.foreground,
                    fontFamily: isSelected
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                    fontSize: 14,
                  }}
                >
                  {d}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.calFooter}>
        <Pressable onPress={() => onChange(todayYMD)}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
            }}
          >
            Hoje
          </Text>
        </Pressable>
        <Pressable onPress={() => onChange(null)}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
            }}
          >
            Limpar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SheetModal({
  visible,
  onClose,
  title,
  children,
  footer,
  fillHeight = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  fillHeight?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const footerPad = Platform.OS === "web" ? 16 : insets.bottom + 12;
  const sheetHeight = fillHeight
    ? Math.min(windowHeight * 0.9, windowHeight - insets.top - 8)
    : undefined;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
              sheetHeight ? { height: sheetHeight } : null,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <Text
                numberOfLines={1}
                style={[styles.sheetTitle, { color: colors.foreground }]}
              >
                {title}
              </Text>
              <Pressable hitSlop={10} onPress={onClose}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={fillHeight ? styles.scrollFill : undefined}
              contentContainerStyle={[
                styles.sheetContent,
                fillHeight ? styles.sheetContentFill : null,
              ]}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={[
                  styles.sheetFooter,
                  { borderTopColor: colors.border, paddingBottom: footerPad },
                ]}
              >
                {footer}
              </View>
            ) : (
              <View style={{ height: footerPad }} />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  segmentRow: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionList: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calendar: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calWeekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calWeekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  calDay: {
    width: "100%",
    height: "100%",
    maxWidth: 40,
    maxHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  kav: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
    ...(Platform.OS === "web"
      ? { maxWidth: 640, width: "100%", alignSelf: "center" }
      : {}),
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    flex: 1,
  },
  scrollFill: {
    flex: 1,
  },
  sheetContent: {
    paddingBottom: 8,
  },
  sheetContentFill: {
    flexGrow: 1,
  },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 4,
  },
});

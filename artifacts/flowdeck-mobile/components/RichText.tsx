import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import { Image } from "expo-image";

import { useColors } from "@/hooks/useColors";
import {
  parseRichHtml,
  resolveImageSrc,
  type RichInline,
} from "@/lib/rich-text";

function inlineStyle(run: RichInline): TextStyle {
  const style: TextStyle = {};
  if (run.bold && run.italic) {
    style.fontFamily = "Inter_700Bold";
    style.fontStyle = "italic";
  } else if (run.bold) {
    style.fontFamily = "Inter_700Bold";
  } else if (run.italic) {
    style.fontStyle = "italic";
  }
  const deco: string[] = [];
  if (run.underline) deco.push("underline");
  if (run.strike) deco.push("line-through");
  if (deco.length) style.textDecorationLine = deco.join(" ") as TextStyle["textDecorationLine"];
  if (run.color) style.color = run.color;
  return style;
}

function InlineRuns({ inlines }: { inlines: RichInline[] }) {
  return (
    <>
      {inlines.map((run, i) => (
        <Text key={i} style={inlineStyle(run)}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

function RichImage({ src, alt }: { src: string; alt: string }) {
  const colors = useColors();
  const [ratio, setRatio] = useState(16 / 9);
  return (
    <Image
      accessibilityLabel={alt || undefined}
      source={{ uri: resolveImageSrc(src) }}
      style={[
        styles.image,
        { aspectRatio: ratio, backgroundColor: colors.secondary, borderRadius: colors.radius },
      ]}
      contentFit="contain"
      transition={150}
      onLoad={(e) => {
        const w = e.source?.width;
        const h = e.source?.height;
        if (w && h) setRatio(w / h);
      }}
    />
  );
}

export function RichText({ html }: { html: string }) {
  const colors = useColors();
  const blocks = useMemo(() => parseRichHtml(html), [html]);

  if (blocks.length === 0) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        if (block.type === "image") {
          return <RichImage key={i} src={block.src} alt={block.alt} />;
        }
        if (block.type === "list") {
          return (
            <View key={i} style={styles.list}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.listRow}>
                  <Text style={[styles.bullet, { color: colors.mutedForeground }]}>
                    {block.ordered ? `${j + 1}.` : "•"}
                  </Text>
                  <Text style={[styles.paragraph, { color: colors.foreground, flex: 1 }]}>
                    <InlineRuns inlines={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.paragraph, { color: colors.foreground }]}>
            <InlineRuns inlines={block.inlines} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  paragraph: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: 4,
  },
  listRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  bullet: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    minWidth: 16,
  },
  image: {
    width: "100%",
    maxHeight: 280,
    marginVertical: 2,
  },
});

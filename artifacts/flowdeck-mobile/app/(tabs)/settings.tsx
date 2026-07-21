import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";
import {
  Avatar,
  Badge,
  Button,
  Header,
  useBottomInset,
} from "@/components/ui";

export default function SettingsScreen() {
  const colors = useColors();
  const bottomInset = useBottomInset();
  const { user, signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Account" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profile,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <Avatar name={user?.name ?? "?"} size={64} />
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name}
            </Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>
              {user?.email}
            </Text>
            {user?.role ? (
              <View style={{ marginTop: 8 }}>
                <Badge
                  label={user.role === "admin" ? "Admin" : "Member"}
                  color={colors.primary}
                  bg={colors.secondary}
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <Button
            testID="logout-button"
            label="Sign out"
            onPress={signOut}
            variant="destructive"
            icon="log-out-outline"
          />
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          ElectricTask Mobile
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    ...(Platform.OS === "web"
      ? { maxWidth: 640, width: "100%", alignSelf: "center" }
      : {}),
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 2,
  },
  footer: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
  },
});

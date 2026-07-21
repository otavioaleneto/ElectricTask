import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/auth";
import { Button, useTopInset } from "@/components/ui";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

export default function LoginScreen() {
  const colors = useColors();
  const top = useTopInset();
  const { user, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Redirect href="/" />;
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Introduza o seu email e palavra-passe.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 401) {
        setError("Email ou palavra-passe incorretos.");
      } else {
        setError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: top + 48 }]}
      bottomOffset={24}
    >
      <View style={styles.brandRow}>
        <View style={[styles.logo, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <MaterialCommunityIcons name="cards" size={30} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>ElectricTask</Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        Bem-vindo de volta
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Entre para gerir os seus projetos de conteúdo onde quer que esteja.
      </Text>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
        <TextInput
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="exemplo@email.com"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
            },
          ]}
        />

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>
          Palavra-passe
        </Text>
        <TextInput
          testID="password-input"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
            },
          ]}
        />

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <View style={{ marginTop: 24 }}>
          <Button
            testID="login-button"
            label="Entrar"
            onPress={handleSubmit}
            loading={submitting}
            icon="log-in-outline"
          />
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    flexGrow: 1,
    ...(Platform.OS === "web" ? { maxWidth: 480, width: "100%", alignSelf: "center" } : {}),
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 48,
  },
  logo: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
  },
  form: {
    marginTop: 36,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 16,
  },
});

import * as AC from "@bacons/apple-colors";
import { useAuth } from "@/contexts/AuthContext";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
      }
      // Navigation handled by _layout.tsx route guard
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error);
      } else {
        setSuccessMsg(
          "Account created! Check your email to confirm, then sign in."
        );
      }
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: mode === "signin" ? "Sign In" : "Sign Up", headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: AC.systemGroupedBackground as any }}
          contentContainerStyle={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
          }}
        >
          {/* Logo / Title */}
          <View style={{ alignItems: "center", marginBottom: 40, gap: 8 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: AC.systemBlue as any,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0,122,255,0.35)",
              }}
            >
              <Text style={{ fontSize: 36 }}>💰</Text>
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: AC.label as any,
                letterSpacing: -0.5,
              }}
            >
              FinanceKit
            </Text>
            <Text style={{ fontSize: 15, color: AC.secondaryLabel as any }}>
              Personal Finance Dashboard
            </Text>
          </View>

          {/* Card */}
          <View
            style={{
              backgroundColor: AC.secondarySystemGroupedBackground as any,
              borderRadius: 16,
              borderCurve: "continuous",
              padding: 20,
              gap: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: AC.label as any,
                marginBottom: 4,
              }}
            >
              {mode === "signin" ? "Welcome back" : "Create account"}
            </Text>

            <View style={{ gap: 10 }}>
              <TextInput
                style={{
                  backgroundColor: AC.tertiarySystemGroupedBackground as any,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  padding: 14,
                  fontSize: 16,
                  color: AC.label as any,
                }}
                placeholder="Email"
                placeholderTextColor={AC.placeholderText as any}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextInput
                style={{
                  backgroundColor: AC.tertiarySystemGroupedBackground as any,
                  borderRadius: 10,
                  borderCurve: "continuous",
                  padding: 14,
                  fontSize: 16,
                  color: AC.label as any,
                }}
                placeholder="Password"
                placeholderTextColor={AC.placeholderText as any}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType={mode === "signin" ? "password" : "newPassword"}
              />
            </View>

            {error && (
              <Text
                selectable
                style={{
                  color: AC.systemRed as any,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
            )}
            {successMsg && (
              <Text
                selectable
                style={{
                  color: AC.systemGreen as any,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {successMsg}
              </Text>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => ({
                backgroundColor: AC.systemBlue as any,
                borderRadius: 12,
                borderCurve: "continuous",
                padding: 16,
                alignItems: "center",
                opacity: pressed || loading ? 0.7 : 1,
                marginTop: 4,
              })}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{ color: "white", fontWeight: "600", fontSize: 16 }}
                >
                  {mode === "signin" ? "Sign In" : "Sign Up"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Toggle mode */}
          <Pressable
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setSuccessMsg(null);
            }}
            style={{ marginTop: 20, alignItems: "center" }}
          >
            <Text style={{ color: AC.systemBlue as any, fontSize: 15 }}>
              {mode === "signin"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

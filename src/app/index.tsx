import * as AC from "@bacons/apple-colors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, type Account, type PlaidItem, type Transaction } from "@/lib/supabase";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  Platform,
} from "react-native";

// --- Plaid Link Web Component (web only) ---
function PlaidLinkWeb({
  linkToken,
  onSuccess,
  onExit,
}: {
  linkToken: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !linkToken) return;
    initialized.current = true;

    // Dynamically load Plaid Link JS on web
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => {
      const handler = (window as any).Plaid.create({
        token: linkToken,
        onSuccess: (public_token: string) => {
          onSuccess(public_token);
        },
        onExit: () => {
          onExit();
        },
      });
      handler.open();
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [linkToken]);

  return null;
}

// --- Badge component ---
function Badge({ label, color }: { label: string; color: any }) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderCurve: "continuous",
        opacity: 0.85,
      }}
    >
      <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

// --- Account Card ---
function AccountCard({
  account,
  transactionCount,
  expanded,
  onToggle,
}: {
  account: Account;
  transactionCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const balance = account.balance_current ?? account.balance_available ?? 0;
  const isCredit = account.type === "credit";

  return (
    <View
      style={{
        backgroundColor: AC.secondarySystemGroupedBackground as any,
        borderRadius: 14,
        borderCurve: "continuous",
        overflow: "hidden",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          padding: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: AC.label as any,
                }}
              >
                {account.name ?? "Account"}
              </Text>
              {account.mask && (
                <Text
                  style={{ fontSize: 13, color: AC.secondaryLabel as any }}
                >
                  ••{account.mask}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {account.subtype && (
                <Badge
                  label={account.subtype}
                  color={isCredit ? AC.systemOrange : AC.systemBlue}
                />
              )}
              <Text
                style={{ fontSize: 12, color: AC.tertiaryLabel as any }}
              >
                {transactionCount} transactions
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text
              selectable
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: isCredit
                  ? (AC.systemOrange as any)
                  : (AC.systemGreen as any),
              }}
            >
              ${Math.abs(balance).toFixed(2)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: AC.tertiaryLabel as any,
              }}
            >
              {expanded ? "▲ Hide JSON" : "▼ Show JSON"}
            </Text>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View
          style={{
            backgroundColor: AC.tertiarySystemGroupedBackground as any,
            padding: 12,
            borderTopWidth: 0.5,
            borderTopColor: AC.separator as any,
          }}
        >
          <Text
            selectable
            style={{
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              fontSize: 11,
              color: AC.secondaryLabel as any,
              lineHeight: 18,
            }}
          >
            {JSON.stringify(account, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

// --- Bank Item header ---
function BankHeader({ item, onSync }: { item: PlaidItem; syncing: boolean; onSync: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: AC.label as any }}>
          {item.institution_name ?? "Bank"}
        </Text>
        {item.last_synced_at && (
          <Text style={{ fontSize: 12, color: AC.secondaryLabel as any }}>
            Synced {new Date(item.last_synced_at).toLocaleString()}
          </Text>
        )}
      </View>
    </View>
  );
}

// --- Main Screen ---
export default function IndexScreen() {
  const { user, signOut } = useAuth();
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [itemsRes, accountsRes, txRes] = await Promise.all([
      supabase.from("plaid_items").select("*").order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("balance_current", { ascending: false }),
      supabase.from("transactions").select("*").order("date", { ascending: false }),
    ]);
    if (itemsRes.data) setPlaidItems(itemsRes.data as PlaidItem[]);
    if (accountsRes.data) setAccounts(accountsRes.data as Account[]);
    if (txRes.data) setTransactions(txRes.data as Transaction[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const syncTransactions = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      // Re-fetch items to get latest cursors
      const { data: currentItems } = await supabase
        .from("plaid_items")
        .select("*");
      if (!currentItems) return;

      for (const item of currentItems as PlaidItem[]) {
        let cursor = item.cursor ?? undefined;
        let hasMore = true;

        while (hasMore) {
          const res = await fetch("/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: item.access_token, cursor }),
          });

          if (!res.ok) {
            const err = await res.json();
            console.error("Sync error:", err);
            break;
          }

          const { added, accounts: syncedAccounts, has_more, next_cursor, modified } =
            await res.json();

          // Upsert accounts
          if (syncedAccounts?.length) {
            await supabase.from("accounts").upsert(
              syncedAccounts.map((a: any) => ({
                user_id: user.id,
                plaid_item_id: item.id,
                plaid_account_id: a.account_id,
                name: a.name,
                official_name: a.official_name,
                type: a.type,
                subtype: a.subtype,
                mask: a.mask,
                balance_current: a.balances?.current ?? null,
                balance_available: a.balances?.available ?? null,
                balance_limit: a.balances?.limit ?? null,
                currency_code: a.balances?.iso_currency_code ?? "USD",
                updated_at: new Date().toISOString(),
              })),
              { onConflict: "user_id,plaid_account_id" }
            );
          }

          // Map transactions to account UUIDs
          if (added?.length || modified?.length) {
            const { data: dbAccounts } = await supabase
              .from("accounts")
              .select("id, plaid_account_id")
              .eq("user_id", user.id);

            const accountMap = new Map(
              (dbAccounts ?? []).map((a: any) => [a.plaid_account_id, a.id])
            );

            const allTx = [...(added ?? []), ...(modified ?? [])];
            const mappedTx = allTx
              .map((t: any) => ({
                user_id: user.id,
                account_id: accountMap.get(t.account_id),
                plaid_transaction_id: t.transaction_id,
                amount: t.amount,
                date: t.date,
                name: t.name,
                merchant_name: t.merchant_name ?? null,
                category: t.category ?? null,
                pending: t.pending ?? false,
              }))
              .filter((t) => t.account_id);

            if (mappedTx.length) {
              await supabase.from("transactions").upsert(mappedTx, {
                onConflict: "user_id,plaid_transaction_id",
              });
            }
          }

          // Update cursor
          await supabase
            .from("plaid_items")
            .update({ cursor: next_cursor, last_synced_at: new Date().toISOString() })
            .eq("id", item.id);

          cursor = next_cursor;
          hasMore = has_more;
        }
      }

      await fetchData();
    } catch (e) {
      console.error("syncTransactions error:", e);
      Alert.alert("Sync Error", String(e));
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, fetchData]);

  const connectBank = async () => {
    if (!user) return;
    setConnectingBank(true);
    try {
      const res = await fetch(`/token?user_id=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (Platform.OS === "web") {
        setPlaidLinkToken(data.link_token);
      } else {
        // On native (Expo Go): open Plaid hosted link in browser
        // Plaid doesn't support hosted link without OAuth redirect setup,
        // so we show an info alert pointing to dev client
        Alert.alert(
          "Native Bank Connection",
          "Plaid Link requires a custom dev client build (react-native-plaid-link-sdk is not in Expo Go). Switch to the web preview or build a custom dev client via EAS.",
          [{ text: "OK" }]
        );
        setConnectingBank(false);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not get link token");
      setConnectingBank(false);
    }
  };

  const handlePlaidSuccess = async (publicToken: string) => {
    setPlaidLinkToken(null);
    setConnectingBank(true);
    try {
      const res = await fetch("/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken, user_id: user!.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await syncTransactions();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to connect bank");
    } finally {
      setConnectingBank(false);
    }
  };

  const handlePlaidExit = () => {
    setPlaidLinkToken(null);
    setConnectingBank(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalBalance = accounts.reduce((sum, a) => {
    const b = a.balance_current ?? a.balance_available ?? 0;
    return sum + (a.type === "credit" ? -b : b);
  }, 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: "FinanceKit",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Pressable
                onPress={syncTransactions}
                disabled={syncing || plaidItems.length === 0}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={AC.systemBlue as any} />
                ) : (
                  <Text
                    style={{
                      color:
                        plaidItems.length === 0
                          ? (AC.secondaryLabel as any)
                          : (AC.systemBlue as any),
                      fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    Sync
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={signOut}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text
                  style={{
                    color: AC.systemRed as any,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  Sign Out
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Plaid Link (web) */}
      {Platform.OS === "web" && plaidLinkToken && (
        <PlaidLinkWeb
          linkToken={plaidLinkToken}
          onSuccess={handlePlaidSuccess}
          onExit={handlePlaidExit}
        />
      )}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: AC.systemGroupedBackground as any }}
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
      >
        {loading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}
          >
            <ActivityIndicator size="large" color={AC.systemBlue as any} />
          </View>
        ) : (
          <>
            {/* Net Worth Summary */}
            {accounts.length > 0 && (
              <View
                style={{
                  backgroundColor: AC.systemBlue as any,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  padding: 20,
                  gap: 4,
                  boxShadow: "0 4px 20px rgba(0,122,255,0.3)",
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 13,
                    fontWeight: "500",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Net Worth
                </Text>
                <Text
                  selectable
                  style={{
                    color: "white",
                    fontSize: 36,
                    fontWeight: "700",
                    letterSpacing: -1,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  ${totalBalance.toFixed(2)}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""} ·{" "}
                  {transactions.length} transaction
                  {transactions.length !== 1 ? "s" : ""}
                </Text>
              </View>
            )}

            {/* Connect Bank Button */}
            <Pressable
              onPress={connectBank}
              disabled={connectingBank}
              style={({ pressed }) => ({
                backgroundColor: AC.secondarySystemGroupedBackground as any,
                borderRadius: 14,
                borderCurve: "continuous",
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: pressed || connectingBank ? 0.7 : 1,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                borderWidth: 1.5,
                borderColor: AC.systemBlue as any,
                borderStyle: "dashed",
              })}
            >
              {connectingBank ? (
                <ActivityIndicator color={AC.systemBlue as any} />
              ) : (
                <>
                  <Text style={{ fontSize: 20 }}>🏦</Text>
                  <Text
                    style={{
                      color: AC.systemBlue as any,
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    Connect Bank Account
                  </Text>
                </>
              )}
            </Pressable>

            {/* Accounts by bank */}
            {plaidItems.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 40,
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 48 }}>💳</Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: AC.label as any,
                  }}
                >
                  No accounts yet
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: AC.secondaryLabel as any,
                    textAlign: "center",
                    maxWidth: 260,
                    lineHeight: 20,
                  }}
                >
                  Connect a bank account above to see your balances and transactions.
                </Text>
              </View>
            ) : (
              plaidItems.map((item) => {
                const itemAccounts = accounts.filter(
                  (a) => a.plaid_item_id === item.id
                );
                return (
                  <View key={item.id} style={{ gap: 10 }}>
                    <BankHeader item={item} syncing={syncing} onSync={syncTransactions} />
                    {itemAccounts.length === 0 ? (
                      <Text
                        style={{
                          color: AC.secondaryLabel as any,
                          fontSize: 14,
                          paddingLeft: 4,
                        }}
                      >
                        No accounts found. Try syncing.
                      </Text>
                    ) : (
                      itemAccounts.map((account) => (
                        <AccountCard
                          key={account.id}
                          account={account}
                          transactionCount={
                            transactions.filter(
                              (t) => t.account_id === account.id
                            ).length
                          }
                          expanded={expandedIds.has(account.id)}
                          onToggle={() => toggleExpanded(account.id)}
                        />
                      ))
                    )}
                  </View>
                );
              })
            )}

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: AC.label as any,
                  }}
                >
                  Recent Transactions
                </Text>
                {transactions.slice(0, 20).map((tx) => (
                  <View
                    key={tx.id}
                    style={{
                      backgroundColor: AC.secondarySystemGroupedBackground as any,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      padding: 14,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text
                        selectable
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: AC.label as any,
                        }}
                        numberOfLines={1}
                      >
                        {tx.merchant_name ?? tx.name ?? "Transaction"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: AC.secondaryLabel as any,
                        }}
                      >
                        {tx.date}
                        {tx.pending ? " · Pending" : ""}
                      </Text>
                    </View>
                    <Text
                      selectable
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color:
                          tx.amount < 0
                            ? (AC.systemGreen as any)
                            : (AC.label as any),
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {tx.amount < 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
                {transactions.length > 20 && (
                  <Text
                    style={{
                      textAlign: "center",
                      color: AC.secondaryLabel as any,
                      fontSize: 13,
                    }}
                  >
                    +{transactions.length - 20} more transactions
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

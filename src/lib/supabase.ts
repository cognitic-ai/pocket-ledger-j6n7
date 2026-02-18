import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PlaidItem = {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
  institution_id: string | null;
  institution_name: string | null;
  cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  name: string | null;
  official_name: string | null;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  balance_current: number | null;
  balance_available: number | null;
  balance_limit: number | null;
  currency_code: string;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  plaid_transaction_id: string;
  amount: number;
  date: string;
  name: string | null;
  merchant_name: string | null;
  category: string[] | null;
  pending: boolean;
  created_at: string;
};

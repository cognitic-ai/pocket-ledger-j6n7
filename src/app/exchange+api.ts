import { plaidClient } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key (bypasses RLS for inserts)
function getSupabaseAdmin() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { public_token, user_id } = body;

  if (!public_token || !user_id) {
    return Response.json(
      { error: "public_token and user_id are required" },
      { status: 400 }
    );
  }

  try {
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    const { access_token, item_id } = exchangeResponse.data;

    // Get institution info
    let institution_name: string | null = null;
    let institution_id: string | null = null;
    try {
      const itemResponse = await plaidClient.itemGet({ access_token });
      institution_id = itemResponse.data.item.institution_id ?? null;
      if (institution_id) {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id,
          country_codes: ["US"] as any,
        });
        institution_name = instResponse.data.institution.name;
      }
    } catch {
      // Non-fatal - continue without institution name
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Upsert plaid item
    const { error: insertError } = await supabaseAdmin
      .from("plaid_items")
      .upsert(
        {
          user_id,
          item_id,
          access_token,
          institution_id,
          institution_name,
        },
        { onConflict: "item_id" }
      );

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ success: true, item_id });
  } catch (err: any) {
    console.error("Exchange error:", err?.response?.data ?? err);
    return Response.json(
      { error: err?.response?.data?.error_message ?? "Token exchange failed" },
      { status: 500 }
    );
  }
}

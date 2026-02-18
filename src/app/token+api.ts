import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "FinanceKit",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error("Plaid link token error:", err?.response?.data ?? err);
    return Response.json(
      { error: err?.response?.data?.error_message ?? "Failed to create link token" },
      { status: 500 }
    );
  }
}

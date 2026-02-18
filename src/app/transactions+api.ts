import { plaidClient } from "@/lib/plaid";

export async function POST(request: Request) {
  const body = await request.json();
  const { access_token, cursor } = body;

  if (!access_token) {
    return Response.json({ error: "access_token is required" }, { status: 400 });
  }

  try {
    const response = await plaidClient.transactionsSync({
      access_token,
      cursor: cursor ?? undefined,
    });

    return Response.json({
      added: response.data.added,
      modified: response.data.modified,
      removed: response.data.removed,
      accounts: response.data.accounts,
      has_more: response.data.has_more,
      next_cursor: response.data.next_cursor,
    });
  } catch (err: any) {
    console.error("Transactions sync error:", err?.response?.data ?? err);
    return Response.json(
      { error: err?.response?.data?.error_message ?? "Transaction sync failed" },
      { status: 500 }
    );
  }
}

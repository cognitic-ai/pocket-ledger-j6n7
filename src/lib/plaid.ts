import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath:
    process.env.PLAID_SANDBOX === "true"
      ? PlaidEnvironments.sandbox
      : PlaidEnvironments.production,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SANDBOX === "true"
        ? process.env.PLAID_SECRET_SANDBOX
        : process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

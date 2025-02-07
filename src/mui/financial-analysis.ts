import { ZeeWorkflow, TransactionsTool, TokenBalancesTool, Agent } from "@covalenthq/ai-agent-sdk";
import { StateFn } from "@covalenthq/ai-agent-sdk/dist/core/state";
import { user } from "../util/base";

const tools = {
    tokenBalances: new TokenBalancesTool(
        process.env["GOLDRUSH_API_KEY"]
    ),
    transactions: new TransactionsTool(process.env["GOLDRUSH_API_KEY"]),
};

const portfolio_analyst = new Agent({
    name: "portfolio analyst",
    model: {
        provider: "OPEN_AI",
        name: "gpt-4o",
    },
    description:
        "You are a blockchain portfolio analyst that analyzes wallet holdings and provides insights.",
    instructions: [
        "Provide a comprehensive overview of the wallet's portfolio",
    ],
    tools: {
        tokenBalances: tools.tokenBalances,
    },
});

const transaction_analyst = new Agent({
    name: "transaction analyst",
    model: {
        provider: "OPEN_AI",
        name: "gpt-4o-mini",
    },
    description:
        "You are a blockchain transaction analyst that analyzes trading patterns and token price movements.",
    instructions: [
        "Provide a comprehensive overview of the transaction",
    ],
    tools: {
        transactions: tools.transactions,
    },
});

const zee = new ZeeWorkflow({
    description: "Analyze a wallet's blockchain activity",
    output: "A comprehensive report on the wallet's holdings and trading patterns.",
    agents: {
        portfolio_analyst,
        transaction_analyst,
    },
});

const initialState = StateFn.root(zee.description);
initialState.messages.push(
    user(
        "Analyze the wallet address 0x1805707Dd1874C4147BEA492AcE0543b9e7b4dBA on 'base-mainnet' for the last 3 months. Provide a complete analysis of their portfolio and trading activity."
    )
);


(async function main() {
    const result = await ZeeWorkflow.run(zee);
    console.log(result);
})();

// const result = await ZeeWorkflow.run(zee, initialState);

// console.log(result);

// expect(result.messages.length).toBeGreaterThan(0);
// expect(result.status).toEqual("finished");

// const finalMessage = result.messages[result.messages.length - 1];
// expect(finalMessage?.content).toBeDefined();
// console.log("Final Analysis:", finalMessage?.content);
import {
    Agent,
    TokenBalancesTool,
    TransactionsTool,
    Tool,
    ZeeWorkflow,
  } from "@covalenthq/ai-agent-sdk";
  import { user } from "@covalenthq/ai-agent-sdk/dist/core/base";
  import { StateFn } from "@covalenthq/ai-agent-sdk/dist/core/state";
  
  const agent = new Agent({
    model: {
      provider: "OPEN_AI",
      name: "gpt-4o-mini",
    },
    name: "Covalent Agent",
    description:
      "You are a blockchain researcher analyzing wallet activities for the wallet address and chain provided by the user.",
    tools: {
      TokenBalancesTool: new TokenBalancesTool(process.env.GOLDRUSH_API_KEY),
      TransactionsTool: new TransactionsTool(process.env.GOLDRUSH_API_KEY),
    },
  });
  
  const zeeWorflow = new ZeeWorkflow({
    description:
      "Analyze the activities of a wallet that is provided by the user and persist the wallet address and chain in the state",
    output: "Give a summary of the wallet's activities",
    agents: {
      agent,
    },
  });
  
  const main = async () => {
    const initialState = StateFn.root(zeeWorflow.description);
    initialState.messages.push(
      user(
        "Analyze the wallet address '0x1805707Dd1874C4147BEA492AcE0543b9e7b4dBA' on chain 'base-mainnet' for the last year. Provide a complete analysis of their portfolio and trading activity. Persist the wallet address and chain in the state."
      )
    );
  
    const result = await ZeeWorkflow.run(zeeWorflow, initialState);
  
    console.log(result);
  };
  
  main();
  
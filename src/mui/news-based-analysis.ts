
import { z } from "zod";
import { createTool, Agent, ZeeWorkflow } from "@covalenthq/ai-agent-sdk";
const cryptoNewsTool = createTool({
    id: "get-crypto-news",
    description: "This tool is used to get the latest crypto news, for analysis on market trends.",
    schema: z.object({
        news: z.array(z.object({
            title: z.string(),
            url: z.string(),
            source: z.string(),
            published_at: z.string(),
        })),
    }),
    execute: async (params) => {
        try {
            const API_KEY = process.env.CRYPTOPANIC_NEWS_API_KEY;
            const response = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=${API_KEY}&public=true`);
            const data = await response.json();
            const articles = data.results.slice(0, 5);
            const news = articles.map((article: any) => ({
                title: article.title,
                url: article.url,
                source: article.source,
                published_at: article.published_at,
            }));
            return JSON.stringify(news);
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Error fetching news: ${errorMessage}`;
        }
    },
});

const agent = new Agent({
    name: "research agent",
    model: {
        provider: "OPEN_AI",
        name: "gpt-4o-mini",
    },
    description:
        "You are a crypto analyst that analyzes the latest crypto news to provide a comprehensive analysis of the market trends.",
    instructions: ["Use the crypto news tool to get the latest crypto news"],
    tools: {
        cryptoNewsTool,
    },
});

const zee = new ZeeWorkflow({
    description:
        "Analyze the latest crypto news to provide a comprehensive analysis of the market trends.",
    output: "A comprehensive analysis of the market trends.",
    agents: {
        agent,
    },
});

(async function main() {
const result = await ZeeWorkflow.run(zee);
console.log(result);
})();

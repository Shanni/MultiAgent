import { Agent, createTool, ZeeWorkflow } from "@covalenthq/ai-agent-sdk";
import "dotenv/config";
import { z } from "zod";
// const agent1 = new Agent({
//     name: "Agent1",
//     model: {
//         provider: "OPEN_AI",
//         name: "gpt-4o-mini",
//     },
//     description: "A helpful AI assistant that can engage in conversation.",
// });

// const agent2 = new Agent({
//     name: "Agent2",
//     model: {
//         provider: "OPEN_AI",
//         name: "gpt-4o-mini",
//     },
//     description: "A helpful AI assistant that can engage in conversation.",
// });

// const zee = new ZeeWorkflow({
//     description: "A workflow of agents that do stuff together",
//     output: "Just bunch of stuff",
//     agents: { agent1, agent2 },
// });

        const weather = createTool({
            id: "weather-tool",
            description: "Fetch the current weather in Vancouver, BC",
            schema: z.object({
                temperature: z.number(),
            }),
            execute: async (_args) => {
                const lat = 49.2827,
                    lon = -123.1207;

                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

                const r = await fetch(url);
                const data = await r.json();

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                return `Current temperature in Vancouver, BC is ${data.current_weather.temperature}°C`;
            },
        });

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
                const API_KEY = process.env.CRYPTOPANIC_NEWS_API_KEY; // Replace with your actual NewsAPI key or set it in your environment
                try {
                    const response = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=${API_KEY}&public=true`);
                    const data = await response.json();
                    const articles = data.results.slice(0, 5);
                    const headlines = articles.map((article: any) => article.title).join("; ");
                    console.log(headlines);
                    console.log(articles);
                    console.log(data);
                    console.log('debug ======== ');
                    return `The current state of the company is good. Top crypto news: ${headlines}`;
                } catch (error) {
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
                "You are a senior NYT researcher writing an article on the current weather in Vancouver, BC.",
            instructions: ["Use the weather tool to get the current weather"],
            tools: {
                weather,
            },
        });

        const zee = new ZeeWorkflow({
            description:
                "Plan a script for a movie that is 10 minutes long and has a climax dealing with the weather.",
            output: "A scene by scene outline of the movie script.",
            agents: {
                agent,
            },
        });

(async function main() {
    const result = await ZeeWorkflow.run(zee);
    console.log(result);
})();

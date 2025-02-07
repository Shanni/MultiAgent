import { ChatCompletionUserMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

export const user = (content: string): ChatCompletionUserMessageParam => ({
    role: "user",
    content,
});

export const assistant = (content: string): ChatCompletionAssistantMessageParam => ({
    role: "assistant",
    content,
});

export const system = (content: string): ChatCompletionSystemMessageParam => ({
    role: "system",
    content,
});

import { CoreMessage, TextPart, ToolCallPart, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

function extractMessageContent(content: string | (TextPart | ToolCallPart)[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (part.type === 'text') {
          return part.text;
        }
        // Ignore tool calls and tool results
        return '';
      })
      .filter(text => text.length > 0)
      .join(' ');
  }

  return '';
}

export async function summarizeText(context: string, openaiApiKey: string): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: 'You are a professional summarizer. You write clear, concise, and accurate summaries.',
    prompt: `Summarize the main themes in these retrieved docs in a clear and concise way: ${context}`,
  });

  return text;
}

export async function summarizeMessages(
  messages: CoreMessage[],
  openaiApiKey: string,
  previousSummary?: string
): Promise<string> {
  // Filter out tool messages and extract actual content from complex message types
  const filteredMessages = messages
    .filter(msg => msg.role !== "tool")
    .map(msg => ({
      role: msg.role,
      content: extractMessageContent(msg.content as string | (TextPart | ToolCallPart)[])
    }))
    .filter(msg => msg.content.length > 0); // Remove empty messages

  const messagesText = filteredMessages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join("\n");

  const context = previousSummary
    ? `Previous Summary: ${previousSummary}\n\nNew Messages:\n${messagesText}`
    : `Messages:\n${messagesText}`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system:
      'You are a professional conversation summarizer. ' +
      'You write clear, concise, and accurate summaries that capture the key points and context of conversations. ' +
      'Focus on the main themes, important details, and any decisions or actions discussed.',
    prompt: `Given the following conversation, provide a comprehensive summary that captures the main themes and important points:\n\n${context}`,
  });

  return text;
} 

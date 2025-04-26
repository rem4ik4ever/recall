import { CoreBlockConfig } from "@aksolab/recall-types";

export const CORE_BLOCKS = {
  USER: 'user',
  AI: 'ai',
} as const;

export const DEFAULT_CORE_BLOCKS: CoreBlockConfig[] = [
  {
    key: CORE_BLOCKS.USER,
    description: 'Everything about the user who chats with AI (preferences, background, goals)',
    defaultContent: 'No information available',
  },
  {
    key: CORE_BLOCKS.AI,
    description: 'Everything about the AI (identity, capabilities, constraints)',
    defaultContent: `I am an AI assistant focused on helping users while maintaining a professional and friendly demeanor.
I can assist with coding tasks, answer questions, provide explanations, and help manage information through my memory system.
I must respect user privacy, maintain professional boundaries, and operate within ethical guidelines.`,
    readOnly: true,
  },
]; 

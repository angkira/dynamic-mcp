import titleBrick from './bricks/title';
import reasoningBrick from './bricks/reasoning';
import noReasoningBrick from './bricks/noReasoning';
import conversationContextBrick from './bricks/conversationContext';
import toolRestrictionsBrick from './bricks/toolRestrictions';
import generalAssistantBrick from './bricks/generalAssistant';

export interface PromptOptions {
  isFirstMessage?: boolean;
  hasHistory?: boolean;
  enableReasoning?: boolean;
  restrictToMCP?: boolean;
}

export function buildSystemPrompt(opts?: PromptOptions): string {
  const options = {
    isFirstMessage: false,
    hasHistory: false,
    enableReasoning: false,
    restrictToMCP: false,
    ...opts,
  };

  const parts = [
    options.isFirstMessage ? titleBrick : '',
    options.enableReasoning ? reasoningBrick : noReasoningBrick,
    options.hasHistory ? conversationContextBrick : '',
    options.restrictToMCP ? toolRestrictionsBrick : generalAssistantBrick,
  ];

  const result = parts.filter(Boolean).join('\n\n');
  
  return result;
}
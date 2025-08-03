import { buildSystemPrompt } from '../index';

describe('buildSystemPrompt', () => {
  it('should build a prompt for first-message with reasoning and general assistant', () => {
    const prompt = buildSystemPrompt({
      isFirstMessage: true,
      enableReasoning: true,
      restrictToMCP: false,
    });
    expect(prompt).toMatchSnapshot();
  });

  it('should build a prompt for follow-up message with reasoning off and MCP restriction', () => {
    const prompt = buildSystemPrompt({
      isFirstMessage: false,
      hasHistory: true,
      enableReasoning: false,
      restrictToMCP: true,
    });
    expect(prompt).toMatchSnapshot();
  });

  it('should build a prompt for follow-up message with reasoning on and no restriction', () => {
    const prompt = buildSystemPrompt({
      isFirstMessage: false,
      hasHistory: true,
      enableReasoning: true,
      restrictToMCP: false,
    });
    expect(prompt).toMatchSnapshot();
  });
});
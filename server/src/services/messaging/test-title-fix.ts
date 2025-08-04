// Test for the specific title tag issue
import { StreamingPipeline } from './StreamingPipeline';
import { ServerWebSocketEvent } from '@shared/types';

// Mock stream function to capture events
const mockEvents: { type: ServerWebSocketEvent; data: any }[] = [];
const mockStream = (type: ServerWebSocketEvent, data: any) => {
  mockEvents.push({ type, data });
  console.log(`Event: ${type}`, data);
};

// Test the specific case from the bug report
console.log('\n=== Test: Title with immediate content after ===');
const pipeline = new StreamingPipeline(mockStream, 98, false);

// This is the exact content that was causing the issue
const problematicContent = '<title>Server Tools Inquiry</title>\nI can\'t list the tools without knowing which server you are referring to. Please specify the server ID or name.';

pipeline.processTextChunk(problematicContent);
const results = pipeline.finalize();

console.log('\n=== Results ===');
console.log('Full response:', results.fullResponse);
console.log('Title:', results.title);
console.log('Thoughts:', results.thoughts);

console.log('\n=== All Events ===');
mockEvents.forEach((event, index) => {
  console.log(`${index + 1}. ${event.type}:`, event.data);
});

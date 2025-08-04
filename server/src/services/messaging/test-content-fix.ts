// Test for the content saving issue
import { StreamingPipeline } from './StreamingPipeline';
import { ServerWebSocketEvent } from '@shared/types';

// Mock stream function to capture events
const mockEvents: { type: ServerWebSocketEvent; data: any }[] = [];
const mockStream = (type: ServerWebSocketEvent, data: any) => {
  mockEvents.push({ type, data });
  console.log(`Event: ${type}`, data);
};

// Test the specific case from the bug report
console.log('\n=== Test: Content with title should only save streamed content ===');
const pipeline = new StreamingPipeline(mockStream, 98, false);

// This is the exact content that was causing the issue
const problematicContent = '<title>Server Tools Inquiry</title>\nI can\'t list the tools without knowing which server you are referring to. Please specify the server ID or name.';

console.log('Processing content:', problematicContent);
pipeline.processTextChunk(problematicContent);
console.log('Finalizing...');
const results = pipeline.finalize();

console.log('\n=== Results ===');
console.log('Full response (should only contain streamed content):', results.fullResponse);
console.log('Title:', results.title);

console.log('\n=== Streamed Events ===');
mockEvents.forEach((event, index) => {
  console.log(`${index + 1}. ${event.type}:`, event.data);
});

// Verify the fix
console.log('\n=== Verification ===');
const expectedStreamedContent = '\nI can\'t list the tools without knowing which server you are referring to. Please specify the server ID or name.';
const actualStreamedContent = results.fullResponse;

if (actualStreamedContent === expectedStreamedContent) {
  console.log('✅ PASS: fullResponse contains only streamed content');
} else {
  console.log('❌ FAIL: fullResponse contains unexpected content');
  console.log('Expected:', JSON.stringify(expectedStreamedContent));
  console.log('Actual:', JSON.stringify(actualStreamedContent));
}

if (results.title === 'Server Tools Inquiry') {
  console.log('✅ PASS: Title extracted correctly');
} else {
  console.log('❌ FAIL: Title not extracted correctly. Got:', results.title);
}

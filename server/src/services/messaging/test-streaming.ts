// Quick test for StreamingPipeline improvements
import { StreamingPipeline } from './StreamingPipeline';
import { ServerWebSocketEvent } from '@shared/types';

// Mock stream function to capture events
const mockEvents: { type: ServerWebSocketEvent; data: any }[] = [];
const mockStream = (type: ServerWebSocketEvent, data: any) => {
  mockEvents.push({ type, data });
  console.log(`Event: ${type}`, data);
};

// Test streaming pipeline
const pipeline = new StreamingPipeline(mockStream, 1, false);

// Test case 1: Title with XML tags should be cleaned
console.log('\n=== Test 1: Title Cleaning ===');
pipeline.processTextChunk('<title>Chat about Programming</title>');
pipeline.flush();

// Test case 2: 2-word incremental streaming
console.log('\n=== Test 2: 2-Word Incremental Streaming ===');
const pipeline2 = new StreamingPipeline(mockStream, 2, false);
pipeline2.processTextChunk('Hello world this is a test message ');
pipeline2.flush();

// Test case 3: Thought content separation
console.log('\n=== Test 3: Thought Content ===');
const pipeline3 = new StreamingPipeline(mockStream, 3, false);
pipeline3.processTextChunk('<thought>I need to think about this problem step by step</thought>');
pipeline3.processTextChunk('Here is my answer to your question ');
pipeline3.flush();

console.log('\n=== All Events ===');
mockEvents.forEach((event, index) => {
  console.log(`${index + 1}. ${event.type}:`, event.data);
});

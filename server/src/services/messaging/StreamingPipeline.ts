import { ServerWebSocketEvent } from '@shared/types';

enum ContentType {
  REGULAR = 'regular',
  THOUGHT = 'thought',
  TITLE = 'title'
}

export interface StreamingResults {
  fullResponse: string;
  thoughts: string[];
  title?: string;
}

export class StreamingPipeline {
  private regularBuffer = '';
  private thoughtBuffer = '';
  private titleBuffer = '';
  private currentType = ContentType.REGULAR;
  private fullResponse = '';
  private thoughts: string[] = [];
  private title?: string;
  private rawBuffer = '';
  private currentThoughtAccumulator = '';
  
  private readonly TAG_REGEX = /(<\/?(?:title|thoughts?)>)/gi;

  constructor(
    private stream: (type: ServerWebSocketEvent, data: any) => void,
    private chatId: number,
    private isThinking: boolean = false
  ) {}

  public processTextChunk(chunk: string): void {
    this.fullResponse += chunk;
    this.rawBuffer += chunk;
    
    // Process the buffer looking for complete tags
    let processedUpTo = 0;
    
    while (processedUpTo < this.rawBuffer.length) {
      // Look for the next tag
      const remaining = this.rawBuffer.slice(processedUpTo);
      const tagMatch = remaining.match(/^(.*?)(<\/?(?:title|thoughts?)>)(.*)/is);
      
      if (tagMatch && tagMatch[1] !== undefined && tagMatch[2] !== undefined) {
        const beforeTag = tagMatch[1];
        const tag = tagMatch[2];
        const afterTag = tagMatch[3] || '';
        
        // Process content before the tag
        if (beforeTag) {
          for (const char of beforeTag) {
            this.addCharToCurrentBuffer(char);
          }
        }
        
        // Handle the tag
        this.handleTag(tag);
        
        // Move past the processed content
        processedUpTo += beforeTag.length + tag.length;
        
        // If there's content after the tag, we'll process it in the next iteration
        if (afterTag) {
          // Continue processing remaining content
          continue;
        }
      } else {
        // No complete tag found in remaining content
        // Check if we might have a partial tag at the end
        const partialTagMatch = remaining.match(/<\/?(?:title|thoughts?)?$/i);
        
        if (partialTagMatch && partialTagMatch.index !== undefined) {
          // We have a partial tag at the end, process everything before it
          const beforePartial = remaining.slice(0, partialTagMatch.index);
          for (const char of beforePartial) {
            this.addCharToCurrentBuffer(char);
          }
          processedUpTo += beforePartial.length;
          break; // Keep the partial tag in buffer for next chunk
        } else {
          // No tags, process all remaining content
          for (const char of remaining) {
            this.addCharToCurrentBuffer(char);
          }
          processedUpTo = this.rawBuffer.length;
        }
      }
    }
    
    // Keep only unprocessed content in the buffer
    this.rawBuffer = this.rawBuffer.slice(processedUpTo);
  }

  private isTag(text: string): boolean {
    // This method is no longer central to the parsing logic but can be kept for utility.
    return this.TAG_REGEX.test(text);
  }

  private handleTag(tag: string): void {
    console.debug(` Detected tag: "${tag}", switching from ${this.currentType}`);
    this.flushCurrentBuffer();
    const lowerTag = tag.toLowerCase();

    if (lowerTag === '<title>') {
      this.currentType = ContentType.TITLE;
      console.log('[DEBUG] Switched to TITLE mode');
    } else if (lowerTag === '</title>') {
      this.flushTitle();
      this.currentType = ContentType.REGULAR;
      console.log('[DEBUG] Switched back to REGULAR mode after title');
    } else if (lowerTag === '<thought>' || lowerTag === '<thoughts>') {
      this.currentType = ContentType.THOUGHT;
      this.currentThoughtAccumulator = '';
      console.log('[DEBUG] Switched to THOUGHT mode');
    } else if (lowerTag === '</thought>' || lowerTag === '</thoughts>') {
      this.flushThoughts();
      this.currentType = ContentType.REGULAR;
      console.log('[DEBUG] Switched back to REGULAR mode after thought');
    }
  }

  private addCharToCurrentBuffer(char: string): void {
    switch (this.currentType) {
      case ContentType.TITLE:
        this.titleBuffer += char;
        break;
      case ContentType.THOUGHT:
        this.thoughtBuffer += char;
        this.currentThoughtAccumulator += char;
        // For thoughts, flush more aggressively to get better streaming
        if (this.shouldFlushBuffer(this.thoughtBuffer)) {
          this.flushThoughtContent();
        }
        break;
      case ContentType.REGULAR:
        this.regularBuffer += char;
        // For regular content, check for word boundary completion
        if (this.shouldFlushBuffer(this.regularBuffer)) {
          this.flushRegularContent();
        }
        break;
    }
  }

  private shouldFlushBuffer(buffer: string): boolean {
    // Only flush when we have complete words (ending with whitespace)
    const trimmed = buffer.trim();
    if (trimmed.length === 0) return false;
    
    // Check if we just completed a word (current character is whitespace after text)
    const words = trimmed.split(/\s+/).filter(word => word.length > 0);
    const endsWithWhitespace = buffer !== trimmed; // Buffer has trailing whitespace
    
    // Flush every 2 complete words
    return words.length >= 2 && endsWithWhitespace;
  }

  private checkAndFlushBuffers(): void {
    // Deprecated: Flushing is now handled in addToCurrentBuffer and handleTag
  }

  private shouldFlush(buffer: string): boolean {
    // Deprecated: We will flush content more directly.
    return buffer.trim().length > 0;
  }

  private flushCurrentBuffer(): void {
    switch (this.currentType) {
      case ContentType.REGULAR:
        this.flushRegularContent();
        break;
      case ContentType.THOUGHT:
        this.flushThoughtContent();
        break;
      case ContentType.TITLE:
        break;
    }
  }

  private flushRegularContent(): void {
    if (this.regularBuffer.trim()) {
      console.debug(` Flushing regular content: "${this.regularBuffer}" (${this.regularBuffer.trim().split(/\s+/).length} words)`);
      this.stream(ServerWebSocketEvent.MessageChunk, {
        content: this.regularBuffer,
        chatId: this.chatId,
      });
      this.regularBuffer = '';
    }
  }

  private flushThoughtContent(): void {
    if (this.thoughtBuffer) {
      console.debug(` Flushing thought content: "${this.thoughtBuffer}" (${this.thoughtBuffer.split(/\s+/).length} words)`);
      this.stream(ServerWebSocketEvent.Reasoning, {
        content: this.thoughtBuffer,
        chatId: this.chatId,
      });
      this.thoughtBuffer = '';
    }
  }

  private flushTitle(): void {
    if (this.titleBuffer.trim()) {
      // Remove XML tags from title
      this.title = this.titleBuffer.trim().replace(/<\/?title>/gi, '');
      
      this.stream(ServerWebSocketEvent.Title, {
        title: this.title,
        chatId: this.chatId,
      });
      this.titleBuffer = '';
    }
  }

  private flushThoughts(): void {
    this.flushThoughtContent(); // Flush any remaining thought content
    if (this.currentThoughtAccumulator.trim()) {
      this.thoughts.push(this.currentThoughtAccumulator.trim());
    }
    this.currentThoughtAccumulator = '';
  }

  public flush(): void {
    this.flushRegularContent();
    this.flushThoughtContent();
    this.flushTitle();
  }

  public finalize(): StreamingResults {
    // Add any remaining text from the raw buffer to the correct content buffer
    if (this.rawBuffer) {
      console.debug(` Processing remaining rawBuffer: "${this.rawBuffer}"`);
      for (const char of this.rawBuffer) {
        this.addCharToCurrentBuffer(char);
      }
      this.rawBuffer = '';
    }
    
    // If we're still in THOUGHT or TITLE mode at the end, we need to close them
    if (this.currentType === ContentType.THOUGHT) {
      console.debug(` Stream ended while in THOUGHT mode, closing thought`);
      this.flushThoughts(); // This will flush thought content and add to thoughts array
      this.currentType = ContentType.REGULAR;
    } else if (this.currentType === ContentType.TITLE) {
      console.debug(` Stream ended while in TITLE mode, closing title`);
      this.flushTitle();
      this.currentType = ContentType.REGULAR;
    }
    
    this.flush();
    
    console.debug(` Finalization complete. Thoughts: ${this.thoughts.length}, Title: ${this.title || 'none'}`);

    return {
      fullResponse: this.fullResponse,
      thoughts: this.thoughts,
      title: this.title
    };
  }
}

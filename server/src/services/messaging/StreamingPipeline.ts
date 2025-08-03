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
  
  private readonly TAG_REGEX = /(<\/?(?:title|thought|thoughts)>)/gi;

  constructor(
    private stream: (type: ServerWebSocketEvent, data: any) => void,
    private chatId: number,
    private isThinking: boolean = false
  ) {}

  public processTextChunk(chunk: string): void {
    this.fullResponse += chunk;
    
    // Process each character to catch tags immediately and stream incrementally
    for (const char of chunk) {
      // Check if we're starting a tag
      const potentialTag = this.rawBuffer + char;
      const tagMatch = potentialTag.match(/(<\/?(?:title|thought|thoughts)>)$/i);
      
      if (tagMatch) {
        // We found a complete tag, handle it
        this.handleTag(tagMatch[1]);
        this.rawBuffer = '';
      } else if (potentialTag.match(/<\/?(?:title|thought|thoughts)$/i)) {
        // We're in the middle of a tag, keep building
        this.rawBuffer += char;
      } else {
        // Regular character or not a tag
        if (this.rawBuffer) {
          // Add any buffered characters first
          for (const bufferedChar of this.rawBuffer) {
            this.addCharToCurrentBuffer(bufferedChar);
          }
          this.rawBuffer = '';
        }
        this.addCharToCurrentBuffer(char);
      }
    }
  }

  private isTag(text: string): boolean {
    // This method is no longer central to the parsing logic but can be kept for utility.
    return this.TAG_REGEX.test(text);
  }

  private handleTag(tag: string): void {
    this.flushCurrentBuffer();
    const lowerTag = tag.toLowerCase();

    if (lowerTag === '<title>') {
      this.currentType = ContentType.TITLE;
    } else if (lowerTag === '</title>') {
      this.flushTitle();
      this.currentType = ContentType.REGULAR;
    } else if (lowerTag === '<thought>') {
      this.currentType = ContentType.THOUGHT;
      this.currentThoughtAccumulator = '';
    } else if (lowerTag === '</thought>') {
      this.flushThoughts();
      this.currentType = ContentType.REGULAR;
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
      console.log(`[DEBUG] Flushing regular content: "${this.regularBuffer}" (${this.regularBuffer.trim().split(/\s+/).length} words)`);
      this.stream(ServerWebSocketEvent.MessageChunk, {
        content: this.regularBuffer,
        chatId: this.chatId,
      });
      this.regularBuffer = '';
    }
  }

  private flushThoughtContent(): void {
    if (this.thoughtBuffer) {
      console.log(`[DEBUG] Flushing thought content: "${this.thoughtBuffer}" (${this.thoughtBuffer.trim().split(/\s+/).length} words)`);
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
      for (const char of this.rawBuffer) {
        this.addCharToCurrentBuffer(char);
      }
      this.rawBuffer = '';
    }
    this.flush();

    return {
      fullResponse: this.fullResponse,
      thoughts: this.thoughts,
      title: this.title
    };
  }
}

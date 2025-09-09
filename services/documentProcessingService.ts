import type { KnowledgeDocument } from '../types';

// PDF parsing using browser-based pdf-lib (client-side)
export class DocumentProcessingService {
  
  /**
   * Process uploaded file and convert to KnowledgeDocument
   */
  static async processFile(file: File, profileId: string): Promise<KnowledgeDocument> {
    const docId = `${profileId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let content: string;
    let type: KnowledgeDocument['type'];
    let metadata: KnowledgeDocument['metadata'] = {};

    switch (file.type) {
      case 'application/pdf':
        content = await this.parsePDF(file);
        type = 'pdf';
        metadata.pages = await this.getPDFPageCount(file);
        break;
      
      case 'text/markdown':
      case 'text/x-markdown':
        content = await this.parseTextFile(file);
        type = 'markdown';
        break;
      
      case 'text/plain':
        content = await this.parseTextFile(file);
        type = 'text';
        break;
      
      default:
        // Try to parse as text if it's a readable file
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          content = await this.parseTextFile(file);
          type = 'markdown';
        } else {
          throw new Error(`Unsupported file type: ${file.type}. Supported types: PDF, Markdown (.md), Text (.txt)`);
        }
    }

    // Clean and optimize content for AI consumption
    content = this.cleanContentForAI(content);

    return {
      id: docId,
      name: file.name,
      type,
      content,
      uploadDate: Date.now(),
      size: content.length,
      metadata
    };
  }

  /**
   * Parse PDF file using client-side PDF.js
   */
  private static async parsePDF(file: File): Promise<string> {
    try {
      // Use PDF.js library for client-side PDF parsing
      const pdfjsLib = await this.loadPDFJS();
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();
        
        if (pageText) {
          fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
        }
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF. Please ensure the PDF is not password protected or corrupted.');
    }
  }

  /**
   * Get PDF page count
   */
  private static async getPDFPageCount(file: File): Promise<number> {
    try {
      const pdfjsLib = await this.loadPDFJS();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch {
      return 0;
    }
  }

  /**
   * Load PDF.js library dynamically
   */
  private static async loadPDFJS() {
    // Check if PDF.js is already loaded
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }

    // Load PDF.js from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Configure PDF.js properly to avoid font warnings
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Set standard font data URL to avoid font warnings
        (window as any).pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/';
        
        resolve((window as any).pdfjsLib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Parse text-based files (markdown, txt)
   */
  private static async parseTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Process Google Docs URL and extract content
   */
  static async processGoogleDocsUrl(url: string, profileId: string): Promise<KnowledgeDocument> {
    try {
      // Convert Google Docs URL to export format
      const exportUrl = this.convertGoogleDocsUrl(url);
      
      const response = await fetch(exportUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch Google Docs content. Make sure the document is publicly accessible.');
      }
      
      const content = await response.text();
      const cleanedContent = this.cleanContentForAI(content);
      
      const docId = `${profileId}-gdoc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        id: docId,
        name: this.extractTitleFromGoogleDocsUrl(url),
        type: 'googledoc',
        content: cleanedContent,
        originalUrl: url,
        uploadDate: Date.now(),
        size: cleanedContent.length,
        metadata: {
          title: this.extractTitleFromGoogleDocsUrl(url)
        }
      };
    } catch (error) {
      console.error('Google Docs processing error:', error);
      throw new Error('Failed to process Google Docs URL. Please ensure the document is publicly accessible and the URL is correct.');
    }
  }

  /**
   * Convert Google Docs sharing URL to export URL
   */
  private static convertGoogleDocsUrl(url: string): string {
    // Extract document ID from various Google Docs URL formats
    const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (!docIdMatch) {
      throw new Error('Invalid Google Docs URL format');
    }
    
    const docId = docIdMatch[1];
    // Export as plain text
    return `https://docs.google.com/document/d/${docId}/export?format=txt`;
  }

  /**
   * Extract title from Google Docs URL
   */
  private static extractTitleFromGoogleDocsUrl(url: string): string {
    // Try to extract title from URL if present, otherwise use generic name
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Look for title in path
    const titleMatch = pathname.match(/\/document\/d\/[^/]+\/([^/]+)/);
    if (titleMatch) {
      return decodeURIComponent(titleMatch[1]).replace(/[_-]/g, ' ');
    }
    
    return 'Google Docs Document';
  }

  /**
   * Clean and optimize content for AI consumption
   */
  private static cleanContentForAI(content: string): string {
    return content
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove multiple consecutive line breaks
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Remove special characters that might interfere with AI processing
      .replace(/[^\x00-\x7F\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF]/g, '')
      // Trim whitespace
      .trim();
  }

  /**
   * Validate file before processing
   */
  static validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/x-markdown'
    ];
    
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 50MB'
      };
    }
    
    const isAllowedType = allowedTypes.includes(file.type) || 
                         file.name.endsWith('.md') || 
                         file.name.endsWith('.markdown') ||
                         file.name.endsWith('.txt');
    
    if (!isAllowedType) {
      return {
        isValid: false,
        error: 'Supported file types: PDF, Markdown (.md), Text (.txt)'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Get total content from all knowledge documents
   */
  static combineKnowledgeContent(documents: KnowledgeDocument[], legacyText?: string): string {
    let combinedContent = '';
    
    // Add legacy text first if present
    if (legacyText && legacyText.trim()) {
      combinedContent += legacyText.trim() + '\n\n';
    }
    
    // Add all document contents
    documents.forEach((doc, index) => {
      combinedContent += `--- ${doc.name} (${doc.type.toUpperCase()}) ---\n`;
      combinedContent += doc.content.trim() + '\n\n';
    });
    
    return combinedContent.trim();
  }
}
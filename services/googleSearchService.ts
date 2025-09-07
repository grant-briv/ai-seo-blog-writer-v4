import type { ExternalLinkSuggestion, GoogleSearchConfig } from '../types';

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  formattedUrl: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

export class GoogleSearchService {
  private baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';

  public isConfigured(config?: GoogleSearchConfig): boolean {
    if (!config) return false;
    return !!(config.apiKey && config.searchEngineId && config.isEnabled);
  }

  public async searchWeb(
    query: string, 
    config: GoogleSearchConfig,
    options: {
      num?: number;
      start?: number;
      siteSearch?: string;
      dateRestrict?: string;
      fileType?: string;
    } = {}
  ): Promise<GoogleSearchResult[]> {
    if (!this.isConfigured(config)) {
      throw new Error('Google Search API not configured. Please set API key and Search Engine ID.');
    }

    const params = new URLSearchParams({
      key: config.apiKey,
      cx: config.searchEngineId,
      q: query,
      num: String(options.num || 10),
      start: String(options.start || 1),
    });

    if (options.siteSearch) {
      params.append('siteSearch', options.siteSearch);
    }
    if (options.dateRestrict) {
      params.append('dateRestrict', options.dateRestrict);
    }
    if (options.fileType) {
      params.append('fileType', options.fileType);
    }

    try {
      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Search API error: ${errorData.error?.message || response.statusText}`);
      }

      const data: GoogleSearchResponse = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Google Search API error:', error);
      throw error;
    }
  }

  /**
   * Find authoritative external links for given topics and match them with blog content
   */
  public async findAuthoritativeLinks(
    topics: string[],
    config: GoogleSearchConfig,
    excludeDomains: string[] = [],
    blogContent?: string
  ): Promise<ExternalLinkSuggestion[]> {
    if (!this.isConfigured(config)) {
      throw new Error('Google Search API not configured');
    }

    // High-authority domains to prioritize
    const authorityDomains = [
      // Government and educational
      '.gov', '.edu',
      // Major news and finance
      'reuters.com', 'bloomberg.com', 'wsj.com', 'forbes.com', 'fortune.com',
      'cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com', 'economist.com',
      // Research and academic
      'ncbi.nlm.nih.gov', 'nature.com', 'science.org', 'sciencedirect.com',
      'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov',
      // Finance specific
      'investopedia.com', 'nerdwallet.com', 'bankrate.com', 'morningstar.com',
      'sec.gov', 'federalreserve.gov', 'marketwatch.com',
      // Real estate specific
      'nar.realtor', 'realtor.com', 'zillow.com', 'housingwire.com',
      // Health authorities
      'mayoclinic.org', 'webmd.com', 'healthline.com', 'who.int',
      // Major organizations
      'mckinsey.com', 'deloitte.com', 'pwc.com', 'bcg.com'
    ];

    const suggestions: ExternalLinkSuggestion[] = [];

    // Limit topics to avoid rate limits (paid tier should handle this, but let's be conservative)
    const limitedTopics = topics.slice(0, 4);

    for (const topic of limitedTopics) {
      try {
        // Search for recent content from the sites configured in your Custom Search Engine
        const searches = [
          // Use broader queries since your CSE is already limited to specific sites
          `${topic}`,
          // Try to get variety from different configured sites
          `${topic} agent tips`,
          `${topic} real estate marketing`
        ];

        for (const searchQuery of searches) {
          try {
            console.log(`🔍 Searching for: "${searchQuery}"`);
            const results = await this.searchWeb(searchQuery, config, {
              num: 5,
              dateRestrict: 'y3' // Last 3 years
            });
            
            console.log(`📊 Found ${results.length} results for "${searchQuery}"`);
            if (results.length > 0) {
              console.log('Sample results:', results.map(r => ({ title: r.title, domain: r.displayLink })));
            }

            for (const result of results) {
              // Since your Custom Search Engine is already configured with specific real estate sites,
              // we don't need to filter by authority - all results should be from your approved sites
              
              // Check if domain should be excluded (basic exclusion only)
              const isExcluded = excludeDomains.some(domain => 
                result.displayLink.toLowerCase().includes(domain.toLowerCase())
              );

              if (!isExcluded) {
                // If blog content is provided, find the best anchor text from the blog content
                // Otherwise fall back to extracting from external title
                let anchorText: string;
                let context: string;
                
                if (blogContent) {
                  const contentMatch = this.findBestContentMatch(blogContent, result, topic);
                  if (contentMatch) {
                    anchorText = contentMatch.anchorText;
                    context = contentMatch.context;
                  } else {
                    // Fallback to title-based anchor text
                    anchorText = this.extractAnchorText(result.title);
                    context = `According to research on ${topic.toLowerCase()}, ${result.snippet.substring(0, 100)}...`;
                  }
                } else {
                  // No blog content provided, use title-based anchor text
                  anchorText = this.extractAnchorText(result.title);
                  context = `According to research on ${topic.toLowerCase()}, ${result.snippet.substring(0, 100)}...`;
                }
                
                console.log(`✅ Adding result: ${result.title} from ${result.displayLink}`);
                console.log(`   Anchor text: "${anchorText}"`);
                
                suggestions.push({
                  url: result.link,
                  anchorText,
                  context,
                  title: result.title,
                  domain: result.displayLink,
                  snippet: result.snippet
                });

                // Limit results per topic
                if (suggestions.length >= 10) break;
              } else {
                console.log(`❌ Excluding result from ${result.displayLink} (in exclusion list)`);
              }
            }
            
            // Longer delay for paid tier rate limiting
            await new Promise(resolve => setTimeout(resolve, 250));
            
          } catch (searchError) {
            console.warn(`Failed to search for topic "${topic}":`, searchError);
            // If it's a rate limit error, break out of the search loop entirely
            if (searchError instanceof Error && searchError.message.includes('429')) {
              console.warn('Rate limit reached, stopping further searches for this topic');
              break;
            }
            continue;
          }
        }
      } catch (error) {
        console.warn(`Failed to search for topic "${topic}":`, error);
        continue;
      }
      
      // Small delay between topics to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Remove duplicates and return top results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.url === suggestion.url)
    );

    return uniqueSuggestions.slice(0, 8); // Return top 8 suggestions
  }

  /**
   * Find the best anchor text and context from blog content that matches the external link topic
   */
  private findBestContentMatch(
    blogContent: string, 
    searchResult: { title: string; snippet: string; displayLink: string }, 
    topic: string
  ): { anchorText: string; context: string } | null {
    // Remove heading tags (H1, H2, H3, H4) and their content first, then remove all other HTML tags
    const contentWithoutHeadings = blogContent.replace(/<h[1-4][^>]*>.*?<\/h[1-4]>/gi, ' ');
    const plainText = contentWithoutHeadings.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // Split into sentences, filtering out very short ones
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Extract keywords from the search result and topic
    const keywords = [
      topic.toLowerCase(),
      ...searchResult.title.toLowerCase().split(/\s+/).filter(word => word.length > 3),
      ...searchResult.snippet.toLowerCase().split(/\s+/).filter(word => word.length > 4)
    ];
    
    // Remove common words
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
    const relevantKeywords = keywords.filter(word => !stopWords.includes(word) && word.length > 2);
    
    let bestMatch: { sentence: string; score: number; anchorText: string } | null = null;
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase().trim();
      
      // Skip sentences that are too short or too long
      if (sentence.length < 30 || sentence.length > 300) continue;
      
      let score = 0;
      let potentialAnchors: string[] = [];
      
      // Score based on keyword matches and find potential anchor phrases
      for (const keyword of relevantKeywords) {
        if (lowerSentence.includes(keyword)) {
          score += keyword.length > 5 ? 3 : 2; // Longer keywords get higher scores
          
          // Find phrases around this keyword that could be good anchor text
          const keywordIndex = lowerSentence.indexOf(keyword);
          if (keywordIndex !== -1) {
            // Extract 2-5 word phrases containing the keyword
            const words = sentence.split(/\s+/);
            for (let i = 0; i < words.length; i++) {
              if (words[i].toLowerCase().includes(keyword)) {
                // Try different phrase lengths
                for (let len = 2; len <= Math.min(5, words.length - i); len++) {
                  const phrase = words.slice(i, i + len).join(' ');
                  if (phrase.length > 10 && phrase.length < 80) {
                    potentialAnchors.push(phrase.trim().replace(/[,.;:!?]$/, ''));
                  }
                }
              }
            }
          }
        }
      }
      
      // Bonus for sentences with multiple relevant terms
      if (score >= 4) score += 2;
      
      // Prefer sentences with good structure (not lists, headings, etc.)
      if (!lowerSentence.match(/^\s*[-•*]\s/) && !lowerSentence.match(/^\s*\d+\.\s/)) {
        score += 1;
      }
      
      // Find the best anchor text for this sentence
      let bestAnchor = '';
      if (potentialAnchors.length > 0) {
        // Prefer phrases that are more specific and relevant
        bestAnchor = potentialAnchors.reduce((best, current) => {
          if (!best) return current;
          
          // Prefer phrases with more relevant keywords
          const currentScore = relevantKeywords.reduce((acc, keyword) => 
            current.toLowerCase().includes(keyword) ? acc + 1 : acc, 0);
          const bestScore = relevantKeywords.reduce((acc, keyword) => 
            best.toLowerCase().includes(keyword) ? acc + 1 : acc, 0);
          
          if (currentScore > bestScore) return current;
          if (currentScore === bestScore && current.length > best.length && current.length < 60) return current;
          return best;
        });
      }
      
      // If no good anchor found, try to extract a reasonable phrase from the sentence
      if (!bestAnchor && score > 0) {
        // Look for noun phrases or key terms
        const nounPhrases = sentence.match(/\b[A-Z][a-z]+(?:\s+[a-z]+){1,3}\b/g) || [];
        if (nounPhrases.length > 0) {
          bestAnchor = nounPhrases[0];
        } else {
          // Fall back to first few words that contain relevant terms
          const words = sentence.split(/\s+/);
          for (let i = 0; i < Math.min(words.length - 1, 6); i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (relevantKeywords.some(keyword => phrase.toLowerCase().includes(keyword))) {
              bestAnchor = phrase.replace(/[,.;:!?]$/, '');
              break;
            }
          }
        }
      }
      
      if (score > 0 && bestAnchor && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { 
          sentence: sentence.trim(), 
          score, 
          anchorText: bestAnchor.trim()
        };
      }
    }
    
    if (bestMatch && bestMatch.anchorText) {
      return { 
        anchorText: bestMatch.anchorText, 
        context: bestMatch.sentence 
      };
    }
    
    return null;
  }

  private extractAnchorText(title: string): string {
    // Clean up the title to create good anchor text
    let anchor = title
      .replace(/^\w+\s*[-–—]\s*/, '') // Remove "Site Name - " prefix
      .replace(/\s*[-–—]\s*\w+$/, '') // Remove " - Site Name" suffix
      .replace(/[|•]/g, '-') // Replace pipes and bullets
      .trim();

    // Limit length for readability
    if (anchor.length > 60) {
      const sentences = anchor.split(/[.!?]/);
      anchor = sentences[0].trim();
      if (anchor.length > 60) {
        anchor = anchor.substring(0, 57) + '...';
      }
    }

    return anchor || title.substring(0, 50);
  }

  /**
   * Verify if a URL is accessible (basic check)
   */
  public async verifyUrl(url: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Basic URL validation
      new URL(url);
      
      // In a real implementation, you might want to check if URL is accessible
      // For now, we'll do basic validation
      const domain = new URL(url).hostname;
      
      // Check against known problematic patterns
      const problematicPatterns = [
        'localhost', '127.0.0.1', '0.0.0.0',
        'example.com', 'test.com', 'placeholder'
      ];
      
      if (problematicPatterns.some(pattern => domain.includes(pattern))) {
        return { isValid: false, error: 'Suspicious or test domain' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }
}

// Singleton instance
export const googleSearchService = new GoogleSearchService();
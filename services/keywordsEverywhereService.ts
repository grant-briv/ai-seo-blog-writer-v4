export interface KeywordData {
  keyword: string;
  vol: number | null; // Monthly search volume
  cpc: number | null; // Cost per click (optional)
  competition: number | null; // Competition level (0-1)
  trend: number[] | null; // 12-month trend data
}

export interface KeywordResearchResult {
  seed_keyword: string;
  keywords: KeywordData[];
  related_keywords: KeywordData[];
  questions: KeywordData[];
  total_results: number;
}

export interface KeywordsEverywhereConfig {
  apiKey: string;
  isEnabled: boolean;
}

export class KeywordsEverywhereService {
  private baseUrl = 'https://api.keywordseverywhere.com/v1';
  
  public isConfigured(config?: KeywordsEverywhereConfig): boolean {
    if (!config) return false;
    return !!(config.apiKey && config.isEnabled);
  }

  /**
   * Get keyword data including volume, CPC, and competition
   */
  public async getKeywordData(
    keywords: string[],
    config: KeywordsEverywhereConfig,
    country: string = 'US',
    currency: string = 'USD'
  ): Promise<KeywordData[]> {
    if (!this.isConfigured(config)) {
      throw new Error('Keywords Everywhere API not configured. Please set API key in settings.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/get_keyword_data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kw: keywords,
          country: country,
          currency: currency,
          dataSource: 'gkp', // Google Keyword Planner
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Handle specific HTTP status codes
        if (response.status === 402) {
          errorMessage = 'Payment Required: Your Keywords Everywhere account may be out of credits or your subscription may have expired. Please check your account balance at keywordseverywhere.com';
        } else if (response.status === 401) {
          errorMessage = 'Invalid API key. Please verify your Keywords Everywhere API key is correct';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait before making another request';
        }
        
        // Try to get more specific error from response body
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `${errorMessage}. Details: ${errorData.error}`;
          }
        } catch (parseError) {
          // Response might not be JSON (could be HTML error page)
          const textResponse = await response.text();
          if (textResponse.includes('<html>') || textResponse.includes('<!DOCTYPE')) {
            errorMessage = `${errorMessage}. Server returned an HTML error page instead of JSON. This often indicates an API endpoint issue or invalid API key.`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Keywords Everywhere API error:', error);
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Unknown error occurred while connecting to Keywords Everywhere API');
      }
    }
  }

  /**
   * Get related keywords for a seed keyword
   * Note: Since Keywords Everywhere API may not have a dedicated related keywords endpoint,
   * we'll use the keyword data endpoint and generate variations
   */
  public async getRelatedKeywords(
    seedKeyword: string,
    config: KeywordsEverywhereConfig,
    country: string = 'US',
    limit: number = 100
  ): Promise<KeywordResearchResult> {
    if (!this.isConfigured(config)) {
      throw new Error('Keywords Everywhere API not configured. Please set API key in settings.');
    }

    try {
      // Generate keyword variations for research
      const keywordVariations = this.generateKeywordVariations(seedKeyword);
      const allKeywords = [seedKeyword, ...keywordVariations];
      
      // Get data for all keywords using the working endpoint
      const keywordData = await this.getKeywordData(allKeywords, config, country);
      
      // Create a map of keywords with data
      const keywordDataMap = new Map<string, KeywordData>();
      keywordData.forEach(k => keywordDataMap.set(k.keyword.toLowerCase(), k));
      
      // Create full keyword data with defaults for missing keywords
      const fullKeywordData: KeywordData[] = allKeywords.map(keyword => {
        const existingData = keywordDataMap.get(keyword.toLowerCase());
        if (existingData) {
          return existingData;
        }
        // Create default data for keywords without API data
        return {
          keyword: keyword,
          vol: null,
          cpc: null,
          competition: null,
          trend: null
        };
      });
      
      // Filter out the seed keyword from results and categorize
      const seedData = fullKeywordData.find(k => k.keyword.toLowerCase() === seedKeyword.toLowerCase());
      const otherKeywords = fullKeywordData.filter(k => k.keyword.toLowerCase() !== seedKeyword.toLowerCase());
      
      // Categorize keywords
      const questions = otherKeywords.filter(k => 
        k.keyword.toLowerCase().includes('how') || 
        k.keyword.toLowerCase().includes('what') || 
        k.keyword.toLowerCase().includes('why') ||
        k.keyword.toLowerCase().includes('when') ||
        k.keyword.toLowerCase().includes('where') ||
        k.keyword.toLowerCase().includes('?')
      );
      
      const regularKeywords = otherKeywords.filter(k => !questions.includes(k));
      
      // Parse the response into our structure
      const result: KeywordResearchResult = {
        seed_keyword: seedKeyword,
        keywords: seedData ? [seedData] : [],
        related_keywords: regularKeywords.slice(0, limit),
        questions: questions.slice(0, Math.min(20, limit)),
        total_results: fullKeywordData.length
      };

      return result;
    } catch (error) {
      console.error('Keywords Everywhere API error:', error);
      throw error;
    }
  }

  /**
   * Generate keyword variations for research
   */
  private generateKeywordVariations(seedKeyword: string): string[] {
    const variations: string[] = [];
    const words = seedKeyword.toLowerCase().split(' ');
    
    // Add plural/singular variations
    variations.push(seedKeyword + 's');
    if (seedKeyword.endsWith('s')) {
      variations.push(seedKeyword.slice(0, -1));
    }
    
    // Add common modifiers
    const modifiers = [
      'best', 'top', 'how to', 'what is', 'free', 'online', 'guide', 'tips',
      'cheap', 'review', 'comparison', '2024', 'near me', 'service'
    ];
    
    modifiers.forEach(modifier => {
      variations.push(`${modifier} ${seedKeyword}`);
      variations.push(`${seedKeyword} ${modifier}`);
    });
    
    // Add question variations
    const questions = [
      `how to ${seedKeyword}`,
      `what is ${seedKeyword}`,
      `why ${seedKeyword}`,
      `when ${seedKeyword}`,
      `where ${seedKeyword}`
    ];
    
    variations.push(...questions);
    
    // Remove duplicates and limit
    return Array.from(new Set(variations)).slice(0, 50);
  }

  /**
   * Get long-tail keyword suggestions
   */
  public async getLongTailKeywords(
    seedKeyword: string,
    config: KeywordsEverywhereConfig,
    country: string = 'US'
  ): Promise<KeywordData[]> {
    if (!this.isConfigured(config)) {
      throw new Error('Keywords Everywhere API not configured.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/get_longtail_keywords`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kw: [seedKeyword],
          country: country,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Keywords Everywhere API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Keywords Everywhere API error:', error);
      throw error;
    }
  }

  /**
   * Get search trends for keywords
   */
  public async getKeywordTrends(
    keywords: string[],
    config: KeywordsEverywhereConfig,
    country: string = 'US'
  ): Promise<KeywordData[]> {
    if (!this.isConfigured(config)) {
      throw new Error('Keywords Everywhere API not configured.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/get_search_trends`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kw: keywords,
          country: country,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Keywords Everywhere API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Keywords Everywhere API error:', error);
      throw error;
    }
  }

  /**
   * Format volume number for display
   */
  public formatVolume(volume: number | null | undefined): string {
    if (volume === null || volume === undefined || volume === 0 || typeof volume !== 'number' || isNaN(volume)) {
      return 'No data';
    }
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  }

  /**
   * Format CPC for display
   */
  public formatCPC(cpc: number | null | undefined): string {
    if (cpc === null || cpc === undefined || cpc === 0 || typeof cpc !== 'number' || isNaN(cpc)) {
      return 'No data';
    }
    return `$${cpc.toFixed(2)}`;
  }

  /**
   * Get competition level as text
   */
  public getCompetitionText(competition: number | null | undefined): string {
    if (competition === null || competition === undefined || typeof competition !== 'number' || isNaN(competition)) {
      return 'Unknown';
    }
    if (competition >= 0.8) return 'High';
    if (competition >= 0.5) return 'Medium';
    if (competition >= 0.2) return 'Low';
    return 'Very Low';
  }

  /**
   * Get competition color for UI
   */
  public getCompetitionColor(competition: number | null | undefined): string {
    if (competition === null || competition === undefined || typeof competition !== 'number' || isNaN(competition)) {
      return 'text-gray-500';
    }
    if (competition >= 0.8) return 'text-red-600';
    if (competition >= 0.5) return 'text-yellow-600';
    if (competition >= 0.2) return 'text-green-600';
    return 'text-green-500';
  }
}

// Singleton instance
export const keywordsEverywhereService = new KeywordsEverywhereService();
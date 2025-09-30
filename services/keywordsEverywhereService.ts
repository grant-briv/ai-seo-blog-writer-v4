export interface KeywordData {
  keyword: string;
  vol: number | null; // Monthly search volume
  cpc: number | null; // Cost per click (optional)
  competition: number | null; // Competition level (0-1)
  trend: number[] | null; // 12-month trend data
}

export interface AIKeywordSuggestions {
  informational: string[];
  commercial: string[];
  transactional: string[];
  navigational: string[];
  questions: string[];
  longTail: string[];
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
   * Use AI to intelligently research and generate keyword variations with high search probability
   * This uses a multi-step approach to ensure quality keywords
   */
  private async generateAIKeywordVariations(seedKeyword: string, country: string = 'US'): Promise<string[]> {
    try {
      console.log(`🤖 AI: Starting intelligent keyword research for "${seedKeyword}"...`);
      const { initializeAI } = await import('./geminiService.js');
      const aiClient = await initializeAI();

      // Step 1: Use AI to deeply research the topic and user intent
      const researchPrompt = `You are an expert SEO keyword researcher with deep knowledge of search behavior patterns.

TASK: Research the keyword "${seedKeyword}" and identify what people ACTUALLY search for related to this topic.

ANALYSIS REQUIRED:
1. What is this keyword about? (Define the core topic)
2. What are the main user intents? (What do people want to achieve?)
3. What problems does this solve?
4. What related topics/concepts do people search for?
5. What are common questions people ask?
6. What are alternative/synonym terms?
7. What specific use cases or scenarios exist?
8. What buying stages would apply? (awareness, consideration, decision)

Based on this analysis, generate 80-100 keyword variations that have HIGH PROBABILITY of real search volume.

KEYWORD CATEGORIES TO INCLUDE:
🎯 Core variations (10-15 keywords):
   - Exact match with modifiers (plural, singular, with/without articles)
   - Direct synonyms and alternative terms

🔍 Informational (15-20 keywords):
   - "how to [action] ${seedKeyword}"
   - "what is ${seedKeyword}"
   - "why ${seedKeyword}"
   - "${seedKeyword} guide"
   - "${seedKeyword} tutorial"
   - "${seedKeyword} tips"
   - "${seedKeyword} best practices"
   - "${seedKeyword} for beginners"

💡 Problem-solving (15-20 keywords):
   - Problems this solves
   - Use case specific searches
   - "how to [solve specific problem] with ${seedKeyword}"

🛒 Commercial intent (15-20 keywords):
   - "best ${seedKeyword}"
   - "top ${seedKeyword} ${new Date().getFullYear()}"
   - "${seedKeyword} reviews"
   - "${seedKeyword} comparison"
   - "${seedKeyword} vs [alternative]"
   - "cheapest ${seedKeyword}"
   - "affordable ${seedKeyword}"

💰 Transactional (10-15 keywords):
   - "buy ${seedKeyword}"
   - "${seedKeyword} price"
   - "${seedKeyword} cost"
   - "${seedKeyword} discount"
   - "${seedKeyword} deals"

❓ Questions (10-15 keywords):
   - Natural questions people ask
   - "should i [action] ${seedKeyword}"
   - "can i [action] ${seedKeyword}"
   - "when to [action] ${seedKeyword}"

🎯 Long-tail (10-15 keywords):
   - Highly specific 3-5 word phrases
   - Niche-specific variations
   - Industry jargon if applicable

CRITICAL RULES:
✅ Every keyword must be something a real person would type into Google
✅ Focus on search terms that are likely to have decent search volume (100+ searches/month)
✅ Include location modifiers ONLY if this is a local service ("near me", "in [city]")
✅ Include year ${new Date().getFullYear()} for evergreen comparisons and "best of" lists
✅ Mix difficulty levels - include both easy (long-tail) and competitive (short-tail) terms
✅ NO made-up jargon or marketing speak that nobody searches for
✅ NO overly generic single words unless they're direct synonyms

RETURN FORMAT:
Respond with ONLY a valid JSON array of keyword strings. No markdown, no code blocks, no explanations.
Just the array: ["keyword 1", "keyword 2", ...]`;

      console.log('🤖 AI: Analyzing topic and generating research-based keywords...');
      const result = await aiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: researchPrompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        }
      });
      const text = result.text;

      // Parse AI response with multiple strategies
      let keywords: string[] = [];
      try {
        // Strategy 1: Direct JSON parse
        try {
          keywords = JSON.parse(text);
        } catch {
          // Strategy 2: Extract JSON array from markdown or text
          const jsonMatch = text.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            keywords = JSON.parse(jsonMatch[0]);
          } else {
            // Strategy 3: Extract line by line if AI didn't follow format
            const lines = text.split('\n');
            keywords = lines
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('[') && !line.startsWith(']') && !line.startsWith('{') && !line.startsWith('"//'))
              .map(line => line.replace(/^[-*•]\s*/, '').replace(/^["']|["']$/g, '').replace(/,\s*$/, ''))
              .filter(line => line.length > 0);
          }
        }

        console.log(`🤖 AI: Successfully extracted ${keywords.length} keyword suggestions`);

        // Aggressive filtering and cleaning
        const cleaned = keywords
          .filter(k => typeof k === 'string' && k.trim().length > 0)
          .map(k => k.trim().toLowerCase())
          // Remove seed keyword itself
          .filter(k => k !== seedKeyword.toLowerCase())
          // Remove too-short keywords (likely mistakes)
          .filter(k => k.length >= 3)
          // Remove too-long keywords (likely sentences)
          .filter(k => k.length <= 100 && k.split(' ').length <= 10)
          // Remove keywords with special characters (except hyphens, apostrophes, and spaces)
          .filter(k => /^[a-z0-9\s'-]+$/.test(k))
          // Remove duplicates
          .filter((k, idx, arr) => arr.indexOf(k) === idx);

        console.log(`🤖 AI: Cleaned to ${cleaned.length} valid, unique keywords`);

        if (cleaned.length > 0) {
          console.log(`🤖 AI: Sample keywords:`, cleaned.slice(0, 8));
        } else {
          console.warn('🤖 AI: No valid keywords after cleaning');
        }

        return cleaned.slice(0, 90);

      } catch (parseError) {
        console.error('🤖 AI: Failed to parse keywords:', parseError);
        console.error('🤖 AI: Raw response:', text.substring(0, 500));
        return [];
      }

    } catch (error) {
      console.error('🤖 AI: Keyword generation failed:', error);
      return [];
    }
  }

  /**
   * Get related keywords for a seed keyword
   * Uses AI to generate intelligent variations, then validates with Keywords Everywhere API
   */
  public async getRelatedKeywords(
    seedKeyword: string,
    config: KeywordsEverywhereConfig,
    country: string = 'US',
    limit: number = 100,
    useAI: boolean = true
  ): Promise<KeywordResearchResult> {
    if (!this.isConfigured(config)) {
      throw new Error('Keywords Everywhere API not configured. Please set API key in settings.');
    }

    try {
      let keywordVariations: string[] = [];

      // Try AI-generated variations first if enabled
      if (useAI) {
        const aiVariations = await this.generateAIKeywordVariations(seedKeyword, country);

        if (aiVariations.length > 0) {
          keywordVariations = aiVariations;
          console.log(`✅ Using ${aiVariations.length} AI-generated keywords`);
        } else {
          console.warn('⚠️ AI generation produced no keywords, falling back to manual generation');
        }
      }

      // If AI didn't work or wasn't used, fall back to manual
      if (keywordVariations.length === 0) {
        console.log('📝 Using manual keyword generation...');
        keywordVariations = this.generateKeywordVariations(seedKeyword);
      } else {
        // AI worked - optionally add a few manual ones for diversity
        const manualVariations = this.generateKeywordVariations(seedKeyword);
        // Add top 20 manual variations that aren't already in AI list
        const lowercaseAI = keywordVariations.map(k => k.toLowerCase());
        const uniqueManual = manualVariations
          .filter(k => !lowercaseAI.includes(k.toLowerCase()))
          .slice(0, 20);

        if (uniqueManual.length > 0) {
          console.log(`➕ Adding ${uniqueManual.length} manual variations for diversity`);
          keywordVariations = [...keywordVariations, ...uniqueManual];
        }
      }

      // Ensure we don't exceed API limits (100 keywords per batch)
      // Keep seed + top 99 variations
      const allKeywords = [seedKeyword, ...keywordVariations.slice(0, 99)];

      // Get data for all keywords using the working endpoint
      const keywordData = await this.getKeywordData(allKeywords, config, country);

      // Create a map of keywords with data
      const keywordDataMap = new Map<string, KeywordData>();
      keywordData.forEach(k => {
        // Only include keywords that have actual search volume data
        if (k.vol !== null && k.vol !== undefined && k.vol > 0) {
          keywordDataMap.set(k.keyword.toLowerCase(), k);
        }
      });

      // Get seed keyword data (include even if no volume to show it was searched)
      const seedData = keywordData.find(k => k.keyword.toLowerCase() === seedKeyword.toLowerCase());

      // Filter to only keywords WITH data (volume > 0)
      const keywordsWithData: KeywordData[] = Array.from(keywordDataMap.values());

      // Remove seed keyword from related results
      const otherKeywords = keywordsWithData.filter(k =>
        k.keyword.toLowerCase() !== seedKeyword.toLowerCase()
      );

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

      // Sort by search volume (highest first) to show most relevant
      regularKeywords.sort((a, b) => (b.vol || 0) - (a.vol || 0));
      questions.sort((a, b) => (b.vol || 0) - (a.vol || 0));

      // Parse the response into our structure
      const result: KeywordResearchResult = {
        seed_keyword: seedKeyword,
        keywords: seedData ? [seedData] : [],
        related_keywords: regularKeywords.slice(0, limit),
        questions: questions.slice(0, Math.min(20, limit)),
        total_results: keywordsWithData.length
      };

      console.log(`📊 Keyword research complete for "${seedKeyword}":`);
      console.log(`   • Total variations tested: ${allKeywords.length}`);
      console.log(`   • Keywords with search data: ${keywordsWithData.length} (${Math.round(keywordsWithData.length / allKeywords.length * 100)}% success rate)`);
      console.log(`   • Related keywords: ${regularKeywords.length}`);
      console.log(`   • Question keywords: ${questions.length}`);
      console.log(`   • Returning top ${result.related_keywords.length} related + ${result.questions.length} questions`);

      return result;
    } catch (error) {
      console.error('Keywords Everywhere API error:', error);
      throw error;
    }
  }

  /**
   * Generate keyword variations for research
   * Improved to focus on high-probability variations more likely to have search data
   */
  private generateKeywordVariations(seedKeyword: string): string[] {
    const variations: string[] = [];
    const words = seedKeyword.toLowerCase().trim().split(/\s+/);
    const currentYear = new Date().getFullYear().toString();

    // Prefix modifiers - most likely to have data
    const prefixModifiers = [
      'best', 'top', 'how to', 'what is', 'benefits of', 'importance of',
      'why', 'tips for', 'guide to', 'examples of', 'types of'
    ];

    // Suffix modifiers - common long-tail patterns
    const suffixModifiers = [
      'guide', 'tips', 'strategies', 'ideas', 'examples', 'services',
      'solutions', 'tools', 'software', 'app', 'companies', 'cost',
      'pricing', 'reviews', 'comparison', currentYear, 'near me', 'online',
      'for beginners', 'for small business', 'for business'
    ];

    // Question starters with better phrasing
    const questions = [
      `how to ${seedKeyword}`,
      `what is ${seedKeyword}`,
      `what are ${seedKeyword}`,
      `why use ${seedKeyword}`,
      `why is ${seedKeyword} important`,
      `when to use ${seedKeyword}`,
      `how does ${seedKeyword} work`,
      `how much does ${seedKeyword} cost`
    ];

    // Add prefix variations (higher priority)
    prefixModifiers.forEach(modifier => {
      variations.push(`${modifier} ${seedKeyword}`);
    });

    // Add suffix variations (high priority)
    suffixModifiers.forEach(modifier => {
      variations.push(`${seedKeyword} ${modifier}`);
    });

    // Add question variations
    variations.push(...questions);

    // Add word-based variations for multi-word keywords
    if (words.length > 1) {
      // Alternate word order variations
      const reversed = [...words].reverse().join(' ');
      if (reversed !== seedKeyword) {
        variations.push(reversed);
      }

      // Individual word combinations with common modifiers
      words.forEach(word => {
        if (word.length > 3) { // Skip short words like 'the', 'and'
          variations.push(`best ${word}`);
          variations.push(`${word} services`);
          variations.push(`${word} guide`);
        }
      });
    }

    // Add semantic variations based on common patterns
    if (!seedKeyword.endsWith('s') && !seedKeyword.endsWith('ing')) {
      variations.push(`${seedKeyword}s`); // Plural
    }
    if (seedKeyword.endsWith('s')) {
      variations.push(seedKeyword.slice(0, -1)); // Singular
    }

    // Add comparative/superlative if relevant
    variations.push(`best ${seedKeyword}`);
    variations.push(`top ${seedKeyword}`);
    variations.push(`${seedKeyword} vs`);
    variations.push(`${seedKeyword} alternatives`);

    // Add intent-based variations
    variations.push(`buy ${seedKeyword}`);
    variations.push(`${seedKeyword} for sale`);
    variations.push(`affordable ${seedKeyword}`);
    variations.push(`professional ${seedKeyword}`);

    // Add location-based if doesn't already contain location
    if (!seedKeyword.includes('near me') && !seedKeyword.includes('local')) {
      variations.push(`${seedKeyword} near me`);
      variations.push(`local ${seedKeyword}`);
    }

    // Remove duplicates, empty strings, and limit to prevent API overuse
    const uniqueVariations = Array.from(new Set(variations.filter(v => v && v.trim().length > 0)));

    // Prioritize shorter variations (more likely to have data) and limit to 80
    return uniqueVariations
      .sort((a, b) => a.split(' ').length - b.split(' ').length)
      .slice(0, 80);
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
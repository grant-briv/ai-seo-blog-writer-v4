import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { SectionCard } from './SectionCard';
import { SearchIcon, TrendingUpIcon, StarIcon, SparklesIcon } from './Icons';
import { keywordsEverywhereService, KeywordData, KeywordResearchResult } from '../services/keywordsEverywhereService';
import type { WriterProfileData, KeywordsEverywhereConfig } from '../types';
import { generateKeywordVariations } from '../services/geminiService';

interface KeywordResearchProps {
  profileData?: WriterProfileData;
  onKeywordSelect?: (keyword: string, data: KeywordData) => void;
}

interface KeywordWithScore extends KeywordData {
  score: number;
  reason: string;
}

export const KeywordResearch: React.FC<KeywordResearchProps> = ({ profileData, onKeywordSelect }) => {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<string[]>([]);
  const [researchResults, setResearchResults] = useState<KeywordResearchResult | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'volume' | 'competition' | 'score'>('score');
  const [filterBy, setFilterBy] = useState<'all' | 'low_competition' | 'high_volume'>('all');
  const [country, setCountry] = useState('US');
  const [adminConfig, setAdminConfig] = useState<KeywordsEverywhereConfig | null>(null);

  // Load admin-level configuration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('keywordsEverywhereConfig');
      if (saved) {
        setAdminConfig(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load admin Keywords Everywhere config:', err);
    }
  }, []);

  // Check if either profile or admin config is available
  const getActiveConfig = (): KeywordsEverywhereConfig | null => {
    // First check profile-level config
    if (profileData?.keywordsEverywhereConfig && keywordsEverywhereService.isConfigured(profileData.keywordsEverywhereConfig)) {
      return profileData.keywordsEverywhereConfig;
    }
    // Then check admin-level config
    if (adminConfig && keywordsEverywhereService.isConfigured(adminConfig)) {
      return adminConfig;
    }
    // Finally check environment variable
    const envApiKey = import.meta.env.VITE_KEYWORDS_EVERYWHERE_API_KEY;
    if (envApiKey) {
      return {
        apiKey: envApiKey,
        isEnabled: true
      };
    }
    return null;
  };

  const activeConfig = getActiveConfig();
  const isConfigured = !!activeConfig;

  const calculateKeywordScore = (keyword: KeywordData): KeywordWithScore => {
    let score = 0;
    let reasons: string[] = [];

    // Volume scoring (0-40 points)
    if (keyword.vol > 10000) {
      score += 40;
      reasons.push('High volume');
    } else if (keyword.vol > 1000) {
      score += 30;
      reasons.push('Good volume');
    } else if (keyword.vol > 100) {
      score += 20;
      reasons.push('Moderate volume');
    } else if (keyword.vol > 0) {
      score += 10;
      reasons.push('Low volume');
    }

    // Competition scoring (0-30 points) - lower competition = higher score
    if (keyword.competition < 0.2) {
      score += 30;
      reasons.push('Very low competition');
    } else if (keyword.competition < 0.5) {
      score += 25;
      reasons.push('Low competition');
    } else if (keyword.competition < 0.8) {
      score += 15;
      reasons.push('Medium competition');
    } else {
      score += 5;
      reasons.push('High competition');
    }

    // Keyword length bonus (0-20 points) - longer tail keywords often convert better
    const wordCount = keyword.keyword.split(' ').length;
    if (wordCount >= 4) {
      score += 20;
      reasons.push('Long-tail keyword');
    } else if (wordCount === 3) {
      score += 15;
      reasons.push('3-word phrase');
    } else if (wordCount === 2) {
      score += 10;
      reasons.push('2-word phrase');
    }

    // CPC bonus (0-10 points) - higher CPC can indicate commercial intent
    if (keyword.cpc > 5) {
      score += 10;
      reasons.push('High commercial value');
    } else if (keyword.cpc > 1) {
      score += 5;
      reasons.push('Some commercial value');
    }

    return {
      ...keyword,
      score: Math.round(score),
      reason: reasons.join(', ')
    };
  };

  const performKeywordResearch = useCallback(async () => {
    if (!seedKeyword.trim()) {
      setError('Please enter a seed keyword');
      return;
    }

    const config = getActiveConfig();
    if (!config) {
      setError('Keywords Everywhere not configured. Please configure it in Admin Dashboard → API Configuration or in Profile Settings → External Link Search Configuration.');
      return;
    }

    setIsResearching(true);
    setIsGeneratingVariations(true);
    setError(null);
    setResearchResults(null);
    setGeneratedVariations([]);

    try {
      // Step 1: Use Gemini to generate keyword variations
      console.log('🤖 Generating keyword variations with AI...');
      const variations = await generateKeywordVariations(seedKeyword.trim(), profileData);
      console.log(`✅ Generated ${variations.length} keyword variations`);
      setGeneratedVariations(variations);
      setIsGeneratingVariations(false);

      // Step 2: Research all variations using Keywords Everywhere
      console.log('🔍 Researching keywords with Keywords Everywhere...');

      // Combine seed keyword with variations (up to 200 total)
      const allKeywords = [seedKeyword.trim(), ...variations].slice(0, 200);

      // Create a comma-separated list for the API
      const keywordList = allKeywords.join(',');

      const results = await keywordsEverywhereService.getRelatedKeywords(
        keywordList,
        config,
        country,
        200
      );
      console.log(`✅ Retrieved data for ${results.keywords.length} keywords`);
      setResearchResults(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform keyword research';
      setError(errorMessage);
      setIsGeneratingVariations(false);
    } finally {
      setIsResearching(false);
    }
  }, [seedKeyword, activeConfig, country, isConfigured, profileData]);

  const handleKeywordSelect = (keyword: KeywordData) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword.keyword)) {
      newSelected.delete(keyword.keyword);
    } else {
      newSelected.add(keyword.keyword);
    }
    setSelectedKeywords(newSelected);

    if (onKeywordSelect) {
      onKeywordSelect(keyword.keyword, keyword);
    }
  };

  const getFilteredAndSortedKeywords = (keywords: KeywordData[]): KeywordWithScore[] => {
    let keywordsWithScore = keywords.map(calculateKeywordScore);

    // Apply filter
    if (filterBy === 'low_competition') {
      keywordsWithScore = keywordsWithScore.filter(k => k.competition < 0.5);
    } else if (filterBy === 'high_volume') {
      keywordsWithScore = keywordsWithScore.filter(k => k.vol > 1000);
    }

    // Apply sort
    keywordsWithScore.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.vol - a.vol;
        case 'competition':
          return a.competition - b.competition; // Lower competition first
        case 'score':
        default:
          return b.score - a.score;
      }
    });

    return keywordsWithScore;
  };

  const KeywordTable: React.FC<{ keywords: KeywordData[]; title: string; icon: React.ReactNode }> = ({ keywords, title, icon }) => {
    const sortedKeywords = getFilteredAndSortedKeywords(keywords);
    
    if (sortedKeywords.length === 0) return null;

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center">
          {icon}
          <h3 className="ml-2 text-lg font-semibold text-gray-900">{title} ({sortedKeywords.length})</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedKeywords.slice(0, 50).map((keyword) => (
                <tr key={keyword.keyword} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{keyword.keyword}</div>
                      {keyword.reason && (
                        <div className="text-xs text-gray-500">{keyword.reason}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {keywordsEverywhereService.formatVolume(keyword.vol)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={keywordsEverywhereService.getCompetitionColor(keyword.competition)}>
                      {keywordsEverywhereService.getCompetitionText(keyword.competition)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {keywordsEverywhereService.formatCPC(keyword.cpc)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        keyword.score >= 70 ? 'bg-green-100 text-green-800' :
                        keyword.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {keyword.score}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      onClick={() => handleKeywordSelect(keyword)}
                      className={`text-xs px-3 py-1 ${selectedKeywords.has(keyword.keyword) ? 'btn btn-primary' : 'btn btn-secondary'}`}
                    >
                      {selectedKeywords.has(keyword.keyword) ? 'Selected' : 'Select'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isConfigured) {
    return (
      <SectionCard title="Keyword Research" icon={<SearchIcon className="w-6 h-6 text-blue-600"/>}>
        <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <SearchIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-900 mb-2">Keywords Everywhere Not Configured</h3>
          <p className="text-yellow-800 mb-4">
            To use keyword research, please configure Keywords Everywhere API key.
          </p>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>Admin users:</strong> Go to Admin Dashboard → API Configuration to set up the API key</p>
            <p><strong>Profile-level:</strong> Go to Profile Settings → External Link Search Configuration</p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Keyword Research" icon={<SearchIcon className="w-6 h-6 text-blue-600"/>}>
      <div className="space-y-6">
        {/* Research Form */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <TextInput
                label="Seed Keyword"
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
                placeholder="Enter a keyword to research (e.g., 'digital marketing')"
                onKeyPress={(e) => e.key === 'Enter' && performKeywordResearch()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
              <Button
                onClick={performKeywordResearch}
                disabled={isResearching || !seedKeyword.trim()}
                className="w-full btn btn-primary h-[42px]"
              >
                {isGeneratingVariations ? (
                  <>
                    <SparklesIcon className="w-4 h-4 mr-2 animate-spin" />
                    Generating AI Variations...
                  </>
                ) : isResearching ? (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Researching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Research with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="text-red-600 mr-2">❌</div>
                <div>
                  <h4 className="text-sm font-medium text-red-900">Error</h4>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {generatedVariations.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start">
                <SparklesIcon className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    AI Generated {generatedVariations.length} Keyword Variations
                  </h4>
                  <p className="text-xs text-blue-800 mb-2">
                    These variations were intelligently generated using AI and are now being researched for volume and competition data.
                  </p>
                  <details className="text-xs text-blue-700">
                    <summary className="cursor-pointer hover:text-blue-900 font-medium">View generated keywords</summary>
                    <div className="mt-2 max-h-32 overflow-y-auto bg-white rounded p-2 border border-blue-200">
                      <div className="flex flex-wrap gap-1">
                        {generatedVariations.map((kw, idx) => (
                          <span key={idx} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Sorting */}
        {researchResults && (
          <div className="flex flex-wrap items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="score">Opportunity Score</option>
                <option value="volume">Search Volume</option>
                <option value="competition">Competition (Low to High)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Keywords</option>
                <option value="low_competition">Low Competition Only</option>
                <option value="high_volume">High Volume Only (1000+)</option>
              </select>
            </div>
            
            {selectedKeywords.size > 0 && (
              <div className="ml-auto">
                <span className="text-sm text-gray-600">
                  {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {researchResults && (
          <div className="space-y-6">
            <KeywordTable 
              keywords={researchResults.keywords} 
              title="Related Keywords" 
              icon={<SearchIcon className="w-5 h-5 text-blue-600" />} 
            />
            
            {researchResults.questions.length > 0 && (
              <KeywordTable 
                keywords={researchResults.questions} 
                title="Question Keywords" 
                icon={<TrendingUpIcon className="w-5 h-5 text-place-teal" />} 
              />
            )}
            
            {researchResults.related_keywords.length > 0 && (
              <KeywordTable 
                keywords={researchResults.related_keywords} 
                title="Additional Suggestions" 
                icon={<StarIcon className="w-5 h-5 text-purple-600" />} 
              />
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
};
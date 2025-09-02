



import React, { useState, useEffect, useCallback } from 'react';
import { TextInput } from './TextInput';
import { Button } from './Button';
import { SectionCard } from './SectionCard';
import { searchGoogleNews, deepResearchOnTopic, analyzeArticleViralPotential, generateTrendingQuestions, researchHeadlineIdea, RateLimitError } from '../services/geminiService';
import type { Article, ArticleStats, GroundingSource } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { SaveIcon, SparklesIcon, SearchCircleIcon, TrendingUpIcon, LightBulbIcon } from './Icons';

interface TopicFinderProps {
    onSetDeepResearchInfo: (info: string) => void;
    onHeadlineResearchComplete: (data: { researchInfo: string; headline: string; topic: string; }) => void;
}

const SAVED_SEARCHES_KEY = 'ai_blog_writer_topic_searches';

const getEngagementColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
};

const getSentimentClasses = (sentiment: ArticleStats['sentiment']) => {
    switch (sentiment) {
        case 'Positive': return 'bg-green-100 text-green-800';
        case 'Negative': return 'bg-red-100 text-red-800';
        case 'Mixed': return 'bg-yellow-100 text-yellow-800';
        case 'Neutral':
        default: return 'bg-gray-100 text-gray-800';
    }
};

export const TopicFinder: React.FC<TopicFinderProps> = ({ onSetDeepResearchInfo, onHeadlineResearchComplete }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResearching, setIsResearching] = useState<string | null>(null); // Stores the link of the article being researched
    const [isAnalyzingStats, setIsAnalyzingStats] = useState<string | null>(null); // Stores link of article being analyzed for virality
    const [researchingHeadlineIndex, setResearchingHeadlineIndex] = useState<number | null>(null); // Stores headline index being researched
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<{ articles: Article[]; groundingSources: GroundingSource[] } | null>(null);
    const [trendingQuestions, setTrendingQuestions] = useState<string[]>([]);
    const [editableHeadlines, setEditableHeadlines] = useState<string[]>([]);
    const [savedSearches, setSavedSearches] = useState<string[]>([]);

    useEffect(() => {
        try {
            const storedSearches = localStorage.getItem(SAVED_SEARCHES_KEY);
            if (storedSearches) {
                setSavedSearches(JSON.parse(storedSearches));
            }
        } catch (e) {
            console.error("Could not load saved searches from local storage.", e);
        }
    }, []);
    
    useEffect(() => {
        setEditableHeadlines(trendingQuestions);
    }, [trendingQuestions]);

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError(null);
        setSearchResults(null);
        setTrendingQuestions([]);
        try {
            const [newsResults, questionsResults] = await Promise.all([
                searchGoogleNews(query),
                generateTrendingQuestions(query)
            ]);
            setSearchResults(newsResults);
            setTrendingQuestions(questionsResults);
        } catch (err) {
            if (err instanceof RateLimitError) {
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred during search.');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch(searchQuery);
    };

    const handleSaveSearch = () => {
        if (searchQuery.trim() && !savedSearches.includes(searchQuery.trim().toLowerCase())) {
            const newSavedSearches = [...savedSearches, searchQuery.trim().toLowerCase()];
            setSavedSearches(newSavedSearches);
            localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSavedSearches));
        }
    };

    const handleDeleteSearch = (searchToDelete: string) => {
        const newSavedSearches = savedSearches.filter(s => s !== searchToDelete);
        setSavedSearches(newSavedSearches);
        localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSavedSearches));
    };
    
    const handleDeepResearch = async (article: Article) => {
        setIsResearching(article.link);
        setError(null);
        try {
            const researchText = await deepResearchOnTopic(article.title, article.link, article.snippet);
            onSetDeepResearchInfo(researchText);
        } catch(err) {
            if (err instanceof RateLimitError) {
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred during deep research.');
            }
        } finally {
            setIsResearching(null);
        }
    };

    const handleAnalyzeVirality = async (articleLink: string) => {
        if (!searchResults) return;

        setIsAnalyzingStats(articleLink);
        setError(null);
        try {
            const articleToAnalyze = searchResults.articles.find(a => a.link === articleLink);
            if (!articleToAnalyze) throw new Error("Article not found");

            const stats = await analyzeArticleViralPotential(articleToAnalyze);

            setSearchResults(prev => {
                if (!prev) return null;
                const updatedArticles = prev.articles.map(a => 
                    a.link === articleLink ? { ...a, stats } : a
                );
                return { ...prev, articles: updatedArticles };
            });

        } catch (err) {
            if (err instanceof RateLimitError) {
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred during virality analysis.');
            }
        } finally {
            setIsAnalyzingStats(null);
        }
    };
    
    const handleDeepResearchHeadline = async (headline: string, index: number) => {
        setResearchingHeadlineIndex(index);
        setError(null);
        try {
            const researchText = await researchHeadlineIdea(headline);
            onHeadlineResearchComplete({
                researchInfo: researchText,
                headline: headline,
                topic: searchQuery,
            });
        } catch(err) {
            if (err instanceof RateLimitError) {
                setError(err.message);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred during deep research on headline.');
            }
        } finally {
            setResearchingHeadlineIndex(null);
        }
    };

    const handleHeadlineChange = (index: number, value: string) => {
        const newHeadlines = [...editableHeadlines];
        newHeadlines[index] = value;
        setEditableHeadlines(newHeadlines);
    };

    const anyLoading = isLoading || !!isResearching || !!isAnalyzingStats || researchingHeadlineIndex !== null;

    return (
        <div className="space-y-6">
            {(anyLoading) && <LoadingSpinner />}
            
            <p className="text-sm text-gray-600">
                Find timely topics for your next blog post. Search for a keyword to get recent news, articles, and trending consumer questions from Google.
            </p>
            
            <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-grow w-full">
                    <TextInput
                        label="Search Topic"
                        name="searchQuery"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g., renewable energy trends"
                        className="!mb-0"
                    />
                </div>
                <div className="flex w-full sm:w-auto space-x-2 flex-shrink-0">
                    <Button type="submit" disabled={isLoading} className="bg-sky-600 hover:bg-sky-700 text-white flex-1 sm:flex-initial">
                        <SearchCircleIcon className="w-5 h-5 mr-2" />
                        Search
                    </Button>
                     <Button type="button" onClick={handleSaveSearch} disabled={!searchQuery.trim()} variant="secondary" className="flex-1 sm:flex-initial">
                        <SaveIcon className="w-5 h-5 mr-2" />
                        Save
                    </Button>
                </div>
            </form>

            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md border border-red-300 text-sm" role="alert">{error}</p>}

            {savedSearches.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-2">Saved Searches</h4>
                    <div className="flex flex-wrap gap-2">
                        {savedSearches.map(search => (
                            <div key={search} className="flex items-center bg-gray-200 rounded-full">
                                <button
                                    onClick={() => {
                                        setSearchQuery(search);
                                        handleSearch(search);
                                    }}
                                    className="px-3 py-1 text-sm text-gray-800 hover:bg-gray-300 rounded-l-full"
                                >
                                    {search}
                                </button>
                                <button onClick={() => handleDeleteSearch(search)} className="px-2 py-1 text-red-500 hover:bg-red-200 rounded-r-full" aria-label={`Delete saved search: ${search}`}>
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {editableHeadlines.length > 0 && (
                <div className="mt-6">
                    <SectionCard title="Trending Questions & Headline Ideas" icon={<LightBulbIcon className="w-6 h-6 text-yellow-500" />}>
                        <p className="text-sm text-gray-600 mb-4">You can edit the headlines below. Select one to run deep research and populate the blog writer.</p>
                        <ul className="space-y-4">
                            {editableHeadlines.map((headline, index) => (
                                <li key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex-grow w-full">
                                        <TextInput
                                            label=""
                                            name={`headline-idea-${index}`}
                                            value={headline}
                                            onChange={(e) => handleHeadlineChange(index, e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        onClick={() => handleDeepResearchHeadline(headline, index)}
                                        disabled={anyLoading}
                                        className="bg-teal-500 hover:bg-teal-600 text-white !py-1 !px-2.5 text-xs ml-0 sm:ml-2 flex-shrink-0 self-end sm:self-center"
                                    >
                                        <SparklesIcon className="w-4 h-4 mr-1.5" />
                                        {researchingHeadlineIndex === index ? 'Researching...' : 'Deep Research'}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                </div>
            )}

            {searchResults && (
                <div className="space-y-4 mt-6">
                    <h3 className="text-xl font-semibold text-sky-800">Recent News for "{searchQuery}"</h3>
                    {searchResults.articles.length > 0 ? (
                        <ul className="space-y-4">
                            {searchResults.articles.map((article, index) => (
                                <li key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
                                    <h3 className="text-lg font-semibold text-sky-700">
                                        <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            {article.title}
                                        </a>
                                    </h3>
                                    <p className="text-gray-700">{article.snippet}</p>
                                    <p className="text-sm text-gray-500 break-words">
                                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{article.link}</a>
                                    </p>

                                    {article.stats && (
                                        <div className="p-4 bg-teal-50/50 rounded-md border border-teal-200 space-y-4">
                                            <h4 className="text-md font-semibold text-teal-800 flex items-center">
                                                <TrendingUpIcon className="w-5 h-5 mr-2" />
                                                Virality Analysis
                                            </h4>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-gray-700">Engagement Score:</span>
                                                    <div className="flex items-center">
                                                        <span className={`font-bold text-lg ${getEngagementColor(article.stats.estimatedEngagementScore)}`}>{article.stats.estimatedEngagementScore}</span>
                                                        <span className="text-gray-500">/100</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-gray-700">Sentiment:</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentClasses(article.stats.sentiment)}`}>
                                                        {article.stats.sentiment}
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="font-semibold text-gray-700 mb-1">Key Takeaways:</h5>
                                                <ul className="list-disc list-inside space-y-1 text-gray-600 pl-2">
                                                    {article.stats.keyTakeaways.map((takeaway, i) => <li key={i}>{takeaway}</li>)}
                                                </ul>
                                            </div>

                                            <div>
                                                <h5 className="font-semibold text-gray-700 mb-1">Potential Viral Angles:</h5>
                                                <ul className="list-disc list-inside space-y-1 text-gray-600 pl-2">
                                                    {article.stats.potentialAngles.map((angle, i) => <li key={i}>{angle}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                                        <Button
                                            onClick={() => handleDeepResearch(article)}
                                            disabled={anyLoading}
                                            className="bg-teal-500 hover:bg-teal-600 text-white !py-1.5 !px-3 text-sm"
                                        >
                                            <SparklesIcon className="w-4 h-4 mr-2" />
                                            {isResearching === article.link ? 'Researching...' : 'Deep Research'}
                                        </Button>
                                        <Button
                                            onClick={() => handleAnalyzeVirality(article.link)}
                                            disabled={anyLoading || !!article.stats}
                                            variant="secondary"
                                            className="bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-200 !py-1.5 !px-3 text-sm"
                                        >
                                            <TrendingUpIcon className="w-4 h-4 mr-2" />
                                            {isAnalyzingStats === article.link ? 'Analyzing...' : (article.stats ? 'Analyzed' : 'Analyze Virality')}
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-6">No articles found for this topic.</p>
                    )}
                    
                    {searchResults.groundingSources.length > 0 && (
                         <div className="mt-6">
                            <h4 className="text-md font-semibold text-gray-700 mb-2">Sources Used for this Search</h4>
                             <ul className="list-disc list-inside space-y-1 text-sm">
                                {searchResults.groundingSources.map((source, index) => (
                                    <li key={index} className="text-gray-600">
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline" title={source.uri}>
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
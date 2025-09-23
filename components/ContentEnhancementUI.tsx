import React, { useState } from 'react';
import { Button } from './Button';
import { SectionCard } from './SectionCard';
import { SparklesIcon, LightBulbIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import type { WriterProfileData } from '../types';
import { 
  analyzeContentQuality, 
  type SentenceAnalysis, 
  type EmotionalTone, 
  type PowerWordSuggestions, 
  type MetaphorSuggestion 
} from '../services/contentEnhancementService';

interface ContentEnhancementUIProps {
  content: string;
  profileData?: WriterProfileData;
  onContentImproved?: (improvedContent: string) => void;
}

interface EnhancementResults {
  sentenceAnalysis: SentenceAnalysis;
  emotionalTone: EmotionalTone;
  powerWords: PowerWordSuggestions[];
  metaphors: MetaphorSuggestion[];
  overallScore: number;
  priorityRecommendations: string[];
}

export const ContentEnhancementUI: React.FC<ContentEnhancementUIProps> = ({
  content,
  profileData,
  onContentImproved
}) => {
  const [enhancementResults, setEnhancementResults] = useState<EnhancementResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'sentences' | 'tone' | 'words' | 'metaphors'>('overview');

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError('Please provide content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const results = await analyzeContentQuality(content, profileData);
      setEnhancementResults(results);
    } catch (err) {
      setError('Failed to analyze content. Please try again.');
      console.error('Content analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  if (!content.trim()) {
    return (
      <SectionCard title="Content Enhancement" icon={<SparklesIcon className="w-6 h-6 text-purple-600" />}>
        <div className="text-center py-8 text-gray-500">
          <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Enter some content to analyze and enhance its writing quality</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Content Enhancement Analysis" icon={<SparklesIcon className="w-6 h-6 text-purple-600" />}>
        <div className="space-y-4">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full btn btn-primary"
          >
            {isAnalyzing ? 'Analyzing Content...' : 'Analyze Writing Quality'}
          </Button>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {enhancementResults && (
            <>
              {/* Overview Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', name: 'Overview', icon: '📊' },
                    { id: 'sentences', name: 'Sentences', icon: '📝' },
                    { id: 'tone', name: 'Tone', icon: '🎭' },
                    { id: 'words', name: 'Power Words', icon: '⚡' },
                    { id: 'metaphors', name: 'Metaphors', icon: '🎯' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.icon} {tab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Overall Score */}
                    <div className="text-center">
                      <div className={`inline-flex items-center px-6 py-3 rounded-lg text-lg font-semibold ${getScoreColor(enhancementResults.overallScore)}`}>
                        <CheckCircleIcon className="w-6 h-6 mr-2" />
                        Overall Score: {enhancementResults.overallScore}/100 ({getScoreLabel(enhancementResults.overallScore)})
                      </div>
                    </div>

                    {/* Priority Recommendations */}
                    {enhancementResults.priorityRecommendations.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                          <XCircleIcon className="w-5 h-5 mr-2" />
                          Priority Improvements
                        </h4>
                        <ul className="space-y-2">
                          {enhancementResults.priorityRecommendations.map((rec, index) => (
                            <li key={index} className="text-blue-800 text-sm flex items-start">
                              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">{enhancementResults.sentenceAnalysis.totalSentences}</div>
                        <div className="text-sm text-gray-600">Total Sentences</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">{enhancementResults.sentenceAnalysis.avgWordsPerSentence}</div>
                        <div className="text-sm text-gray-600">Avg Words/Sentence</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">{enhancementResults.emotionalTone.intensity}%</div>
                        <div className="text-sm text-gray-600">Emotional Intensity</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">{enhancementResults.metaphors.length}</div>
                        <div className="text-sm text-gray-600">Suggested Metaphors</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'sentences' && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Sentence Variety Score */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Variety Score</h4>
                        <div className={`text-3xl font-bold ${getScoreColor(enhancementResults.sentenceAnalysis.varietyScore)}`}>
                          {enhancementResults.sentenceAnalysis.varietyScore}/100
                        </div>
                      </div>

                      {/* Sentence Types Distribution */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Sentence Types</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Simple:</span>
                            <span className="font-medium">{enhancementResults.sentenceAnalysis.sentenceTypes.simple}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Compound:</span>
                            <span className="font-medium">{enhancementResults.sentenceAnalysis.sentenceTypes.compound}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Complex:</span>
                            <span className="font-medium">{enhancementResults.sentenceAnalysis.sentenceTypes.complex}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {enhancementResults.sentenceAnalysis.suggestions.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-3">💡 Sentence Improvement Suggestions</h4>
                        <ul className="space-y-2">
                          {enhancementResults.sentenceAnalysis.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-blue-800 text-sm flex items-start">
                              <LightBulbIcon className="w-4 h-4 mt-1 mr-2 flex-shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'tone' && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Primary Tone */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Primary Emotion</h4>
                        <div className="text-2xl font-bold text-purple-600 capitalize mb-2">
                          {enhancementResults.emotionalTone.primary}
                        </div>
                        <div className="text-sm text-gray-600">
                          Secondary: <span className="capitalize font-medium">{enhancementResults.emotionalTone.secondary}</span>
                        </div>
                        <div className="mt-2">
                          <div className="text-sm text-gray-600">Intensity: {enhancementResults.emotionalTone.intensity}%</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{width: `${enhancementResults.emotionalTone.intensity}%`}}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Emotion Breakdown */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">Emotion Analysis</h4>
                        <div className="space-y-2 text-sm">
                          {Object.entries(enhancementResults.emotionalTone.emotions).map(([emotion, score]) => (
                            <div key={emotion} className="flex justify-between items-center">
                              <span className="capitalize">{emotion}:</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-500 h-2 rounded-full" 
                                    style={{width: `${score}%`}}
                                  ></div>
                                </div>
                                <span className="w-8 text-xs text-gray-600">{score}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tone Recommendations */}
                    {enhancementResults.emotionalTone.recommendations.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-3">🎭 Tone Recommendations</h4>
                        <ul className="space-y-2">
                          {enhancementResults.emotionalTone.recommendations.map((rec, index) => (
                            <li key={index} className="text-green-800 text-sm flex items-start">
                              <CheckCircleIcon className="w-4 h-4 mt-1 mr-2 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'words' && (
                  <div className="space-y-4">
                    {enhancementResults.powerWords.map((suggestion, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-yellow-900">{suggestion.category}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            suggestion.impact === 'high' ? 'bg-red-100 text-red-800' :
                            suggestion.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {suggestion.impact} impact
                          </span>
                        </div>
                        <p className="text-yellow-800 text-sm mb-3">{suggestion.context}</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.words.map((word, wordIndex) => (
                            <span 
                              key={wordIndex}
                              className="bg-white border border-yellow-300 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:bg-yellow-100 transition-colors"
                              onClick={() => navigator.clipboard.writeText(word)}
                              title="Click to copy"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'metaphors' && (
                  <div className="space-y-4">
                    {enhancementResults.metaphors.length > 0 ? (
                      enhancementResults.metaphors.map((metaphor, index) => (
                        <div key={index} className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-indigo-900">Concept: "{metaphor.original}"</h4>
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium capitalize">
                              {metaphor.category}
                            </span>
                          </div>
                          <div className="bg-white border border-indigo-200 p-3 rounded mb-3">
                            <p className="text-indigo-900 font-medium italic">"{metaphor.metaphor}"</p>
                          </div>
                          <p className="text-indigo-700 text-sm">{metaphor.explanation}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <LightBulbIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>No metaphor suggestions available for this content.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
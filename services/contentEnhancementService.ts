import type { WriterProfileData } from '../types';
import { initializeAI } from './geminiService';
import { DEFAULT_TEXT_MODEL } from '../constants';

// Content enhancement interfaces
export interface SentenceAnalysis {
  totalSentences: number;
  avgWordsPerSentence: number;
  sentenceTypes: {
    simple: number;
    compound: number;
    complex: number;
  };
  varietyScore: number; // 0-100, higher is better
  suggestions: string[];
}

export interface EmotionalTone {
  primary: string;
  secondary: string;
  intensity: number; // 0-100
  emotions: {
    joy: number;
    trust: number;
    fear: number;
    surprise: number;
    sadness: number;
    disgust: number;
    anger: number;
    anticipation: number;
  };
  recommendations: string[];
}

export interface PowerWordSuggestions {
  category: string;
  words: string[];
  context: string;
  impact: 'high' | 'medium' | 'low';
}

export interface MetaphorSuggestion {
  original: string;
  metaphor: string;
  explanation: string;
  category: 'business' | 'nature' | 'technology' | 'sports' | 'journey' | 'building';
}

// Power words database categorized by impact and purpose
const POWER_WORDS = {
  emotional: {
    high: ['breakthrough', 'revolutionary', 'extraordinary', 'magnificent', 'incredible', 'phenomenal', 'spectacular', 'remarkable'],
    medium: ['amazing', 'fantastic', 'wonderful', 'excellent', 'outstanding', 'impressive', 'brilliant', 'superb'],
    low: ['good', 'nice', 'interesting', 'helpful', 'useful', 'beneficial', 'positive', 'effective']
  },
  urgency: {
    high: ['urgent', 'critical', 'immediate', 'now', 'deadline', 'limited time', 'act fast', 'don\'t miss'],
    medium: ['soon', 'quickly', 'today', 'this week', 'hurry', 'while supplies last', 'time-sensitive', 'priority'],
    low: ['eventually', 'when ready', 'consider', 'think about', 'maybe', 'possibly', 'sometime', 'later']
  },
  credibility: {
    high: ['proven', 'certified', 'guaranteed', 'research-backed', 'scientifically tested', 'expert-approved', 'award-winning', 'industry-leading'],
    medium: ['trusted', 'reliable', 'established', 'experienced', 'professional', 'quality', 'reputable', 'recognized'],
    low: ['claims', 'believes', 'suggests', 'thinks', 'feels', 'opinion', 'idea', 'concept']
  },
  curiosity: {
    high: ['secret', 'hidden', 'revealed', 'exposed', 'discovered', 'unknown', 'mysterious', 'forbidden'],
    medium: ['behind-the-scenes', 'insider', 'exclusive', 'special', 'unique', 'surprising', 'unexpected', 'rare'],
    low: ['information', 'details', 'facts', 'data', 'content', 'material', 'stuff', 'things']
  }
};

/**
 * Analyze sentence variety and structure
 */
export const analyzeSentenceVariety = async (content: string): Promise<SentenceAnalysis> => {
  const sentences = content.match(/[.!?]+/g) || [];
  const totalSentences = sentences.length;
  
  // Split content into sentences for analysis
  const sentenceArray = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Calculate average words per sentence
  const totalWords = content.split(/\s+/).length;
  const avgWordsPerSentence = totalWords / totalSentences;
  
  // Analyze sentence types (simplified heuristics)
  let simple = 0, compound = 0, complex = 0;
  
  sentenceArray.forEach(sentence => {
    const conjunctions = (sentence.match(/\b(and|but|or|so|yet|for|nor)\b/gi) || []).length;
    const subordinators = (sentence.match(/\b(because|since|although|while|if|when|where|that|which|who)\b/gi) || []).length;
    
    if (subordinators > 0) {
      complex++;
    } else if (conjunctions > 0) {
      compound++;
    } else {
      simple++;
    }
  });
  
  // Calculate variety score
  const simpleRatio = simple / totalSentences;
  const compoundRatio = compound / totalSentences;
  const complexRatio = complex / totalSentences;
  
  // Ideal ratios: 40% simple, 30% compound, 30% complex
  const varietyScore = Math.max(0, 100 - (
    Math.abs(simpleRatio - 0.4) * 100 +
    Math.abs(compoundRatio - 0.3) * 100 +
    Math.abs(complexRatio - 0.3) * 100
  ));
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (simpleRatio > 0.7) suggestions.push("Try combining some short sentences with conjunctions (and, but, or)");
  if (complexRatio < 0.2) suggestions.push("Add more complex sentences with subordinate clauses (because, although, when)");
  if (avgWordsPerSentence > 25) suggestions.push("Break down some long sentences for better readability");
  if (avgWordsPerSentence < 10) suggestions.push("Expand some sentences with more descriptive details");
  
  return {
    totalSentences,
    avgWordsPerSentence: Math.round(avgWordsPerSentence),
    sentenceTypes: { simple, compound, complex },
    varietyScore: Math.round(varietyScore),
    suggestions
  };
};

/**
 * Analyze emotional tone of content using AI
 */
export const analyzeEmotionalTone = async (
  content: string,
  profileData?: WriterProfileData
): Promise<EmotionalTone> => {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  
  const prompt = `Analyze the emotional tone of this content and return a JSON response with the following structure:
{
  "primary": "dominant emotion (joy, trust, fear, surprise, sadness, disgust, anger, anticipation)",
  "secondary": "secondary emotion", 
  "intensity": number (0-100),
  "emotions": {
    "joy": number (0-100),
    "trust": number (0-100), 
    "fear": number (0-100),
    "surprise": number (0-100),
    "sadness": number (0-100),
    "disgust": number (0-100),
    "anger": number (0-100),
    "anticipation": number (0-100)
  },
  "recommendations": ["suggestion 1", "suggestion 2", ...]
}

Content to analyze:
${content}

Focus on:
1. Overall emotional impression
2. Word choice emotional impact  
3. Sentence structure emotional effect
4. Practical recommendations for tone adjustment`;

  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    });
    
    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error('Error analyzing emotional tone:', error);
  }
  
  // Fallback response
  return {
    primary: 'neutral',
    secondary: 'informative', 
    intensity: 50,
    emotions: {
      joy: 20, trust: 60, fear: 10, surprise: 15,
      sadness: 5, disgust: 5, anger: 5, anticipation: 30
    },
    recommendations: ['Content appears neutral - consider adding more emotional engagement']
  };
};

/**
 * Suggest power words to enhance impact
 */
export const suggestPowerWords = (content: string, purpose: 'emotional' | 'urgency' | 'credibility' | 'curiosity' = 'emotional'): PowerWordSuggestions[] => {
  const suggestions: PowerWordSuggestions[] = [];
  const words = content.toLowerCase().split(/\s+/);
  
  // Analyze current word strength
  const weakWords = words.filter(word => 
    POWER_WORDS[purpose].low.includes(word) ||
    ['very', 'really', 'quite', 'pretty', 'somewhat', 'rather'].includes(word)
  );
  
  if (weakWords.length > 0) {
    suggestions.push({
      category: `Replace weak ${purpose} words`,
      words: POWER_WORDS[purpose].high.slice(0, 8),
      context: `Found ${weakWords.length} weak words that could be strengthened`,
      impact: 'high'
    });
  }
  
  // Suggest power words for different categories
  Object.keys(POWER_WORDS).forEach(category => {
    if (category !== purpose) {
      suggestions.push({
        category: `Add ${category} power words`,
        words: POWER_WORDS[category as keyof typeof POWER_WORDS].high.slice(0, 6),
        context: `Enhance ${category} impact`,
        impact: 'medium'
      });
    }
  });
  
  return suggestions.slice(0, 3); // Return top 3 suggestions
};

/**
 * Generate metaphors and analogies for complex topics
 */
export const generateMetaphors = async (
  content: string,
  profileData?: WriterProfileData
): Promise<MetaphorSuggestion[]> => {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  
  const prompt = `Analyze this content and suggest 3-5 metaphors or analogies to make complex concepts more understandable and engaging. Return JSON:
[
  {
    "original": "complex concept from the content",
    "metaphor": "simple, relatable metaphor or analogy", 
    "explanation": "brief explanation of how the metaphor works",
    "category": "business|nature|technology|sports|journey|building"
  }
]

Content to analyze:
${content}

Focus on:
1. Technical or abstract concepts that need simplification
2. Create vivid, memorable comparisons
3. Use familiar, everyday references
4. Vary metaphor categories for richness`;

  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });
    
    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error('Error generating metaphors:', error);
  }
  
  // Fallback metaphors
  return [
    {
      original: "complex process",
      metaphor: "like building a house - you need a strong foundation before adding the walls and roof",
      explanation: "Breaks down complexity into sequential, understandable steps",
      category: "building"
    }
  ];
};

/**
 * Comprehensive content enhancement analysis
 */
export const analyzeContentQuality = async (
  content: string,
  profileData?: WriterProfileData
): Promise<{
  sentenceAnalysis: SentenceAnalysis;
  emotionalTone: EmotionalTone;
  powerWords: PowerWordSuggestions[];
  metaphors: MetaphorSuggestion[];
  overallScore: number;
  priorityRecommendations: string[];
}> => {
  try {
    // Run all analyses
    const [sentenceAnalysis, emotionalTone, metaphors] = await Promise.all([
      analyzeSentenceVariety(content),
      analyzeEmotionalTone(content, profileData),
      generateMetaphors(content, profileData)
    ]);
    
    const powerWords = suggestPowerWords(content, 'emotional');
    
    // Calculate overall score
    const varietyScore = sentenceAnalysis.varietyScore;
    const toneScore = emotionalTone.intensity;
    const powerWordScore = Math.max(0, 100 - (powerWords.length * 20)); // Fewer suggestions = better current state
    
    const overallScore = Math.round((varietyScore + toneScore + powerWordScore) / 3);
    
    // Generate priority recommendations
    const priorityRecommendations: string[] = [];
    
    if (varietyScore < 60) {
      priorityRecommendations.push("Improve sentence variety for better flow");
    }
    if (emotionalTone.intensity < 40) {
      priorityRecommendations.push("Add more emotional engagement");
    }
    if (powerWords.length > 2) {
      priorityRecommendations.push("Replace weak words with more powerful alternatives");
    }
    if (metaphors.length === 0) {
      priorityRecommendations.push("Add metaphors to simplify complex concepts");
    }
    
    return {
      sentenceAnalysis,
      emotionalTone,
      powerWords,
      metaphors,
      overallScore,
      priorityRecommendations
    };
  } catch (error) {
    console.error('Error analyzing content quality:', error);
    throw error;
  }
};
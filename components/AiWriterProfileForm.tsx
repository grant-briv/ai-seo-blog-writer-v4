
import React, { useState, useEffect, useMemo } from 'react';
import type { AiWriterProfile } from '../types';
import { TextInput } from './TextInput';
import { TextAreaInput } from './TextAreaInput';
import { Button } from './Button';
import { PlusCircleIcon, SaveIcon, SparklesIcon, GlobeAltIcon } from './Icons';
import { 
  AVAILABLE_TEXT_MODELS, 
  KNOWLEDGE_BASE_MAX_CHARS, CHARS_PER_TOKEN_ESTIMATE, KNOWLEDGE_BASE_MAX_TOKENS_ESTIMATE, 
  IMAGE_PROMPT_INSTRUCTIONS_MAX_CHARS, IMAGE_PROMPT_INSTRUCTIONS_MAX_TOKENS_ESTIMATE,
  DEFAULT_TEXT_MODEL 
} from '../constants';
import { generateWebsiteContext, RateLimitError } from '../services/geminiService';
import { SectionCard } from './SectionCard';

interface AiWriterProfileFormProps {
  profile?: AiWriterProfile | null; 
  onSave: (profile: AiWriterProfile) => void;
  onCancel?: () => void;
  currentUserId: string;
}

export const AiWriterProfileForm: React.FC<AiWriterProfileFormProps> = ({ profile, onSave, onCancel, currentUserId }) => {
  const [agentName, setAgentName] = useState('');
  const [coreInstructions, setCoreInstructions] = useState('');
  const [knowledgeDocumentsText, setKnowledgeDocumentsText] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_TEXT_MODEL);
  const [imagePromptInstructions, setImagePromptInstructions] = useState('');
  
  // Website Context Engine state
  const [urlListInput, setUrlListInput] = useState('');
  const [sitemapPages, setSitemapPages] = useState<{ url: string; selected: boolean }[]>([]);
  const [websiteContext, setWebsiteContext] = useState('');
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setAgentName(profile.agentName);
      setCoreInstructions(profile.coreInstructions);
      setKnowledgeDocumentsText(profile.knowledgeDocumentsText);
      setBrandVoice(profile.brandVoice);
      setSelectedModel(profile.selectedModel || DEFAULT_TEXT_MODEL);
      setImagePromptInstructions(profile.imagePromptInstructions || '');
      setSitemapPages(profile.sitemapPages || []);
      setWebsiteContext(profile.websiteContext || '');
      setUrlListInput(''); // Clear input on profile change
    } else {
      // Reset form for new profile
      setAgentName('');
      setCoreInstructions('');
      setKnowledgeDocumentsText('');
      setBrandVoice('');
      setSelectedModel(DEFAULT_TEXT_MODEL);
      setImagePromptInstructions('');
      setUrlListInput('');
      setSitemapPages([]);
      setWebsiteContext('');
    }
  }, [profile]);

  const currentKnowledgeChars = knowledgeDocumentsText.length;
  const estimatedKnowledgeTokens = Math.ceil(currentKnowledgeChars / CHARS_PER_TOKEN_ESTIMATE);
  const knowledgeBaseOverLimit = estimatedKnowledgeTokens > KNOWLEDGE_BASE_MAX_TOKENS_ESTIMATE;

  const currentImagePromptChars = imagePromptInstructions.length;
  const estimatedImagePromptTokens = Math.ceil(currentImagePromptChars / CHARS_PER_TOKEN_ESTIMATE);
  const imagePromptOverLimit = estimatedImagePromptTokens > IMAGE_PROMPT_INSTRUCTIONS_MAX_TOKENS_ESTIMATE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!agentName.trim()) {
      setFormError("Agent Name is required.");
      return;
    }
    if (knowledgeBaseOverLimit) {
      setFormError(`Knowledge Base text exceeds the estimated maximum of ${KNOWLEDGE_BASE_MAX_TOKENS_ESTIMATE} tokens. Please reduce the text.`);
      return;
    }
    if (imagePromptOverLimit) {
      setFormError(`Image Prompt Instructions text exceeds the estimated maximum of ${IMAGE_PROMPT_INSTRUCTIONS_MAX_TOKENS_ESTIMATE} tokens. Please reduce the text.`);
      return;
    }

    onSave({
      id: profile?.id || crypto.randomUUID(),
      ownerId: profile?.ownerId || currentUserId,
      agentName,
      coreInstructions,
      knowledgeDocumentsText,
      brandVoice,
      selectedModel,
      imagePromptInstructions,
      sitemapPages,
      websiteContext,
    });
    
    if (!profile) { // Reset form only if it was a new creation
        setAgentName('');
        setCoreInstructions('');
        setKnowledgeDocumentsText('');
        setBrandVoice('');
        setSelectedModel(DEFAULT_TEXT_MODEL);
        setImagePromptInstructions('');
        setUrlListInput('');
        setSitemapPages([]);
        setWebsiteContext('');
    }
  };

  const handleProcessUrls = () => {
    setFormError(null);
    const urls = urlListInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));

    if (urls.length === 0) {
      setFormError("No valid URLs found. Please ensure each URL starts with http:// or https:// and is on its own line.");
      return;
    }
    
    const uniqueUrls = [...new Set(urls)];
    setSitemapPages(uniqueUrls.map(url => ({ url, selected: true })));
  };

  const handleGenerateContext = async () => {
    const selectedUrls = sitemapPages.filter(p => p.selected).map(p => p.url);
    if (selectedUrls.length === 0) {
      setFormError("Please select at least one URL to generate context from.");
      return;
    }
    setIsGeneratingContext(true);
    setFormError(null);
    try {
      const context = await generateWebsiteContext(selectedUrls);
      setWebsiteContext(context);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "An unknown error occurred while generating context.");
      }
    } finally {
      setIsGeneratingContext(false);
    }
  };
  
  const handlePageSelection = (index: number) => {
    const newPages = [...sitemapPages];
    newPages[index].selected = !newPages[index].selected;
    setSitemapPages(newPages);
  };
  
  const handleSelectAll = (select: boolean) => {
    setSitemapPages(sitemapPages.map(p => ({ ...p, selected: select })));
  };

  const selectedPageCount = useMemo(() => sitemapPages.filter(p => p.selected).length, [sitemapPages]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-xl border border-gray-200">
      <h3 className="text-2xl font-semibold text-sky-700 mb-6">
        {profile ? 'Edit AI Writer Profile' : 'Create New AI Writer Profile'}
      </h3>
      {formError && <p className="text-red-600 bg-red-100 p-3 rounded-md my-3 border border-red-300" role="alert">{formError}</p>}
      
      <TextInput
        label="Agent Name"
        name="agentName"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        placeholder="e.g., BrandX Expert, Casual Tech Reviewer"
        isRequired
      />

      <div>
        <label htmlFor="selectedModel" className="block text-sm font-medium text-gray-700 mb-1">
          Gemini Model for this Profile (Text Generation)
        </label>
        <select
          id="selectedModel"
          name="selectedModel"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm 
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 mb-4"
        >
          {AVAILABLE_TEXT_MODELS.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <TextAreaInput
        label="Core Instructions (AI Persona & Expertise)"
        name="coreInstructions"
        value={coreInstructions}
        onChange={(e) => setCoreInstructions(e.target.value)}
        placeholder="Define the AI's personality, role, expertise, and general writing style. E.g., 'You are a friendly financial advisor specializing in retirement planning for millennials...'"
        rows={8}
      />
      <div>
        <TextAreaInput
          label="Knowledge Base (Paste Text Content)"
          name="knowledgeDocumentsText"
          value={knowledgeDocumentsText}
          onChange={(e) => setKnowledgeDocumentsText(e.target.value)}
          placeholder={`Paste relevant text content (up to ${KNOWLEDGE_BASE_MAX_CHARS.toLocaleString()} characters). The AI uses this text directly. Please copy and paste actual content, not just URLs.`}
          rows={10}
          className={knowledgeBaseOverLimit ? 'border-red-500 focus:ring-red-500' : ''}
        />
        <div className={`text-xs mt-1 ${knowledgeBaseOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
          Estimated Usage: {currentKnowledgeChars.toLocaleString()} / {KNOWLEDGE_BASE_MAX_CHARS.toLocaleString()} characters.
          Approx. Tokens: {estimatedKnowledgeTokens.toLocaleString()} / {KNOWLEDGE_BASE_MAX_TOKENS_ESTIMATE.toLocaleString()} (est. {CHARS_PER_TOKEN_ESTIMATE} chars/token).
          {knowledgeBaseOverLimit && <span className="font-semibold"> Limit exceeded.</span>}
        </div>
      </div>
      
      <TextAreaInput
        label="Brand Voice & Specific Guidelines"
        name="brandVoice"
        value={brandVoice}
        onChange={(e) => setBrandVoice(e.target.value)}
        placeholder="Describe the target audience, desired tone (e.g., formal, witty, empathetic), specific keywords to include/avoid, brand mission, etc. E.g., 'Write for busy professionals. Tone should be concise and actionable. Avoid jargon. Always include a call to action for our newsletter.'"
        rows={8}
      />

      <div>
        <TextAreaInput
          label="Image Prompt Instructions (for Feature Image Generator)"
          name="imagePromptInstructions"
          value={imagePromptInstructions}
          onChange={(e) => setImagePromptInstructions(e.target.value)}
          placeholder={`Define general style, mood, or elements for image prompts. E.g., "Generate images in a photorealistic style, using a warm color palette." (Max ${IMAGE_PROMPT_INSTRUCTIONS_MAX_CHARS.toLocaleString()} chars)`}
          rows={5}
          className={imagePromptOverLimit ? 'border-red-500 focus:ring-red-500' : ''}
        />
        <div className={`text-xs mt-1 ${imagePromptOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
          Estimated Usage: {currentImagePromptChars.toLocaleString()} / {IMAGE_PROMPT_INSTRUCTIONS_MAX_CHARS.toLocaleString()} characters.
          Approx. Tokens: {estimatedImagePromptTokens.toLocaleString()} / {IMAGE_PROMPT_INSTRUCTIONS_MAX_TOKENS_ESTIMATE.toLocaleString()} (est. {CHARS_PER_TOKEN_ESTIMATE} chars/token).
          {imagePromptOverLimit && <span className="font-semibold"> Limit exceeded.</span>}
        </div>
      </div>

      <SectionCard title="Website Context Engine" icon={<GlobeAltIcon className="w-6 h-6 text-sky-600"/>} startOpen={false}>
          <div className="space-y-4">
              <p className="text-sm text-gray-600">Power internal link suggestions by providing your website's URLs. The AI will analyze the content of selected pages and use that context when writing new posts.</p>
              
              <div className="space-y-2">
                <TextAreaInput
                  label="Paste URLs for Context"
                  name="urlListInput"
                  value={urlListInput}
                  onChange={(e) => setUrlListInput(e.target.value)}
                  placeholder="Paste a list of your website's URLs here, with each URL on a new line. These will be analyzed to provide context for internal linking."
                  rows={8}
                />
                <Button type="button" onClick={handleProcessUrls} disabled={isGeneratingContext} className="bg-sky-500 hover:bg-sky-600 text-white w-full sm:w-auto">
                    Process URL List
                </Button>
              </div>


              {sitemapPages.length > 0 && (
                  <div className="space-y-3">
                      <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-gray-800">Select Pages for Context Analysis</h4>
                          <div className="flex gap-2">
                              <button type="button" onClick={() => handleSelectAll(true)} className="text-xs text-sky-600 hover:underline">Select All</button>
                              <button type="button" onClick={() => handleSelectAll(false)} className="text-xs text-sky-600 hover:underline">Deselect All</button>
                          </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-3 space-y-2 bg-gray-50">
                          {sitemapPages.map((page, index) => (
                              <div key={index} className="flex items-center">
                                  <input
                                      type="checkbox"
                                      id={`page-${index}`}
                                      checked={page.selected}
                                      onChange={() => handlePageSelection(index)}
                                      className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                  />
                                  <label htmlFor={`page-${index}`} className="ml-2 block text-sm text-gray-700 truncate" title={page.url}>
                                      {page.url}
                                  </label>
                              </div>
                          ))}
                      </div>
                      <p className="text-xs text-gray-500">{selectedPageCount} of {sitemapPages.length} pages selected.</p>
                      
                      <Button type="button" onClick={handleGenerateContext} disabled={isGeneratingContext || selectedPageCount === 0} className="w-full bg-teal-500 hover:bg-teal-600 text-white">
                          <SparklesIcon className="w-5 h-5 mr-2" />
                          {isGeneratingContext ? 'Generating Summaries...' : `Generate Context from ${selectedPageCount} Selected URLs`}
                      </Button>
                  </div>
              )}

              {websiteContext && (
                  <div>
                      <TextAreaInput
                          label="Generated Website Context"
                          name="websiteContext"
                          value={websiteContext}
                          readOnly
                          rows={10}
                          className="bg-gray-100 font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 mt-1">This context will be provided to the AI for internal link suggestions. It is saved with the profile.</p>
                  </div>
              )}
          </div>
      </SectionCard>

      <div className="flex space-x-4 pt-4">
        <Button 
          type="submit" 
          className="bg-green-500 hover:bg-green-600 text-white flex-1" 
          disabled={knowledgeBaseOverLimit || imagePromptOverLimit || isGeneratingContext}
          aria-live="polite"
        >
          {profile ? <SaveIcon className="w-5 h-5 mr-2" /> : <PlusCircleIcon className="w-5 h-5 mr-2" />}
          {profile ? 'Save Changes' : 'Create Profile'}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};
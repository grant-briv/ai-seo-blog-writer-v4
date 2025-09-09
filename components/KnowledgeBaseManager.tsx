import React, { useState, useCallback, useRef } from 'react';
import type { KnowledgeDocument } from '../types';
import { DocumentProcessingService } from '../services/documentProcessingService';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { TextAreaInput } from './TextAreaInput';
import { 
  DocumentTextIcon, 
  TrashIcon, 
  CloudArrowUpIcon, 
  EyeIcon, 
  EyeSlashIcon,
  LinkIcon,
  PlusIcon
} from './Icons';

interface KnowledgeBaseManagerProps {
  documents: KnowledgeDocument[];
  legacyText: string;
  profileId: string;
  onDocumentsChange: (documents: KnowledgeDocument[]) => void;
  onLegacyTextChange: (text: string) => void;
  disabled?: boolean;
}

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({
  documents,
  legacyText,
  profileId,
  onDocumentsChange,
  onLegacyTextChange,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleDocsUrl, setGoogleDocsUrl] = useState('');
  const [isAddingGoogleDoc, setIsAddingGoogleDoc] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const newDocuments: KnowledgeDocument[] = [];

      for (const file of Array.from(files)) {
        // Validate file
        const validation = DocumentProcessingService.validateFile(file);
        if (!validation.isValid) {
          throw new Error(`${file.name}: ${validation.error}`);
        }

        // Process file
        const document = await DocumentProcessingService.processFile(file, profileId);
        newDocuments.push(document);
      }

      // Add new documents to existing ones
      onDocumentsChange([...documents, ...newDocuments]);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file(s)');
    } finally {
      setIsProcessing(false);
    }
  }, [documents, profileId, onDocumentsChange]);

  const handleGoogleDocsAdd = useCallback(async () => {
    if (!googleDocsUrl.trim()) {
      setError('Please enter a Google Docs URL');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const document = await DocumentProcessingService.processGoogleDocsUrl(googleDocsUrl.trim(), profileId);
      onDocumentsChange([...documents, document]);
      setGoogleDocsUrl('');
      setIsAddingGoogleDoc(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process Google Docs URL');
    } finally {
      setIsProcessing(false);
    }
  }, [googleDocsUrl, documents, profileId, onDocumentsChange]);

  const handleDeleteDocument = useCallback((docId: string) => {
    onDocumentsChange(documents.filter(doc => doc.id !== docId));
  }, [documents, onDocumentsChange]);

  const toggleDocumentExpansion = useCallback((docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  }, [expandedDocs]);

  const formatFileSize = (sizeInChars: number): string => {
    if (sizeInChars < 1000) return `${sizeInChars} chars`;
    if (sizeInChars < 1000000) return `${(sizeInChars / 1000).toFixed(1)}K chars`;
    return `${(sizeInChars / 1000000).toFixed(1)}M chars`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getDocumentIcon = (type: KnowledgeDocument['type']) => {
    switch (type) {
      case 'pdf':
        return <DocumentTextIcon className="w-4 h-4 text-red-500" />;
      case 'markdown':
        return <DocumentTextIcon className="w-4 h-4 text-blue-500" />;
      case 'googledoc':
        return <LinkIcon className="w-4 h-4 text-green-500" />;
      default:
        return <DocumentTextIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0) + legacyText.length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button 
            type="button"
            onClick={() => setError(null)} 
            className="ml-2 text-red-500 hover:text-red-700 font-bold" 
            aria-label="Clear error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Legacy Text Area (for backward compatibility) */}
      <div>
        <TextAreaInput
          label="Manual Text Content (Legacy)"
          value={legacyText}
          onChange={(e) => onLegacyTextChange(e.target.value)}
          placeholder="Paste text content here (for backward compatibility)"
          rows={6}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500 mt-1">
          This field is maintained for backward compatibility. Consider uploading files instead.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
          <CloudArrowUpIcon className="w-5 h-5 mr-2 text-blue-600" />
          Upload Documents
        </h4>
        
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              variant="secondary"
              size="sm"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Upload Files
            </Button>
            
            <Button
              type="button"
              onClick={() => setIsAddingGoogleDoc(!isAddingGoogleDoc)}
              disabled={disabled || isProcessing}
              variant="secondary"
              size="sm"
            >
              <LinkIcon className="w-4 h-4 mr-1" />
              Add Google Docs
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.md,.markdown,.txt,text/plain,text/markdown,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {isAddingGoogleDoc && (
            <div className="flex gap-2">
              <TextInput
                label=""
                value={googleDocsUrl}
                onChange={(e) => setGoogleDocsUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                disabled={disabled || isProcessing}
              />
              <Button
                type="button"
                onClick={handleGoogleDocsAdd}
                disabled={disabled || isProcessing || !googleDocsUrl.trim()}
                size="sm"
              >
                Add
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsAddingGoogleDoc(false);
                  setGoogleDocsUrl('');
                }}
                disabled={disabled || isProcessing}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Supported: PDF, Markdown (.md), Text (.txt), Google Docs (public URLs). Max 50MB per file.
          </p>
        </div>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            Knowledge Documents ({documents.length})
          </h4>
          
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {getDocumentIcon(doc.type)}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-gray-900 truncate">
                        {doc.name}
                      </h5>
                      <div className="text-xs text-gray-500 flex items-center space-x-3">
                        <span>{doc.type.toUpperCase()}</span>
                        <span>{formatFileSize(doc.size)}</span>
                        <span>{formatDate(doc.uploadDate)}</span>
                        {doc.metadata?.pages && (
                          <span>{doc.metadata.pages} pages</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleDocumentExpansion(doc.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={expandedDocs.has(doc.id) ? "Hide content" : "Show content"}
                    >
                      {expandedDocs.has(doc.id) ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Delete document"
                      disabled={disabled}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {expandedDocs.has(doc.id) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono">
                        {doc.content.slice(0, 1000)}
                        {doc.content.length > 1000 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p>
          <strong>Total Content:</strong> {formatFileSize(totalSize)} 
          ({documents.length} documents + {legacyText.length > 0 ? '1 legacy text' : 'no legacy text'})
        </p>
        <p className="mt-1">
          This content will be automatically included when generating blog posts to provide context and expertise.
        </p>
      </div>

      {isProcessing && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Processing document(s)...</p>
        </div>
      )}
    </div>
  );
};
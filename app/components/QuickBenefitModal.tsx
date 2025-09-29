import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3 } from 'lucide-react';
import BenefitsModal from './BenefitsModal';
import DOMPurify from 'dompurify';

interface QuickBenefitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (payload: { selectedCategory: CategoryType; content: TemplateSections; resolvedBenefit: {district: string; taluka: string; category: 'I'|'II'|'III'} | null }) => void;
}

type CategoryType = 'general' | 'category1' | 'category2' | 'category3';

type TemplateSections = {
  overview: string;
};

type CategoryContent = Record<CategoryType, TemplateSections>;

// ContentEditable Editor Component
interface ContentEditableEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder: string;
}

const ContentEditableEditor: React.FC<ContentEditableEditorProps> = ({ content, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!content || content.trim() === '');

  useEffect(() => {
    setIsEmpty(!content || content.trim() === '');
  }, [content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = (e.currentTarget as HTMLDivElement).innerHTML;
    onChange(html);
    setIsEmpty(!html || html.trim() === '' || html === '<br>');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html);
  };

  const handleFocus = () => {
    if (isEmpty && editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const handleBlur = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setIsEmpty(!html || html.trim() === '' || html === '<br>');
    }
  };

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        className="w-full min-h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black whitespace-pre-wrap resize-y overflow-auto"
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
      {isEmpty && (
        <div className="absolute top-2 left-3 text-gray-500 text-sm pointer-events-none select-none">
          {placeholder}
        </div>
      )}
    </div>
  );
};

const QuickBenefitModal: React.FC<QuickBenefitModalProps> = ({ isOpen, onClose, onSave }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('general');
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const [resolvedBenefit, setResolvedBenefit] = useState<{district: string; taluka: string; category: 'I'|'II'|'III'} | null>(null);
  const [showContentEditor, setShowContentEditor] = useState(false);
  const [contentByCategory, setContentByCategory] = useState<CategoryContent>({
    general: { overview: '' },
    category1: { overview: '' },
    category2: { overview: '' },
    category3: { overview: '' }
  });
  const [editingContent, setEditingContent] = useState<TemplateSections>({
    overview: ''
  });

  // Load saved content from localStorage on component mount and when category changes
  useEffect(() => {
    if (isOpen) {
      handleContentLoad();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadCategoryContent(selectedCategory);
    }
  }, [selectedCategory, isOpen]);

  // Content management functions
  const handleContentLoad = () => {
    if (typeof window === 'undefined') return;
    
    const categories: CategoryType[] = ['general', 'category1', 'category2', 'category3'];
    const loadedContent: Partial<CategoryContent> = {};
    
    categories.forEach(category => {
      try {
        const saved = localStorage.getItem(`quickBenefitTemplate_${category}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          loadedContent[category] = parsed;
        }
      } catch (error) {
        console.warn(`Error loading content for ${category}:`, error);
        // Reset to defaults for this category on error
        loadedContent[category] = { overview: '' };
      }
    });
    
    setContentByCategory(prev => ({ ...prev, ...loadedContent }));
  };

  const loadCategoryContent = (category: CategoryType) => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(`quickBenefitTemplate_${category}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setContentByCategory(prev => ({ ...prev, [category]: parsed }));
      }
    } catch (error) {
      console.warn(`Error loading content for ${category}:`, error);
    }
  };

  const handleContentSave = (category: CategoryType, content: TemplateSections) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Sanitize content before saving
      const sanitized = { overview: DOMPurify.sanitize(content.overview) };
      
      // Update the category content
      setContentByCategory(prev => ({ ...prev, [category]: sanitized }));
      
      // Save to localStorage
      localStorage.setItem(`quickBenefitTemplate_${category}`, JSON.stringify(sanitized));
      
      // Close the editor
      setShowContentEditor(false);
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Failed to save content. Please try again.');
    }
  };

  const handleEditContent = () => {
    const currentContent = contentByCategory[selectedCategory];
    setEditingContent(currentContent);
    setShowContentEditor(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Quick Benefit Template</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEditContent}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Edit Content"
            >
              <Edit3 className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Template sections */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Template Content - {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Benefits Overview</h4>
                <div
                  className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(contentByCategory[selectedCategory].overview) || 'This section will contain benefits overview...' 
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 gap-4">
          {/* Category buttons */}
          <div className="flex items-center gap-2 gap-y-2 flex-wrap" role="group" aria-label="Benefit category">
            {([
              {key: 'general', label: 'General', classes: 'bg-gray-600 hover:bg-gray-700'},
              {key: 'category1', label: 'Category 1', classes: 'bg-blue-600 hover:bg-blue-700'},
              {key: 'category2', label: 'Category 2', classes: 'bg-green-600 hover:bg-green-700'},
              {key: 'category3', label: 'Category 3', classes: 'bg-purple-600 hover:bg-purple-700'},
            ] as const).map(({key, label, classes}) => {
              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  {...(isSelected ? { "aria-pressed": "true" } : { "aria-pressed": "false" })}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? `${classes} text-white border-transparent`
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Benefits button */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowBenefitsModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              title="Open Benefits selector"
            >
              Benefits
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onSave?.({
                  selectedCategory,
                  content: contentByCategory[selectedCategory],
                  resolvedBenefit
                });
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Save Template
            </button>
          </div>
        </div>
      </div>

      {/* Benefits Modal */}
      <BenefitsModal
        isOpen={showBenefitsModal}
        onClose={() => setShowBenefitsModal(false)}
        onCategoryResolved={(district, taluka, category) => {
          setResolvedBenefit({ district, taluka, category });
          setShowBenefitsModal(false);
        }}
      />

      {/* Content Editor Modal */}
      {showContentEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Template Content - {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
              </h2>
              <button
                onClick={() => setShowContentEditor(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Close editor"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Editor Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Benefits Overview Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benefits Overview
                  </label>
                  <ContentEditableEditor
                    content={editingContent.overview}
                    onChange={(html) => setEditingContent(prev => ({ ...prev, overview: html }))}
                    placeholder="Enter benefits overview content... Bold text, formatting, spaces, and line breaks will be preserved exactly as typed or pasted."
                  />
                </div>
              </div>
            </div>

            {/* Editor Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowContentEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleContentSave(selectedCategory, editingContent)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Save Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickBenefitModal;

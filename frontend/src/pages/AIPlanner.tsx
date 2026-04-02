import React, { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import { ChatMessage, AISuggestion, Resource, Project } from '../types';
import { planWithAI, getResources, getProjects, createAllocation } from '../api/client';

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}
        >
          {message.content.replace(/SUGGESTIONS:[\s\S]*$/, '').trim()}
        </div>
        <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 ml-3 mt-1">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: AISuggestion;
  resources: Resource[];
  projects: Project[];
  onApply: (suggestion: AISuggestion) => void;
  applied: boolean;
}

function SuggestionCard({ suggestion, resources, projects, onApply, applied }: SuggestionCardProps) {
  const resource = resources.find(r => r.id === suggestion.resource_id);
  const project = projects.find(p => p.id === suggestion.project_id);

  const pctColor =
    suggestion.percentage < 80
      ? 'text-green-600 bg-green-50'
      : suggestion.percentage <= 100
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${
      applied ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900">{suggestion.resource_name}</span>
          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="text-sm text-indigo-600">{suggestion.project_name}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>Week of {formatDate(suggestion.week_start)}</span>
          {suggestion.notes && <span className="text-gray-400">"{suggestion.notes}"</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctColor}`}>
          {suggestion.percentage}%
        </span>
        <button
          onClick={() => onApply(suggestion)}
          disabled={applied || !suggestion.resource_id || !suggestion.project_id}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            applied
              ? 'bg-green-100 text-green-700 cursor-default'
              : suggestion.resource_id && suggestion.project_id
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          title={!suggestion.resource_id || !suggestion.project_id ? 'Cannot match resource/project' : ''}
        >
          {applied ? 'Applied' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

export default function AIPlanner() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your AI resource planning assistant.

Tell me about a project you need to staff — for example:
- "I need a frontend developer and a backend dev for a 4-week project starting next Monday"
- "Find me someone with React and Node.js skills for 60% allocation for 3 weeks"
- "We have a DevOps project starting in 2 weeks that needs 2 developers"

I'll analyze your team's current availability and suggest the best allocations.`,
      timestamp: new Date(),
      suggestions: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const [res, proj] = await Promise.all([getResources(), getProjects()]);
      setResources(res);
      setProjects(proj);
    };
    loadData().catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setApplyError('');

    const conversationHistory = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const result = await planWithAI({
        message: text,
        conversationHistory,
      });

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        suggestions: result.suggestions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorContent = err.response?.data?.error || err.message || 'Failed to get AI response';
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorContent}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleApplySuggestion(suggestion: AISuggestion, messageId: string, suggIndex: number) {
    if (!suggestion.resource_id || !suggestion.project_id) return;

    const key = `${messageId}-${suggIndex}`;
    setApplyError('');

    try {
      await createAllocation({
        resource_id: suggestion.resource_id,
        project_id: suggestion.project_id,
        week_start: suggestion.week_start,
        percentage: suggestion.percentage,
        notes: suggestion.notes || 'Created via AI Planner',
      });
      setAppliedSuggestions(prev => new Set([...prev, key]));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to apply suggestion';
      setApplyError(`Failed to apply suggestion for ${suggestion.resource_name}: ${msg}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const currentMonday = getMonday(new Date());
  const examplePrompts = [
    `Need a React dev for 60% for 3 weeks starting ${currentMonday}`,
    'Staff a backend API project for 2 weeks, 2 engineers',
    'Who is most available next month for a new project?',
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="AI Planner"
        subtitle="AI-powered resource allocation suggestions"
      />

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map(message => (
          <div key={message.id}>
            <MessageBubble message={message} />
            {message.suggestions && message.suggestions.length > 0 && (
              <div className="ml-11 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Suggested Allocations
                </p>
                <div className="space-y-2">
                  {message.suggestions.map((suggestion, idx) => (
                    <SuggestionCard
                      key={idx}
                      suggestion={suggestion}
                      resources={resources}
                      projects={projects}
                      applied={appliedSuggestions.has(`${message.id}-${idx}`)}
                      onApply={(s) => handleApplySuggestion(s, message.id, idx)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mr-3">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {applyError && (
          <div className="mb-3 mx-11 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
            {applyError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example prompts */}
      {messages.length === 1 && !loading && (
        <div className="px-6 pb-2">
          <p className="text-xs text-gray-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map(prompt => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a project or resource need... (Enter to send, Shift+Enter for new line)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={loading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary h-11 px-4 flex-shrink-0"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { Send, Mic } from 'lucide-react';
import AudioRecorder from './AudioRecorder';

const MessageComposer = ({ onSendMessage, loading = false }) => {
  const [textInput, setTextInput] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const inputRef = useRef(null);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!textInput.trim() && !audioUrl) return;

    onSendMessage({
      text: textInput.trim(),
      audioUrl: audioUrl || null
    });

    setTextInput('');
    setAudioUrl('');
    setShowAudioRecorder(false);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
    // Auto expand textarea height on typing multiple lines
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
  };

  return (
    <div className="p-3 border-t border-border/30 bg-card space-y-2 shrink-0">
      {showAudioRecorder && (
        <div className="animate-in fade-in duration-200">
          <AudioRecorder
            onAudioRecorded={(url) => setAudioUrl(url)}
            onCancel={() => setShowAudioRecorder(false)}
          />
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Type your message"
          value={textInput}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 text-xs p-2.5 bg-muted/20 border border-border/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-foreground placeholder:text-muted-foreground resize-none max-h-24 scrollbar-thin transition-all"
        />

        <button
          type="button"
          onClick={() => setShowAudioRecorder(prev => !prev)}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            showAudioRecorder
              ? 'bg-red-500/15 border-red-500/30 text-red-500'
              : 'bg-muted/30 border-border/40 hover:bg-muted text-muted-foreground'
          }`}
          title="Toggle voice audio recording"
          aria-label="Toggle voice audio recording"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={loading || (!textInput.trim() && !audioUrl)}
          className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;

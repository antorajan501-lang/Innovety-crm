import React, { useState } from 'react';
import { X, RefreshCw, Send } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import api from '../services/api';

const RetryModal = ({ isOpen, onClose, task, onTaskRetried }) => {
  const [resubmissionNotes, setResubmissionNotes] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      const res = await api.post(`/tasks/${task.id}/retry`, {
        resubmissionNotes,
        audioUrl
      });

      if (onTaskRetried) {
        onTaskRetried(res.data);
      }
      onClose();
    } catch (err) {
      console.error('Retry task error:', err);
      setError(err.response?.data?.message || 'Failed to resubmit task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-card border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <RefreshCw className="w-5 h-5" />
            <h3 className="text-base font-extrabold text-foreground">Retry & Resubmit Task</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Task: <span className="font-bold text-foreground">"{task.title}"</span>
        </p>

        {error && (
          <div className="text-xs font-semibold text-red-500 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resubmission Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Resubmission Notes / Changes Made</label>
            <textarea
              rows={3}
              placeholder="Describe corrections made (e.g. Fixed API endpoint status and added error handling)..."
              value={resubmissionNotes}
              onChange={(e) => setResubmissionNotes(e.target.value)}
              className="w-full text-xs p-3 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Optional Audio Recorder */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Voice Explanation (Optional)</label>
            <AudioRecorder
              onAudioRecorded={(url) => setAudioUrl(url)}
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-border/50 hover:bg-muted text-muted-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Resubmitting...' : 'Resubmit Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RetryModal;

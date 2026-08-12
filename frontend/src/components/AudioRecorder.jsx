import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, UploadCloud } from 'lucide-react';
import api from '../services/api';

const AudioRecorder = ({ onAudioRecorded, onCancel, className = '' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError('');
      setAudioBlob(null);
      setAudioUrl(null);
      setUploadSuccess(false);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Microphone access denied or unsupported.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const clearRecording = () => {
    if (isPlaying && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setUploadSuccess(false);
  };

  const handleUploadAndSave = async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);
      setError('');
      const formData = new FormData();
      formData.append('file', audioBlob, `audio_record_${Date.now()}.webm`);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const serverAudioUrl = res.data.fileUrl || res.data.url;
      setUploadSuccess(true);
      if (onAudioRecorded) {
        onAudioRecorded(serverAudioUrl);
      }
    } catch (err) {
      console.error('Audio upload error:', err);
      setError('Failed to upload audio message.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`p-3 bg-card border border-border/50 rounded-2xl shadow-xs space-y-3 ${className}`}>
      {error && (
        <div className="text-[11px] font-semibold text-red-500 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
          {error}
        </div>
      )}

      {/* State 1: Ready to Record */}
      {!isRecording && !audioUrl && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-muted-foreground">Voice Audio Message</span>
          </div>
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer"
            aria-label="Start recording audio message"
          >
            <Mic className="w-4 h-4" />
            <span>Record Voice</span>
          </button>
        </div>
      )}

      {/* State 2: Active Recording */}
      {isRecording && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
              Recording... {formatTime(recordingTime)}
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-bold shadow-xs hover:bg-red-600 transition-all cursor-pointer"
            aria-label="Stop audio recording"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* State 3: Recording Review & Upload */}
      {audioUrl && !isRecording && (
        <div className="space-y-2">
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl border border-border/30">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs hover:scale-105 transition-all cursor-pointer"
                aria-label={isPlaying ? "Pause audio playback" : "Play audio recording preview"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Voice Message ({formatTime(recordingTime)})</p>
                <p className="text-[10px] text-muted-foreground font-mono">audio/webm</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={clearRecording}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                title="Discard audio recording"
                aria-label="Discard recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {!uploadSuccess ? (
                <button
                  type="button"
                  onClick={handleUploadAndSave}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  aria-label="Attach audio to message"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Attach Audio'}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 text-xs font-extrabold border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Ready
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;

import React, { useState, useEffect } from 'react';
import { getBackendBaseUrl, setBackendBaseUrl, api } from '../api/client';
import { Server, CheckCircle2, AlertTriangle, ExternalLink, X } from 'lucide-react';

interface BackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const BackendModal: React.FC<BackendModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(getBackendBaseUrl());
      setStatus('idle');
      setStatusMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const target = url.trim().replace(/\/+$/, '');
    setTesting(true);
    setStatus('idle');
    try {
      const checkUrl = target ? `${target}/api/streets?city=Chikkaballapur` : '/api/streets?city=Chikkaballapur';
      const res = await fetch(checkUrl);
      if (res.ok) {
        setStatus('success');
        setStatusMsg('Live Python backend reachable! (200 OK)');
      } else {
        setStatus('error');
        setStatusMsg(`Backend returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(`Connection failed: ${err.message || 'Cannot reach URL'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setBackendBaseUrl(url);
    if (onConnected) onConnected();
    onClose();
    window.location.reload();
  };

  const handleResetDefault = () => {
    setBackendBaseUrl('');
    setUrl('');
    if (onConnected) onConnected();
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800 font-sans">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Python Backend Connection</h3>
              <p className="text-xs text-slate-300">Connect GitHub Pages to your live Python Flask server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 leading-relaxed">
            <strong className="block text-blue-950 font-bold mb-1">Why is this needed on GitHub?</strong>
            GitHub Pages is a static file host (HTML/CSS) and cannot run Python or databases. To use real-time Python simulations on GitHub Pages, paste your live backend URL below (Render, Cloudflare Tunnel, or Railway).
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Live Backend URL:
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://your-app.onrender.com or https://...trycloudflare.com"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Leave blank to use default relative path (<code>/api</code>) with in-browser demo data.
            </span>
          </div>

          {/* Test connection status message */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {url && (
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 underline text-[11px] cursor-pointer"
                >
                  Reset to Demo
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md transition-colors cursor-pointer"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

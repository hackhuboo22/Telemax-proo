import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, FileCode, CheckCircle2 } from 'lucide-react';
import { ChannelRoute, TelegramCredentials } from '../types/telegram';
import {
  generatePythonTelethonBot,
  generateDockerfile,
  generateDockerCompose,
  generateRequirementsTxt,
  generateDeploymentGuide,
} from '../utils/codeGenerators';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: TelegramCredentials;
  routes: ChannelRoute[];
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  credentials,
  routes,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'bot.py' | 'Dockerfile' | 'docker-compose.yml' | 'requirements.txt' | 'README.md'>('bot.py');
  const [copied, setCopied] = useState(false);

  const pythonScript = generatePythonTelethonBot(credentials, routes);
  const dockerfile = generateDockerfile();
  const dockerCompose = generateDockerCompose();
  const requirements = generateRequirementsTxt();
  const guide = generateDeploymentGuide();

  const getFileContent = () => {
    switch (activeTab) {
      case 'bot.py':
        return pythonScript;
      case 'Dockerfile':
        return dockerfile;
      case 'docker-compose.yml':
        return dockerCompose;
      case 'requirements.txt':
        return requirements;
      case 'README.md':
        return guide;
      default:
        return pythonScript;
    }
  };

  const currentContent = getFileContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadActiveFile = () => {
    const blob = new Blob([currentContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span>Export 24/7 Production Bot for VPS / Server</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production Telethon + FFmpeg script pre-configured with your API ID, routes, 5s intro crop, and link cleaner.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher & actions */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* File tabs */}
          <div className="flex items-center gap-1">
            {(['bot.py', 'Dockerfile', 'docker-compose.yml', 'requirements.txt', 'README.md'] as const).map(
              (file) => (
                <button
                  key={file}
                  onClick={() => setActiveTab(file)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                    activeTab === file
                      ? 'bg-slate-800 text-cyan-400 font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {file}
                </button>
              )
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadActiveFile}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download {activeTab}</span>
            </button>
          </div>
        </div>

        {/* Code display */}
        <div className="p-6 overflow-y-auto flex-1 bg-black/90 font-mono text-xs text-slate-200 leading-relaxed">
          <pre className="select-all whitespace-pre-wrap">{currentContent}</pre>
        </div>

        {/* Quick Instructions Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono">Quick Run:</span>
            <code className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-200 font-mono text-[11px]">
              pip install telethon && python bot.py
            </code>
          </div>

          <div className="text-[11px] text-slate-500">
            Requires FFmpeg installed on server for 5s cutting
          </div>
        </div>
      </div>
    </div>
  );
};

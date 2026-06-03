import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_PROMPT = "Extract the visible text and clean the formatting. Preserve numbers, names, dates, and line breaks.";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [freeReplyUsed, setFreeReplyUsed] = useState(false);

  useEffect(() => {
    const used = localStorage.getItem('cleancopy_free_reply_used');
    if (used === 'true') {
      setFreeReplyUsed(true);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrorMessage(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpeg', '.jpg', '.webp'] },
    maxFiles: 1,
  });

  const clearWorkspace = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setOutputText("");
    setErrorMessage(null);
  };

  const handleCleanText = async () => {
    if (!selectedFile) return;

    if (freeReplyUsed) {
      setShowPaywall(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setOutputText("");

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read file."));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const dataUrl = await base64Promise;
      const base64Data = dataUrl.split(',')[1];
      const mimeType = selectedFile.type;

      const res = await fetch("/api/clean-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageBuffer: base64Data,
          mimeType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract text.");
      }

      setOutputText(data.text);
      setFreeReplyUsed(true);
      localStorage.setItem('cleancopy_free_reply_used', 'true');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen pb-24 selection:bg-aura-text selection:text-aura-bg font-sans">
      <div className="max-w-2xl mx-auto px-6 pt-24 font-light">
        
        {/* Header */}
        <header className="mb-16 text-center">
          <h1 className="text-3xl font-medium tracking-tight text-aura-text mb-4">
            AI Vision
          </h1>
          <p className="text-[15px] text-aura-text-muted max-w-sm mx-auto leading-relaxed">
            Drop your screenshot below to extract perfectly formatted text.
          </p>
        </header>

        {/* Main Work Area */}
        <main className="space-y-8">
          
          {/* Image Input Area */}
          <div className="relative group transition-all duration-500 will-change-transform">
            {previewUrl ? (
              <div className="relative rounded-[2rem] overflow-hidden bg-aura-card border border-aura-border shadow-2xl">
                <img src={previewUrl} alt="Document preview" className="w-full max-h-[500px] object-cover block opacity-90 transition-opacity hover:opacity-100" />
                <button 
                  onClick={clearWorkspace}
                  className="absolute top-6 right-6 px-4 py-2 text-[13px] font-medium bg-black/40 hover:bg-black/80 text-white backdrop-blur-xl rounded-full transition-all duration-300"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div 
                {...getRootProps()} 
                className={`
                  rounded-[2rem] p-16 text-center cursor-pointer transition-all duration-500 ease-out
                  ${isDragActive ? 'bg-aura-card border-none scale-[0.98]' : 'bg-transparent border border-aura-border hover:bg-aura-card hover:border-transparent'}
                `}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <p className="text-[17px] font-medium tracking-tight text-aura-text">
                    {isDragActive ? "Drop to upload" : "Select or drop image"}
                  </p>
                  <p className="text-[13px] text-aura-text-muted">
                    PNG, JPG, WEBP formats supported.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Prompt & Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Extraction instructions..."
                className="w-full px-6 py-4 bg-transparent border-b border-aura-border text-[15px] focus:outline-none focus:border-aura-text transition-colors disabled:opacity-30 placeholder:text-aura-text-muted"
                disabled={isLoading || !selectedFile}
              />
            </div>
            <button
              onClick={handleCleanText}
              disabled={isLoading || !selectedFile || !prompt.trim()}
              className="w-full sm:w-auto px-8 py-4 bg-aura-text hover:opacity-80 active:scale-[0.98] disabled:bg-aura-border disabled:text-aura-text-muted disabled:opacity-50 disabled:cursor-not-allowed text-aura-bg text-[15px] font-medium rounded-full transition-all duration-300 whitespace-nowrap"
            >
              {isLoading ? "Extracting..." : "Extract Text"}
            </button>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="text-aura-red text-[13px] font-medium text-center"
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Area */}
          <AnimatePresence>
            {outputText && !isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-aura-card border border-aura-border rounded-[2rem] overflow-hidden mt-12"
              >
                <div className="flex items-center justify-between px-8 py-6 border-b border-aura-border">
                  <span className="text-[12px] font-medium text-aura-text-muted tracking-widest uppercase">Output</span>
                  <button 
                    onClick={copyToClipboard}
                    className="text-[13px] font-medium text-aura-text hover:opacity-60 transition-opacity"
                  >
                    {isCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="p-8">
                  <textarea
                    readOnly
                    value={outputText}
                    className="w-full min-h-[300px] text-[13px] text-aura-text/90 font-mono leading-relaxed bg-transparent border-none resize-y focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>

      {/* Paywall Modal */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#111111] overflow-hidden flex flex-col w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <div className="px-10 py-12 text-center">
                <h2 className="text-[22px] font-medium tracking-tight text-white mb-4">AI Vision Pro</h2>
                <p className="text-[15px] font-light text-white/60 leading-relaxed mb-10">
                  You have reached the limit of free extractions. Upgrade for unlimited processing, seamless formatting, and lifetime access.
                </p>
                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      setFreeReplyUsed(false);
                      localStorage.setItem('cleancopy_free_reply_used', 'false');
                      setShowPaywall(false);
                      setTimeout(handleCleanText, 100);
                    }}
                    className="w-full py-4 bg-white text-black text-[15px] font-medium rounded-full hover:opacity-90 active:scale-[0.98] transition-all duration-300"
                  >
                    Unlock Lifetime Access — $9.99
                  </button>
                  <button 
                    onClick={() => {
                      setFreeReplyUsed(false);
                      localStorage.setItem('cleancopy_free_reply_used', 'false');
                      setShowPaywall(false);
                    }}
                    className="w-full py-4 text-white/80 hover:text-white text-[15px] font-medium transition-colors border border-white/10 rounded-full hover:bg-white/5 active:scale-[0.98]"
                  >
                    Restore Purchases
                  </button>
                  <button 
                    onClick={() => setShowPaywall(false)}
                    className="w-full py-4 text-white/50 hover:text-white text-[15px] font-medium transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 border-t border-white/10 flex items-center justify-center gap-6 text-[11px] font-medium text-white/40 tracking-wide uppercase">
                <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" className="hover:text-white/80 transition-colors">Terms</a>
                <a href="https://www.apple.com/legal/privacy/en-ww/" target="_blank" rel="noreferrer" className="hover:text-white/80 transition-colors">Privacy</a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


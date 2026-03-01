import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Only show if not already installed and not dismissed recently
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 86400000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white border border-orange-200 rounded-2xl shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4" data-testid="pwa-install-banner">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-900">Install SSC Track</p>
          <p className="text-xs text-stone-500 mt-0.5">Access your business data offline with our app</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="rounded-xl h-7 text-xs" onClick={handleInstall} data-testid="pwa-install-btn">
              Install
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={dismiss}>
              Not Now
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-stone-400 hover:text-stone-600">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

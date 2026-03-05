import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // iOS detection
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    if (isiOS && !window.navigator.standalone) {
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    // Android/Desktop - listen for install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-in slide-in-from-bottom-4 duration-300" data-testid="pwa-install-banner">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">Install SSC Track</p>
              <p className="text-xs text-muted-foreground">Use as a mobile or desktop app</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-stone-400 hover:text-stone-600 p-1" data-testid="pwa-dismiss">
            <X size={16} />
          </button>
        </div>

        {isIOS ? (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-xs space-y-1.5">
            <p className="font-medium text-blue-800 dark:text-blue-300">To install on iPhone/iPad:</p>
            <p className="text-blue-700 dark:text-blue-400">1. Tap the <strong>Share</strong> button (box with arrow)</p>
            <p className="text-blue-700 dark:text-blue-400">2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
            <p className="text-blue-700 dark:text-blue-400">3. Tap <strong>"Add"</strong> to confirm</p>
          </div>
        ) : (
          <Button onClick={handleInstall} className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white" data-testid="pwa-install-btn">
            <Download size={14} className="mr-2" />Install App
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">Works offline with instant access</p>
      </div>
    </div>
  );
}

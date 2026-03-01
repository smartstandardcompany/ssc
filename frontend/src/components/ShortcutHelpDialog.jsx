import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

export function ShortcutHelpDialog() {
  const [open, setOpen] = useState(false);

  const handleShortcutHelp = useCallback(() => setOpen(true), []);
  const handleEscape = useCallback(() => setOpen(false), []);

  useEffect(() => {
    window.addEventListener('shortcut:help', handleShortcutHelp);
    window.addEventListener('shortcut:escape', handleEscape);
    return () => {
      window.removeEventListener('shortcut:help', handleShortcutHelp);
      window.removeEventListener('shortcut:escape', handleEscape);
    };
  }, [handleShortcutHelp, handleEscape]);

  const navNumShortcuts = SHORTCUTS.filter(s => s.action === 'nav' && s.keys.includes('ctrl') && !s.keys.includes('shift') && !s.keys.includes('alt'));
  const navShiftShortcuts = SHORTCUTS.filter(s => s.action === 'nav' && s.keys.includes('shift'));
  const navAltShortcuts = SHORTCUTS.filter(s => s.action === 'nav' && s.keys.includes('alt'));
  const actionShortcuts = SHORTCUTS.filter(s => s.action === 'event' && s.event !== 'shortcut:help' && s.event !== 'shortcut:escape');

  const renderGroup = (label, items) => (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase mb-2">{label}</p>
      <div className="space-y-1">
        {items.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800">
            <span className="text-sm">{s.label}</span>
            <div className="flex gap-0.5">
              {s.keys.map((k, j) => (
                <Badge key={j} variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">
                  {k === 'ctrl' ? '⌘/Ctrl' : k === 'shift' ? '⇧' : k === 'alt' ? 'Alt' : k}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" data-testid="shortcut-help-dialog">
        <DialogHeader>
          <DialogTitle className="font-outfit">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {renderGroup('Quick Navigation (Ctrl + Number)', navNumShortcuts)}
          {renderGroup('Page Navigation (Ctrl + Shift)', navShiftShortcuts)}
          {renderGroup('More Pages (Alt + Key)', navAltShortcuts)}
          {renderGroup('Actions', actionShortcuts)}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">System</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800">
                <span className="text-sm">Show Shortcuts</span>
                <div className="flex gap-0.5">
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">⌘/Ctrl</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">/</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800">
                <span className="text-sm">Close Dialog</span>
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">Esc</Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

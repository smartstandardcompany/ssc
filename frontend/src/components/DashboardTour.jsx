import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Sparkles, LayoutDashboard, Zap, Brain, Package, Clock, Users, TrendingUp, Settings, CheckCircle } from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to SSC Track! 🎉',
    titleAr: 'مرحباً بك في SSC Track! 🎉',
    description: 'Let us show you around your new business management dashboard. This quick tour will help you get started.',
    descriptionAr: 'دعنا نعرفك على لوحة التحكم الجديدة لإدارة أعمالك. هذه الجولة السريعة ستساعدك على البدء.',
    icon: LayoutDashboard,
    target: null,
    position: 'center'
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    titleAr: 'إجراءات سريعة',
    description: 'Access your most common tasks instantly. These buttons adapt based on your role and permissions.',
    descriptionAr: 'الوصول السريع لمهامك الأكثر شيوعاً. هذه الأزرار تتكيف بناءً على دورك وصلاحياتك.',
    icon: Zap,
    target: '[data-testid="quick-actions-widget"]',
    position: 'bottom'
  },
  {
    id: 'ai-widgets',
    title: 'AI-Powered Insights',
    titleAr: 'رؤى مدعومة بالذكاء الاصطناعي',
    description: 'Get predictive analytics including low stock alerts, peak hours, customer value, and profit trends.',
    descriptionAr: 'احصل على تحليلات تنبؤية تشمل تنبيهات المخزون المنخفض، ساعات الذروة، قيمة العملاء، واتجاهات الربح.',
    icon: Brain,
    target: '[data-testid="low-stock-widget"]',
    position: 'top'
  },
  {
    id: 'low-stock',
    title: 'Low Stock Alerts',
    titleAr: 'تنبيهات المخزون المنخفض',
    description: 'AI predicts which items will run low soon, helping you reorder before stockouts.',
    descriptionAr: 'الذكاء الاصطناعي يتنبأ بالمنتجات التي ستنفد قريباً، مما يساعدك على إعادة الطلب قبل نفاد المخزون.',
    icon: Package,
    target: '[data-testid="low-stock-widget"]',
    position: 'right'
  },
  {
    id: 'peak-hours',
    title: 'Peak Hours Analysis',
    titleAr: 'تحليل ساعات الذروة',
    description: 'See when your business is busiest to optimize staffing and resources.',
    descriptionAr: 'اعرف أوقات الذروة في عملك لتحسين التوظيف والموارد.',
    icon: Clock,
    target: '[data-testid="peak-hours-widget"]',
    position: 'left'
  },
  {
    id: 'customer-clv',
    title: 'Customer Lifetime Value',
    titleAr: 'قيمة العميل مدى الحياة',
    description: 'Identify your most valuable customers and their predicted lifetime value.',
    descriptionAr: 'حدد عملائك الأكثر قيمة وقيمتهم المتوقعة على المدى الطويل.',
    icon: Users,
    target: '[data-testid="customer-clv-widget"]',
    position: 'right'
  },
  {
    id: 'profit-trend',
    title: 'Profit Trends',
    titleAr: 'اتجاهات الربح',
    description: 'Track daily profit trends, best performing days, and identify areas for improvement.',
    descriptionAr: 'تتبع اتجاهات الربح اليومية، أفضل الأيام أداءً، وحدد مجالات التحسين.',
    icon: TrendingUp,
    target: '[data-testid="profit-trend-widget"]',
    position: 'left'
  },
  {
    id: 'customize',
    title: 'Customize Your Dashboard',
    titleAr: 'خصص لوحة التحكم',
    description: 'Click the settings icon to show/hide widgets and rearrange them to suit your workflow.',
    descriptionAr: 'انقر على أيقونة الإعدادات لإظهار/إخفاء الأدوات وترتيبها حسب طريقة عملك.',
    icon: Settings,
    target: '[data-testid="widget-settings-btn"]',
    position: 'bottom'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! ✨',
    titleAr: 'أنت جاهز! ✨',
    description: 'Explore the sidebar to access all features. Need help? Click the Help icon anytime.',
    descriptionAr: 'استكشف القائمة الجانبية للوصول لجميع الميزات. تحتاج مساعدة؟ انقر على أيقونة المساعدة في أي وقت.',
    icon: CheckCircle,
    target: null,
    position: 'center'
  }
];

export default function DashboardTour({ onComplete, language = 'en' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState(null);

  const isArabic = language === 'ar';
  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  useEffect(() => {
    // Check if tour was already completed
    const tourCompleted = localStorage.getItem('ssc_dashboard_tour_completed');
    if (tourCompleted === 'true') {
      setIsVisible(false);
      return;
    }

    // Find and highlight target element
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('tour-highlight');
      }
    } else {
      setTargetRect(null);
    }

    return () => {
      // Remove highlight from all elements
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    };
  }, [currentStep, step.target]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('ssc_dashboard_tour_completed', 'true');
    localStorage.setItem('ssc_dashboard_tour_date', new Date().toISOString());
    setIsVisible(false);
    onComplete?.();
  };

  const resetTour = () => {
    localStorage.removeItem('ssc_dashboard_tour_completed');
    localStorage.removeItem('ssc_dashboard_tour_date');
    setCurrentStep(0);
    setIsVisible(true);
  };

  if (!isVisible) return null;

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect || step.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001
      };
    }

    const padding = 16;
    const tooltipWidth = 380;
    const tooltipHeight = 220;

    let style = {
      position: 'fixed',
      zIndex: 10001
    };

    switch (step.position) {
      case 'top':
        style.top = Math.max(padding, targetRect.top - tooltipHeight - padding);
        style.left = Math.max(padding, targetRect.left + (targetRect.width - tooltipWidth) / 2);
        break;
      case 'bottom':
        style.top = Math.min(window.innerHeight - tooltipHeight - padding, targetRect.bottom + padding);
        style.left = Math.max(padding, targetRect.left + (targetRect.width - tooltipWidth) / 2);
        break;
      case 'left':
        style.top = Math.max(padding, targetRect.top + (targetRect.height - tooltipHeight) / 2);
        style.left = Math.max(padding, targetRect.left - tooltipWidth - padding);
        break;
      case 'right':
        style.top = Math.max(padding, targetRect.top + (targetRect.height - tooltipHeight) / 2);
        style.left = Math.min(window.innerWidth - tooltipWidth - padding, targetRect.right + padding);
        break;
      default:
        style.top = '50%';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
    }

    return style;
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
        onClick={handleSkip}
        data-testid="tour-overlay"
      />

      {/* Highlight cutout */}
      {targetRect && (
        <div
          className="fixed border-4 border-orange-500 rounded-xl z-[10000] pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(249,115,22,0.5)'
          }}
        />
      )}

      {/* Tooltip */}
      <Card 
        className="w-[380px] shadow-2xl border-orange-200 bg-white dark:bg-stone-900"
        style={getTooltipStyle()}
        data-testid="tour-tooltip"
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                <Icon size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-white">
                  {isArabic ? step.titleAr : step.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-stone-900"
              onClick={handleSkip}
              data-testid="tour-close-btn"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Content */}
          <p className={`text-sm text-stone-600 dark:text-stone-300 mb-6 leading-relaxed ${isArabic ? 'text-right' : ''}`}>
            {isArabic ? step.descriptionAr : step.description}
          </p>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-stone-900"
              data-testid="tour-skip-btn"
            >
              {isArabic ? 'تخطي' : 'Skip Tour'}
            </Button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="gap-1"
                  data-testid="tour-prev-btn"
                >
                  <ChevronLeft size={16} />
                  {isArabic ? 'السابق' : 'Back'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                data-testid="tour-next-btn"
              >
                {currentStep === TOUR_STEPS.length - 1 
                  ? (isArabic ? 'إنهاء' : 'Finish')
                  : (isArabic ? 'التالي' : 'Next')
                }
                {currentStep < TOUR_STEPS.length - 1 && <ChevronRight size={16} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSS for highlight animation */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 10001 !important;
        }
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(249,115,22,0); }
        }
      `}</style>
    </>
  );
}

// Export reset function for use elsewhere
export const resetDashboardTour = () => {
  localStorage.removeItem('ssc_dashboard_tour_completed');
  localStorage.removeItem('ssc_dashboard_tour_date');
};

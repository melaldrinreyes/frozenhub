import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface ReceiptProps {
  saleData: {
    saleId: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      discountAmount: number;
      finalPrice: number;
    }>;
    subtotal: number;
    totalDiscount: number;
    total: number;
    paymentMethod: string;
    gcashReference?: string;
    date: Date;
    operator: string;
    branchName?: string;
  };
  branchName?: string;
  onClose: () => void;
  onPrint: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ saleData, branchName, onClose, onPrint }) => {
  const formatCurrency = (amount: number) => `₱${amount.toFixed(2)}`;

  // Fetch company branding
  const { data: companyLogoData } = useQuery({
    queryKey: ["setting", "company_logo"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_logo");
      } catch {
        return { setting: null };
      }
    },
  });

  const { data: companyNameData } = useQuery({
    queryKey: ["setting", "company_name"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_name");
      } catch {
        return { setting: { setting_value: "Batangas Premium Bongabong" } };
      }
    },
  });

  const companyLogo = companyLogoData?.setting?.setting_value;
  const companyName = companyNameData?.setting?.setting_value || "Batangas Premium Bongabong";

  // Keyboard shortcut: Ctrl/Cmd+P to print
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onPrint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrint]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[96dvh] sm:max-h-[90vh] flex flex-col">
        {/* Receipt Header */}
        <div className="bg-gradient-to-r from-black via-gray-900 to-black text-white p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 bg-gold-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">B</span>
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold truncate">{branchName || saleData.branchName || "Branch"}</h2>
                <p className="text-xs text-gray-300">Point of Sale Receipt</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close receipt"
              title="Close receipt"
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div id="receipt-content" className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Store Info */}
          <div className="text-center border-b border-gray-200 pb-4">
            {companyLogo && (
              <div className="flex justify-center mb-2">
                <img src={companyLogo} alt={companyName} className="h-8 object-contain" />
              </div>
            )}
            <h3 className="font-bold text-lg">{companyName}</h3>
            <p className="text-xs text-gray-600 mb-1">{branchName || saleData.branchName || "Branch"}</p>
            <p className="text-sm text-gray-600">Frozen Foods & Products</p>
            <p className="text-xs text-gray-500">123 Main Street, Batangas</p>
            <p className="text-xs text-gray-500">Tel: (043) 123-4567</p>
          </div>

          {/* Sale Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Receipt #:</span>
              <span className="font-mono font-semibold text-right break-all">{saleData.saleId}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Date:</span>
              <span>{saleData.date.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Time:</span>
              <span>{saleData.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Operator:</span>
              <span className="text-right break-words">{saleData.operator}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Payment:</span>
              <span className="capitalize">{saleData.paymentMethod}</span>
            </div>
            {saleData.gcashReference && (
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Ref #:</span>
                <span className="font-mono text-xs text-right break-all">{saleData.gcashReference}</span>
              </div>
            )}
          </div>

          {/* Items Header */}
          <div className="border-t border-b border-gray-200 py-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {saleData.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 text-sm">
                <div className="col-span-6 text-xs leading-tight break-words">
                  {item.name}
                  {item.discountAmount > 0 && (
                    <div className="text-green-600 text-[10px]">
                      -{formatCurrency(item.discountAmount)} discount
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center">{item.quantity}</div>
                <div className="col-span-2 text-right">{formatCurrency(item.price)}</div>
                <div className="col-span-2 text-right font-semibold">
                  {formatCurrency(item.finalPrice)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(saleData.subtotal)}</span>
            </div>
            {saleData.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(saleData.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
              <span>TOTAL:</span>
              <span>{formatCurrency(saleData.total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-4">
            <p>Thank you for your business!</p>
            <p>Please keep this receipt for your records.</p>
            <p className="mt-2 font-mono">{new Date().toISOString().split('T')[0]} {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Print Buttons */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200 space-y-2 sticky bottom-0 left-0 w-full z-10">
          <button
            onClick={onPrint}
            className="w-full min-h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Printer className="w-5 h-5" />
            Print Receipt
          </button>

          <button
            onClick={() => onClose()}
            className="w-full min-h-11 bg-white border border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <X className="w-5 h-5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
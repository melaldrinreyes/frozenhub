import React, { useEffect, useRef } from "react";

interface PaymentBarcodeProps {
  paymentId: string;
}

const PaymentBarcode: React.FC<PaymentBarcodeProps> = ({ paymentId }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;

    async function renderBarcode() {
      if (!barcodeRef.current) return;

      try {
        // Dynamically import to avoid hard dependency if package isn't installed
        const mod: any = await import("jsbarcode");
        const JsBarcode = mod.default || mod;
        if (!mounted) return;
        JsBarcode(barcodeRef.current, String(paymentId), {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
        });
      } catch (e) {
        // If import fails (package missing), fail gracefully and log
        // This prevents the typecheck/build from crashing when the package is optional
        // and provides a safe fallback during development.
        // eslint-disable-next-line no-console
        console.warn('JsBarcode not available:', e);
      }
    }

    renderBarcode();

    return () => {
      mounted = false;
    };
  }, [paymentId]);

  return (
    <div className="payment-barcode">
      <svg ref={barcodeRef}></svg>
    </div>
  );
};

export default PaymentBarcode;
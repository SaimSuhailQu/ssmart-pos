/* eslint-disable @typescript-eslint/ban-ts-comment */
import { BrowserWindow } from 'electron';
// @ts-ignore
import usb from 'usb';
// @ts-ignore
import escpos from 'escpos';
// @ts-ignore
import escposUsb from 'escpos-usb';

// Bridge modern 'usb' module EventEmitter API with escpos-usb expectations
const rawUsb = usb as { 
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  usb?: { 
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  };
};
if (rawUsb && !rawUsb.on && rawUsb.usb && rawUsb.usb.on) {
  rawUsb.on = rawUsb.usb.on.bind(rawUsb.usb);
  rawUsb.removeListener = rawUsb.usb.removeListener?.bind(rawUsb.usb);
}

escpos.USB = escposUsb;

export interface PrintReceiptOptions {
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  payments?: Array<{ method: string; amount: number }>;
  change?: number;
  cashierName?: string;
  customerName?: string;
}

const RECEIPT_WIDTH = 48;
export { RECEIPT_WIDTH };

function generateReceiptHtml(
  items: Array<{ name?: string; qty?: number; price?: number }>,
  payment: PrintReceiptOptions,
  saleId?: number,
  cashierName?: string
): string {
  const subtotal = payment.subtotal ?? payment.total ?? 0;
  const discount = payment.discount ?? 0;
  const total = payment.total ?? subtotal - discount;
  const payments = payment.payments ?? [];
  const change = payment.change ?? 0;
  const cashier = cashierName || payment.cashierName || 'SS Mart';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let totalItemDiscounts = 0;

  const itemRows = (items || []).map((item) => {
    const qty = Number(item.qty || 1);
    const origPrice = Number(item.price || 0);
    const origLineTotal = origPrice * qty;

    const itemDiscPercent = discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0;
    const finalPrice = origPrice * (1 - itemDiscPercent / 100);
    const lineFinalTotal = finalPrice * qty;
    totalItemDiscounts += (origLineTotal - lineFinalTotal);

    return `
      <div style="margin-bottom: 3px; padding-bottom: 1px;">
        <div style="font-weight: 700; font-size: 11.5px; text-transform: uppercase; word-break: break-word;">${item.name || 'Item'}</div>
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 500; margin-top: 1px;">
          <span>${origPrice.toFixed(2)} x ${qty}</span>
          <span style="font-weight: 700;">${itemDiscPercent > 0 ? `(-${itemDiscPercent.toFixed(0)}%) ` : ''}${lineFinalTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  const actualDiscount = Math.max(discount, totalItemDiscounts);
  const totalPaid = payments.length > 0 ? payments.reduce((s, p) => s + p.amount, 0) : total;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        html, body {
          width: 100%;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff;
          color: #000;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .receipt-wrapper {
          width: 68mm;
          margin-left: 0.5mm;
          margin-right: auto;
          margin-top: 0mm;
          margin-bottom: 0mm;
          padding-top: 0mm;
          padding-bottom: 8px;
          padding-left: 1mm;
          padding-right: 1mm;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10.5px;
          line-height: 1.25;
          font-weight: 500;
          -webkit-font-smoothing: antialiased;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: 700; }
        .header { margin-bottom: 4px; border-bottom: 1px dashed #000; padding-top: 0; padding-bottom: 4px; }
        .logo-container { width: 100%; text-align: center; margin: 0 auto 1px auto; padding-top: 0; }
        .store-name { font-size: 18px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin: 1px 0 2px 0; }
        .header-sub { font-size: 10px; font-weight: 500; line-height: 1.25; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .double-divider { border-top: 2px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-weight: 500; }
        .total-row { font-size: 14px; font-weight: 900; margin: 4px 0; }
        .footer { margin-top: 8px; border-top: 1px dashed #000; padding-top: 5px; text-align: center; }
        .footer-note {
          text-align: center;
          font-size: 9px;
          margin-top: 4px;
          line-height: 1.2;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="receipt-wrapper">
        <div class="header text-center">
          <div class="logo-container">
            <svg viewBox="0 0 200 150" width="85" height="55" style="display: block; margin: 0 auto;">
              <path d="M 75 25 L 35 25 L 35 75 L 105 75 L 105 110 L 65 110" fill="none" stroke="#000" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter" />
              <path d="M 125 125 L 165 125 L 165 75 L 95 75 L 95 40 L 135 40" fill="none" stroke="#000" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter" />
              <path d="M 55 10 L 20 10 L 20 90 L 120 90 L 120 125 L 50 125" fill="none" stroke="#000" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter" />
              <path d="M 145 140 L 180 140 L 180 60 L 80 60 L 80 25 L 150 25" fill="none" stroke="#000" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter" />
            </svg>
          </div>
          <div class="store-name">SS MART</div>
          <div class="header-sub">Old Lakar Mandi</div>
          <div class="header-sub">Opposite Railway Station, Havelian</div>
          <div class="header-sub">Ph: 0316-5915787</div>
          <div class="divider"></div>
          <div class="row" style="font-size: 9.5px;"><span>Inv #: <strong>${saleId ? String(saleId).padStart(5, '0') : 'WALK-IN'}</strong></span><span>Date: ${dateStr}</span></div>
          <div class="row" style="font-size: 9.5px;"><span>Cashier: <strong>${cashier}</strong></span><span>Time: ${timeStr}</span></div>
        </div>

        <div style="margin: 3px 0;">
          ${itemRows}
        </div>

        <div class="divider"></div>

        <div class="row" style="font-size: 10.5px; margin-bottom: 2px;">
          <span>Subtotal:</span>
          <span>Rs. ${subtotal.toFixed(2)}</span>
        </div>

        ${actualDiscount > 0 ? `
          <div class="row" style="font-size: 10.5px; margin-bottom: 2px; font-weight: 600;">
            <span>Discount:</span>
            <span>- Rs. ${actualDiscount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>

        <div class="row total-row">
          <span>TOTAL PAYABLE:</span>
          <span>Rs. ${total.toFixed(2)}</span>
        </div>

        <div class="double-divider"></div>

        <div style="margin-top: 3px;">
          ${payments.map(p => `
            <div class="row" style="font-size: 10px; margin-bottom: 1px;">
              <span>Paid via ${p.method}:</span>
              <span class="bold">Rs. ${p.amount.toFixed(2)}</span>
            </div>
          `).join('')}

          <div class="row" style="font-size: 10px; margin-top: 2px;">
            <span>Tendered Amount:</span>
            <span>Rs. ${totalPaid.toFixed(2)}</span>
          </div>

          ${change > 0 ? `
            <div class="row" style="font-size: 11px; font-weight: 700; margin-top: 2px;">
              <span>Change Returned:</span>
              <span>Rs. ${change.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        <div class="footer">
          <div class="bold" style="font-size: 11px; letter-spacing: 0.5px;">THANKS FOR YOUR VISIT</div>
          <div style="font-size: 8.5px; margin-top: 3px; color: #333;">Software Developed By: SSQ</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

let cachedTargetPrinter: string | null = null;
let lastPrinterCheckTime = 0;

async function getTargetPrinterName(win: BrowserWindow): Promise<string> {
  const now = Date.now();
  if (cachedTargetPrinter && (now - lastPrinterCheckTime < 10000)) {
    return cachedTargetPrinter;
  }

  try {
    const printers = await win.webContents.getPrintersAsync();
    const targetPrinter = printers.find(p => p.name.trim() === 'BC-97AC') ||
      printers.find(p => p.name.includes('BC-97AC (copy 1)')) ||
      printers.find(p => p.name.toLowerCase().includes('bc-97ac')) ||
      printers.find(p => p.name.toLowerCase().includes('blackcopper')) ||
      printers[0];

    cachedTargetPrinter = targetPrinter ? targetPrinter.name : 'BC-97AC';
    lastPrinterCheckTime = now;
    return cachedTargetPrinter;
  } catch {
    return cachedTargetPrinter || 'BC-97AC';
  }
}

async function printViaWindowsDriver(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        width: 300,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          offscreen: true
        }
      });

      let isCleanedUp = false;
      const cleanup = (success: boolean) => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearTimeout(safetyTimer);
        try {
          if (!printWin.isDestroyed()) {
            printWin.destroy();
          }
        } catch {
          // Already destroyed
        }
        resolve(success);
      };

      // 10-second safety timeout to avoid resource leaks
      const safetyTimer = setTimeout(() => {
        console.warn('Silent print window operation timed out (10s). Releasing resources.');
        cleanup(false);
      }, 10000);

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWin.webContents.once('did-finish-load', async () => {
        try {
          const deviceName = await getTargetPrinterName(printWin);

          printWin.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: deviceName,
            color: false,
            margins: {
              marginType: 'none'
            },
            pageSize: {
              width: 80000,
              height: 297000
            }
          }, (success) => {
            if (!success && deviceName === 'BC-97AC') {
              printWin.webContents.print({
                silent: true,
                printBackground: true,
                deviceName: 'BC-97AC (copy 1)',
                color: false,
                margins: { marginType: 'none' },
                pageSize: { width: 80000, height: 297000 }
              }, (fallbackSuccess) => {
                cleanup(fallbackSuccess);
              });
              return;
            }
            cleanup(success);
          });
        } catch (err) {
          console.warn('Silent print error:', err);
          cleanup(false);
        }
      });
    } catch (e) {
      console.warn('Could not spawn print window:', e);
      resolve(false);
    }
  });
}

export async function printReceipt(
  items: Array<{ name?: string; qty?: number; price?: number }>,
  paymentInfo: number | PrintReceiptOptions,
  saleId?: number,
  cashierName?: string
): Promise<boolean> {
  const payment: PrintReceiptOptions = typeof paymentInfo === 'number'
    ? { total: paymentInfo }
    : (paymentInfo || {});

  // Instant dispatch directly to Windows print spooler
  const html = generateReceiptHtml(items, payment, saleId, cashierName);
  return printViaWindowsDriver(html);
}

// Zero-dependency embedded Code128 barcode SVG generator (100% offline-ready)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

function generateCode128Svg(text: string): string {
  const codes: number[] = [104]; // Start Code B
  let checkSum = 104;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) - 32;
    const validCode = charCode >= 0 && charCode <= 95 ? charCode : 0;
    codes.push(validCode);
    checkSum += validCode * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(106); // Stop pattern

  let fullPattern = '';
  for (const c of codes) {
    fullPattern += CODE128_PATTERNS[c] || '';
  }

  const barWidth = 2;
  const height = 50;
  let x = 10;
  let isBar = true;
  const rects: string[] = [];

  for (let i = 0; i < fullPattern.length; i++) {
    const width = parseInt(fullPattern[i], 10) * barWidth;
    if (isBar) {
      rects.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000"/>`);
    }
    x += width;
    isBar = !isBar;
  }

  const totalWidth = x + 10;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 20}" width="100%" height="100%">
      ${rects.join('')}
      <text x="${totalWidth / 2}" y="${height + 15}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#000">${text}</text>
    </svg>
  `;
}

export function printBarcode(product: { name?: string; barcode?: string; price?: number | string }): Promise<boolean> {
  const cleanBarcode = String(product.barcode || '').trim();
  const productName = product.name || 'Product';
  const price = typeof product.price === 'number' ? product.price.toFixed(2) : String(product.price || '0.00');

  const barcodeSvg = generateCode128Svg(cleanBarcode);

  const barcodeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        html, body {
          width: 100%;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff;
          color: #000;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .barcode-label {
          width: 68mm;
          margin-left: 1mm;
          margin-right: auto;
          padding: 2mm 2mm 8mm 2mm;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .store-header {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .product-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 3px;
          word-break: break-word;
        }
        .price-tag {
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 4px;
        }
        .barcode-box {
          margin: 4px auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 60mm;
          height: 18mm;
        }
        .divider {
          border-top: 1px dashed #000;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="barcode-label">
        <div class="store-header">SS MART</div>
        <div class="product-title">${productName}</div>
        <div class="price-tag">Rs. ${price}</div>
        <div class="barcode-box">
          ${barcodeSvg}
        </div>
        <div class="divider"></div>
      </div>
    </body>
    </html>
  `;

  return printViaWindowsDriver(barcodeHtml);
}

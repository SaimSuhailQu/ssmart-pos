/* eslint-disable @typescript-eslint/ban-ts-comment */
import { BrowserWindow } from 'electron';
// @ts-ignore
import usb from 'usb';
// @ts-ignore
import escpos from 'escpos';
// @ts-ignore
import escposUsb from 'escpos-usb';

// Bridge modern 'usb' module EventEmitter API with escpos-usb expectations
const rawUsb: any = usb;
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

import fs from 'fs';
import path from 'path';

const RECEIPT_WIDTH = 48;

let cachedLogoBase64: string | null = null;
function getLogoBase64(): string {
  if (cachedLogoBase64 !== null) return cachedLogoBase64;
  try {
    const possiblePaths = [
      path.join(__dirname, 'assets', 'ss_mart_logo.png'),
      path.join(process.cwd(), 'src', 'assets', 'ss_mart_logo.png'),
      path.join(__dirname, '..', 'src', 'assets', 'ss_mart_logo.png')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        cachedLogoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
        return cachedLogoBase64;
      }
    }
  } catch (err) {
    console.warn('Could not load logo for receipt:', err);
  }
  cachedLogoBase64 = '';
  return cachedLogoBase64;
}

function padLine(left: string, right: string, width = RECEIPT_WIDTH): string {
  const maxLeft = width - right.length - 1;
  const safeLeft = left.length > maxLeft ? left.substring(0, maxLeft) : left;
  const spaces = Math.max(1, width - safeLeft.length - right.length);
  return safeLeft + ' '.repeat(spaces) + right;
}

function generateReceiptHtml(
  items: any[],
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
  let originalSubtotal = 0;

  const itemRows = (items || []).map((item) => {
    const qty = Number(item.qty || 1);
    const origPrice = Number(item.price || 0);
    const origLineTotal = origPrice * qty;
    originalSubtotal += origLineTotal;

    const itemDiscPercent = discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0;
    const finalPrice = origPrice * (1 - itemDiscPercent / 100);
    const lineFinalTotal = finalPrice * qty;
    totalItemDiscounts += (origLineTotal - lineFinalTotal);

    return `
      <div style="margin-bottom: 3px; padding-bottom: 1px;">
        <div style="font-weight: 600; font-size: 11.5px; text-transform: uppercase; word-break: break-word;">${item.name || 'Item'}</div>
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 500; margin-top: 1px;">
          <span>${origPrice.toFixed(2)} x ${qty}</span>
          <span style="font-weight: 600;">${itemDiscPercent > 0 ? `(-${itemDiscPercent.toFixed(0)}%) ` : ''}${lineFinalTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  const actualDiscount = Math.max(discount, totalItemDiscounts);
  const totalPaid = payments.length > 0 ? payments.reduce((s, p) => s + p.amount, 0) : total;
  const logoDataUri = getLogoBase64();

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
        .store-name { font-size: 18px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin: 1px 0 2px 0; }
        .header-sub { font-size: 10px; font-weight: 500; line-height: 1.2; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-weight: 500; }
        .total-row { font-size: 14px; font-weight: 700; margin: 4px 0; }
        .footer { margin-top: 8px; border-top: 1px dashed #000; padding-top: 5px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="receipt-wrapper">
        <div class="header text-center">
          <div class="logo-container">
            <svg viewBox="0 0 200 150" width="85" height="55" style="display: block; margin: 0 auto;">
              <!-- Outer interconnected geometric SS Monogram -->
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
          <div class="row"><span>Inv #: ${saleId || '1001'}</span><span>Date: ${dateStr}</span></div>
          <div class="row"><span>User: ${cashier}</span><span>Time: ${timeStr}</span></div>
        </div>

      <div class="items">
        ${itemRows}
      </div>

      <div class="divider"></div>

      <div class="row total-row">
        <span>TOTAL:</span>
        <span>Rs. ${total.toFixed(2)}</span>
      </div>

      <div class="row">
        <span>Cash Tendered:</span>
        <span>Rs. ${totalPaid.toFixed(2)}</span>
      </div>
      <div class="row">
        <span>Change / Balance:</span>
        <span>Rs. ${change.toFixed(2)}</span>
      </div>

      ${actualDiscount > 0 ? `
        <div class="divider"></div>
        <div class="row" style="font-size: 11px; font-weight: 600;">
          <span>Total Discount:</span>
          <span>Rs. ${actualDiscount.toFixed(2)}</span>
        </div>
      ` : ''}

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

async function getTargetPrinterName(printWin: BrowserWindow): Promise<string> {
  const now = Date.now();
  if (cachedTargetPrinter && (now - lastPrinterCheckTime < 60000)) {
    return cachedTargetPrinter;
  }

  try {
    const printers = await printWin.webContents.getPrintersAsync();
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
          }, (success, failureReason) => {
            if (!success && deviceName === 'BC-97AC') {
              printWin.webContents.print({
                silent: true,
                printBackground: true,
                deviceName: 'BC-97AC (copy 1)',
                color: false,
                margins: { marginType: 'none' },
                pageSize: { width: 80000, height: 297000 }
              }, (fallbackSuccess) => {
                try { printWin.destroy(); } catch {}
                resolve(fallbackSuccess);
              });
              return;
            }

            try { printWin.destroy(); } catch {}
            resolve(success);
          });
        } catch (err) {
          console.warn('Silent print error:', err);
          try { printWin.destroy(); } catch {}
          resolve(false);
        }
      });
    } catch (e) {
      console.warn('Could not spawn print window:', e);
      resolve(false);
    }
  });
}

export async function printReceipt(
  items: any[],
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

export function printBarcode(product: any): Promise<boolean> {
  const cleanBarcode = String(product.barcode || '').trim();
  const productName = product.name || 'Product';
  const price = typeof product.price === 'number' ? product.price.toFixed(2) : product.price;

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
        }
        .barcode-svg {
          width: 60mm;
          height: 18mm;
        }
        .divider {
          border-top: 1px dashed #000;
          margin-top: 8px;
        }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    </head>
    <body>
      <div class="barcode-label">
        <div class="store-header">SS MART</div>
        <div class="product-title">${productName}</div>
        <div class="price-tag">Rs. ${price}</div>
        <div class="barcode-box">
          <svg id="barcode-elem" class="barcode-svg"></svg>
        </div>
        <div class="divider"></div>
      </div>
      <script>
        try {
          JsBarcode("#barcode-elem", "${cleanBarcode}", {
            format: "CODE128",
            lineColor: "#000",
            width: 2,
            height: 55,
            displayValue: true,
            fontSize: 14,
            fontOptions: "bold",
            margin: 0
          });
        } catch (e) {
          console.warn("JsBarcode render error:", e);
        }
      </script>
    </body>
    </html>
  `;

  return printViaWindowsDriver(barcodeHtml);
}

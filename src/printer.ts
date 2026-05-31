/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import escpos from 'escpos';
// @ts-ignore
import escposUsb from 'escpos-usb';

// Important: escpos.USB must be set up properly
escpos.USB = escposUsb;

export function printReceipt(items: any[], total: number, saleId?: number) {
  try {
    const device = new escpos.USB(); 
    const printer = new escpos.Printer(device);

    device.open((err: any) => {
      if (err) {
        console.error('Failed to open printer device:', err);
        return;
      }

      printer
        .font('a')
        .align('ct')
        .size(1, 1)
        .text('SS MART')
        .text('Address: Havelian')
        .align('lt')
        .text(`Date: ${new Date().toLocaleString()}`)
        .text(`Invoice No: INV-${saleId || 'N/A'}`)
        .text('------------------------------');
        
      for (const item of items) {
        printer.text(`${item.name.substring(0, 15).padEnd(15, ' ')} x${item.qty} Rs. ${(item.price * item.qty).toFixed(2)}`);
      }
      
      printer
        .text('------------------------------')
        .text(`TOTAL: Rs. ${total.toFixed(2)}`)
        .feed(2)
        .cashdraw() // Pops the drawer
        .cut()
        .close();
        
      console.log('Successfully sent to printer.');
    });
  } catch (error) {
    console.warn('Printer not connected or escpos failed. MOCK PRINTING.');
    console.log('--- RECEIPT MOCK ---');
    console.log('SS MART');
    console.log('Address: Havelian');
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`Invoice No: INV-${saleId || 'N/A'}`);
    for (const item of items) {
      console.log(`${item.name} x${item.qty} Rs. ${(item.price * item.qty).toFixed(2)}`);
    }
    console.log(`TOTAL: Rs. ${total.toFixed(2)}`);
    console.log('--- END RECEIPT ---');
  }
}

export function printBarcode(product: any) {
  try {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    device.open((err: any) => {
      if (err) {
        console.error('Failed to open printer device for barcode:', err);
        return;
      }

      printer
        .align('ct')
        .size(1, 1)
        .text(product.name)
        .text(`Rs. ${product.price.toFixed(2)}`)
        .barcode(product.barcode, 'CODE128', {
          width: 2, // Width of barcode line
          height: 60, // Height of barcode line
          position: 'BLW', // Print text below barcode
          font: 'A' // Font size of text
        })
        .feed(2)
        .cut()
        .close();

      console.log('Successfully printed barcode.');
    });
  } catch (error) {
    console.warn('Printer not connected or escpos failed. MOCK BARCODE PRINTING.');
    console.log('--- BARCODE MOCK ---');
    console.log(`Product: ${product.name}`);
    console.log(`Price: Rs. ${product.price.toFixed(2)}`);
    console.log(`||| BARCODE: ${product.barcode} (CODE128) |||`);
    console.log('--- END BARCODE ---');
  }
}

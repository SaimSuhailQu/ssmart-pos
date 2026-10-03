/**
 * Validation — typed input schemas returning Result, no exceptions.
 *
 * Every form and every IPC argument that originates from user input goes
 * through one of these validators before it touches the database or the
 * cart. Validators return `Result<T, FieldError[]>` so the UI can render
 * per-field messages without try/catch.
 */

import { Result, ok, err } from './result';
import { fromMajor, isPositive, Money } from './money';

export interface FieldError {
  field: string;
  message: string;
}

export type Validation<T> = Result<T, FieldError[]>;

const fieldError = (field: string, message: string): FieldError => ({ field, message });

function collect<T>(value: T, errors: FieldError[]): Validation<T> {
  return errors.length > 0 ? err(errors) : ok(value);
}

const MAX_NAME_LEN = 120;
const MAX_BARCODE_LEN = 64;
const MAX_PRICE_MAJOR = 100_000_000; // Rs. 10 crore sanity cap

export interface ProductInput {
  name: string;
  barcode: string;
  price: Money;
  costPrice: Money;
  stock: number;
  category: string;
}

export interface RawProductInput {
  name: unknown;
  barcode: unknown;
  price: unknown;
  cost_price: unknown;
  stock: unknown;
  category: unknown;
}

const cleanText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Validate a product payload from any form (inventory, quick-add, bulk). */
export function validateProductInput(raw: RawProductInput): Validation<ProductInput> {
  const errors: FieldError[] = [];

  const name = cleanText(raw.name);
  if (!name) errors.push(fieldError('name', 'Product name is required.'));
  else if (name.length > MAX_NAME_LEN) errors.push(fieldError('name', `Name must be under ${MAX_NAME_LEN} characters.`));

  const barcode = cleanText(raw.barcode);
  if (!barcode) errors.push(fieldError('barcode', 'Barcode is required.'));
  else if (barcode.length > MAX_BARCODE_LEN) errors.push(fieldError('barcode', 'Barcode is too long.'));
  else if (!/^[A-Za-z0-9\-_./+ ]+$/.test(barcode)) errors.push(fieldError('barcode', 'Barcode contains invalid characters.'));

  const priceNum = typeof raw.price === 'number' ? raw.price : Number(raw.price);
  const price = fromMajor(priceNum);
  if (!Number.isFinite(priceNum) || !isPositive(price)) errors.push(fieldError('price', 'Price must be greater than zero.'));
  else if (priceNum > MAX_PRICE_MAJOR) errors.push(fieldError('price', 'Price exceeds the maximum allowed.'));

  const costNum = typeof raw.cost_price === 'number' ? raw.cost_price : Number(raw.cost_price);
  const costPrice = fromMajor(costNum);
  if (Number.isFinite(costNum) && costNum > 0 && costNum > MAX_PRICE_MAJOR) {
    errors.push(fieldError('cost_price', 'Cost price exceeds the maximum allowed.'));
  }

  const stockNum = typeof raw.stock === 'number' ? raw.stock : Number(raw.stock);
  const stock = Number.isFinite(stockNum) ? Math.trunc(stockNum) : NaN;
  if (!Number.isFinite(stock) || stock < 0) errors.push(fieldError('stock', 'Stock must be zero or more.'));
  else if (stock > 1_000_000) errors.push(fieldError('stock', 'Stock exceeds the maximum allowed.'));

  const category = cleanText(raw.category) || 'General';
  if (category.length > 60) errors.push(fieldError('category', 'Category name is too long.'));

  return collect(
    { name, barcode, price, costPrice, stock: stock || 0, category },
    errors,
  );
}

export interface TenderInput {
  total: Money;
  payments: Array<{ method: string; amount: Money }>;
}

/** Validate a (possibly split) tender: methods named, amounts positive, covers total. */
export function validateTender(total: Money, payments: Array<{ method: unknown; amount: unknown }>): Validation<TenderInput> {
  const errors: FieldError[] = [];
  const clean: TenderInput['payments'] = [];

  payments.forEach((p, i) => {
    const method = cleanText(p.method);
    const amountNum = typeof p.amount === 'number' ? p.amount : Number(p.amount);
    if (!method) errors.push(fieldError(`payments[${i}].method`, 'Payment method is required.'));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      errors.push(fieldError(`payments[${i}].amount`, 'Amount must be greater than zero.'));
    } else {
      clean.push({ method, amount: fromMajor(amountNum) });
    }
  });

  if (clean.length === 0 && errors.length === 0) {
    errors.push(fieldError('payments', 'At least one payment is required.'));
  }

  const tendered = clean.reduce((s, p) => s + p.amount.minor, 0);
  if (errors.length === 0 && tendered < total.minor) {
    errors.push(fieldError('payments', `Tendered ${tendered / 100} is less than the total ${total.minor / 100}.`));
  }

  return collect({ total, payments: clean }, errors);
}

/** Cashier/manager PIN: 4–8 digits. Never log the value — only the boolean. */
export function validatePin(pin: unknown): Validation<string> {
  const v = cleanText(pin);
  if (!/^\d{4,8}$/.test(v)) return err([fieldError('pin', 'PIN must be 4–8 digits.')]);
  return ok(v);
}

/** Customer phone: digits with optional leading +, 7–15 chars. */
export function validatePhone(phone: unknown): Validation<string> {
  const v = cleanText(phone).replace(/[\s-]/g, '');
  if (!/^\+?\d{7,15}$/.test(v)) return err([fieldError('phone', 'Enter a valid phone number.')]);
  return ok(v);
}

/** Discount in major units: >= 0 and never more than the subtotal. */
export function validateDiscount(discount: unknown, subtotal: Money): Validation<Money> {
  const n = typeof discount === 'number' ? discount : Number(discount);
  if (!Number.isFinite(n) || n < 0) return err([fieldError('discount', 'Discount cannot be negative.')]);
  const m = fromMajor(n);
  if (m.minor > subtotal.minor) return err([fieldError('discount', 'Discount cannot exceed the subtotal.')]);
  return ok(m);
}

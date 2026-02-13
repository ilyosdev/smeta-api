import { FormFieldDef } from './comma-parser';

export interface FormConfig {
  formType: string;
  title: string;
  emoji: string;
  exampleMessage: string;
  fields: FormFieldDef[];
  confirmPrefix: string;
}

export const INCOME_FORM: FormConfig = {
  formType: 'income',
  title: "KIRIM QO'SHISH",
  emoji: '\u{1F4B0}',
  exampleMessage:
    "Masalan: \"500,000,000, Karimovdan, perechesleniya, investor to'lovi\"",
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'source', label: 'Kimdan', required: true, type: 'string' },
    {
      key: 'paymentType',
      label: "To'lov turi",
      required: true,
      type: 'enum',
      enumValues: ['CASH', 'TRANSFER'],
      enumLabels: { CASH: 'Naqd', TRANSFER: "Pul o'tkazma" },
      default: 'CASH',
    },
    { key: 'note', label: 'Izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'income',
};

export const EXPENSE_FORM: FormConfig = {
  formType: 'expense',
  title: "CHIQIM QO'SHISH",
  emoji: '\u{1F4B8}',
  exampleMessage:
    'Masalan: "120,000,000, ishchilar oyligi, naqd, brigada #3"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'recipient', label: 'Kimga', required: true, type: 'string' },
    {
      key: 'category',
      label: 'Kategoriya',
      required: true,
      type: 'enum',
      enumValues: ['MATERIAL', 'LABOR', 'EQUIPMENT', 'TRANSPORT', 'OTHER'],
      enumLabels: {
        MATERIAL: 'Material',
        LABOR: 'Ish haqi',
        EQUIPMENT: 'Uskunalar',
        TRANSPORT: 'Transport',
        OTHER: 'Boshqa',
      },
      default: 'OTHER',
    },
    {
      key: 'paymentType',
      label: "To'lov turi",
      required: true,
      type: 'enum',
      enumValues: ['CASH', 'TRANSFER'],
      enumLabels: { CASH: 'Naqd', TRANSFER: "Pul o'tkazma" },
      default: 'CASH',
    },
    { key: 'note', label: 'Izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'expense',
};

export const CASH_REQUEST_FORM: FormConfig = {
  formType: 'cash_request',
  title: 'PUL ZAYAVKASI',
  emoji: '\u{1F4DD}',
  exampleMessage:
    'Masalan: "300,000,000, oy oxirigacha, ishchilar oyligi uchun"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'period', label: 'Davr (qachon kerak)', required: true, type: 'string' },
    { key: 'reason', label: 'Sabab', required: true, type: 'string' },
  ],
  confirmPrefix: 'cash_request',
};

export const CASH_TRANSACTION_FORM: FormConfig = {
  formType: 'cash_transaction',
  title: "KASSA OPERATSIYASI",
  emoji: '\u{1F4B5}',
  exampleMessage:
    'Masalan: "500,000,000, naqd, Umid oka, kvartira arendasi"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    {
      key: 'type',
      label: 'Turi',
      required: true,
      type: 'enum',
      enumValues: ['OUT', 'IN'],
      enumLabels: { OUT: 'Chiqim', IN: 'Kirim' },
      default: 'OUT',
    },
    { key: 'recipient', label: 'Kimga', required: true, type: 'string' },
    { key: 'reason', label: 'Sabab', required: true, type: 'string' },
  ],
  confirmPrefix: 'cash_tx',
};

export const WORKLOG_FORM: FormConfig = {
  formType: 'worklog',
  title: "BAJARILGAN ISH",
  emoji: '\u{1F4D0}',
  exampleMessage: 'Masalan: "Karimov, Suvoq, 120 m2, 45,000 so\'mdan"',
  fields: [
    { key: 'workerName', label: 'Usta ismi', required: true, type: 'string' },
    { key: 'workType', label: 'Ish turi', required: true, type: 'string' },
    { key: 'quantity', label: 'Miqdor', required: true, type: 'number', format: 'plain' },
    { key: 'unit', label: "O'lchov birligi (m\u00B2, m\u00B3, dona, p.m.)", required: true, type: 'string' },
    { key: 'unitPrice', label: 'Birlik narxi', required: true, type: 'number' },
  ],
  confirmPrefix: 'worklog',
};

export const FOREMAN_CASH_REQUEST_FORM: FormConfig = {
  formType: 'cash_request',
  title: "PUL SO'ROVI",
  emoji: '\u{1F4B5}',
  exampleMessage: 'Masalan: "10,000,000, kundalik rasxodlar"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'reason', label: 'Sabab / izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'foreman_cash_req',
};

export const FOREMAN_EXPENSE_FORM: FormConfig = {
  formType: 'foreman_expense',
  title: 'PRORAB RASXODI',
  emoji: '\u{1F4B8}',
  exampleMessage: 'Masalan: "2,000,000, naqd, mix va mayda materiallar"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    {
      key: 'paymentType',
      label: "To'lov turi",
      required: true,
      type: 'enum',
      enumValues: ['CASH', 'TRANSFER'],
      enumLabels: { CASH: 'Naqd', TRANSFER: "Pul o'tkazma" },
      default: 'CASH',
    },
    { key: 'note', label: 'Sabab / izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'foreman_exp',
};

export const FOREMAN_REQUEST_FORM: FormConfig = {
  formType: 'foreman_request',
  title: 'MATERIAL ZAYAVKASI',
  emoji: '\u{1F4E6}',
  exampleMessage: 'Masalan: "Sement, 100, qop, 2 kundan keyin, poydevor uchun"',
  fields: [
    { key: 'smetaItemName', label: 'Mahsulot nomi', required: true, type: 'string' },
    { key: 'requestedQty', label: 'Miqdor', required: true, type: 'number', format: 'plain' },
    { key: 'requestedUnit', label: "O'lchov birligi (dona, kg, metr, m\u00B2, m\u00B3, tonna)", required: true, type: 'string' },
    { key: 'deadline', label: 'Qachon kerak', required: true, type: 'string' },
    { key: 'note', label: 'Sabab / izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'foreman_req',
};

export const WORKER_PAYMENT_FORM: FormConfig = {
  formType: 'worker_payment',
  title: "USTA TO'LOVI",
  emoji: '\u{1F4B0}',
  exampleMessage: 'Masalan: "Karimov, 5,000,000, suvoq ishlari uchun"',
  fields: [
    { key: 'workerName', label: 'Usta ismi', required: true, type: 'string' },
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'note', label: 'Izoh', required: true, type: 'string' },
  ],
  confirmPrefix: 'worker_pay',
};

export const WAREHOUSE_ADD_FORM: FormConfig = {
  formType: 'warehouse_add',
  title: "SKLAD KIRIMI",
  emoji: '\u{2795}',
  exampleMessage:
    'Masalan: "Razetka, 100, dona, Pastavshik X"',
  fields: [
    { key: 'name', label: 'Mahsulot nomi', required: true, type: 'string' },
    { key: 'quantity', label: 'Miqdor', required: true, type: 'number', format: 'plain' },
    { key: 'unit', label: "O'lchov birligi (dona, kg, m, m\u00B2, m\u00B3, litr)", required: true, type: 'string' },
    { key: 'source', label: 'Qayerdan keldi', required: true, type: 'string' },
  ],
  confirmPrefix: 'wh_add',
};

export const SUPPLIER_DEBT_FORM: FormConfig = {
  formType: 'supplier_debt',
  title: "QARZ QO'SHISH",
  emoji: '\u{1F4C9}',
  exampleMessage: 'Masalan: "35,000,000, armatura yetkazib berildi"',
  fields: [
    { key: 'amount', label: 'Summa', required: true, type: 'number' },
    { key: 'reason', label: 'Sabab', required: true, type: 'string' },
  ],
  confirmPrefix: 'supply_debt',
};

export const SUPPLY_ORDER_FORM: FormConfig = {
  formType: 'supply_order',
  title: 'BUYURTMA BERISH',
  emoji: '\u{1F4E6}',
  exampleMessage: 'Masalan: "Karimov LLC, sement, 100, qop, 5000000"',
  fields: [
    { key: 'supplierName', label: 'Postavshik nomi', required: true, type: 'string' },
    { key: 'product', label: 'Mahsulot nomi', required: true, type: 'string' },
    { key: 'quantity', label: 'Miqdor', required: true, type: 'number', format: 'plain' },
    { key: 'unit', label: "O'lchov birligi (dona, kg, metr, m\u00B2, m\u00B3, tonna)", required: true, type: 'string' },
    { key: 'summa', label: 'Summa (so\'m)', required: true, type: 'number', format: 'money' },
  ],
  confirmPrefix: 'supply_order',
};

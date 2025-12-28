/* eslint-disable @typescript-eslint/no-misused-promises */
'use client';

import { cn } from '@skillancer/ui';
import {
  DollarSign,
  Calendar,
  Tag,
  Briefcase,
  Camera,
  X,
  ChevronDown,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { useState } from 'react';

// Types
type ExpenseCategory =
  | 'software'
  | 'hardware'
  | 'cloud'
  | 'professional'
  | 'marketing'
  | 'office'
  | 'travel'
  | 'meals'
  | 'education'
  | 'mileage'
  | 'other';

type ExpenseFormProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: ExpenseData) => void;
  initialData?: Partial<ExpenseData>;
  mode?: 'create' | 'edit';
}>;

interface ExpenseData {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  merchant: string;
  isDeductible: boolean;
  projectId?: string;
  paymentMethod: string;
  notes?: string;
  receiptFile?: File;
}

const categoryOptions: { value: ExpenseCategory; label: string }[] = [
  { value: 'software', label: 'Software & Tools' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'cloud', label: 'Cloud & Hosting' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'office', label: 'Office Expenses' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'education', label: 'Education' },
  { value: 'mileage', label: 'Mileage' },
  { value: 'other', label: 'Other' },
];

const paymentMethods = [
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'PayPal',
  'Cash',
  'Company Card',
  'Personal Card (Reimbursable)',
  'Other',
];

const mockProjects = [
  { id: '1', name: 'Website Redesign', clientName: 'Acme Corp' },
  { id: '2', name: 'Mobile App', clientName: 'TechStart Inc' },
  { id: '3', name: 'Brand Identity', clientName: 'Design Studio' },
];

export function ExpenseForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode = 'create',
}: ExpenseFormProps) {
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'software');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [isDeductible, setIsDeductible] = useState(initialData?.isDeductible ?? true);
  const [projectId, setProjectId] = useState(initialData?.projectId || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Credit Card');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!amount || amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!merchant.trim()) {
      newErrors.merchant = 'Merchant is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSubmit({
      description,
      amount,
      category,
      date,
      merchant,
      isDeductible,
      projectId: projectId || undefined,
      paymentMethod,
      notes: notes || undefined,
      receiptFile: receiptFile || undefined,
    });

    setIsSaving(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Expense' : 'Edit Expense'}
          </h2>
          <button className="rounded-lg p-2 transition-colors hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Amount & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Amount *</span>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  className={cn(
                    'w-full rounded-lg border py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    errors.amount ? 'border-red-300' : 'border-gray-200'
                  )}
                  min="0"
                  step="0.01"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Date *</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className={cn(
                    'w-full rounded-lg border py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    errors.date ? 'border-red-300' : 'border-gray-200'
                  )}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Description *</span>
            <input
              className={cn(
                'w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                errors.description ? 'border-red-300' : 'border-gray-200'
              )}
              placeholder="What was this expense for?"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Merchant */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Merchant *</span>
            <input
              className={cn(
                'w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500',
                errors.merchant ? 'border-red-300' : 'border-gray-200'
              )}
              placeholder="Where did you make this purchase?"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
            {errors.merchant && <p className="mt-1 text-xs text-red-600">{errors.merchant}</p>}
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Category</span>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Payment Method</span>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Project (Optional) */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Project <span className="font-normal text-gray-400">(optional)</span>
            </span>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {mockProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.clientName})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Tax Deductible */}
          <div className="flex items-center gap-3">
            <input
              checked={isDeductible}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              id="isDeductible"
              type="checkbox"
              onChange={(e) => setIsDeductible(e.target.checked)}
            />
            <label className="text-sm text-gray-700" htmlFor="isDeductible">
              This expense is tax deductible
            </label>
          </div>

          {/* Receipt Upload */}
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Receipt</span>
            {receiptPreview ? (
              <div className="relative inline-block">
                <img
                  alt="Receipt preview"
                  className="max-h-48 rounded-lg border border-gray-200"
                  src={receiptPreview}
                />
                <button
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                  onClick={removeReceipt}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                aria-label="Upload receipt"
                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-indigo-400"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="mb-2 rounded-full bg-gray-100 p-2">
                    <Camera className="h-6 w-6 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-indigo-600">Upload receipt</span> or drag and
                    drop
                  </p>
                  <p className="text-xs text-gray-400">PNG, JPG, PDF up to 10MB</p>
                </div>
                <input
                  accept="image/*,.pdf"
                  className="hidden"
                  type="file"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </span>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add any additional details..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
          <button
            className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-6 py-2 transition-colors',
              isSaving
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
            disabled={isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {mode === 'create' ? 'Add Expense' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpenseForm;

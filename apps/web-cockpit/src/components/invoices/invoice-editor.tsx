'use client';

import { cn } from '@skillancer/ui';
import {
  Plus,
  Trash2,
  GripVertical,
  DollarSign,
  Percent,
  Clock,
  Calendar,
  Package,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Types
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  unit?: 'hours' | 'days' | 'units' | 'fixed';
  taxable: boolean;
}

interface InvoiceEditorProps {
  lineItems: LineItem[];
  onLineItemsChange: (items: LineItem[]) => void;
  taxRate: number;
  onTaxRateChange: (rate: number) => void;
  discount: number;
  onDiscountChange: (discount: number) => void;
  discountType: 'percent' | 'fixed';
  onDiscountTypeChange: (type: 'percent' | 'fixed') => void;
  currency?: string;
  className?: string;
}

const unitOptions = [
  { value: 'hours', label: 'Hours', icon: Clock },
  { value: 'days', label: 'Days', icon: Calendar },
  { value: 'units', label: 'Units', icon: Package },
  { value: 'fixed', label: 'Fixed', icon: DollarSign },
];

export function InvoiceEditor({
  lineItems,
  onLineItemsChange,
  taxRate,
  onTaxRateChange,
  discount,
  onDiscountChange,
  discountType,
  onDiscountTypeChange,
  currency = 'USD',
  className,
}: InvoiceEditorProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxableAmount = lineItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal + taxAmount - discountAmount;

  // Validate items
  useEffect(() => {
    const newErrors: Record<string, string> = {};
    lineItems.forEach((item) => {
      if (!item.description.trim()) {
        newErrors[item.id] = 'Description is required';
      } else if (item.quantity <= 0) {
        newErrors[item.id] = 'Quantity must be greater than 0';
      } else if (item.rate < 0) {
        newErrors[item.id] = 'Rate cannot be negative';
      }
    });
    setErrors(newErrors);
  }, [lineItems]);

  const addLineItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      rate: 0,
      unit: 'hours',
      taxable: true,
    };
    onLineItemsChange([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      onLineItemsChange(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number | boolean) => {
    onLineItemsChange(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const _duplicateLineItem = (id: string) => {
    const index = lineItems.findIndex((item) => item.id === id);
    if (index !== -1) {
      const original = lineItems[index];
      const duplicate: LineItem = {
        ...original,
        id: `item-${Date.now()}`,
      };
      const newItems = [...lineItems];
      newItems.splice(index + 1, 0, duplicate);
      onLineItemsChange(newItems);
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      const draggedIndex = lineItems.findIndex((item) => item.id === draggedId);
      const targetIndex = lineItems.findIndex((item) => item.id === targetId);
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newItems = [...lineItems];
        const [removed] = newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, removed);
        onLineItemsChange(newItems);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Line Items Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900">Line Items</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Unit
                </th>
                <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Qty
                </th>
                <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rate
                </th>
                <th className="w-16 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tax
                </th>
                <th className="w-28 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item) => {
                const amount = item.quantity * item.rate;
                const hasError = errors[item.id];
                const UnitIcon = unitOptions.find((u) => u.value === item.unit)?.icon || Clock;

                return (
                  <tr
                    key={item.id}
                    draggable
                    className={cn(
                      'transition-colors',
                      draggedId === item.id && 'bg-indigo-50 opacity-50',
                      hasError && 'bg-red-50'
                    )}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDragStart={() => handleDragStart(item.id)}
                  >
                    <td className="px-2">
                      <button className="cursor-grab p-1 text-gray-400 hover:text-gray-600">
                        <GripVertical className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <input
                          className={cn(
                            'w-full rounded-lg border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500',
                            hasError && !item.description ? 'border-red-300' : 'border-gray-200'
                          )}
                          placeholder="Enter description"
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        />
                        {hasError && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            {hasError}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-8 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                        >
                          {unitOptions.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                        <UnitIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        min="0"
                        step="0.5"
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            'quantity',
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateLineItem(item.id, 'rate', Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        checked={item.taxable}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        type="checkbox"
                        onChange={(e) => updateLineItem(item.id, 'taxable', e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
                    </td>
                    <td className="px-2">
                      <button
                        className={cn(
                          'rounded p-1 transition-colors',
                          lineItems.length === 1
                            ? 'cursor-not-allowed text-gray-300'
                            : 'text-gray-400 hover:text-red-500'
                        )}
                        disabled={lineItems.length === 1}
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-indigo-600 transition-colors hover:bg-indigo-50"
            onClick={addLineItem}
          >
            <Plus className="h-4 w-4" />
            Add Line Item
          </button>
        </div>
      </div>

      {/* Totals Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex justify-end">
          <div className="w-80 space-y-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>

            {/* Tax */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Tax</span>
                <div className="relative w-20">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    max="100"
                    min="0"
                    step="0.1"
                    type="number"
                    value={taxRate}
                    onChange={(e) => onTaxRateChange(Number.parseFloat(e.target.value) || 0)}
                  />
                  <Percent className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <span className="font-medium text-gray-600">{formatCurrency(taxAmount)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Discount</span>
                <div className="flex">
                  <input
                    className="w-16 rounded-l border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    type="number"
                    value={discount}
                    onChange={(e) => onDiscountChange(Number.parseFloat(e.target.value) || 0)}
                  />
                  <select
                    className="rounded-r border border-l-0 border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={discountType}
                    onChange={(e) => onDiscountTypeChange(e.target.value as 'percent' | 'fixed')}
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </div>
              </div>
              {discount > 0 && (
                <span className="font-medium text-red-500">-{formatCurrency(discountAmount)}</span>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Quick add:</span>
        <button
          className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={() => {
            const newItem: LineItem = {
              id: `item-${Date.now()}`,
              description: 'Development Services',
              quantity: 8,
              rate: 150,
              unit: 'hours',
              taxable: true,
            };
            onLineItemsChange([...lineItems, newItem]);
          }}
        >
          Development (8h)
        </button>
        <button
          className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={() => {
            const newItem: LineItem = {
              id: `item-${Date.now()}`,
              description: 'Design Services',
              quantity: 4,
              rate: 125,
              unit: 'hours',
              taxable: true,
            };
            onLineItemsChange([...lineItems, newItem]);
          }}
        >
          Design (4h)
        </button>
        <button
          className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={() => {
            const newItem: LineItem = {
              id: `item-${Date.now()}`,
              description: 'Consultation',
              quantity: 1,
              rate: 200,
              unit: 'hours',
              taxable: true,
            };
            onLineItemsChange([...lineItems, newItem]);
          }}
        >
          Consultation
        </button>
      </div>
    </div>
  );
}

export default InvoiceEditor;

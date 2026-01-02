'use client';

/**
 * Card Management Page
 * View, manage, and control Skillancer debit cards
 * Sprint M5: Freelancer Financial Services
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Plus,
  Snowflake,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Settings,
  ChevronRight,
  ShoppingBag,
  AlertCircle,
  Check,
  Smartphone,
  Shield,
  RefreshCw,
  Lock,
  Unlock,
  Package,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Card {
  id: string;
  type: 'virtual' | 'physical';
  status: 'active' | 'frozen' | 'inactive' | 'pending';
  last4: string;
  expMonth: number;
  expYear: number;
  brand: string;
  nickname: string;
  spendingLimits: {
    perTransaction: number;
    daily: number;
    monthly: number;
  };
  walletEnabled: boolean;
  createdAt: string;
  activatedAt?: string;
}

interface CardTransaction {
  id: string;
  merchantName: string;
  amount: number;
  category: string;
  status: 'pending' | 'completed' | 'declined';
  createdAt: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCards: Card[] = [
  {
    id: '1',
    type: 'virtual',
    status: 'active',
    last4: '4242',
    expMonth: 12,
    expYear: 2027,
    brand: 'Visa',
    nickname: 'Main Virtual Card',
    spendingLimits: { perTransaction: 5000, daily: 10000, monthly: 50000 },
    walletEnabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    activatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    type: 'physical',
    status: 'active',
    last4: '8888',
    expMonth: 6,
    expYear: 2028,
    brand: 'Visa',
    nickname: 'Physical Card',
    spendingLimits: { perTransaction: 2500, daily: 5000, monthly: 25000 },
    walletEnabled: false,
    createdAt: '2024-01-15T00:00:00Z',
    activatedAt: '2024-01-20T00:00:00Z',
  },
];

const mockTransactions: CardTransaction[] = [
  {
    id: '1',
    merchantName: 'Adobe Systems',
    amount: 54.99,
    category: 'Software',
    status: 'completed',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    merchantName: 'Amazon Web Services',
    amount: 127.43,
    category: 'Software',
    status: 'completed',
    createdAt: '2024-01-14T15:45:00Z',
  },
  {
    id: '3',
    merchantName: 'Figma',
    amount: 15.0,
    category: 'Software',
    status: 'completed',
    createdAt: '2024-01-13T09:00:00Z',
  },
  {
    id: '4',
    merchantName: 'WeWork',
    amount: 450.0,
    category: 'Office',
    status: 'pending',
    createdAt: '2024-01-12T14:20:00Z',
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function CardDisplay({ card, onManage }: { card: Card; onManage: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText('4242424242424242');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Card Visual */}
      <div
        className={`relative overflow-hidden rounded-2xl p-6 text-white ${
          card.status === 'frozen'
            ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
            : card.status === 'inactive'
              ? 'bg-gradient-to-br from-gray-400 to-gray-500'
              : 'bg-gradient-to-br from-gray-800 to-gray-900'
        }`}
        style={{ aspectRatio: '1.586' }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-white" />
          <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-white" />
        </div>

        {/* Card Content */}
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70">Skillancer</div>
              <div className="font-medium">{card.nickname}</div>
            </div>
            <div className="flex items-center gap-2">
              {card.type === 'virtual' && (
                <span className="rounded-full bg-white/20 px-2 py-1 text-xs">Virtual</span>
              )}
              {card.status === 'frozen' && <Snowflake className="h-5 w-5" />}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="font-mono text-xl tracking-widest">
                {showDetails ? '4242 4242 4242' : '•••• •••• ••••'} {card.last4}
              </div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="rounded p-1 hover:bg-white/10"
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {showDetails && (
                <button onClick={copyToClipboard} className="rounded p-1 hover:bg-white/10">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-70">Expires</div>
                <div className="font-mono">
                  {showDetails
                    ? `${card.expMonth.toString().padStart(2, '0')}/${card.expYear}`
                    : '••/••••'}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70">CVV</div>
                <div className="font-mono">{showDetails ? '123' : '•••'}</div>
              </div>
              <div className="text-2xl font-bold opacity-70">{card.brand}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      {card.status !== 'active' && (
        <div
          className={`absolute -right-2 -top-2 rounded-full px-3 py-1 text-xs font-medium ${
            card.status === 'frozen'
              ? 'bg-blue-100 text-blue-700'
              : card.status === 'inactive'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {card.status === 'frozen'
            ? 'Frozen'
            : card.status === 'inactive'
              ? 'Activate Required'
              : 'Pending'}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onManage}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" />
          Manage
        </button>
        {card.status === 'active' ? (
          <button className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100">
            <Snowflake className="h-4 w-4" />
            Freeze
          </button>
        ) : card.status === 'frozen' ? (
          <button className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-700 hover:bg-green-100">
            <Unlock className="h-4 w-4" />
            Unfreeze
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CardList({ cards, onSelect }: { cards: Card[]; onSelect: (card: Card) => void }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Your Cards</h2>
        <button
          onClick={() => router.push('/finances/cards/new')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New Card
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <CardDisplay key={card.id} card={card} onManage={() => onSelect(card)} />
        ))}

        {/* Add Card Placeholder */}
        <button
          onClick={() => router.push('/finances/cards/new')}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-8 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
          style={{ aspectRatio: '1.586' }}
        >
          <Plus className="mb-2 h-8 w-8 text-gray-400" />
          <span className="font-medium text-gray-600">Add New Card</span>
          <span className="text-sm text-gray-500">Virtual cards are instant</span>
        </button>
      </div>
    </div>
  );
}

function SpendingLimitsCard({ card }: { card: Card }) {
  const usedToday = 847.52;
  const usedThisMonth = 2134.89;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 font-semibold text-gray-900">Spending Limits</h3>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-600">Per Transaction</span>
            <span className="font-medium">
              ${card.spendingLimits.perTransaction.toLocaleString()}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-600">Daily</span>
            <span className="font-medium">
              ${usedToday.toLocaleString()} / ${card.spendingLimits.daily.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${(usedToday / card.spendingLimits.daily) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-600">Monthly</span>
            <span className="font-medium">
              ${usedThisMonth.toLocaleString()} / ${card.spendingLimits.monthly.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${(usedThisMonth / card.spendingLimits.monthly) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <button className="mt-4 w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
        Edit Limits
      </button>
    </div>
  );
}

function RecentTransactions({ transactions }: { transactions: CardTransaction[] }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Recent Card Transactions</h3>
        <button
          onClick={() => router.push('/finances/transactions?type=card')}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          View All
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {transactions.slice(0, 5).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gray-100 p-2">
                <ShoppingBag className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{tx.merchantName}</div>
                <div className="text-sm text-gray-500">
                  {tx.category} · {new Date(tx.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium text-gray-900">-${tx.amount.toFixed(2)}</div>
              {tx.status === 'pending' && <span className="text-xs text-amber-600">Pending</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSettings({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Card Settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
          <p className="text-gray-500">
            {card.nickname} •••• {card.last4}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {/* Quick Actions */}
          <div className="space-y-2">
            <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 hover:bg-gray-100">
              <div className="flex items-center gap-3">
                <Snowflake className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Freeze Card</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>

            <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 hover:bg-gray-100">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Spending Controls</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>

            <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 hover:bg-gray-100">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Add to Apple Pay</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>

            {card.type === 'physical' && (
              <button className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-gray-600" />
                  <span className="font-medium">Request Replacement</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Danger Zone */}
          <div className="border-t border-gray-100 pt-4">
            <button className="flex w-full items-center justify-between rounded-xl bg-red-50 p-4 hover:bg-red-100">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-700">Cancel Card</span>
              </div>
              <ChevronRight className="h-5 w-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DigitalWalletBanner() {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-white/10 p-3">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">Add to Digital Wallet</h3>
          <p className="text-sm text-gray-300">
            Use your Skillancer Card with Apple Pay or Google Pay
          </p>
        </div>
      </div>
      <button className="rounded-lg bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-100">
        Set Up
      </button>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setCards(mockCards);
      setTransactions(mockTransactions);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const primaryCard = cards.find((c) => c.status === 'active') || cards[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/finances')}
            className="mb-4 flex items-center gap-1 text-gray-500 hover:text-gray-700"
          >
            ← Back to Finances
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Cards</h1>
          <p className="text-gray-500">Manage your Skillancer debit cards</p>
        </div>

        {/* Digital Wallet Banner */}
        {primaryCard && !primaryCard.walletEnabled && (
          <div className="mb-6">
            <DigitalWalletBanner />
          </div>
        )}

        {/* Cards Grid */}
        <div className="mb-8">
          <CardList cards={cards} onSelect={setSelectedCard} />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactions transactions={transactions} />
          </div>
          <div>{primaryCard && <SpendingLimitsCard card={primaryCard} />}</div>
        </div>
      </div>

      {/* Settings Modal */}
      {selectedCard && <CardSettings card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}

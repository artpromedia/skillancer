import 'package:flutter/material.dart';

import '../../domain/models/finance_models.dart';

/// Card Preview Widget for Finances Dashboard
/// Sprint M5: Freelancer Financial Services
class CardPreview extends StatelessWidget {
  final SkillancerCard card;
  final VoidCallback? onTap;

  const CardPreview({
    super.key,
    required this.card,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isVirtual = card.type == CardType.virtual;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 300,
        height: 190,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: card.isFrozen
                ? [Colors.grey.shade400, Colors.grey.shade500]
                : isVirtual
                    ? [const Color(0xFF1a1a2e), const Color(0xFF16213e)]
                    : [const Color(0xFF0f0c29), const Color(0xFF302b63)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Background pattern
            Positioned(
              right: -30,
              top: -30,
              child: Opacity(
                opacity: 0.1,
                child: Icon(
                  Icons.credit_card,
                  size: 150,
                  color: Colors.white,
                ),
              ),
            ),

            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Logo and status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'SKILLANCER',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                        if (isVirtual) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'VIRTUAL',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 8,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (card.isFrozen)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.ac_unit, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text(
                              'FROZEN',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const Spacer(),

                // Card number (masked)
                Text(
                  '•••• •••• •••• ${card.last4}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 2,
                  ),
                ),

                const SizedBox(height: 16),

                // Bottom row: Expiry and brand
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'EXPIRES',
                          style: TextStyle(
                            color: Colors.white54,
                            fontSize: 8,
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          card.expiryFormatted,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    _CardBrandLogo(brand: card.brand),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CardBrandLogo extends StatelessWidget {
  final String brand;

  const _CardBrandLogo({required this.brand});

  @override
  Widget build(BuildContext context) {
    // Simple text-based brand indicator
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        brand.toUpperCase(),
        style: TextStyle(
          color: _getBrandColor(),
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Color _getBrandColor() {
    switch (brand.toLowerCase()) {
      case 'visa':
        return const Color(0xFF1A1F71);
      case 'mastercard':
        return const Color(0xFFEB001B);
      default:
        return Colors.black;
    }
  }
}

/// Skeleton loader for card preview
class CardPreviewSkeleton extends StatelessWidget {
  const CardPreviewSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      height: 190,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}

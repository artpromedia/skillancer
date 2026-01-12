import '../../../core/network/api_client.dart';
import '../domain/models/contract.dart';

/// Contracts repository for fetching and managing contracts/service orders
class ContractsRepository {
  final ApiClient _apiClient;

  ContractsRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get contracts where user is buyer
  Future<ContractsResult> getBuyerContracts({
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (status != null) {
        queryParams['status'] = status;
      }

      final response = await _apiClient.get(
        '/service-orders/buyer',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final contracts = (data['orders'] as List? ?? [])
          .map((o) => _mapOrderToContract(o as Map<String, dynamic>))
          .toList();

      return ContractsResult(
        contracts: contracts,
        total: data['total'] as int? ?? contracts.length,
        hasMore: data['hasMore'] as bool? ?? false,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch contracts');
    }
  }

  /// Get contracts where user is seller/freelancer
  Future<ContractsResult> getSellerContracts({
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (status != null) {
        queryParams['status'] = status;
      }

      final response = await _apiClient.get(
        '/service-orders/seller',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final contracts = (data['orders'] as List? ?? [])
          .map((o) => _mapOrderToContract(o as Map<String, dynamic>))
          .toList();

      return ContractsResult(
        contracts: contracts,
        total: data['total'] as int? ?? contracts.length,
        hasMore: data['hasMore'] as bool? ?? false,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch contracts');
    }
  }

  /// Get all contracts for current user (both buyer and seller)
  Future<List<Contract>> getMyContracts() async {
    try {
      final buyerResult = await getBuyerContracts();
      final sellerResult = await getSellerContracts();

      // Combine and deduplicate
      final allContracts = <String, Contract>{};
      for (final contract in buyerResult.contracts) {
        allContracts[contract.id] = contract;
      }
      for (final contract in sellerResult.contracts) {
        allContracts[contract.id] = contract;
      }

      return allContracts.values.toList()
        ..sort((a, b) => b.startDate.compareTo(a.startDate));
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch contracts');
    }
  }

  /// Get contract by ID
  Future<Contract> getContractById(String contractId) async {
    try {
      final response = await _apiClient.get('/service-orders/$contractId');
      final data = response.data as Map<String, dynamic>;
      return _mapOrderToContract(data['order'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch contract');
    }
  }

  /// Accept delivery
  Future<void> acceptDelivery(String contractId) async {
    try {
      await _apiClient.post('/service-orders/$contractId/accept');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'ACCEPT_ERROR', message: 'Failed to accept delivery');
    }
  }

  /// Request revision
  Future<void> requestRevision({
    required String contractId,
    required String description,
  }) async {
    try {
      await _apiClient.post(
        '/service-orders/$contractId/revision',
        data: {'description': description},
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'REVISION_ERROR', message: 'Failed to request revision');
    }
  }

  /// Cancel contract
  Future<void> cancelContract({
    required String contractId,
    required String reason,
  }) async {
    try {
      await _apiClient.post(
        '/service-orders/$contractId/cancel',
        data: {'reason': reason},
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'CANCEL_ERROR', message: 'Failed to cancel contract');
    }
  }

  /// Map backend service order to Contract model
  Contract _mapOrderToContract(Map<String, dynamic> order) {
    // Map backend status to ContractStatus
    final statusMap = {
      'PENDING_REQUIREMENTS': 'pending',
      'PENDING_PAYMENT': 'pending',
      'IN_PROGRESS': 'active',
      'DELIVERED': 'active',
      'REVISION_REQUESTED': 'active',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
      'DISPUTED': 'disputed',
    };

    final backendStatus = order['status'] as String? ?? 'IN_PROGRESS';
    final mappedStatus = statusMap[backendStatus] ?? 'active';

    // Extract nested objects
    final service = order['service'] as Map<String, dynamic>?;
    final buyer = order['buyer'] as Map<String, dynamic>?;
    final seller = order['seller'] as Map<String, dynamic>?;

    return Contract.fromJson({
      'id': order['id'],
      'title': service?['title'] ?? order['title'] ?? 'Contract',
      'clientId': buyer?['id'] ?? order['buyerId'] ?? '',
      'clientName': buyer?['name'] ?? order['buyerName'] ?? '',
      'clientAvatarUrl': buyer?['avatarUrl'] ?? order['buyerAvatarUrl'],
      'status': mappedStatus,
      'totalAmount': order['totalAmount'] ?? order['total'] ?? 0,
      'paidAmount': order['paidAmount'] ?? 0,
      'hourlyRate': order['hourlyRate'] ?? 0,
      'startDate': order['createdAt'] ?? DateTime.now().toIso8601String(),
      'endDate': order['completedAt'] ?? order['endDate'],
      'description': service?['description'] ?? order['description'],
      'milestones': order['milestones'],
    });
  }
}

/// Result wrapper for paginated contracts
class ContractsResult {
  final List<Contract> contracts;
  final int total;
  final bool hasMore;

  const ContractsResult({
    required this.contracts,
    required this.total,
    required this.hasMore,
  });
}

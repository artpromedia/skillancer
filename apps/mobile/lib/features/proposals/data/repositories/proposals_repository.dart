import '../../../core/network/api_client.dart';
import '../domain/models/proposal.dart';

/// Proposals repository for fetching and managing proposals/bids
class ProposalsRepository {
  final ApiClient _apiClient;

  ProposalsRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get current user's proposals (bids)
  Future<ProposalsResult> getMyProposals({
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
        '/bids/my',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final proposals = (data['bids'] as List? ?? [])
          .map((p) => _mapBidToProposal(p as Map<String, dynamic>))
          .toList();

      return ProposalsResult(
        proposals: proposals,
        total: data['total'] as int? ?? proposals.length,
        hasMore: data['hasMore'] as bool? ?? false,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch proposals');
    }
  }

  /// Get proposal by ID
  Future<Proposal> getProposalById(String proposalId) async {
    try {
      final response = await _apiClient.get('/bids/$proposalId');
      final data = response.data as Map<String, dynamic>;
      return _mapBidToProposal(data['bid'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'FETCH_ERROR', message: 'Failed to fetch proposal');
    }
  }

  /// Submit a new proposal/bid
  Future<Proposal> submitProposal({
    required String jobId,
    required String coverLetter,
    required double proposedRate,
    required String rateType,
    int? deliveryDays,
    List<Map<String, dynamic>>? milestones,
  }) async {
    try {
      final body = <String, dynamic>{
        'jobId': jobId,
        'coverLetter': coverLetter,
        'proposedRate': proposedRate,
        'rateType': rateType,
      };
      if (deliveryDays != null) {
        body['deliveryDays'] = deliveryDays;
      }
      if (milestones != null) {
        body['proposedMilestones'] = milestones;
      }

      final response = await _apiClient.post('/bids', data: body);
      final data = response.data as Map<String, dynamic>;
      return _mapBidToProposal(data['bid'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'SUBMIT_ERROR', message: 'Failed to submit proposal');
    }
  }

  /// Update an existing proposal
  Future<Proposal> updateProposal({
    required String proposalId,
    String? coverLetter,
    double? proposedRate,
    int? deliveryDays,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (coverLetter != null) body['coverLetter'] = coverLetter;
      if (proposedRate != null) body['proposedRate'] = proposedRate;
      if (deliveryDays != null) body['deliveryDays'] = deliveryDays;

      final response = await _apiClient.patch('/bids/$proposalId', data: body);
      final data = response.data as Map<String, dynamic>;
      return _mapBidToProposal(data['bid'] as Map<String, dynamic>);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'UPDATE_ERROR', message: 'Failed to update proposal');
    }
  }

  /// Withdraw a proposal
  Future<void> withdrawProposal(String proposalId) async {
    try {
      await _apiClient.post('/bids/$proposalId/withdraw');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'WITHDRAW_ERROR', message: 'Failed to withdraw proposal');
    }
  }

  /// Map backend bid response to Proposal model
  Proposal _mapBidToProposal(Map<String, dynamic> bid) {
    // Map backend status to ProposalStatus
    final statusMap = {
      'DRAFT': 'draft',
      'SUBMITTED': 'pending',
      'PENDING': 'pending',
      'VIEWED': 'viewed',
      'SHORTLISTED': 'shortlisted',
      'ACCEPTED': 'accepted',
      'HIRED': 'accepted',
      'REJECTED': 'rejected',
      'WITHDRAWN': 'withdrawn',
    };

    final backendStatus = bid['status'] as String? ?? 'PENDING';
    final mappedStatus = statusMap[backendStatus] ?? 'pending';

    // Extract job info if nested
    final job = bid['job'] as Map<String, dynamic>?;

    return Proposal.fromJson({
      'id': bid['id'],
      'jobId': bid['jobId'] ?? bid['projectId'],
      'jobTitle': job?['title'] ?? bid['jobTitle'] ?? '',
      'clientName': job?['clientName'] ?? bid['clientName'] ?? '',
      'clientAvatarUrl': job?['clientAvatarUrl'] ?? bid['clientAvatarUrl'],
      'bidAmount': bid['proposedRate'] ?? bid['bidAmount'] ?? 0,
      'coverLetter': bid['coverLetter'] ?? '',
      'status': mappedStatus,
      'submittedAt': bid['createdAt'] ?? bid['submittedAt'] ?? DateTime.now().toIso8601String(),
      'deliveryDays': bid['deliveryDays'],
      'milestones': bid['proposedMilestones'],
    });
  }
}

/// Result wrapper for paginated proposals
class ProposalsResult {
  final List<Proposal> proposals;
  final int total;
  final bool hasMore;

  const ProposalsResult({
    required this.proposals,
    required this.total,
    required this.hasMore,
  });
}

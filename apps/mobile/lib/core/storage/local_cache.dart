import 'package:hive_flutter/hive_flutter.dart';

import '../../features/contracts/domain/models/contract.dart';
import '../../features/jobs/domain/models/job.dart';
import '../../features/proposals/domain/models/proposal.dart';

/// Local cache using Hive for offline support
class LocalCache {
  static const String _jobsBox = 'jobs_cache';
  static const String _proposalsBox = 'proposals_cache';
  static const String _contractsBox = 'contracts_cache';
  static const String _settingsBox = 'settings_cache';
  static const String _searchHistoryBox = 'search_history';

  static LocalCache? _instance;

  late Box<Map> _jobsBoxInstance;
  late Box<Map> _proposalsBoxInstance;
  late Box<Map> _contractsBoxInstance;
  late Box<dynamic> _settingsBoxInstance;
  late Box<String> _searchHistoryBoxInstance;

  LocalCache._();

  factory LocalCache() {
    _instance ??= LocalCache._();
    return _instance!;
  }

  /// Initialize cache - call during app startup
  static Future<void> initialize() async {
    final instance = LocalCache();

    instance._jobsBoxInstance = await Hive.openBox<Map>(_jobsBox);
    instance._proposalsBoxInstance = await Hive.openBox<Map>(_proposalsBox);
    instance._contractsBoxInstance = await Hive.openBox<Map>(_contractsBox);
    instance._settingsBoxInstance = await Hive.openBox<dynamic>(_settingsBox);
    instance._searchHistoryBoxInstance =
        await Hive.openBox<String>(_searchHistoryBox);
  }

  // ============================================================================
  // Jobs Cache
  // ============================================================================

  Future<void> cacheJobs(List<Job> jobs) async {
    final jobMaps = {for (var job in jobs) job.id: job.toJson()};
    await _jobsBoxInstance.putAll(jobMaps);
    await _setLastUpdated(_jobsBox);
  }

  List<Job> getCachedJobs() {
    return _jobsBoxInstance.values
        .map((map) => Job.fromJson(Map<String, dynamic>.from(map)))
        .toList();
  }

  Future<void> cacheJob(Job job) async {
    await _jobsBoxInstance.put(job.id, job.toJson());
  }

  Job? getCachedJob(String jobId) {
    final map = _jobsBoxInstance.get(jobId);
    if (map == null) return null;
    return Job.fromJson(Map<String, dynamic>.from(map));
  }

  Future<void> removeCachedJob(String jobId) async {
    await _jobsBoxInstance.delete(jobId);
  }

  // ============================================================================
  // Proposals Cache
  // ============================================================================

  Future<void> cacheProposals(List<Proposal> proposals) async {
    final proposalMaps = {for (var p in proposals) p.id: p.toJson()};
    await _proposalsBoxInstance.putAll(proposalMaps);
    await _setLastUpdated(_proposalsBox);
  }

  List<Proposal> getCachedProposals() {
    return _proposalsBoxInstance.values
        .map((map) => Proposal.fromJson(Map<String, dynamic>.from(map)))
        .toList();
  }

  Future<void> cacheProposal(Proposal proposal) async {
    await _proposalsBoxInstance.put(proposal.id, proposal.toJson());
  }

  Proposal? getCachedProposal(String proposalId) {
    final map = _proposalsBoxInstance.get(proposalId);
    if (map == null) return null;
    return Proposal.fromJson(Map<String, dynamic>.from(map));
  }

  // ============================================================================
  // Contracts Cache
  // ============================================================================

  Future<void> cacheContracts(List<Contract> contracts) async {
    final contractMaps = {for (var c in contracts) c.id: c.toJson()};
    await _contractsBoxInstance.putAll(contractMaps);
    await _setLastUpdated(_contractsBox);
  }

  List<Contract> getCachedContracts() {
    return _contractsBoxInstance.values
        .map((map) => Contract.fromJson(Map<String, dynamic>.from(map)))
        .toList();
  }

  // ============================================================================
  // Search History
  // ============================================================================

  Future<void> addSearchQuery(String query) async {
    // Keep only last 20 searches
    final searches = getSearchHistory();
    if (searches.contains(query)) {
      searches.remove(query);
    }
    searches.insert(0, query);
    if (searches.length > 20) {
      searches.removeLast();
    }

    await _searchHistoryBoxInstance.clear();
    for (int i = 0; i < searches.length; i++) {
      await _searchHistoryBoxInstance.put(i.toString(), searches[i]);
    }
  }

  List<String> getSearchHistory() {
    return _searchHistoryBoxInstance.values.toList();
  }

  Future<void> clearSearchHistory() async {
    await _searchHistoryBoxInstance.clear();
  }

  // ============================================================================
  // Settings
  // ============================================================================

  Future<void> setSetting(String key, dynamic value) async {
    await _settingsBoxInstance.put(key, value);
  }

  T? getSetting<T>(String key, {T? defaultValue}) {
    return _settingsBoxInstance.get(key, defaultValue: defaultValue) as T?;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  Future<void> _setLastUpdated(String boxName) async {
    await _settingsBoxInstance.put(
      '${boxName}_last_updated',
      DateTime.now().toIso8601String(),
    );
  }

  DateTime? getLastUpdated(String boxName) {
    final value =
        _settingsBoxInstance.get('${boxName}_last_updated') as String?;
    if (value == null) return null;
    return DateTime.tryParse(value);
  }

  bool isCacheStale(String boxName,
      {Duration maxAge = const Duration(hours: 1)}) {
    final lastUpdated = getLastUpdated(boxName);
    if (lastUpdated == null) return true;
    return DateTime.now().difference(lastUpdated) > maxAge;
  }

  Future<void> clearCache(String boxName) async {
    switch (boxName) {
      case _jobsBox:
        await _jobsBoxInstance.clear();
        break;
      case _proposalsBox:
        await _proposalsBoxInstance.clear();
        break;
      case _contractsBox:
        await _contractsBoxInstance.clear();
        break;
    }
    await _settingsBoxInstance.delete('${boxName}_last_updated');
  }

  Future<void> clearAllCache() async {
    await _jobsBoxInstance.clear();
    await _proposalsBoxInstance.clear();
    await _contractsBoxInstance.clear();
    await _searchHistoryBoxInstance.clear();
    // Keep settings
  }

  /// Get cache size in bytes (approximate)
  int getCacheSize() {
    int size = 0;
    size += _jobsBoxInstance.length * 500; // Estimate 500 bytes per job
    size += _proposalsBoxInstance.length * 300;
    size += _contractsBoxInstance.length * 400;
    return size;
  }
}

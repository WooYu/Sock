enum SyncJobStatus { queued, running, succeeded, failed }

class SyncJob {
  const SyncJob({
    required this.id,
    required this.type,
    required this.status,
    required this.attempts,
    required this.error,
  });

  final String id;
  final String type;
  final SyncJobStatus status;
  final int attempts;
  final String? error;
}

enum UserRole { user, analyst, admin }

class ManagedUser {
  const ManagedUser({
    required this.id,
    required this.phoneMasked,
    required this.role,
    required this.enabled,
  });

  final String id;
  final String phoneMasked;
  final UserRole role;
  final bool enabled;
}

class SecretStatus {
  const SecretStatus({required this.name, required this.configured});
  final String name;
  final bool configured;

  @override
  String toString() => '$name:${configured ? 'configured' : 'missing'}';
}

class AdminAuditEvent {
  const AdminAuditEvent({
    required this.actor,
    required this.action,
    required this.target,
    required this.createdAt,
  });

  final String actor;
  final String action;
  final String target;
  final DateTime createdAt;
}

class AiCallLog {
  const AiCallLog({
    required this.actor,
    required this.purpose,
    required this.model,
    required this.status,
    required this.createdAt,
  });

  final String? actor;
  final String purpose;
  final String model;
  final String status;
  final DateTime createdAt;
}

abstract interface class AdminAuditRepository {
  Future<void> add(AdminAuditEvent event);
}

class MemoryAdminAuditRepository implements AdminAuditRepository {
  final List<AdminAuditEvent> _events = [];
  List<AdminAuditEvent> get events => List.unmodifiable(_events);

  @override
  Future<void> add(AdminAuditEvent event) async => _events.add(event);
}

class AdminService {
  AdminService({required this.audit, DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  final AdminAuditRepository audit;
  final DateTime Function() _clock;

  Future<SyncJob> retry(SyncJob job, {required String actor}) async {
    if (job.status != SyncJobStatus.failed) return job;
    final next = SyncJob(
      id: job.id,
      type: job.type,
      status: SyncJobStatus.queued,
      attempts: job.attempts + 1,
      error: null,
    );
    await _record(actor, 'retry_sync', job.id);
    return next;
  }

  Future<void> repair({required String stockCode, required String actor}) =>
      _record(actor, 'repair_market_data', stockCode);

  Future<ManagedUser> setRole(
    ManagedUser user,
    UserRole role, {
    required String actor,
  }) async {
    await _record(actor, 'set_role', user.id);
    return ManagedUser(
      id: user.id,
      phoneMasked: user.phoneMasked,
      role: role,
      enabled: user.enabled,
    );
  }

  List<SecretStatus> secretStatuses(Map<String, String> serverEnvironment) {
    return serverEnvironment.entries
        .map(
          (entry) => SecretStatus(
            name: entry.key,
            configured: entry.value.trim().isNotEmpty,
          ),
        )
        .toList(growable: false);
  }

  Future<void> _record(String actor, String action, String target) {
    return audit.add(
      AdminAuditEvent(
        actor: actor,
        action: action,
        target: target,
        createdAt: _clock(),
      ),
    );
  }
}

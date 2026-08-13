import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/admin/admin_service.dart';

void main() {
  group('AdminService', () {
    test('retries failed sync jobs and records audit evidence', () async {
      final audit = MemoryAdminAuditRepository();
      final service = AdminService(audit: audit);
      final job = SyncJob(
        id: 'sync-1',
        type: '标注同步',
        status: SyncJobStatus.failed,
        attempts: 2,
        error: 'timeout',
      );

      final retried = await service.retry(job, actor: 'admin');

      expect(retried.status, SyncJobStatus.queued);
      expect(retried.attempts, 3);
      expect(retried.error, isNull);
      expect(audit.events.single.action, 'retry_sync');
    });

    test(
      'data repair records target and never exposes server secret value',
      () async {
        final audit = MemoryAdminAuditRepository();
        final service = AdminService(audit: audit);

        await service.repair(stockCode: '600519', actor: 'admin');
        final secrets = service.secretStatuses({
          'SMS_API_KEY': 'server-secret',
          'MARKET_API_KEY': '',
          'AI_API_KEY': 'server-secret-2',
        });

        expect(audit.events.single.target, '600519');
        expect(secrets.map((item) => item.configured), [true, false, true]);
        expect(
          secrets.map((item) => item.toString()),
          everyElement(isNot(contains('server-secret'))),
        );
      },
    );

    test('updates roles through an auditable operation', () async {
      final audit = MemoryAdminAuditRepository();
      final service = AdminService(audit: audit);
      final user = const ManagedUser(
        id: 'u1',
        phoneMasked: '138****8000',
        role: UserRole.user,
        enabled: true,
      );

      final updated = await service.setRole(
        user,
        UserRole.admin,
        actor: 'owner',
      );

      expect(updated.role, UserRole.admin);
      expect(audit.events.single.action, 'set_role');
      expect(audit.events.single.target, 'u1');
    });
  });
}

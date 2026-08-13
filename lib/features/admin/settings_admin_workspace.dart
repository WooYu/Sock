import 'package:flutter/material.dart';

import 'admin_service.dart';

class SettingsAdminWorkspace extends StatefulWidget {
  const SettingsAdminWorkspace({super.key});

  @override
  State<SettingsAdminWorkspace> createState() => _SettingsAdminWorkspaceState();
}

class _SettingsAdminWorkspaceState extends State<SettingsAdminWorkspace> {
  late final AdminService _admin;
  var _job = const SyncJob(
    id: 'sync-annotation-1',
    type: '标注同步',
    status: SyncJobStatus.failed,
    attempts: 2,
    error: '网络超时',
  );
  var _darkMode = false;
  var _notifications = true;
  var _repairSubmitted = false;

  @override
  void initState() {
    super.initState();
    _admin = AdminService(audit: MemoryAdminAuditRepository());
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: '设置'),
                Tab(text: '管理后台'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _SettingsPanel(
                    darkMode: _darkMode,
                    notifications: _notifications,
                    onDarkMode: (value) => setState(() => _darkMode = value),
                    onNotifications: (value) =>
                        setState(() => _notifications = value),
                  ),
                  _AdminPanel(
                    service: _admin,
                    job: _job,
                    repairSubmitted: _repairSubmitted,
                    onRetry: _retry,
                    onRepair: _repair,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _retry() async {
    final job = await _admin.retry(_job, actor: 'admin');
    setState(() => _job = job);
  }

  Future<void> _repair() async {
    await _admin.repair(stockCode: '600519', actor: 'admin');
    setState(() => _repairSubmitted = true);
  }
}

class _SettingsPanel extends StatelessWidget {
  const _SettingsPanel({
    required this.darkMode,
    required this.notifications,
    required this.onDarkMode,
    required this.onNotifications,
  });

  final bool darkMode;
  final bool notifications;
  final ValueChanged<bool> onDarkMode;
  final ValueChanged<bool> onNotifications;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('看盘偏好', style: Theme.of(context).textTheme.titleMedium),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('指标参数'),
          subtitle: Text('MA 5 / 20 · EMA 12 · BOLL 20, 2'),
          trailing: Icon(Icons.chevron_right),
        ),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('复权方式'),
          subtitle: Text('不复权'),
          trailing: Icon(Icons.chevron_right),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('主题'),
          subtitle: Text(darkMode ? '深色' : '浅色'),
          value: darkMode,
          onChanged: onDarkMode,
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('通知偏好'),
          subtitle: const Text('关键位临近与同步失败'),
          value: notifications,
          onChanged: onNotifications,
        ),
        const Divider(height: 32),
        Text('数据与账户', style: Theme.of(context).textTheme.titleMedium),
        const _ActionTile(icon: Icons.upload_file, title: '导入数据'),
        const _ActionTile(icon: Icons.download_outlined, title: '导出数据'),
        const _ActionTile(icon: Icons.backup_outlined, title: '备份'),
        const _ActionTile(icon: Icons.person_off_outlined, title: '注销账户'),
      ],
    );
  }
}

class _AdminPanel extends StatelessWidget {
  const _AdminPanel({
    required this.service,
    required this.job,
    required this.repairSubmitted,
    required this.onRetry,
    required this.onRepair,
  });

  final AdminService service;
  final SyncJob job;
  final bool repairSubmitted;
  final VoidCallback onRetry;
  final VoidCallback onRepair;

  @override
  Widget build(BuildContext context) {
    final secrets = service.secretStatuses({
      '短信服务': 'configured',
      '行情服务': 'configured',
      'AI 服务': 'configured',
    });
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Section(
          title: '行情源状态',
          child: Row(
            children: [
              const Expanded(child: Text('A 股日线源 · 正常 · 延迟 15 分钟')),
              FilledButton.icon(
                onPressed: onRepair,
                icon: const Icon(Icons.build_outlined),
                label: const Text('修复数据'),
              ),
            ],
          ),
        ),
        if (repairSubmitted) const Text('修复任务已提交'),
        _Section(
          title: '同步任务',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(job.type),
            subtitle: Text(
              job.status == SyncJobStatus.queued
                  ? '等待执行'
                  : '失败 ${job.attempts} 次 · ${job.error}',
            ),
            trailing: job.status == SyncJobStatus.failed
                ? TextButton(onPressed: onRetry, child: const Text('重试'))
                : const Icon(Icons.schedule),
          ),
        ),
        const _Section(title: '用户与权限', child: Text('用户 · 分析师 · 管理员')),
        const _Section(title: '规则模板', child: Text('系统规则 2 · 用户模板 0')),
        const _Section(title: '审计日志', child: Text('管理操作均保留操作者、目标与时间')),
        const _Section(title: 'AI 调用记录', child: Text('只读输入快照 · 文案版本 · 调用状态')),
        _Section(
          title: '服务端密钥',
          child: Column(
            children: [
              for (final secret in secrets)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(secret.name),
                  trailing: Text(secret.configured ? '已配置' : '未配置'),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {},
    );
  }
}

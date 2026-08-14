import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../account/session.dart';
import 'admin_service.dart';
import 'remote_admin_service.dart';
import 'settings_data_service.dart';

class SettingsAdminWorkspace extends StatefulWidget {
  const SettingsAdminWorkspace({
    super.key,
    this.remote,
    this.sessionController,
  });

  final RemoteAdminService? remote;
  final SessionController? sessionController;

  @override
  State<SettingsAdminWorkspace> createState() => _SettingsAdminWorkspaceState();
}

class _SettingsAdminWorkspaceState extends State<SettingsAdminWorkspace> {
  late final AdminService _admin;
  final _data = SettingsDataService();
  var _jobs = <SyncJob>[
    const SyncJob(
      id: 'sync-annotation-1',
      type: '标注同步',
      status: SyncJobStatus.failed,
      attempts: 2,
      error: '网络超时',
    ),
  ];
  var _marketStatus = 'A 股日线源 · 正常 · 延迟 15 分钟';
  var _secrets = const <SecretStatus>[
    SecretStatus(name: '短信服务', configured: true),
    SecretStatus(name: '行情服务', configured: true),
    SecretStatus(name: 'AI 服务', configured: true),
  ];
  var _users = const <ManagedUser>[];
  var _darkMode = false;
  var _notifications = true;
  var _repairSubmitted = false;
  var _loadingAdmin = false;
  String? _adminError;

  @override
  void initState() {
    super.initState();
    _admin = AdminService(audit: MemoryAdminAuditRepository());
    if (widget.remote != null) {
      _jobs = [];
      _secrets = const [];
      _loadingAdmin = true;
      _loadRemote();
    }
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
                    onBackup: _backup,
                    onExport: _export,
                    onImport: _import,
                    onDeleteAccount: _deleteAccount,
                  ),
                  _AdminPanel(
                    marketStatus: _marketStatus,
                    secrets: _secrets,
                    jobs: _jobs,
                    users: _users,
                    loading: _loadingAdmin,
                    error: _adminError,
                    repairSubmitted: _repairSubmitted,
                    onRetry: _retry,
                    onRepair: _repair,
                    onReload: _loadRemote,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadRemote() async {
    final remote = widget.remote;
    if (remote == null) return;
    setState(() {
      _loadingAdmin = true;
      _adminError = null;
    });
    try {
      final snapshot = await remote.load();
      if (!mounted) return;
      setState(() {
        _marketStatus = snapshot.marketStatus;
        _secrets = snapshot.secrets;
        _jobs = snapshot.jobs;
        _users = snapshot.users;
        _loadingAdmin = false;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingAdmin = false;
        _adminError = error.toString();
      });
    }
  }

  Future<void> _retry(SyncJob failed) async {
    final job = widget.remote == null
        ? await _admin.retry(failed, actor: 'admin')
        : await widget.remote!.retry(failed.id);
    setState(() {
      _jobs = [
        for (final item in _jobs)
          if (item.id == job.id) job else item,
      ];
    });
  }

  Future<void> _repair() async {
    if (widget.remote == null) {
      await _admin.repair(stockCode: '600519', actor: 'admin');
    } else {
      final job = await widget.remote!.repair('600519');
      _jobs = [job, ..._jobs];
    }
    setState(() => _repairSubmitted = true);
  }

  Future<void> _backup() async {
    await _data.backup();
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('本地备份已保存')));
  }

  Future<void> _export() async {
    final archive = await _data.exportArchive();
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('StockCal 数据归档'),
        content: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 360),
          child: SingleChildScrollView(child: SelectableText(archive)),
        ),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: archive));
              if (context.mounted) {
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(const SnackBar(content: Text('归档已复制')));
              }
            },
            icon: const Icon(Icons.copy_outlined),
            label: const Text('复制'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }

  Future<void> _import() async {
    var archive = '';
    final submitted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('导入数据归档'),
        content: SizedBox(
          width: 520,
          child: TextFormField(
            minLines: 8,
            maxLines: 14,
            decoration: const InputDecoration(labelText: '归档 JSON'),
            onChanged: (value) => archive = value,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('恢复数据'),
          ),
        ],
      ),
    );
    if (submitted != true) return;
    try {
      await _data.restoreArchive(archive);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('数据已恢复，请重新打开页面')));
      }
    } on FormatException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('注销账户'),
        content: const Text('此操作不可撤销。服务端账户、登录设备和本地数据都将被删除。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确认注销'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.sessionController?.deleteAccount();
      await _data.clearAllData();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('账户与本地数据已删除')));
      }
    } on VerificationException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }
}

class _SettingsPanel extends StatelessWidget {
  const _SettingsPanel({
    required this.darkMode,
    required this.notifications,
    required this.onDarkMode,
    required this.onNotifications,
    required this.onBackup,
    required this.onExport,
    required this.onImport,
    required this.onDeleteAccount,
  });

  final bool darkMode;
  final bool notifications;
  final ValueChanged<bool> onDarkMode;
  final ValueChanged<bool> onNotifications;
  final VoidCallback onBackup;
  final VoidCallback onExport;
  final VoidCallback onImport;
  final VoidCallback onDeleteAccount;

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
        _ActionTile(icon: Icons.upload_file, title: '导入数据', onTap: onImport),
        _ActionTile(
          icon: Icons.download_outlined,
          title: '导出数据',
          onTap: onExport,
        ),
        _ActionTile(icon: Icons.backup_outlined, title: '备份', onTap: onBackup),
        _ActionTile(
          icon: Icons.person_off_outlined,
          title: '注销账户',
          onTap: onDeleteAccount,
        ),
      ],
    );
  }
}

class _AdminPanel extends StatelessWidget {
  const _AdminPanel({
    required this.marketStatus,
    required this.secrets,
    required this.jobs,
    required this.users,
    required this.loading,
    required this.error,
    required this.repairSubmitted,
    required this.onRetry,
    required this.onRepair,
    required this.onReload,
  });

  final String marketStatus;
  final List<SecretStatus> secrets;
  final List<SyncJob> jobs;
  final List<ManagedUser> users;
  final bool loading;
  final String? error;
  final bool repairSubmitted;
  final ValueChanged<SyncJob> onRetry;
  final VoidCallback onRepair;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Section(
          title: '行情源状态',
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
              ? _AdminError(message: error!, onReload: onReload)
              : Row(
                  children: [
                    Expanded(child: Text(marketStatus)),
                    FilledButton.icon(
                      onPressed: onRepair,
                      icon: const Icon(Icons.build_outlined),
                      label: const Text('修复数据'),
                    ),
                  ],
                ),
        ),
        if (repairSubmitted) const Text('修复任务已提交'),
        if (!loading && error == null) ...[
          _Section(
            title: '同步任务',
            child: jobs.isEmpty
                ? const Text('暂无同步任务')
                : Column(
                    children: [
                      for (final job in jobs)
                        _JobTile(job: job, onRetry: onRetry),
                    ],
                  ),
          ),
          _Section(
            title: '用户与权限',
            child: users.isEmpty
                ? const Text('暂无用户记录')
                : Column(
                    children: [for (final user in users) _UserTile(user: user)],
                  ),
          ),
        ],
        const _Section(title: '规则模板', child: Text('系统规则 2 · 用户模板 0')),
        const _Section(title: '审计日志', child: Text('管理操作均保留操作者、目标与时间')),
        const _Section(title: 'AI 调用记录', child: Text('只读输入快照 · 文案版本 · 调用状态')),
        if (!loading && error == null)
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

class _AdminError extends StatelessWidget {
  const _AdminError({required this.message, required this.onReload});
  final String message;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.lock_outline),
      const SizedBox(width: 8),
      Expanded(child: Text(message)),
      IconButton(
        tooltip: '重新加载管理数据',
        onPressed: onReload,
        icon: const Icon(Icons.refresh),
      ),
    ],
  );
}

class _JobTile extends StatelessWidget {
  const _JobTile({required this.job, required this.onRetry});
  final SyncJob job;
  final ValueChanged<SyncJob> onRetry;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(job.type),
    subtitle: Text(
      job.status == SyncJobStatus.queued
          ? '等待执行'
          : job.status == SyncJobStatus.failed
          ? '失败 ${job.attempts} 次 · ${job.error}'
          : job.status.name,
    ),
    trailing: job.status == SyncJobStatus.failed
        ? TextButton(onPressed: () => onRetry(job), child: const Text('重试'))
        : const Icon(Icons.schedule),
  );
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});
  final ManagedUser user;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.person_outline),
    title: Text(user.phoneMasked),
    subtitle: Text(user.role.name.toUpperCase()),
    trailing: Icon(user.enabled ? Icons.check_circle_outline : Icons.block),
  );
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
  const _ActionTile({required this.icon, required this.title, this.onTap});
  final IconData icon;
  final String title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

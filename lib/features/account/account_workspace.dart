import 'dart:async';

import 'package:flutter/material.dart';

import 'session.dart';

/// 账户页统计数字。
class AccountStats {
  const AccountStats({
    required this.watchlist,
    required this.notes,
    required this.predictions,
    required this.reviews,
  });

  final int watchlist;
  final int notes;
  final int predictions;
  final int reviews;
}

class AccountWorkspace extends StatefulWidget {
  const AccountWorkspace({
    super.key,
    required this.controller,
    required this.loadStats,
  });

  final SessionController controller;

  /// 返回账户页统计数字（自选股 / 笔记 / 预测 / 复盘）。
  final Future<AccountStats> Function() loadStats;

  @override
  State<AccountWorkspace> createState() => _AccountWorkspaceState();
}

class _AccountWorkspaceState extends State<AccountWorkspace> {
  final _formKey = GlobalKey<FormState>();
  var _phone = '';
  var _code = '';
  String? _error;
  String? _notice;
  var _secondsUntilResend = 0;
  var _isRequesting = false;
  Timer? _resendTimer;
  Future<AccountStats>? _stats;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    _ensureStats();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    widget.controller.removeListener(_refresh);
    super.dispose();
  }

  void _ensureStats() {
    if (_stats == null && widget.controller.session != null) {
      _stats = widget.loadStats();
    }
  }

  void _refresh() => setState(_ensureStats);

  @override
  Widget build(BuildContext context) {
    final session = widget.controller.session;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: session == null ? _buildSignIn() : _buildAccount(session),
    );
  }

  Widget _buildSignIn() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(
                  Icons.candlestick_chart_outlined,
                  size: 44,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 12),
                Text(
                  'StockCal',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'A 股决策日志 · 手机号登录',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 24),
                TextFormField(
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  keyboardType: TextInputType.phone,
                  onChanged: (value) => _phone = value.trim(),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: InputDecoration(
                    labelText: '验证码',
                    prefixIcon: const Icon(Icons.password_outlined),
                    suffixIcon: Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: TextButton(
                        onPressed: _isRequesting || _secondsUntilResend > 0
                            ? null
                            : _requestCode,
                        child: Text(
                          _secondsUntilResend > 0
                              ? '$_secondsUntilResend 秒后重发'
                              : '获取验证码',
                        ),
                      ),
                    ),
                    suffixIconConstraints: const BoxConstraints(minWidth: 112),
                  ),
                  keyboardType: TextInputType.number,
                  onChanged: (value) => _code = value.trim(),
                ),
                if (_notice != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _notice!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: _signIn,
                  icon: const Icon(Icons.login),
                  label: const Text('登录'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAccount(UserSession session) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildProfileCard(session),
        const SizedBox(height: 12),
        FutureBuilder<AccountStats>(
          future: _stats,
          builder: (context, snapshot) => _buildStatsGrid(snapshot.data),
        ),
        const SizedBox(height: 20),
        _buildSectionTitle('设备管理'),
        _buildDeviceList(),
        const SizedBox(height: 20),
        _buildSectionTitle('同步状态'),
        _buildSyncList(),
        const SizedBox(height: 24),
        _buildSignOut(),
      ],
    );
  }

  Widget _buildProfileCard(UserSession session) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.14),
            scheme.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: scheme.primary.withValues(alpha: 0.22),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: scheme.primary.withValues(alpha: 0.14),
            child: Icon(Icons.person_outline, color: scheme.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _maskPhone(session.phone),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '普通用户',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: scheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsGrid(AccountStats? stats) {
    final cards = [
      ('自选股', stats?.watchlist ?? 0),
      ('笔记', stats?.notes ?? 0),
      ('预测', stats?.predictions ?? 0),
      ('复盘', stats?.reviews ?? 0),
    ];
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildStatCard(cards[0].$1, cards[0].$2)),
            const SizedBox(width: 8),
            Expanded(child: _buildStatCard(cards[1].$1, cards[1].$2)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _buildStatCard(cards[2].$1, cards[2].$2)),
            const SizedBox(width: 8),
            Expanded(child: _buildStatCard(cards[3].$1, cards[3].$2)),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, int value) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$value',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }

  Widget _buildDeviceList() {
    final scheme = Theme.of(context).colorScheme;
    final devices = widget.controller.devices;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: devices.isEmpty
          ? ListTile(
              leading: const Icon(Icons.devices_outlined),
              title: const Text('设备信息暂不可用'),
              subtitle: const Text('网络恢复后将自动更新'),
            )
          : Column(
              children: [
                for (final device in devices)
                  ListTile(
                    leading: Icon(
                      device.isCurrent
                          ? Icons.devices_outlined
                          : Icons.laptop_outlined,
                    ),
                    title: Text(device.isCurrent ? '当前设备' : device.name),
                    subtitle: Text(
                      device.isCurrent
                          ? '${device.name} · 最近活跃'
                          : '已登录设备',
                    ),
                    trailing: device.isCurrent
                        ? const Icon(Icons.verified_user_outlined)
                        : IconButton(
                            onPressed: () => _revokeDevice(device),
                            tooltip: '撤销 ${device.name}',
                            icon: const Icon(Icons.logout),
                          ),
                  ),
              ],
            ),
    );
  }

  Widget _buildSyncList() {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: const Column(
        children: [
          ListTile(
            leading: Icon(Icons.cloud_done_outlined),
            title: Text('已同步'),
            subtitle: Text('自选股、交易、标注、规则与预测记录'),
            trailing: Icon(Icons.check_circle_outline),
          ),
          Divider(height: 1, indent: 56),
          ListTile(
            leading: Icon(Icons.key_outlined),
            title: Text('令牌有效'),
            subtitle: Text('将在到期前自动续期'),
          ),
        ],
      ),
    );
  }

  Widget _buildSignOut() {
    return OutlinedButton.icon(
      onPressed: widget.controller.signOut,
      icon: const Icon(Icons.logout),
      label: const Text('退出登录'),
    );
  }

  Future<void> _signIn() async {
    try {
      await widget.controller.verifyPhone(phone: _phone, code: _code);
      if (mounted) setState(() => _error = null);
    } on VerificationException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _requestCode() async {
    setState(() {
      _isRequesting = true;
      _error = null;
      _notice = null;
    });
    try {
      await widget.controller.requestVerificationCode(_phone);
      if (!mounted) return;
      setState(() {
        _isRequesting = false;
        _secondsUntilResend = 60;
        _notice = '验证码已发送（开发模式验证码：000000）';
      });
      _resendTimer?.cancel();
      _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() {
          _secondsUntilResend -= 1;
          if (_secondsUntilResend <= 0) timer.cancel();
        });
      });
    } on VerificationException catch (error) {
      if (!mounted) return;
      setState(() {
        _isRequesting = false;
        _error = error.message;
      });
    }
  }

  Future<void> _revokeDevice(UserDevice device) async {
    try {
      await widget.controller.revokeDevice(device.id);
      if (mounted) setState(() => _error = null);
    } on VerificationException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  String _maskPhone(String phone) {
    if (phone.length != 11) return phone;
    return '${phone.substring(0, 3)}****${phone.substring(7)}';
  }
}

import 'dart:async';

import 'package:flutter/material.dart';

import 'session.dart';

class AccountWorkspace extends StatefulWidget {
  const AccountWorkspace({super.key, required this.controller});

  final SessionController controller;

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

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    widget.controller.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

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
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.person_outline)),
          title: Text(_maskPhone(session.phone)),
          subtitle: const Text('个人资料 · StockCal 用户'),
          trailing: OutlinedButton.icon(
            onPressed: widget.controller.signOut,
            icon: const Icon(Icons.logout),
            label: const Text('退出登录'),
          ),
        ),
        const Divider(height: 32),
        Text('设备管理', style: Theme.of(context).textTheme.titleMedium),
        if (widget.controller.devices.isEmpty)
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.devices_outlined),
            title: Text('设备信息暂不可用'),
            subtitle: Text('网络恢复后将自动更新'),
          )
        else
          for (final device in widget.controller.devices)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                device.isCurrent
                    ? Icons.devices_outlined
                    : Icons.laptop_outlined,
              ),
              title: Text(device.isCurrent ? '当前设备' : device.name),
              subtitle: Text(
                device.isCurrent ? '${device.name} · 最近活跃' : '已登录设备',
              ),
              trailing: device.isCurrent
                  ? const Icon(Icons.verified_user_outlined)
                  : IconButton(
                      onPressed: () => _revokeDevice(device),
                      tooltip: '撤销 ${device.name}',
                      icon: const Icon(Icons.logout),
                    ),
            ),
        const Divider(height: 32),
        Text('同步状态', style: Theme.of(context).textTheme.titleMedium),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.cloud_done_outlined),
          title: Text('已同步'),
          subtitle: Text('自选股、交易、标注、规则与预测记录'),
          trailing: Icon(Icons.check_circle_outline),
        ),
        const ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.key_outlined),
          title: Text('令牌有效'),
          subtitle: Text('将在到期前自动续期'),
        ),
      ],
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

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

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
  }

  @override
  void dispose() {
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
                  Icons.lock_person_outlined,
                  size: 40,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  '手机验证码登录',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
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
                  decoration: const InputDecoration(
                    labelText: '验证码',
                    prefixIcon: Icon(Icons.password_outlined),
                  ),
                  keyboardType: TextInputType.number,
                  onChanged: (value) => _code = value.trim(),
                ),
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
        const ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.devices_outlined),
          title: Text('当前设备'),
          subtitle: Text('StockCal Flutter · 最近活跃'),
          trailing: Icon(Icons.verified_user_outlined),
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

  String _maskPhone(String phone) {
    if (phone.length != 11) return phone;
    return '${phone.substring(0, 3)}****${phone.substring(7)}';
  }
}

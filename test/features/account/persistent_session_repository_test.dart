import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/account/persistent_session_repository.dart';
import 'package:stockcal/features/account/session.dart';

void main() {
  test('session survives repository recreation and can be cleared', () async {
    SharedPreferences.setMockInitialValues({});
    final first = PersistentSessionRepository();
    await first.save(
      const UserSession(phone: '13800138000', accessToken: 'token-1'),
    );

    final restored = await PersistentSessionRepository().restore();
    expect(restored?.phone, '13800138000');
    expect(restored?.accessToken, 'token-1');

    await PersistentSessionRepository().clear();
    expect(await PersistentSessionRepository().restore(), isNull);
  });
}

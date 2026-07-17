import 'package:flutter/foundation.dart';

/// Broadcasts the signed-in user's own avatar so every open screen updates
/// the moment it changes — without this, screens built before the change
/// (e.g. HomeScreen, opened before visiting Profile) keep showing the stale
/// widget.user.avatarUrl captured at login until the app restarts.
class ProfileService {
  ProfileService._();

  /// Null until the user has changed their photo this session; screens
  /// should fall back to widget.user.avatarUrl while this is null.
  static final ValueNotifier<String?> avatarUrl = ValueNotifier(null);

  static void setAvatarUrl(String url) => avatarUrl.value = url;
}

/// Tracks which room's ChatScreen is currently on top, so other parts of the
/// app (the HomeScreen's chat-list socket) can tell "peer has this chat open"
/// apart from "peer is only in the app somewhere else" — the same distinction
/// the server's message_delivered/peer_read events are built around.
class ActiveChatTracker {
  ActiveChatTracker._();

  static String? currentRoomId;
}

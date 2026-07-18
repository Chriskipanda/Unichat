import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config.dart';
import '../models/models.dart';

/// Renderers for the non-text, non-image/video "special" message types —
/// document, audio, location, contact, poll, event. One switch here keeps
/// chat_screen's bubble tree from growing a case per type.
class SpecialBubbleContent extends StatelessWidget {
  final Message msg;
  final bool isMe;
  final String currentUserId;
  final void Function(int optionIndex)? onVote;

  const SpecialBubbleContent({
    super.key,
    required this.msg,
    required this.isMe,
    required this.currentUserId,
    this.onVote,
  });

  @override
  Widget build(BuildContext context) {
    if (msg.isDocument) return _DocumentTile(msg: msg, isMe: isMe);
    if (msg.isAudioMessage) return _AudioTile(msg: msg, isMe: isMe);
    if (msg.isLocation) return _LocationTile(msg: msg, isMe: isMe);
    if (msg.isContactShare) return _ContactTile(msg: msg, isMe: isMe);
    if (msg.isPoll) return _PollTile(msg: msg, isMe: isMe, currentUserId: currentUserId, onVote: onVote);
    if (msg.isEvent) return _EventTile(msg: msg, isMe: isMe);
    // Shouldn't happen — SpecialBubbleContent is only built for one of the above.
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Text(msg.content, style: TextStyle(color: isMe ? AppColors.bgMain : context.cl.text)),
    );
  }
}

Color _textColor(BuildContext context, bool isMe) => isMe ? AppColors.bgMain : context.cl.text;
Color _subColor(BuildContext context, bool isMe) =>
    isMe ? AppColors.bgMain.withValues(alpha: 0.65) : context.cl.textSec;

class _DocumentTile extends StatelessWidget {
  final Message msg;
  final bool isMe;
  const _DocumentTile({required this.msg, required this.isMe});

  String get _name => (msg.metadata['originalName'] as String?) ?? 'Document';

  Future<void> _open() async {
    final url = msg.imageUrl;
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: msg.imageUrl != null ? _open : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: (isMe ? AppColors.bgMain : AppColors.brand).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.description_rounded, color: isMe ? AppColors.bgMain : AppColors.brand, size: 22),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(_name, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: _textColor(context, isMe))),
              const SizedBox(height: 2),
              Text(msg.imageUrl == null ? 'Sending…' : 'Tap to open',
                  style: TextStyle(fontSize: 12, color: _subColor(context, isMe))),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _AudioTile extends StatefulWidget {
  final Message msg;
  final bool isMe;
  const _AudioTile({required this.msg, required this.isMe});

  @override
  State<_AudioTile> createState() => _AudioTileState();
}

class _AudioTileState extends State<_AudioTile> {
  final _player = AudioPlayer();
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.onPositionChanged.listen((p) { if (mounted) setState(() => _position = p); });
    _player.onDurationChanged.listen((d) { if (mounted) setState(() => _total = d); });
    _player.onPlayerComplete.listen((_) { if (mounted) setState(() { _playing = false; _position = Duration.zero; }); });
  }

  Future<void> _toggle() async {
    final url = widget.msg.imageUrl;
    if (url == null) return;
    if (_playing) {
      await _player.pause();
      if (mounted) setState(() => _playing = false);
    } else {
      await _player.play(UrlSource(url));
      if (mounted) setState(() => _playing = true);
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final isMe = widget.isMe;
    final progress = _total.inMilliseconds == 0 ? 0.0 : _position.inMilliseconds / _total.inMilliseconds;
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 14, 8),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        InkWell(
          onTap: widget.msg.imageUrl != null ? _toggle : null,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(shape: BoxShape.circle, color: (isMe ? AppColors.bgMain : AppColors.brand).withValues(alpha: 0.15)),
            child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: isMe ? AppColors.bgMain : AppColors.brand, size: 20),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 130,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                minHeight: 3,
                backgroundColor: _subColor(context, isMe).withValues(alpha: 0.25),
                valueColor: AlwaysStoppedAnimation(isMe ? AppColors.bgMain : AppColors.brand),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.msg.imageUrl == null ? 'Sending…' : (_total == Duration.zero ? 'Voice message' : _fmt(_total - _position)),
              style: TextStyle(fontSize: 11.5, color: _subColor(context, isMe)),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _LocationTile extends StatelessWidget {
  final Message msg;
  final bool isMe;
  const _LocationTile({required this.msg, required this.isMe});

  Future<void> _open() async {
    final lat = msg.metadata['lat'];
    final lng = msg.metadata['lng'];
    if (lat == null || lng == null) return;
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _open,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.location_on_rounded, color: isMe ? AppColors.bgMain : AppColors.brand, size: 26),
          const SizedBox(width: 8),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text('Shared location', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: _textColor(context, isMe))),
              const SizedBox(height: 2),
              Text('Tap to open in Maps', style: TextStyle(fontSize: 12, color: _subColor(context, isMe))),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  final Message msg;
  final bool isMe;
  const _ContactTile({required this.msg, required this.isMe});

  Future<void> _call() async {
    final phone = msg.metadata['phone'] as String?;
    if (phone == null || phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final name = (msg.metadata['name'] as String?) ?? 'Contact';
    final phone = msg.metadata['phone'] as String?;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: (isMe ? AppColors.bgMain : AppColors.brand).withValues(alpha: 0.15),
          child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: TextStyle(fontWeight: FontWeight.w700, color: isMe ? AppColors.bgMain : AppColors.brand)),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: _textColor(context, isMe))),
            if (phone != null && phone.isNotEmpty) ...[
              const SizedBox(height: 2),
              InkWell(
                onTap: _call,
                child: Text(phone, style: TextStyle(fontSize: 12.5, color: _subColor(context, isMe), decoration: TextDecoration.underline)),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _PollTile extends StatelessWidget {
  final Message msg;
  final bool isMe;
  final String currentUserId;
  final void Function(int optionIndex)? onVote;
  const _PollTile({required this.msg, required this.isMe, required this.currentUserId, this.onVote});

  @override
  Widget build(BuildContext context) {
    final question = (msg.metadata['question'] as String?) ?? 'Poll';
    final options = ((msg.metadata['options'] as List?) ?? []).cast<dynamic>();
    final totalVotes = options.fold<int>(0, (sum, o) => sum + (((o as Map)['votes'] as List?)?.length ?? 0));

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Icon(Icons.bar_chart_rounded, size: 18, color: isMe ? AppColors.bgMain : AppColors.brand),
          const SizedBox(width: 6),
          Flexible(child: Text(question, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _textColor(context, isMe)))),
        ]),
        const SizedBox(height: 8),
        for (int i = 0; i < options.length; i++) _pollOption(context, options[i] as Map, i, totalVotes),
        const SizedBox(height: 2),
        Text('$totalVotes vote${totalVotes == 1 ? "" : "s"}', style: TextStyle(fontSize: 11.5, color: _subColor(context, isMe))),
      ]),
    );
  }

  Widget _pollOption(BuildContext context, Map option, int index, int totalVotes) {
    final votes = ((option['votes'] as List?) ?? []).cast<String>();
    final mine = votes.contains(currentUserId);
    final ratio = totalVotes == 0 ? 0.0 : votes.length / totalVotes;
    final barColor = isMe ? AppColors.bgMain : AppColors.brand;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: onVote == null ? null : () => onVote!(index),
        borderRadius: BorderRadius.circular(8),
        child: Stack(children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: mine ? barColor : barColor.withValues(alpha: 0.3), width: mine ? 1.5 : 1),
            ),
            child: Stack(children: [
              Positioned.fill(
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: ratio.clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(color: barColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(7)),
                  ),
                ),
              ),
              Row(children: [
                if (mine) Padding(padding: const EdgeInsets.only(right: 6), child: Icon(Icons.check_circle_rounded, size: 15, color: barColor)),
                Expanded(child: Text(option['text']?.toString() ?? '', style: TextStyle(fontSize: 13.5, color: _textColor(context, isMe)))),
                Text('${votes.length}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _subColor(context, isMe))),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  final Message msg;
  final bool isMe;
  const _EventTile({required this.msg, required this.isMe});

  @override
  Widget build(BuildContext context) {
    final title = (msg.metadata['title'] as String?) ?? 'Event';
    final startsAt = DateTime.tryParse((msg.metadata['startsAt'] as String?) ?? '')?.toLocal();
    final location = msg.metadata['location'] as String?;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(color: (isMe ? AppColors.bgMain : AppColors.brand).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
          child: Icon(Icons.event_rounded, color: isMe ? AppColors.bgMain : AppColors.brand, size: 22),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(title, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: _textColor(context, isMe))),
            if (startsAt != null) ...[
              const SizedBox(height: 2),
              Text(_formatEventTime(startsAt), style: TextStyle(fontSize: 12.5, color: _subColor(context, isMe))),
            ],
            if (location != null && location.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(location, style: TextStyle(fontSize: 12, color: _subColor(context, isMe))),
            ],
          ]),
        ),
      ]),
    );
  }

  String _formatEventTime(DateTime dt) {
    final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, $hour:$minute $ampm';
  }
}

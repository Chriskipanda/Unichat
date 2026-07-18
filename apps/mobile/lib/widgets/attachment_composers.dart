import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import '../config.dart';

/// Bottom sheet shown while a voice note is recording. Pops with the
/// recorded file path on Stop, or null on Cancel (after discarding the file).
class RecordingSheet extends StatefulWidget {
  final AudioRecorder recorder;
  const RecordingSheet({super.key, required this.recorder});

  @override
  State<RecordingSheet> createState() => _RecordingSheetState();
}

class _RecordingSheetState extends State<RecordingSheet> {
  Duration _elapsed = Duration.zero;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsed += const Duration(seconds: 1));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _stop() async {
    _timer?.cancel();
    final path = await widget.recorder.stop();
    if (mounted) Navigator.pop(context, path);
  }

  Future<void> _cancel() async {
    _timer?.cancel();
    final path = await widget.recorder.stop();
    if (path != null) {
      final file = File(path);
      if (await file.exists()) await file.delete();
    }
    if (mounted) Navigator.pop(context, null);
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, 28, 24, 28 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: context.cl.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 64, height: 64,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFDC2626)),
          child: const Icon(Icons.mic_rounded, color: Colors.white, size: 30),
        ),
        const SizedBox(height: 16),
        Text(_fmt(_elapsed), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.cl.text)),
        const SizedBox(height: 4),
        Text('Recording…', style: TextStyle(fontSize: 13, color: context.cl.textSec)),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          _actionButton(context, icon: Icons.close_rounded, label: 'Cancel', color: context.cl.textSec, onTap: _cancel),
          _actionButton(context, icon: Icons.send_rounded, label: 'Send', color: AppColors.brand, onTap: _stop, filled: true),
        ]),
      ]),
    );
  }

  Widget _actionButton(BuildContext context, {required IconData icon, required String label, required Color color, required VoidCallback onTap, bool filled = false}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(shape: BoxShape.circle, color: filled ? color : color.withValues(alpha: 0.12)),
          child: Icon(icon, color: filled ? Colors.white : color, size: 24),
        ),
        const SizedBox(height: 6),
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: context.cl.text)),
      ]),
    );
  }
}

/// Bottom sheet for composing a poll — question + at least two options.
/// Pops `{'question': String, 'options': List of String}` or null if cancelled.
class PollComposerSheet extends StatefulWidget {
  const PollComposerSheet({super.key});

  @override
  State<PollComposerSheet> createState() => _PollComposerSheetState();
}

class _PollComposerSheetState extends State<PollComposerSheet> {
  final _questionCtrl = TextEditingController();
  final List<TextEditingController> _optionCtrls = [TextEditingController(), TextEditingController()];

  @override
  void dispose() {
    _questionCtrl.dispose();
    for (final c in _optionCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  void _addOption() {
    if (_optionCtrls.length >= 8) return;
    setState(() => _optionCtrls.add(TextEditingController()));
  }

  void _removeOption(int index) {
    if (_optionCtrls.length <= 2) return;
    setState(() {
      final removed = _optionCtrls.removeAt(index);
      removed.dispose();
    });
  }

  void _submit() {
    final question = _questionCtrl.text.trim();
    final options = _optionCtrls.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();
    if (question.isEmpty || options.length < 2) return;
    Navigator.pop(context, {'question': question, 'options': options});
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        decoration: BoxDecoration(color: context.cl.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Icon(Icons.bar_chart_rounded, color: AppColors.brand),
              const SizedBox(width: 8),
              Text('Create Poll', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: context.cl.text)),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: _questionCtrl,
              autofocus: true,
              decoration: InputDecoration(hintText: 'Ask a question…', filled: true, fillColor: context.cl.cardLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
              style: TextStyle(color: context.cl.text),
            ),
            const SizedBox(height: 12),
            for (int i = 0; i < _optionCtrls.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _optionCtrls[i],
                      decoration: InputDecoration(hintText: 'Option ${i + 1}', filled: true, fillColor: context.cl.cardLight,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
                      style: TextStyle(color: context.cl.text),
                    ),
                  ),
                  if (_optionCtrls.length > 2)
                    IconButton(onPressed: () => _removeOption(i), icon: Icon(Icons.close_rounded, size: 18, color: context.cl.textHint)),
                ]),
              ),
            if (_optionCtrls.length < 8)
              TextButton.icon(
                onPressed: _addOption,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add option'),
                style: TextButton.styleFrom(foregroundColor: AppColors.brand),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(backgroundColor: AppColors.brand, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                child: const Text('Create Poll', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Bottom sheet for composing an event — title, date/time, optional location.
/// Pops {'title': String, 'startsAt': ISO8601 String, 'location': String?}.
class EventComposerSheet extends StatefulWidget {
  const EventComposerSheet({super.key});

  @override
  State<EventComposerSheet> createState() => _EventComposerSheetState();
}

class _EventComposerSheetState extends State<EventComposerSheet> {
  final _titleCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 12, minute: 0);

  @override
  void dispose() {
    _titleCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context, initialDate: _date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time);
    if (picked != null) setState(() => _time = picked);
  }

  void _submit() {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) return;
    final startsAt = DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);
    Navigator.pop(context, {
      'title': title,
      'startsAt': startsAt.toIso8601String(),
      'location': _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        decoration: BoxDecoration(color: context.cl.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(20))),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Icon(Icons.event_rounded, color: AppColors.brand),
              const SizedBox(width: 8),
              Text('Create Event', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: context.cl.text)),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: _titleCtrl,
              autofocus: true,
              decoration: InputDecoration(hintText: 'Event title…', filled: true, fillColor: context.cl.cardLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
              style: TextStyle(color: context.cl.text),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.calendar_today_rounded, size: 16),
                  label: Text('${_date.month}/${_date.day}/${_date.year}'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickTime,
                  icon: const Icon(Icons.access_time_rounded, size: 16),
                  label: Text(_time.format(context)),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            TextField(
              controller: _locationCtrl,
              decoration: InputDecoration(hintText: 'Location (optional)', filled: true, fillColor: context.cl.cardLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
              style: TextStyle(color: context.cl.text),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(backgroundColor: AppColors.brand, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
                child: const Text('Create Event', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

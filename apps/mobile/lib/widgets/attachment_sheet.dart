import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';
import '../config.dart';

/// Inline attachment panel — sits directly below the input bar, no modal.
/// Matches WhatsApp's style: options grid on top, scrollable media grid below.
class AttachmentPanel extends StatefulWidget {
  final VoidCallback onGallery, onCamera, onLocation, onContact;
  final VoidCallback onDocument, onPoll, onEvent, onAudio;
  final void Function(AssetEntity asset) onMediaTap;

  const AttachmentPanel({
    super.key,
    required this.onGallery,  required this.onCamera,
    required this.onLocation, required this.onContact,
    required this.onDocument, required this.onPoll,
    required this.onEvent,    required this.onAudio,
    required this.onMediaTap,
  });

  @override
  State<AttachmentPanel> createState() => _AttachmentPanelState();
}

class _AttachmentPanelState extends State<AttachmentPanel> {
  List<AssetEntity> _assets = [];
  bool _loading = true;
  bool _permDenied = false;

  @override
  void initState() {
    super.initState();
    _loadMedia();
  }

  Future<void> _loadMedia() async {
    final perm = await PhotoManager.requestPermissionExtend();
    if (!mounted) return;
    if (!perm.isAuth) {
      setState(() { _loading = false; _permDenied = true; });
      return;
    }
    final albums = await PhotoManager.getAssetPathList(
      type: RequestType.common, hasAll: true,
    );
    if (!mounted) return;
    if (albums.isEmpty) { setState(() => _loading = false); return; }
    final assets = await albums.first.getAssetListRange(start: 0, end: 40);
    if (mounted) setState(() { _assets = assets; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      // height is controlled by parent (AnimatedContainer)
      decoration: BoxDecoration(
        color: context.cl.surface,
        border: Border(top: BorderSide(color: context.cl.divider.withValues(alpha: 0.4))),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, -2)),
        ],
      ),
      child: Column(
        children: [
          // ── Drag handle
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Container(
              width: 36, height: 3.5,
              decoration: BoxDecoration(
                color: context.cl.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // ── 2×4 option tiles
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(
              children: [
                _optRow(context, [
                  _Opt('Gallery',  Icons.photo_library_rounded,  const Color(0xFF1565C0), const Color(0xFFE3F2FD), widget.onGallery),
                  _Opt('Camera',   Icons.camera_alt_rounded,     const Color(0xFFAD1457), const Color(0xFFFCE4EC), widget.onCamera),
                  _Opt('Location', Icons.location_on_rounded,    const Color(0xFF2E7D32), const Color(0xFFE8F5E9), widget.onLocation),
                  _Opt('Contact',  Icons.person_rounded,         const Color(0xFF0277BD), const Color(0xFFE1F5FE), widget.onContact),
                ]),
                const SizedBox(height: 8),
                _optRow(context, [
                  _Opt('Document', Icons.description_rounded,   const Color(0xFF6A1B9A), const Color(0xFFF3E5F5), widget.onDocument),
                  _Opt('Poll',     Icons.poll_rounded,           const Color(0xFFE65100), const Color(0xFFFFF3E0), widget.onPoll),
                  _Opt('Event',    Icons.event_rounded,          const Color(0xFFC62828), const Color(0xFFFFEBEE), widget.onEvent),
                  _Opt('Audio',    Icons.mic_rounded,            const Color(0xFF00695C), const Color(0xFFE0F2F1), widget.onAudio),
                ]),
              ],
            ),
          ),

          // ── Recents divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Expanded(child: Divider(color: context.cl.divider, height: 1)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text('Recents',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                      color: context.cl.textHint, letterSpacing: 0.5)),
              ),
              Expanded(child: Divider(color: context.cl.divider, height: 1)),
            ]),
          ),
          const SizedBox(height: 6),

          // ── Media grid
          Expanded(child: _buildGrid(context)),
        ],
      ),
    );
  }

  Widget _optRow(BuildContext context, List<_Opt> opts) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: opts.map((o) => _buildTile(context, o)).toList());

  Widget _buildTile(BuildContext context, _Opt o) {
    return GestureDetector(
      onTap: o.onTap,
      child: SizedBox(
        width: 70,
        child: Column(children: [
          Container(
            width: 54, height: 54,
            decoration: BoxDecoration(color: o.bgColor, borderRadius: BorderRadius.circular(15)),
            child: Icon(o.icon, size: 26, color: o.iconColor),
          ),
          const SizedBox(height: 6),
          Text(o.label,
            style: TextStyle(fontSize: 11.5, color: context.cl.text, fontWeight: FontWeight.w500),
            textAlign: TextAlign.center),
        ]),
      ),
    );
  }

  Widget _buildGrid(BuildContext context) {
    if (_loading) {
      return Center(child: SizedBox(width: 24, height: 24,
          child: CircularProgressIndicator(color: AppColors.brand, strokeWidth: 2)));
    }
    if (_permDenied) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.photo_library_outlined, size: 36, color: context.cl.textHint),
          const SizedBox(height: 8),
          Text('Allow media access', style: TextStyle(color: context.cl.textSec, fontSize: 13)),
          TextButton(
            onPressed: PhotoManager.openSetting,
            child: const Text('Open Settings', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w700)),
          ),
        ]),
      );
    }
    if (_assets.isEmpty) {
      return Center(child: Text('No recent media', style: TextStyle(color: context.cl.textHint)));
    }
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4, crossAxisSpacing: 2, mainAxisSpacing: 2,
      ),
      itemCount: _assets.length,
      itemBuilder: (_, i) => _MediaTile(asset: _assets[i], onTap: () => widget.onMediaTap(_assets[i])),
    );
  }
}

class _Opt {
  final String label;
  final IconData icon;
  final Color iconColor, bgColor;
  final VoidCallback onTap;
  const _Opt(this.label, this.icon, this.iconColor, this.bgColor, this.onTap);
}

// ── Media thumbnail tile ───────────────────────────────────────────────────────
class _MediaTile extends StatefulWidget {
  final AssetEntity asset;
  final VoidCallback onTap;
  const _MediaTile({required this.asset, required this.onTap});

  @override
  State<_MediaTile> createState() => _MediaTileState();
}

class _MediaTileState extends State<_MediaTile> {
  Uint8List? _thumb;

  @override
  void initState() {
    super.initState();
    widget.asset.thumbnailDataWithSize(const ThumbnailSize(180, 180), quality: 75)
        .then((d) { if (mounted) setState(() => _thumb = d); });
  }

  @override
  Widget build(BuildContext context) {
    final isVideo = widget.asset.type == AssetType.video;
    return GestureDetector(
      onTap: widget.onTap,
      child: Stack(fit: StackFit.expand, children: [
        _thumb != null
            ? Image.memory(_thumb!, fit: BoxFit.cover)
            : Container(color: context.cl.card),
        if (isVideo)
          Positioned(left: 4, bottom: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black54, borderRadius: BorderRadius.circular(4),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.videocam_rounded, size: 11, color: Colors.white),
                const SizedBox(width: 2),
                Text(_fmt(widget.asset.duration),
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
              ]),
            )),
      ]),
    );
  }

  String _fmt(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

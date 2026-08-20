import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX, Volume1, UserX, Tv, Check, MicOff, Mic } from 'lucide-react';
import type { CallFeed } from '../../types/voice-governance';

interface ParticipantContextMenuProps {
  feed: CallFeed;
  x: number;
  y: number;
  volume: number;
  isLocallyMuted?: boolean;
  isLocalAdmin?: boolean;
  onVolumeChange: (newVol: number) => void;
  onToggleLocalMute?: () => void;
  onKickParticipant?: (peerId: string) => void;
  onToggleWatchStream?: (feedId: string) => void;
  onClose: () => void;
}

export const ParticipantContextMenu: React.FC<ParticipantContextMenuProps> = ({
  feed,
  x,
  y,
  volume,
  isLocallyMuted = false,
  isLocalAdmin = false,
  onVolumeChange,
  onToggleLocalMute,
  onKickParticipant,
  onToggleWatchStream,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Adjust positioning to avoid going offscreen
  const menuWidth = 240;
  const menuHeight = 220;
  const clampedX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ top: clampedY, left: clampedX }}
      className="fixed z-[999999] w-64 p-3 rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] shadow-[0_24px_70px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-white space-y-2.5 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Header Info */}
      <div className="px-2 py-1 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="text-xs font-black truncate">{feed.title}</span>
        </div>
        <span className="text-[10px] font-mono text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
          {isLocallyMuted ? 'MUDO' : `${volume}%`}
        </span>
      </div>

      {/* Volume Control Slider (0 - 200%) */}
      {!feed.isLocal && (
        <div className="p-3 space-y-2 bg-black/30 rounded-xl border border-white/8">
          <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
            <span className="flex items-center gap-1.5">
              {isLocallyMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
              ) : volume < 60 ? (
                <Volume1 className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span>Volume Individual</span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={200}
            value={isLocallyMuted ? 0 : volume}
            onChange={(e) => {
              if (isLocallyMuted && onToggleLocalMute) {
                onToggleLocalMute();
              }
              onVolumeChange(Number(e.target.value));
            }}
            className="w-full accent-white cursor-pointer h-1.5"
          />

          <div className="flex justify-between text-[9px] font-bold text-white/40">
            <span onClick={() => onVolumeChange(0)} className="cursor-pointer hover:text-white">
              0%
            </span>
            <span onClick={() => onVolumeChange(100)} className="cursor-pointer hover:text-white">
              100%
            </span>
            <span onClick={() => onVolumeChange(200)} className="cursor-pointer hover:text-white">
              200%
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-1">
        {/* Toggle Local Mute */}
        {!feed.isLocal && onToggleLocalMute && (
          <button
            type="button"
            onClick={() => {
              onToggleLocalMute();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold hover:bg-white/8 transition cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">
              {isLocallyMuted ? (
                <>
                  <Mic className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Desmutar para mim</span>
                </>
              ) : (
                <>
                  <MicOff className="h-3.5 w-3.5 text-rose-400" />
                  <span>Mutar para mim</span>
                </>
              )}
            </span>
          </button>
        )}

        {/* Watch Stream Toggle (On-Demand) */}
        {feed.isScreenLiveAvailable && onToggleWatchStream && (
          <button
            type="button"
            onClick={() => {
              onToggleWatchStream(feed.id as string);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold hover:bg-white/8 transition cursor-pointer text-left"
          >
            <span className="flex items-center gap-2">
              <Tv className="h-3.5 w-3.5 text-white" />
              <span>{feed.isCurrentlyWatched ? 'Parar de Assistir' : 'Assistir Transmissão'}</span>
            </span>
            {feed.isCurrentlyWatched && <Check className="h-3 w-3 text-white" />}
          </button>
        )}

        {/* Admin Kick Action */}
        {isLocalAdmin && !feed.isLocal && onKickParticipant && (
          <div className="pt-1 border-t border-white/8">
            <button
              type="button"
              onClick={() => {
                onKickParticipant(feed.peerId || (feed.id as string));
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition cursor-pointer text-left"
            >
              <UserX className="h-3.5 w-3.5" />
              <span>Expulsar da Chamada</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

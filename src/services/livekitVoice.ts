/**
 * livekitVoice.ts
 * High-performance, low-latency WebRTC SFU client powered by LiveKit Cloud.
 */
import {
  Room,
  RoomEvent,
  Track,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  RemoteParticipant,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
  type VideoCaptureOptions,
} from "livekit-client";
import { apiUrl } from "./api";
import { supabase } from "./supabase";

export interface LiveKitTokenResponse {
  token: string;
  serverUrl: string;
}

/**
 * Obtém token JWT assinado para ingressar na sala do LiveKit SFU
 */
export const fetchLiveKitToken = async (
  roomName: string,
  identity: string,
  name?: string,
  metadata?: any,
): Promise<LiveKitTokenResponse> => {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl("/api/voice/livekit-token"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomName: String(roomName).trim(),
      identity: String(identity).trim(),
      name: String(name || identity).trim(),
      metadata,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao obter token do LiveKit (${response.status})`);
  }

  return response.json();
};

export {
  Room,
  RoomEvent,
  Track,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  RemoteParticipant,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
};

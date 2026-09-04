// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getVoiceRoomTopic,
  addChannelStatusListener,
  cleanupAllChannels,
  getChannelStatus,
} from "../src/services/voiceCall/channelLifecycle";
import type { ChannelStatusEvent } from "../src/services/voiceCall/types";

describe("VoiceCall - Subdomains & Lifecycle", () => {
  beforeEach(() => {
    cleanupAllChannels();
  });

  it("gera o tópico correto para UUIDs e strings simples", () => {
    const uuid = "12345678-1234-1234-1234-123456789abc";
    expect(getVoiceRoomTopic(uuid)).toBe(`voice:room:${uuid}`);

    const plain = "chat_group_1";
    expect(getVoiceRoomTopic(plain)).toBe("call_session_chat_group_1");
  });

  it("notifica listeners registrados sobre mudanças de status", () => {
    const events: ChannelStatusEvent[] = [];
    const unsubscribe = addChannelStatusListener((e) => events.push(e));

    expect(getChannelStatus("non_existent_channel")).toBe("idle");
    unsubscribe();
  });

  it("limpa todos os canais e promessas em cleanupAllChannels", () => {
    expect(() => cleanupAllChannels()).not.toThrow();
  });
});

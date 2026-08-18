/**
 * PeerAudioNode - Web Audio API Pipeline com Soft Limiter
 * Permite ganho de 0% até 200% sem distorção digital destrutiva (hard clipping)
 * utilizando DynamicsCompressorNode como limitador de áudio profissional.
 */
export class PeerAudioNode {
  private ctx: AudioContext;
  private source: MediaStreamAudioSourceNode;
  private gainNode: GainNode;
  private compressor: DynamicsCompressorNode;
  private isDestroyed = false;

  constructor(ctx: AudioContext, stream: MediaStream, initialVolume = 100) {
    this.ctx = ctx;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.gainNode = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();

    // Configuração de Soft Limiter
    // Threshold em -3dB para dar folga de headroom antes do teto digital 0dBFS
    this.compressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(6, this.ctx.currentTime); // Transição suave
    this.compressor.ratio.setValueAtTime(14, this.ctx.currentTime); // Razão de compressão alta (Limiter)
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime); // 3ms de ataque rápido
    this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime); // 120ms de liberação

    // Conexão: Source -> Gain (0-200%) -> Compressor -> Destination
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.setVolume(initialVolume);
  }

  /**
   * Ajusta o volume com rampa linear/exponencial suave de 15ms para evitar estalos (clicks)
   * @param volumePercent Percentual de 0 a 200
   */
  public setVolume(volumePercent: number): void {
    if (this.isDestroyed || this.ctx.state === 'closed') return;
    const targetGain = Math.max(0, Math.min(2.0, volumePercent / 100));
    try {
      this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.015);
    } catch {
      this.gainNode.gain.value = targetGain;
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    try {
      this.source.disconnect();
      this.gainNode.disconnect();
      this.compressor.disconnect();
    } catch {
      // ignore on teardown
    }
  }
}

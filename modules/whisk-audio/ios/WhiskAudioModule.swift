import AVFoundation
import ExpoModulesCore

private final class WhiskAudioError: Exception {
  private let errorCode: String
  private let errorReason: String

  init(code: String, reason: String) {
    self.errorCode = code
    self.errorReason = reason
    super.init()
  }

  override var code: String {
    errorCode
  }

  override var reason: String {
    errorReason
  }
}

public class WhiskAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WhiskAudio")

    AsyncFunction("extractPcmWav") { (inputUri: String, outputUri: String) async throws -> [String: Any] in
      let inputURL = fileURL(from: inputUri)
      let outputURL = fileURL(from: outputUri)
      var reader: AVAssetReader?

      do {
        guard FileManager.default.fileExists(atPath: inputURL.path) else {
          throw WhiskAudioError(
            code: "ERR_FILE_NOT_FOUND",
            reason: "Input file not found: \(inputURL.path)"
          )
        }

        let asset = AVURLAsset(url: inputURL)
        guard let audioTrack = try await asset.loadTracks(withMediaType: .audio).first else {
          throw WhiskAudioError(
            code: "ERR_NO_AUDIO_TRACK",
            reason: "The input video has no audio track"
          )
        }

        reader = try AVAssetReader(asset: asset)
        guard let reader else {
          throw WhiskAudioError(code: "ERR_DECODE_FAILED", reason: "Unable to create audio reader")
        }
        let output = AVAssetReaderTrackOutput(
          track: audioTrack,
          outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false
          ]
        )
        guard reader.canAdd(output) else {
          throw WhiskAudioError(
            code: "ERR_DECODE_FAILED",
            reason: "Unable to configure audio reader"
          )
        }
        reader.add(output)
        guard reader.startReading() else {
          throw WhiskAudioError(
            code: "ERR_DECODE_FAILED",
            reason: reader.error?.localizedDescription ?? "Unable to start audio reader"
          )
        }

        FileManager.default.createFile(atPath: outputURL.path, contents: nil)
        let file = try FileHandle(forWritingTo: outputURL)
        defer { try? file.close() }
        try file.write(contentsOf: wavHeader(dataBytes: 0))

        var dataBytes: UInt32 = 0
        while true {
          let hasSample = try autoreleasepool {
            guard let sampleBuffer = output.copyNextSampleBuffer() else { return false }
            guard let dataBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return true }
            let length = CMBlockBufferGetDataLength(dataBuffer)
            if length == 0 { return true }
            var pcm = Data(count: length)
            let status = pcm.withUnsafeMutableBytes { buffer in
              CMBlockBufferCopyDataBytes(
                dataBuffer,
                atOffset: 0,
                dataLength: length,
                destination: buffer.baseAddress!
              )
            }
            guard status == kCMBlockBufferNoErr else {
              throw WhiskAudioError(
                code: "ERR_DECODE_FAILED",
                reason: "Unable to read decoded audio"
              )
            }
            try file.write(contentsOf: pcm)
            dataBytes += UInt32(length)
            return true
          }
          if !hasSample { break }
        }

        if reader.status == .failed {
          throw WhiskAudioError(
            code: "ERR_DECODE_FAILED",
            reason: reader.error?.localizedDescription ?? "Audio decoding failed"
          )
        }
        guard dataBytes > 0 else {
          throw WhiskAudioError(
            code: "ERR_NO_AUDIO_TRACK",
            reason: "The input video contains no decodable audio"
          )
        }

        try file.seek(toOffset: 0)
        try file.write(contentsOf: wavHeader(dataBytes: dataBytes))

        return [
          "uri": outputUri,
          "durationSeconds": Double(dataBytes) / 32_000.0,
          "sampleRate": 16_000,
          "channels": 1,
          "bytes": Int(dataBytes)
        ]
      } catch let error as WhiskAudioError {
        reader?.cancelReading()
        try? FileManager.default.removeItem(at: outputURL)
        throw error
      } catch {
        reader?.cancelReading()
        try? FileManager.default.removeItem(at: outputURL)
        throw WhiskAudioError(code: "ERR_DECODE_FAILED", reason: error.localizedDescription)
      }
    }
  }
}

private func fileURL(from value: String) -> URL {
  if value.contains("://"), let url = URL(string: value) {
    return url
  }
  return URL(fileURLWithPath: value)
}

private func wavHeader(dataBytes: UInt32) -> Data {
  var header = Data("RIFF".utf8)
  appendUInt32(36 + dataBytes, to: &header)
  header.append(contentsOf: Data("WAVEfmt ".utf8))
  appendUInt32(16, to: &header)
  appendUInt16(1, to: &header)
  appendUInt16(1, to: &header)
  appendUInt32(16_000, to: &header)
  appendUInt32(32_000, to: &header)
  appendUInt16(2, to: &header)
  appendUInt16(16, to: &header)
  header.append(contentsOf: Data("data".utf8))
  appendUInt32(dataBytes, to: &header)
  return header
}

private func appendUInt16(_ value: UInt16, to data: inout Data) {
  data.append(UInt8(value & 0xff))
  data.append(UInt8((value >> 8) & 0xff))
}

private func appendUInt32(_ value: UInt32, to data: inout Data) {
  data.append(UInt8(value & 0xff))
  data.append(UInt8((value >> 8) & 0xff))
  data.append(UInt8((value >> 16) & 0xff))
  data.append(UInt8((value >> 24) & 0xff))
}

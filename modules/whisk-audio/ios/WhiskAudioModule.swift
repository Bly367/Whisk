import AVFoundation
import ExpoModulesCore

private struct WhiskAudioError: CodedError {
  let code: String
  let description: String

  init(_ code: String, _ description: String) {
    self.code = code
    self.description = description
  }
}

public class WhiskAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WhiskAudio")

    AsyncFunction("extractPcmWav") { (inputUri: String, outputUri: String) -> [String: Any] in
      let inputURL = fileURL(from: inputUri)
      let outputURL = fileURL(from: outputUri)

      do {
        guard FileManager.default.fileExists(atPath: inputURL.path) else {
          throw WhiskAudioError("ERR_FILE_NOT_FOUND", "Input file not found: \(inputURL.path)")
        }

        let asset = AVURLAsset(url: inputURL)
        guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
          throw WhiskAudioError("ERR_NO_AUDIO_TRACK", "The input video has no audio track")
        }

        let reader = try AVAssetReader(asset: asset)
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
          throw WhiskAudioError("ERR_DECODE_FAILED", "Unable to configure audio reader")
        }
        reader.add(output)
        guard reader.startReading() else {
          throw WhiskAudioError(
            "ERR_DECODE_FAILED",
            reader.error?.localizedDescription ?? "Unable to start audio reader"
          )
        }

        FileManager.default.createFile(atPath: outputURL.path, contents: nil)
        let file = try FileHandle(forWritingTo: outputURL)
        defer { try? file.close() }
        try file.write(contentsOf: wavHeader(dataBytes: 0))

        var dataBytes: UInt32 = 0
        while let sampleBuffer = output.copyNextSampleBuffer() {
          guard let dataBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
          let length = CMBlockBufferGetDataLength(dataBuffer)
          if length == 0 { continue }
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
            throw WhiskAudioError("ERR_DECODE_FAILED", "Unable to read decoded audio")
          }
          try file.write(contentsOf: pcm)
          dataBytes += UInt32(length)
        }

        if reader.status == .failed {
          throw WhiskAudioError(
            "ERR_DECODE_FAILED",
            reader.error?.localizedDescription ?? "Audio decoding failed"
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
        try? FileManager.default.removeItem(at: outputURL)
        throw error
      } catch {
        try? FileManager.default.removeItem(at: outputURL)
        throw WhiskAudioError("ERR_DECODE_FAILED", error.localizedDescription)
      }
    }
  }
}

private func fileURL(from value: String) -> URL {
  if let url = URL(string: value), url.isFileURL {
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

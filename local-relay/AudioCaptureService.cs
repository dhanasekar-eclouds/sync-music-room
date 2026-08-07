using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using NAudio.Wave;

namespace SyncAudioRelay;

public class AudioSessionInfo
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string ProcessName { get; set; }
    public int ProcessId { get; set; }
    public bool IsActive { get; set; }
}

public class AudioCaptureService : IDisposable
{
    private WasapiLoopbackCapture _capture;
    private readonly ConcurrentQueue<byte[]> _bufferQueue = new();
    private volatile bool _capturing;
    private Thread _processThread;
    private readonly int _targetSampleRate = 44100;

    public event Action<float[], int> OnAudioData;
    public event Action<string> OnCaptureStarted;
    public event Action<string> OnCaptureStopped;
    public event Action<string> OnSourceClosed;

    public string SelectedSessionId { get; private set; }
    public string SelectedSessionName { get; private set; }
    private int _monitoredProcessId;
    private Timer _processMonitorTimer;

    private static readonly HashSet<string> _systemProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "svchost", "rundll32", "dllhost", "conhost", "csrss", "lsass",
        "services", "smss", "spoolsv", "taskhost", "taskhostw",
        "winlogon", "system", "idle", "systray", "searchindexer",
        "sihost", "runtimebroker", "backgroundtaskhost",
        "com surrogate", "dcomlaunch", "msmpeng",
    };

    public List<AudioSessionInfo> GetAudioSessions()
    {
        var sessions = new List<AudioSessionInfo>();
        try
        {
            var enumerator = new MMDeviceEnumerator();
            var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            var sessionManager = device.AudioSessionManager;

            if (sessionManager == null) return sessions;

            var sessionCount = sessionManager.Sessions.Count;
            for (int i = 0; i < sessionCount; i++)
            {
                try
                {
                    var session = sessionManager.Sessions[i];

                    if (session.State == AudioSessionState.AudioSessionStateExpired)
                        continue;

                    var name = session.DisplayName?.Trim();
                    if (string.IsNullOrEmpty(name))
                        name = session.GetSessionIdentifier?.Split('#')?.LastOrDefault() ?? "";

                    var pid = (int)session.GetProcessID;
                    string procName = "";

                    try
                    {
                        var proc = Process.GetProcessById(pid);
                        procName = proc.ProcessName;
                        var title = proc.MainWindowTitle?.Trim() ?? "";

                        if (string.IsNullOrEmpty(name))
                            name = title;
                        if (string.IsNullOrEmpty(name))
                            name = procName;
                    }
                    catch
                    {
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(name))
                        name = procName;

                    if (_systemProcesses.Contains(procName))
                        continue;

                    if (name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ||
                        name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                        name.StartsWith("\\", StringComparison.Ordinal) ||
                        name.Contains("\\"))
                        continue;

                    sessions.Add(new AudioSessionInfo
                    {
                        Id = $"{pid}",
                        Name = name,
                        ProcessName = procName,
                        ProcessId = pid,
                        IsActive = true,
                    });
                }
                catch { }
            }
        }
        catch { }

        return sessions
            .GroupBy(s => s.ProcessId)
            .Select(g => g.First())
            .ToList();
    }

    public void StartCapture(string sessionId)
    {
        if (_capturing) StopCapture();

        SelectedSessionId = sessionId;
        var sessions = GetAudioSessions();
        var session = sessions.FirstOrDefault(s => s.Id == sessionId);
        SelectedSessionName = session?.Name ?? "Unknown";
        _monitoredProcessId = session?.ProcessId ?? 0;

        _capturing = true;
        _capture = new WasapiLoopbackCapture();
        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += (s, e) => { };
        _capture.StartRecording();

        _processMonitorTimer = new Timer(_ =>
        {
            if (_monitoredProcessId > 0)
            {
                try
                {
                    var proc = Process.GetProcessById(_monitoredProcessId);
                    if (proc.HasExited)
                    {
                        OnSourceClosed?.Invoke(SelectedSessionName);
                        StopCapture();
                    }
                }
                catch (ArgumentException)
                {
                    OnSourceClosed?.Invoke(SelectedSessionName);
                    StopCapture();
                }
            }
        }, null, 0, 2000);

        _processThread = new Thread(ProcessBuffer) { IsBackground = true, Name = "AudioProc" };
        _processThread.Start();

        OnCaptureStarted?.Invoke(SelectedSessionName);
    }

    public void StopCapture()
    {
        _capturing = false;
        _processMonitorTimer?.Dispose();
        _processMonitorTimer = null;

        try { _capture?.StopRecording(); } catch { }
        _capture?.Dispose();
        _capture = null;

        while (_bufferQueue.TryDequeue(out _)) { }

        if (!string.IsNullOrEmpty(SelectedSessionName))
            OnCaptureStopped?.Invoke(SelectedSessionName);

        SelectedSessionId = null;
        SelectedSessionName = null;
        _monitoredProcessId = 0;
    }

    public bool IsCapturing => _capturing;

    private void OnDataAvailable(object sender, WaveInEventArgs e)
    {
        if (_capturing && e.BytesRecorded > 0)
        {
            var buffer = new byte[e.BytesRecorded];
            Buffer.BlockCopy(e.Buffer, 0, buffer, 0, e.BytesRecorded);
            _bufferQueue.Enqueue(buffer);
        }
    }

    private void ProcessBuffer()
    {
        var inputRate = _capture?.WaveFormat.SampleRate ?? 48000;
        var channels = _capture?.WaveFormat.Channels ?? 2;
        var bitsPerSample = _capture?.WaveFormat.BitsPerSample ?? 32;

        while (_capturing)
        {
            if (_bufferQueue.TryDequeue(out var buffer))
            {
                var floats = BytesToFloats(buffer, bitsPerSample);

                var mono = ConvertToMono(floats, channels);
                var resampled = Resample(mono, inputRate, _targetSampleRate);

                OnAudioData?.Invoke(resampled, _targetSampleRate);
            }
            else
            {
                Thread.Sleep(1);
            }
        }
    }

    private static float[] BytesToFloats(byte[] buffer, int bitsPerSample)
    {
        // WASAPI shared-mode loopback nearly always reports a 32-bit IEEE float mix
        // format on modern Windows, not 16-bit PCM. Reading it as int16 pairs would
        // misinterpret every sample as noise, so branch on the device's actual format
        // instead of assuming one.
        if (bitsPerSample == 32)
        {
            var count = buffer.Length / 4;
            var floats = new float[count];
            for (int i = 0; i < count; i++)
                floats[i] = BitConverter.ToSingle(buffer, i * 4);
            return floats;
        }
        else
        {
            var count = buffer.Length / 2;
            var floats = new float[count];
            for (int i = 0; i < count; i++)
                floats[i] = BitConverter.ToInt16(buffer, i * 2) / 32768f;
            return floats;
        }
    }

    private float[] ConvertToMono(float[] input, int channels)
    {
        if (channels == 1) return input;
        var frameCount = input.Length / channels;
        var mono = new float[frameCount];
        for (int i = 0; i < frameCount; i++)
        {
            float sum = 0;
            for (int ch = 0; ch < channels; ch++)
                sum += input[i * channels + ch];
            mono[i] = sum / channels;
        }
        return mono;
    }

    private float[] Resample(float[] input, int fromRate, int toRate)
    {
        if (fromRate == toRate) return input;
        var ratio = (double)toRate / fromRate;
        var newLen = (int)(input.Length * ratio);
        var result = new float[newLen];
        for (int i = 0; i < newLen; i++)
        {
            var src = i / ratio;
            var idx = (int)src;
            var frac = src - idx;
            if (idx + 1 < input.Length)
                result[i] = (float)(input[idx] * (1 - frac) + input[idx + 1] * frac);
            else
                result[i] = input[Math.Min(idx, input.Length - 1)];
        }
        return result;
    }

    public void Dispose()
    {
        StopCapture();
    }
}
